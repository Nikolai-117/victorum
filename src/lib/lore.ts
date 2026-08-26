/**
 * Le lore du monde : le codex de Victorum.
 *
 * Là où les fiches d'entités partent des faits de la carte, le lore part de
 * rien : ce sont les articles que Romain écrit lui-même, rangés par catégorie
 * — bestiaire, faune, géographie, religion, culture, magie, science, et toutes
 * celles qu'il ajoute. Le module ne fournit que les étagères ; les livres qui
 * s'y posent sont les siens.
 *
 * Comme le reste des données écrites depuis le site, tout tient dans une seule
 * clé KV, lue en entier et réécrite d'un bloc.
 */

import { stockage, clePage } from './stockage';

export interface Categorie {
  slug: string;
  nom: string;
  symbole: string;
  /** Une phrase, écrite par Romain, sur ce que la catégorie rassemble. */
  intro?: string;
  /** L'image de couverture, montrée sur la porte du codex. URL ou /illustrations/…. */
  image?: string;
  /** Les catégories intégrées ne se suppriment pas ; les siennes, si. */
  fixe?: boolean;
  ordre: number;
  /** La reliure du volume sur l'étagère : une clé de la famille de cuirs. */
  reliure?: string;
  /** Le fer doré frappé sur le dos : une clé du catalogue de pictogrammes. */
  fer?: string;
}

/**
 * Les cuirs des reliures.
 *
 * Une famille tonale — jamais un arc-en-ciel : l'étagère doit se lire comme
 * une bibliothèque, pas comme un nuancier. Les teintes sont fixes, seule leur
 * répartition change.
 */
export const RELIURES: Record<string, string> = {
  l1: '#5c4a3d', l2: '#4a4038', l3: '#6b5b4a',
  l4: '#5e4b4e', l5: '#57503f', l6: '#6e5a52',
};

/** Les fers dorés que l'on peut frapper sur un dos de volume. */
export const FERS: Record<string, string> = {
  beast: '<path d="M5 13c0-4 3-7 7-7s7 3 7 7-3 6-7 6-7-2-7-6z"/><path d="M8 6C7 4 7 2 7 2s2 1 3 3M16 6c1-2 1-4 1-4s-2 1-3 3"/>',
  crown: '<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8z"/>',
  person: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6"/>',
  faith: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.3L12 15l-1.8-4.7L5.5 9l4.7-1.3L12 3z"/><path d="M12 15v6M9 21h6"/>',
  magic: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/><circle cx="12" cy="12" r="3"/>',
  map: '<path d="M9 20l-6-2V4l6 2m0 14l6-3m-6 3V6m6 11l6 2V6l-6-2m0 11V4M9 6l6-2"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/>',
  ship: '<path d="M3 17c3 3 5 4 9 4s6-1 9-4l-2-6H5l-2 6zM12 11V3M6 11l6-4 6 4"/>',
  sword: '<path d="M14.5 4.5l5 5-8 8-2 .5.5-2 8-8-4-4z"/><path d="M5 21l4-4"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h5M9.5 14h5"/>',
  leaf: '<path d="M20 4C10 4 4 10 4 19c9 0 15-6 16-15z"/><path d="M4 19L14 9"/>',
  star: '<path d="M12 3l2.5 6L21 10l-4.5 4.4L17.6 21 12 17.8 6.4 21l1.1-6.6L3 10l6.5-1L12 3z"/>',
};

const reliureValide = (v: unknown, secours: string): string =>
  typeof v === 'string' && v in RELIURES ? v : secours;
const ferValide = (v: unknown, secours: string): string =>
  typeof v === 'string' && v in FERS ? v : secours;

/** Le fer par défaut des rayons intégrés, quand Romain n'en a pas choisi. */
export const FER_PAR_DEFAUT: Record<string, string> = {
  bestiaire: 'beast', faune: 'leaf', geographie: 'map',
  religion: 'faith', culture: 'person', magie: 'magic', science: 'star',
  personnages: 'person',
};

export interface Article {
  id: string;
  slug: string;
  categorie: string;
  titre: string;
  /** Une ligne d'accroche, montrée sur les vignettes. */
  resume: string;
  symbole: string;
  couleur: string;
  creeLe: string;
  modifieLe: string;
}

export interface Lore {
  /** Les catégories que Romain a ajoutées, en plus des intégrées. */
  categories: Categorie[];
  articles: Article[];
}

/**
 * Les sept catégories que Romain a nommées. Ce sont des étagères, pas du lore :
 * les fournir n'écrit rien à sa place. Il peut en ajouter d'autres, mais
 * celles-ci restent, parce qu'il les a demandées.
 */
