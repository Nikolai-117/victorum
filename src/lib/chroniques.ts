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

export interface Evenement {
  id: string;
  slug: string;
  chronique: string; // slug de la chronique
  titre: string;
  an: number;
  anFin?: number;
  resume: string;
  type: string; // libellé libre : Bataille, Fondation, Catastrophe…
  couleur: string;
  image?: string;
  creeLe: string;
  modifieLe: string;
}

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
  couleur: '#df7f83',
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
    couleur: couleurValide(brut.couleur, existant?.couleur ?? '#df7f83'),
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

  const evenement: Evenement = {
    id,
    slug: slugLibre(titre, (s) => data.evenements.some((e) => e.slug === s && e.id !== id), 'evenement'),
    chronique,
    titre,
    an,
    ...(anFin !== undefined && anFin !== an ? { anFin } : {}),
    resume: texte(brut.resume, 240),
    type: texte(brut.type, 40),
    couleur: couleurValide(brut.couleur, existant?.couleur ?? '#df7f83'),
    image: imageValide(brut.image),
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
