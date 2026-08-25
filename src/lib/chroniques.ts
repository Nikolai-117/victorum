/**
 * Les chroniques du monde : des chronologies que Romain compose lui-même.
 *
 * Une CHRONIQUE est une frise : celle du monde (intégrée), ou une liée à un
 * royaume, ou une libre. Un ÉVÉNEMENT s'y pose à une date, avec un titre, un
 * type, une image, un texte. Comme le codex, la métadonnée vit ici ; la mise
 * en page et le corps d'un événement vivent dans le stockage des pages, sous
 * l'identifiant — un renommage ne perd donc rien.
 *
 * Rien n'est écrit d'avance : le monde a sa frise, vide, et il la remplit.
 */

import { stockage, clePage } from './stockage';

export interface Chronique {
  id: string;
  slug: string;
  titre: string;
  /** 'monde' (intégrée), `etat:<id>` (liée à un royaume), ou 'libre'. */
  portee: string;
  couleur: string;
  intro?: string;
  image?: string;
  fixe?: boolean;
  ordre: number;
}

export interface Citation {
  texte: string;
  source: string;
}

export interface Evenement {
  id: string;
  slug: string;
  chronique: string; // slug de la chronique
  titre: string;
  an: number;
  anFin?: number;
  resume: string;
  /** Clé de catégorie (icône + couleur par défaut) ; libellé libre toléré. */
  categorie: string;
  /** 'atteste' | 'legende' | 'conteste' : l'Histoire, la légende, le contesté. */
  statut: string;
  couleur: string;
  /** Nom d'âge (« Âge des Cendres ») : regroupe la frise en bandes. */
  ere?: string;
  lieu?: string;
  acteurs?: string;
  consequence?: string;
  citation?: Citation;
  tags?: string[];
  /** Lien facultatif : une fiche, une source, une page. */
  lien?: string;
  image?: string;
  /** Ancien champ de type libre, conservé en lecture pour ne rien perdre. */
  type?: string;
  creeLe: string;
  modifieLe: string;
}

/**
 * Les natures d'événement : du vocabulaire, pas du lore. Chacune porte une
 * icône et une teinte par défaut, à la manière des doctrines. Romain peut en
 * saisir d'autres — une catégorie inconnue retombe sur l'icône neutre.
 */
export interface CategorieEvt {
  cle: string;
  label: string;
  couleur: string;
  /** Contenu interne d'un <svg> 24×24, trait courant. */
  icone: string;
}