export const CATEGORIES_FIXES: Categorie[] = [
  { slug: 'bestiaire', nom: 'Bestiaire', symbole: '🐉', fixe: true, ordre: 0 },
  { slug: 'faune', nom: 'Faune', symbole: '🦌', fixe: true, ordre: 1 },
  { slug: 'geographie', nom: 'Géographie', symbole: '⛰️', fixe: true, ordre: 2 },
  { slug: 'religion', nom: 'Religion', symbole: '✦', fixe: true, ordre: 3 },
  { slug: 'personnages', nom: 'Personnages', symbole: '☗', fixe: true, ordre: 7 },
  { slug: 'culture', nom: 'Culture', symbole: '❧', fixe: true, ordre: 4 },
  { slug: 'magie', nom: 'Magie', symbole: '🔮', fixe: true, ordre: 5 },
  { slug: 'science', nom: 'Science', symbole: '⚗️', fixe: true, ordre: 6 },
];

const CLE = 'lore';

/* --------------------------------------------------------------- lecture */

export async function lireLore(locals: App.Locals): Promise<Lore> {
  const espace = stockage(locals);
  const vide: Lore = { categories: [], articles: [] };
  if (!espace) return vide;
  try {
    const brut = await espace.get<Lore>(CLE, 'json');
    if (!brut) return vide;
    return {
      categories: Array.isArray(brut.categories) ? brut.categories : [],
      articles: Array.isArray(brut.articles) ? brut.articles : [],
    };
  } catch {
    return vide;
  }
}

/**
 * Toutes les catégories, les intégrées d'abord puis celles de Romain, sans
 * doublon de slug — une catégorie ajoutée peut compléter une intégrée (lui
 * donner une intro) sans la dupliquer.
 */
export function categoriesDe(lore: Lore): Categorie[] {
  const parSlug = new Map<string, Categorie>();
  for (const c of CATEGORIES_FIXES) parSlug.set(c.slug, { ...c });
  let rang = CATEGORIES_FIXES.length;
  for (const c of lore.categories) {
    const fixe = parSlug.get(c.slug);
    if (fixe) {
      // On ne garde de la version stockée que ce qui enrichit l'intégrée.
      if (c.intro) fixe.intro = c.intro;
      if (c.image) fixe.image = c.image;
      if (c.symbole) fixe.symbole = c.symbole;
      if (c.reliure) fixe.reliure = c.reliure;
      if (c.fer) fixe.fer = c.fer;
    } else {
      parSlug.set(c.slug, { ...c, fixe: false, ordre: c.ordre ?? rang++ });
    }
  }
  return [...parSlug.values()].sort((a, b) => a.ordre - b.ordre);
}

export const articlesDe = (lore: Lore, categorieSlug: string): Article[] =>
  lore.articles
    .filter((a) => a.categorie === categorieSlug)
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));

export const articleParSlug = (lore: Lore, slug: string): Article | null =>
  lore.articles.find((a) => a.slug === slug) ?? null;

/* ------------------------------------------------------------ écriture */

const slugifier = (nom: string): string =>
  nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

