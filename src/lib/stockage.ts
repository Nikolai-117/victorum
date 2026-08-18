/**
 * Ce que Romain enregistre depuis le site lui-même.
 *
 * Trois sources se superposent pour une fiche, de la plus faible à la plus forte :
 *   1. la disposition par défaut, déduite des faits de la carte ;
 *   2. ce qui est versionné dans `src/contenu/` (textes Markdown, mises en page) ;
 *   3. ce qui a été enregistré depuis l'atelier, gardé dans le stockage KV.
 *
 * Le stockage est facultatif par construction : tant que la liaison n'est pas
 * en place, le site fonctionne exactement comme avant et l'atelier le dit
 * franchement au lieu de faire semblant d'enregistrer.
 */

export interface PageEnregistree {
  blocs?: unknown[];
  texte?: string;
  modifieLe?: string;
}

/** Le nom de la liaison déclarée dans wrangler.jsonc. */
const LIAISON = 'VICTORUM';

/** Récupère l'espace de stockage, ou null s'il n'est pas configuré. */
export function stockage(locals: App.Locals): KVNamespace | null {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  const espace = env?.[LIAISON];
  return espace && typeof (espace as KVNamespace).get === 'function' ? (espace as KVNamespace) : null;
}

/** Le mot de passe de l'atelier, défini en variable secrète du Worker. */
function motDePasseAttendu(locals: App.Locals): string | null {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  const valeur = env?.MOT_DE_PASSE;
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
}

/**
 * Comparaison à durée constante : comparer deux chaînes avec `===` laisse
 * fuiter, par le temps de réponse, le nombre de caractères devinés.
 */
function memeSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * Autorise une écriture. Sans mot de passe configuré, tout est refusé : un site
 * public dont n'importe qui pourrait effacer le lore serait pire qu'un site
 * sans enregistrement du tout.
 */
export function ecritureAutorisee(locals: App.Locals, fourni: string | null):
  { ok: true } | { ok: false; raison: string } {
  const attendu = motDePasseAttendu(locals);
  if (!attendu) {
    return {
      ok: false,
      raison:
        "Aucun mot de passe n'est configuré sur le Worker. Ajoute la variable secrète MOT_DE_PASSE dans Cloudflare pour autoriser l'enregistrement.",
    };
  }
  if (!fourni || !memeSecret(attendu, fourni)) {
    return { ok: false, raison: 'Mot de passe incorrect.' };
  }
  return { ok: true };
}

/** Chaque fiche a une clé stable, indépendante de la mise en page. */
export const clePage = (section: string, slug: string) => `page:${section}/${slug}`;

/** Les sections dans lesquelles on accepte d'écrire. */
const SECTIONS_VALIDES = new Set([
  'etats', 'provinces', 'villes', 'lieux', 'cultures', 'religions', 'articles',
]);

/** Refuse tout ce qui ne ressemble pas à une fiche connue. */
export function adresseValide(section: unknown, slug: unknown): section is string {
  return (
    typeof section === 'string' &&
    typeof slug === 'string' &&
    SECTIONS_VALIDES.has(section) &&
    /^[a-z0-9-]{1,120}$/.test(slug)
  );
}

/** Lit ce qui a été enregistré pour une fiche. */
export async function lirePage(
  locals: App.Locals,
  section: string,
  slug: string
): Promise<PageEnregistree | null> {
  const espace = stockage(locals);
  if (!espace) return null;
  try {
    return await espace.get<PageEnregistree>(clePage(section, slug), 'json');
  } catch {
    return null;
  }
}

/** Enregistre une fiche, en fusionnant avec ce qui existait déjà. */
export async function ecrirePage(
  locals: App.Locals,
  section: string,
  slug: string,
  apport: PageEnregistree
): Promise<PageEnregistree> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');

  const existant = (await lirePage(locals, section, slug)) ?? {};
  const fusion: PageEnregistree = { ...existant, modifieLe: new Date().toISOString() };
  if (apport.blocs !== undefined) fusion.blocs = apport.blocs;
  if (apport.texte !== undefined) fusion.texte = apport.texte;

  await espace.put(clePage(section, slug), JSON.stringify(fusion));
  return fusion;
}
