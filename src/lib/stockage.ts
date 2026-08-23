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

/**
 * Efface le mot de passe stocké : après quoi le prochain saisi dans l'atelier
 * redevient celui du site. L'appelant doit avoir déjà validé le mot de passe
 * courant. Sans effet sur un mot de passe imposé par variable secrète.
 */
export async function oublierMotDePasseStocke(locals: App.Locals): Promise<void> {
  const espace = stockage(locals);
  if (espace) await espace.delete(CLE_MOT_DE_PASSE);
}

/** Chaque fiche a une clé stable, indépendante de la mise en page. */
export const clePage = (section: string, slug: string) => `page:${section}/${slug}`;

/** Les sections dans lesquelles on accepte d'écrire. */
const SECTIONS_VALIDES = new Set([
  'etats', 'provinces', 'villes', 'lieux', 'cultures', 'religions', 'articles', 'lore',
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

/* ---------------------------------------------------------------- lieux */

/**
 * Les lieux remarquables.
 *
 * Ils ne viennent plus d'Azgaar — qui en générait des centaines d'identiques —
 * mais de Romain, qui les pose lui-même sur la carte avec leur nom, leur icône
 * et leur couleur. Ils vivent donc dans le stockage du site, pas dans l'export.
 */
export interface Lieu {
  id: string;
  slug: string;
  nom: string;
  categorie: string;
  icone: string;
  couleur: string;
  x: number;
  y: number;
  creeLe: string;
}

const CLE_LIEUX = 'lieux';

/** Slug d'URL : sans accents, sans espaces. */
function slugifier(nom: string): string {
  return (
    nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'lieu'
  );
}

export async function listerLieux(locals: App.Locals): Promise<Lieu[]> {
  const espace = stockage(locals);
  if (!espace) return [];
  try {
    return (await espace.get<Lieu[]>(CLE_LIEUX, 'json')) ?? [];
  } catch {
    return [];
  }
}

export async function lieuParSlug(locals: App.Locals, slug: string): Promise<Lieu | null> {
  return (await listerLieux(locals)).find((l) => l.slug === slug) ?? null;
}

/**
 * Une icône est un pictogramme, pas du texte libre : on exige au moins un
 * symbole et on écarte tout ce qui ressemble à du balisage. Sans cela, un
 * « <img onerror=…> » se retrouverait stocké tel quel, en attente d'un endroit
 * où il finirait par être interprété.
 */
function iconeValide(brut: unknown): string {
  const propose = [...String(brut ?? '')].slice(0, 2).join('');
  if (!propose || /[<>&"'\\]/.test(propose)) return '📍';
  return /[\p{Extended_Pictographic}\p{Symbol}]/u.test(propose) ? propose : '📍';
}

/** Découpe un lieu reçu du navigateur en ne gardant que ce qui est attendu. */
function assainirLieu(brut: Record<string, unknown>): Omit<Lieu, 'id' | 'slug' | 'creeLe'> | null {
  const nom = String(brut.nom ?? '').trim().slice(0, 120);
  const x = Number(brut.x);
  const y = Number(brut.y);
  if (!nom || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    nom,
    categorie: String(brut.categorie ?? '').trim().slice(0, 60) || 'Lieu',
    icone: iconeValide(brut.icone),
    couleur: /^#[0-9a-f]{6}$/i.test(String(brut.couleur)) ? String(brut.couleur) : '#c9a227',
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
  };
}

/** Crée ou met à jour un lieu. Les slugs restent uniques entre eux. */
export async function enregistrerLieu(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Lieu> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');

  const propre = assainirLieu(brut);
  if (!propre) throw new Error('Lieu incomplet : il lui faut un nom et une position.');

  const lieux = await listerLieux(locals);
  const id = typeof brut.id === 'string' && brut.id ? brut.id : crypto.randomUUID().slice(0, 8);
  const existant = lieux.find((l) => l.id === id);

  let slug = slugifier(propre.nom);
  const prisPar = (s: string) => lieux.some((l) => l.slug === s && l.id !== id);
  if (prisPar(slug)) {
    let n = 2;
    while (prisPar(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const lieu: Lieu = { ...propre, id, slug, creeLe: existant?.creeLe ?? new Date().toISOString() };
  const suite = existant ? lieux.map((l) => (l.id === id ? lieu : l)) : [...lieux, lieu];
  await espace.put(CLE_LIEUX, JSON.stringify(suite));
  return lieu;
}

/** Retire un lieu, et le texte qui lui était attaché. */
export async function supprimerLieu(locals: App.Locals, id: string): Promise<boolean> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');

  const lieux = await listerLieux(locals);
  const cible = lieux.find((l) => l.id === id);
  if (!cible) return false;

  await espace.put(CLE_LIEUX, JSON.stringify(lieux.filter((l) => l.id !== id)));
  await espace.delete(clePage('lieux', cible.slug));
  return true;
}
