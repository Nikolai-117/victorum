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
  /** Les catégories intégrées ne se suppriment pas ; les siennes, si. */
  fixe?: boolean;
  ordre: number;
}

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
  if (!nom) throw new Error('Une catégorie a besoin d’un nom.');

  const slugDemande = typeof brut.slug === 'string' ? brut.slug : '';
  const fixe = CATEGORIES_FIXES.find((c) => c.slug === slugDemande);

  if (fixe) {
    const intro = texte(brut.intro, 400);
    const autres = lore.categories.filter((c) => c.slug !== fixe.slug);
    // Une intro vide ne laisse pas d'entrée fantôme : l'intégrée reprend sa
    // forme nue plutôt que de garder une ligne sans effet.
    lore.categories = intro ? [...autres, { ...fixe, intro }] : autres;
    return ecrire(locals, lore);
  }

  const existant = lore.categories.find((c) => c.slug === slugDemande);
  const categorie: Categorie = {
    slug: existant?.slug ?? slugLibre(nom, (s) => categorieConnue(lore, s), 'categorie'),
    nom,
    symbole: symboleValide(brut.symbole, existant?.symbole ?? '❖'),
    intro: texte(brut.intro, 400),
    fixe: false,
    ordre: existant?.ordre ?? CATEGORIES_FIXES.length + lore.categories.length,
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