/** Un symbole reste un pictogramme : au moins un signe, aucun caractère de balisage. */
function symboleValide(brut: unknown, secours: string): string {
  const propose = [...texte(brut, 8)].slice(0, 2).join('');
  if (!propose || /[<>&"'\\]/.test(propose)) return secours;
  return propose;
}

const couleurValide = (brut: unknown, secours: string) =>
  /^#[0-9a-f]{6}$/i.test(String(brut)) ? String(brut) : secours;

/** Une image est une URL http(s) ou un chemin du site ; tout le reste est écarté. */
function imageValide(brut: unknown): string {
  const v = texte(brut, 500);
  return /^(https?:\/\/|\/)[^\s"'<>]+$/i.test(v) ? v : '';
}

const identifiant = () => crypto.randomUUID().slice(0, 8);

async function ecrire(locals: App.Locals, lore: Lore): Promise<Lore> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');
  await espace.put(CLE, JSON.stringify(lore));
  return lore;
}

/** Le slug d'une catégorie valide : intégrée, ou déjà ajoutée. */
function categorieConnue(lore: Lore, slug: string): boolean {
  return CATEGORIES_FIXES.some((c) => c.slug === slug) || lore.categories.some((c) => c.slug === slug);
}

/** Crée ou met à jour un article. */
export async function enregistrerArticle(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Lore> {
  const lore = await lireLore(locals);
  const titre = texte(brut.titre, 120);
  const categorie = texte(brut.categorie, 60);
  if (!titre) throw new Error('Un article a besoin d’un titre.');
  if (!categorieConnue(lore, categorie)) throw new Error('Catégorie inconnue.');

  const id = typeof brut.id === 'string' && brut.id ? brut.id : identifiant();
  const existant = lore.articles.find((a) => a.id === id);

  const article: Article = {
    id,
    slug: slugLibre(titre, (s) => lore.articles.some((a) => a.slug === s && a.id !== id), 'article'),
    categorie,
    titre,
    resume: texte(brut.resume, 200),
    symbole: symboleValide(brut.symbole, existant?.symbole ?? '◆'),
    couleur: couleurValide(brut.couleur, existant?.couleur ?? '#c9a227'),
    creeLe: existant?.creeLe ?? new Date().toISOString(),
    modifieLe: new Date().toISOString(),
  };

  lore.articles = existant
    ? lore.articles.map((a) => (a.id === id ? article : a))
    : [...lore.articles, article];
  return ecrire(locals, lore);
}

export async function supprimerArticle(locals: App.Locals, id: string): Promise<Lore> {
  const lore = await lireLore(locals);
  lore.articles = lore.articles.filter((a) => a.id !== id);
  // La mise en page vit sous l'identifiant, pas le slug : on l'efface avec.
  const espace = stockage(locals);
  if (espace) await espace.delete(clePage('lore', id));
  return ecrire(locals, lore);
}

/** Ajoute ou met à jour une catégorie. Une intégrée ne reçoit qu'une intro. */
export async function enregistrerCategorie(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Lore> {
  const lore = await lireLore(locals);
  const nom = texte(brut.nom, 60);
  const slugDemande = typeof brut.slug === 'string' ? brut.slug : '';
  const fixe = CATEGORIES_FIXES.find((c) => c.slug === slugDemande);
  // Une intégrée garde son nom ; seule une catégorie ajoutée en réclame un.
  if (!fixe && !nom) throw new Error('Une catégorie a besoin d’un nom.');

  if (fixe) {
    // Une intégrée ne change pas de nom, mais peut recevoir une intro, une
    // image de couverture, un autre sceau. On ne stocke que ces surcharges,
    // et rien du tout si elles sont vides — pas d'entrée fantôme.
    // On ne stocke QUE les surcharges — jamais le nom, le sceau ou l'ordre par
    // défaut : sans quoi l'entrée existerait toujours, même vide de sens.
    const enrich: Partial<Categorie> & { slug: string } = { slug: fixe.slug };
    const intro = texte(brut.intro, 400);
    const image = imageValide(brut.image);
    const sym = symboleValide(brut.symbole, fixe.symbole);
    if (intro) enrich.intro = intro;
    if (image) enrich.image = image;
    if (sym !== fixe.symbole) enrich.symbole = sym;
    if (typeof brut.reliure === 'string' && brut.reliure in RELIURES) enrich.reliure = brut.reliure;
    if (typeof brut.fer === 'string' && brut.fer in FERS) enrich.fer = brut.fer;
    const autres = lore.categories.filter((c) => c.slug !== fixe.slug);
    const aQuelqueChose = enrich.intro || enrich.image || enrich.symbole || enrich.reliure || enrich.fer;
    lore.categories = aQuelqueChose ? [...autres, enrich as Categorie] : autres;
    return ecrire(locals, lore);
  }

  const existant = lore.categories.find((c) => c.slug === slugDemande);
  const categorie: Categorie = {
    slug: existant?.slug ?? slugLibre(nom, (s) => categorieConnue(lore, s), 'categorie'),
    nom,
    symbole: symboleValide(brut.symbole, existant?.symbole ?? '❖'),
    intro: texte(brut.intro, 400),
    image: imageValide(brut.image),
    fixe: false,
    ordre: existant?.ordre ?? CATEGORIES_FIXES.length + lore.categories.length,
    reliure: reliureValide(brut.reliure, existant?.reliure ?? 'l1'),
    fer: ferValide(brut.fer, existant?.fer ?? 'book'),
  };

  lore.categories = existant
    ? lore.categories.map((c) => (c.slug === categorie.slug ? categorie : c))
    : [...lore.categories, categorie];
  return ecrire(locals, lore);
}

/** Retire une catégorie ajoutée par Romain, et les articles qu'elle tenait. */
export async function supprimerCategorie(locals: App.Locals, slug: string): Promise<Lore> {
  if (CATEGORIES_FIXES.some((c) => c.slug === slug)) {
    throw new Error('Une catégorie intégrée ne se supprime pas.');
  }
  const lore = await lireLore(locals);
  lore.categories = lore.categories.filter((c) => c.slug !== slug);
  lore.articles = lore.articles.filter((a) => a.categorie !== slug);
  return ecrire(locals, lore);
}
