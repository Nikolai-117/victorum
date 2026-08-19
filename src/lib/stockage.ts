/**
 * Ce que Romain enregistre depuis le site lui-même.
 *
 * Trois sources se superposent pour une fiche, de la plus faible à la plus forte :
 *   1. la disposition par défaut, déduite des faits de la carte ;
 *   2. ce qui est versionné dans `src/contenu/` (textes Markdown, mises en page) ;
 *   3. ce qui a été enregistré depuis l'atelier, gardé dans le stockage KV.
 *
 * Aucune configuration manuelle n'est demandée : l'espace de stockage est créé
 * par Cloudflare au premier déploiement, et le mot de passe est celui que
 * Romain saisit la première fois qu'il enregistre.
 */

export interface PageEnregistree {
  blocs?: unknown[];
  texte?: string;
  modifieLe?: string;
}

/** Le nom de la liaison déclarée dans wrangler.jsonc. */
const LIAISON = 'VICTORUM';

/** Clé réservée : l'empreinte du mot de passe de l'atelier. */
const CLE_MOT_DE_PASSE = 'config:mot-de-passe';

/** Récupère l'espace de stockage, ou null s'il n'est pas encore disponible. */
export function stockage(locals: App.Locals): KVNamespace | null {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  const espace = env?.[LIAISON];
  return espace && typeof (espace as KVNamespace).get === 'function' ? (espace as KVNamespace) : null;
}

/**
 * Un mot de passe peut aussi être imposé en variable secrète du Worker. Ce
 * n'est pas obligatoire ; s'il existe, il l'emporte sur celui enregistré.
 */
function motDePasseImpose(locals: App.Locals): string | null {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  const valeur = env?.MOT_DE_PASSE;
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
}

/** Empreinte du mot de passe : on n'écrit jamais le mot de passe en clair. */
async function empreinte(motDePasse: string): Promise<string> {
  const donnees = new TextEncoder().encode(`victorum:${motDePasse}`);
  const condensat = await crypto.subtle.digest('SHA-256', donnees);
  return [...new Uint8Array(condensat)].map((o) => o.toString(16).padStart(2, '0')).join('');
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

/** Un mot de passe a-t-il déjà été choisi ? */
export async function motDePasseDefini(locals: App.Locals): Promise<boolean> {
  if (motDePasseImpose(locals)) return true;
  const espace = stockage(locals);
  if (!espace) return false;
  return Boolean(await espace.get(CLE_MOT_DE_PASSE));
}

/**
 * Autorise une écriture.
 *
 * Le premier mot de passe saisi devient celui du site : personne d'autre que
 * Romain ne connaît encore l'adresse au moment où il l'ouvre. Ensuite, il est
 * exigé à chaque écriture — le lien étant destiné à être partagé, on ne peut
 * pas laisser un visiteur réécrire son monde.
 */
export async function ecritureAutorisee(
  locals: App.Locals,
  fourni: string | null
): Promise<{ ok: true; premier?: boolean } | { ok: false; raison: string }> {
  const espace = stockage(locals);
  if (!espace) return { ok: false, raison: "Le stockage n'est pas encore disponible." };
  if (!fourni) return { ok: false, raison: 'Mot de passe requis.' };

  const impose = motDePasseImpose(locals);
  if (impose) {
    return memeSecret(impose, fourni) ? { ok: true } : { ok: false, raison: 'Mot de passe incorrect.' };
  }

  const connu = await espace.get(CLE_MOT_DE_PASSE);
  const candidat = await empreinte(fourni);

  if (!connu) {
    if (fourni.length < 4) {
      return { ok: false, raison: 'Choisis un mot de passe d’au moins 4 caractères.' };
    }
    await espace.put(CLE_MOT_DE_PASSE, candidat);
    return { ok: true, premier: true };
  }

  return memeSecret(connu, candidat) ? { ok: true } : { ok: false, raison: 'Mot de passe incorrect.' };
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