export const CATEGORIES_EVT: CategorieEvt[] = [
  { cle: 'fondation', label: 'Fondation', couleur: '#c0895a', icone: '<path d="M4 21h16M5 21V9l7-4 7 4v12M9 21v-6h6v6"/>' },
  { cle: 'guerre', label: 'Guerre', couleur: '#e5675f', icone: '<path d="M14.5 4.5l5 5-8 8-2 .5.5-2 8-8-4-4z"/><path d="M5 21l4-4M3 14l3 3M14 3l3 3"/>' },
  { cle: 'dynastie', label: 'Dynastie', couleur: '#d5a044', icone: '<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8z"/>' },
  { cle: 'magie', label: 'Magie', couleur: '#b06e96', icone: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3z"/><path d="M18 15l.7 1.8L20.5 17l-1.8.6L18 19l-.7-1.4L15.5 17l1.8-.2L18 15z"/>' },
  { cle: 'cataclysme', label: 'Cataclysme', couleur: '#d65a2e', icone: '<path d="M13 2L5 13h5l-1 9 8-12h-5l1-8z"/>' },
  { cle: 'pacte', label: 'Pacte', couleur: '#7e9b6e', icone: '<path d="M4 6h10l-1.5 2H4zM4 6v13l6-3 6 3M14 6l6 2v11M8 11h6M8 14h4"/>' },
];

const ICONE_NEUTRE = '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>';

export const categorieEvt = (cle: string | undefined): CategorieEvt =>
  CATEGORIES_EVT.find((c) => c.cle === cle) ?? {
    cle: cle || 'autre',
    label: cle ? cle.charAt(0).toUpperCase() + cle.slice(1) : 'Événement',
    couleur: '#b24634',
    icone: ICONE_NEUTRE,
  };

export interface StatutEvt {
  cle: string;
  label: string;
  couleur: string;
}

export const STATUTS_EVT: StatutEvt[] = [
  { cle: 'atteste', label: 'Attesté', couleur: '#6f8f6a' },
  { cle: 'legende', label: 'Légende', couleur: '#c6982f' },
  { cle: 'conteste', label: 'Contesté', couleur: '#9a8c82' },
];

export const statutEvt = (cle: string | undefined): StatutEvt =>
  STATUTS_EVT.find((s) => s.cle === cle) ?? STATUTS_EVT[0];

export interface Chroniques {
  chroniques: Chronique[];
  evenements: Evenement[];
}

/** La frise du monde existe toujours : c'est la grande chronologie. */
export const CHRONIQUE_MONDE: Chronique = {
  id: 'monde',
  slug: 'monde',
  titre: 'Chronologie du monde',
  portee: 'monde',
  couleur: '#b24634',
  fixe: true,
  ordre: 0,
};

const CLE = 'chroniques';

/* --------------------------------------------------------------- lecture */

export async function lireChroniques(locals: App.Locals): Promise<Chroniques> {
  const espace = stockage(locals);
  const vide: Chroniques = { chroniques: [], evenements: [] };
  if (!espace) return vide;
  try {
    const brut = await espace.get<Chroniques>(CLE, 'json');
    if (!brut) return vide;
    return {
      chroniques: Array.isArray(brut.chroniques) ? brut.chroniques : [],
      evenements: Array.isArray(brut.evenements) ? brut.evenements : [],
    };
  } catch {
    return vide;
  }
}

/** Toutes les chroniques : le monde d'abord, puis les siennes. */
export function chroniquesDe(data: Chroniques): Chronique[] {
  const parSlug = new Map<string, Chronique>();
  parSlug.set(CHRONIQUE_MONDE.slug, { ...CHRONIQUE_MONDE });
  let rang = 1;
  for (const c of data.chroniques) {
    const monde = parSlug.get(c.slug);
    if (monde && monde.fixe) {
      // La frise du monde ne se renomme pas ; elle s'enrichit.
      if (c.couleur) monde.couleur = c.couleur;
      if (c.intro) monde.intro = c.intro;
      if (c.image) monde.image = c.image;
    } else {
      parSlug.set(c.slug, { ...c, fixe: false, ordre: c.ordre ?? rang++ });
    }
  }
  return [...parSlug.values()].sort((a, b) => a.ordre - b.ordre);
}

export const chroniqueParSlug = (data: Chroniques, slug: string): Chronique | null =>
  chroniquesDe(data).find((c) => c.slug === slug) ?? null;

/** Les événements d'une chronique, du plus ancien au plus récent. */
export const evenementsDe = (data: Chroniques, chroniqueSlug: string): Evenement[] =>
  data.evenements
    .filter((e) => e.chronique === chroniqueSlug)
    .sort((a, b) => a.an - b.an || a.titre.localeCompare(b.titre, 'fr'));

export const evenementParSlug = (data: Chroniques, slug: string): Evenement | null =>
  data.evenements.find((e) => e.slug === slug) ?? null;

/* ------------------------------------------------------------ écriture */

const slugifier = (nom: string): string =>
  nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function slugLibre(base: string, pris: (s: string) => boolean, secours: string): string {
  let slug = slugifier(base) || secours;
  if (!pris(slug)) return slug;
  let n = 2;
  while (pris(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const couleurValide = (brut: unknown, secours: string) =>
  /^#[0-9a-f]{6}$/i.test(String(brut)) ? String(brut) : secours;

function imageValide(brut: unknown): string {
  const v = texte(brut, 500);
  return /^(https?:\/\/|\/)[^\s"'<>]+$/i.test(v) ? v : '';
}

/** Une clé de catégorie : slug court, catalogue ou libre. */
const categorieValide = (brut: unknown): string =>
  texte(brut, 30)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'autre';

const statutValide = (brut: unknown): string =>
  STATUTS_EVT.some((s) => s.cle === brut) ? String(brut) : 'atteste';

/** Une liste de mots-clés : depuis un tableau ou une saisie séparée de virgules. */
function tagsValides(brut: unknown): string[] {
  const source = Array.isArray(brut) ? brut : texte(brut, 400).split(',');
  const vus = new Set<string>();
  const out: string[] = [];
  for (const t of source) {
    const v = texte(t, 40);
    if (v && !vus.has(v.toLowerCase())) {
      vus.add(v.toLowerCase());
      out.push(v);
    }
    if (out.length >= 10) break;
  }
  return out;
}

function citationValide(brut: unknown): Citation | undefined {
  const src = brut as { texte?: unknown; source?: unknown } | null;
  const t = texte(src?.texte, 300);
  if (!t) return undefined;
  return { texte: t, source: texte(src?.source, 120) };
}

/** La portée : le monde, un royaume (`etat:<id>`), ou libre. */
function porteeValide(brut: unknown): string {
  const v = texte(brut, 40);
  if (v === 'monde' || v === 'libre') return v;
  return /^etat:\d+$/.test(v) ? v : 'libre';
}

const identifiant = () => crypto.randomUUID().slice(0, 8);
const nombre = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

async function ecrire(locals: App.Locals, data: Chroniques): Promise<Chroniques> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');
  await espace.put(CLE, JSON.stringify(data));
  return data;
}

const chroniqueConnue = (data: Chroniques, slug: string) =>
  slug === CHRONIQUE_MONDE.slug || data.chroniques.some((c) => c.slug === slug);

/** Crée ou met à jour une chronique. Le monde ne reçoit que des enrichissements. */
export async function enregistrerChronique(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Chroniques> {
  const data = await lireChroniques(locals);
  const slugDemande = typeof brut.slug === 'string' ? brut.slug : '';

  if (slugDemande === CHRONIQUE_MONDE.slug) {
    const enrich: Partial<Chronique> & { slug: string } = { slug: 'monde' };
    const couleur = couleurValide(brut.couleur, CHRONIQUE_MONDE.couleur);
    const intro = texte(brut.intro, 400);
    const image = imageValide(brut.image);
    if (couleur !== CHRONIQUE_MONDE.couleur) enrich.couleur = couleur;
    if (intro) enrich.intro = intro;
    if (image) enrich.image = image;
    const autres = data.chroniques.filter((c) => c.slug !== 'monde');
    const aQuelqueChose = enrich.couleur || enrich.intro || enrich.image;
    data.chroniques = aQuelqueChose ? [...autres, enrich as Chronique] : autres;
    return ecrire(locals, data);
  }

  const nom = texte(brut.titre, 80);
  if (!nom) throw new Error('Une chronique a besoin d’un titre.');
  const id = typeof brut.id === 'string' && brut.id ? brut.id : identifiant();
  const existant = data.chroniques.find((c) => c.slug === slugDemande || c.id === id);

  const chronique: Chronique = {
    id: existant?.id ?? id,
    slug: existant?.slug ?? slugLibre(nom, (s) => chroniqueConnue(data, s), 'chronique'),
    titre: nom,
    portee: porteeValide(brut.portee ?? existant?.portee),
    couleur: couleurValide(brut.couleur, existant?.couleur ?? '#b24634'),
    intro: texte(brut.intro, 400),
    image: imageValide(brut.image),
    fixe: false,
    ordre: existant?.ordre ?? CHRONIQUE_MONDE.ordre + 1 + data.chroniques.length,
  };

  data.chroniques = existant
    ? data.chroniques.map((c) => (c.slug === existant.slug ? chronique : c))
    : [...data.chroniques, chronique];
  return ecrire(locals, data);
}

/** Retire une chronique (jamais le monde), ses événements et leurs pages. */
export async function supprimerChronique(locals: App.Locals, slug: string): Promise<Chroniques> {
  if (slug === CHRONIQUE_MONDE.slug) throw new Error('La chronologie du monde ne se supprime pas.');
  const data = await lireChroniques(locals);
  const espace = stockage(locals);
  const partants = data.evenements.filter((e) => e.chronique === slug);
  if (espace) {
    await espace.delete(clePage('chronique', `c-${slug}`));
    for (const e of partants) await espace.delete(clePage('chronique', e.id));
  }
  data.chroniques = data.chroniques.filter((c) => c.slug !== slug);
  data.evenements = data.evenements.filter((e) => e.chronique !== slug);
  return ecrire(locals, data);
}

/** Crée ou met à jour un événement. */
export async function enregistrerEvenement(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Chroniques> {
  const data = await lireChroniques(locals);
  const titre = texte(brut.titre, 120);
  const chronique = texte(brut.chronique, 60);
  if (!titre) throw new Error('Un événement a besoin d’un titre.');
  if (!chroniqueConnue(data, chronique)) throw new Error('Chronique inconnue.');

  const an = nombre(brut.an);
  if (an === undefined) throw new Error('Un événement a besoin d’une année.');
  const anFin = nombre(brut.anFin);

  const id = typeof brut.id === 'string' && brut.id ? brut.id : identifiant();
  const existant = data.evenements.find((e) => e.id === id);

  // La catégorie donne l'icône, et sa teinte sert de couleur par défaut : une
  // couleur explicite l'emporte toujours, sinon on suit la nature choisie.
  const categorie = categorieValide(brut.categorie ?? existant?.categorie);
  const couleurCat = categorieEvt(categorie).couleur;
  const secoursCouleur = existant?.couleur ?? couleurCat;

  // Fusion sûre : un champ absent de la requête garde sa valeur ; un champ
  // fourni vide l'efface. Un éditeur partiel (la page d'un événement) ne perd
  // donc jamais les champs riches qu'il n'affiche pas.
  const present = (cle: string) => brut[cle] !== undefined;
  const resume = present('resume') ? texte(brut.resume, 600) : existant?.resume ?? '';
  const ere = present('ere') ? texte(brut.ere, 60) : existant?.ere ?? '';
  const lieu = present('lieu') ? texte(brut.lieu, 120) : existant?.lieu ?? '';
  const acteurs = present('acteurs') ? texte(brut.acteurs, 160) : existant?.acteurs ?? '';
  const consequence = present('consequence') ? texte(brut.consequence, 400) : existant?.consequence ?? '';
  const lien = present('lien') ? imageValide(brut.lien) : existant?.lien ?? '';
  const citation = present('citation') ? citationValide(brut.citation) : existant?.citation;
  const tags = present('tags') ? tagsValides(brut.tags) : existant?.tags ?? [];
  const image = present('image') ? imageValide(brut.image) : existant?.image ?? '';

  const evenement: Evenement = {
    id,
    slug: slugLibre(titre, (s) => data.evenements.some((e) => e.slug === s && e.id !== id), 'evenement'),
    chronique,
    titre,
    an,
    ...(anFin !== undefined && anFin !== an ? { anFin } : {}),
    resume,
    categorie,
    statut: statutValide(brut.statut ?? existant?.statut),
    couleur: couleurValide(brut.couleur, secoursCouleur),
    ...(ere ? { ere } : {}),
    ...(lieu ? { lieu } : {}),
    ...(acteurs ? { acteurs } : {}),
    ...(consequence ? { consequence } : {}),
    ...(citation ? { citation } : {}),
    ...(tags.length ? { tags } : {}),
    ...(lien ? { lien } : {}),
    ...(image ? { image } : {}),
    creeLe: existant?.creeLe ?? new Date().toISOString(),
    modifieLe: new Date().toISOString(),
  };

  data.evenements = existant
    ? data.evenements.map((e) => (e.id === id ? evenement : e))
    : [...data.evenements, evenement];
  return ecrire(locals, data);
}

export async function supprimerEvenement(locals: App.Locals, id: string): Promise<Chroniques> {
  const data = await lireChroniques(locals);
  const espace = stockage(locals);
  if (espace) await espace.delete(clePage('chronique', id));
  data.evenements = data.evenements.filter((e) => e.id !== id);
  return ecrire(locals, data);
}
