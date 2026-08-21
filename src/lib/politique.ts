/**
 * La politique du monde : idéologies, doctrines, allégeances.
 *
 * Azgaar ne produit rien de tout cela — et il ne le pourrait pas, puisque
 * c'est du lore. Ce module ne fournit donc que la mécanique ; les noms, les
 * couleurs et les textes viennent de Romain, et de personne d'autre.
 *
 * Trois notions, dans l'esprit d'un Stellaris ou d'un Hearts of Iron, mais
 * entièrement définies par lui :
 *
 *   - un AXE est une grille de lecture du monde. « Idéologies », « Doctrines
 *     militaires », « Obédiences religieuses » : il en crée autant qu'il veut.
 *   - un COURANT est une valeur de cet axe : ce qu'une nation peut professer.
 *     Il a un nom, une couleur, un symbole, et un texte que Romain écrit.
 *   - une ADHÉSION relie une entité du monde à un courant, avec une part
 *     facultative — de quoi représenter aussi bien une doctrine officielle
 *     qu'un rapport de forces entre factions.
 *
 * Tout est stocké dans une seule clé KV : l'ensemble est petit, toujours lu
 * en entier, et une écriture atomique évite d'avoir à gérer des conflits.
 */

import { stockage } from './stockage';
import { AXES } from './doctrines';

export interface Axe {
  id: string;
  slug: string;
  nom: string;
  /** Les types d'entités auxquels cet axe s'applique. */
  cibles: string[];
  /**
   * Un axe multiple accepte plusieurs courants par entité, avec des parts :
   * c'est ce qui permet de figurer un rapport de forces plutôt qu'une
   * doctrine unique.
   */
  multiple: boolean;
  ordre: number;
}

export interface Courant {
  id: string;
  slug: string;
  axeId: string;
  nom: string;
  couleur: string;
  symbole: string;
  resume: string;
  ordre: number;
}

export interface Adhesion {
  /** L'entité visée, sous la forme `type:id` — par exemple `etat:3`. */
  entite: string;
  courantId: string;
  /** Part de soutien, en pourcentage. Absente sur un axe exclusif. */
  part?: number;
}

/**
 * Ce qu'une nation est, en propre : son régime, ses doctrines, sa cour.
 *
 * Séparé des courants parce que la nature en est différente. Un courant est
 * une chose du monde à laquelle on adhère ; une doctrine est une position
 * qu'on tient sur un axe, et deux positions opposées ne peuvent pas coexister.
 */
export interface Nation {
  /** Forme choisie par Romain. Vide : celle déduite des doctrines fait foi. */
  regime?: string;
  /** Positions sur les axes de doctrine : identifiant d'axe → -2…+2. */
  doctrines?: Record<string, number>;
  devise?: string;
  dirigeant?: string;
  titreDirigeant?: string;
  avenement?: number;
}

export interface Politique {
  axes: Axe[];
  courants: Courant[];
  adhesions: Adhesion[];
  /** Clé d'entité (`etat:3`) → ce qu'elle professe en propre. */
  nations?: Record<string, Nation>;
}

export const POLITIQUE_VIDE: Politique = { axes: [], courants: [], adhesions: [], nations: {} };

const CLE = 'politique';

/** Les seuls types d'entités auxquels un courant peut s'attacher. */
export const CIBLES = ['etat', 'province', 'burg', 'culture', 'religion', 'lieu'] as const;

const LIBELLES_CIBLES: Record<string, string> = {
  etat: 'Royaumes',
  province: 'Provinces',
  burg: 'Villes',
  culture: 'Cultures',
  religion: 'Religions',
  lieu: 'Lieux',
};

export const libelleCible = (cible: string) => LIBELLES_CIBLES[cible] ?? cible;

/** La clé d'une entité dans les adhésions. */
export const cleEntite = (type: string, id: number | string) => `${type}:${id}`;

/* ------------------------------------------------------------- lecture */

export async function lirePolitique(locals: App.Locals): Promise<Politique> {
  const espace = stockage(locals);
  if (!espace) return POLITIQUE_VIDE;
  try {
    const brut = await espace.get<Politique>(CLE, 'json');
    if (!brut) return POLITIQUE_VIDE;
    return {
      axes: Array.isArray(brut.axes) ? brut.axes : [],
      courants: Array.isArray(brut.courants) ? brut.courants : [],
      adhesions: Array.isArray(brut.adhesions) ? brut.adhesions : [],
      nations: brut.nations && typeof brut.nations === 'object' ? brut.nations : {},
    };
  } catch {
    return POLITIQUE_VIDE;
  }
}

/**
 * Ce qu'une entité professe, axe par axe, trié du plus fort soutien au plus
 * faible. C'est la forme qu'attend la fiche.
 */
export interface CourantSuivi extends Courant {
  part?: number;
  axe: string;
  axeSlug: string;
}

export function courantsDe(politique: Politique, type: string, id: number | string): CourantSuivi[] {
  const cle = cleEntite(type, id);
  const parId = new Map(politique.courants.map((c) => [c.id, c]));
  const axes = new Map(politique.axes.map((a) => [a.id, a]));

  return politique.adhesions
    .filter((a) => a.entite === cle)
    .map((a) => {
      const courant = parId.get(a.courantId);
      if (!courant) return null;
      const axe = axes.get(courant.axeId);
      return {
        ...courant,
        part: a.part,
        axe: axe?.nom ?? '',
        axeSlug: axe?.slug ?? '',
      };
    })
    .filter((c): c is CourantSuivi => c !== null)
    .sort((a, b) => (b.part ?? 0) - (a.part ?? 0) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ce qu'une entité est en propre : régime, doctrines, cour. */
export const nationDe = (politique: Politique, type: string, id: number | string): Nation =>
  politique.nations?.[cleEntite(type, id)] ?? {};

/** Les entités qui suivent un courant donné. */
export const adherentsDe = (politique: Politique, courantId: string): Adhesion[] =>
  politique.adhesions
    .filter((a) => a.courantId === courantId)
    .sort((a, b) => (b.part ?? 0) - (a.part ?? 0));

/* ------------------------------------------------------------ écriture */

const slugifier = (nom: string): string =>
  nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Un slug qui n'écrase personne d'autre. */
function slugLibre(base: string, pris: (s: string) => boolean, secours: string): string {
  let slug = slugifier(base) || secours;
  if (!pris(slug)) return slug;
  let n = 2;
  while (pris(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

const texte = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/**
 * Un symbole est un pictogramme, pas du texte libre : au moins un signe, et
 * rien qui ressemble à du balisage. Sans cette garde, un « <img onerror=…> »
 * finirait stocké tel quel, en attente d'un endroit où il serait interprété.
 */
function symboleValide(brut: unknown, secours = '◆'): string {
  const propose = [...texte(brut, 8)].slice(0, 2).join('');
  if (!propose || /[<>&"'\\]/.test(propose)) return secours;
  return propose;
}

const couleurValide = (brut: unknown, secours = '#c9a227') =>
  /^#[0-9a-f]{6}$/i.test(String(brut)) ? String(brut) : secours;

const identifiant = () => crypto.randomUUID().slice(0, 8);

async function ecrire(locals: App.Locals, politique: Politique): Promise<Politique> {
  const espace = stockage(locals);
  if (!espace) throw new Error('stockage indisponible');
  await espace.put(CLE, JSON.stringify(politique));
  return politique;
}

/**
 * Enregistre ce qu'une nation est en propre.
 *
 * Les positions de doctrine sont ramenées à l'intervalle attendu et les axes
 * inconnus écartés : ce qui arrive du navigateur n'est jamais tenu pour bon.
 */
export async function enregistrerNation(
  locals: App.Locals,
  entite: string,
  brut: Record<string, unknown>
): Promise<Politique> {
  if (!/^[a-z]+:[0-9a-z-]+$/.test(entite)) throw new Error('Entité inconnue.');
  const politique = await lirePolitique(locals);

  const doctrines: Record<string, number> = {};
  const brutes = (brut.doctrines ?? {}) as Record<string, unknown>;
  for (const axe of AXES) {
    const valeur = Math.round(Number(brutes[axe.id]));
    if (!Number.isFinite(valeur) || valeur === 0) continue;
    doctrines[axe.id] = Math.max(-2, Math.min(2, valeur));
  }

  // `Number(null)` vaut zéro, et zéro est un nombre valide : sans cette garde,
  // effacer l'année d'avènement la remplaçait par l'an 0.
  const vide = brut.avenement === null || brut.avenement === undefined || brut.avenement === '';
  const avenement = vide ? Number.NaN : Number(brut.avenement);
  const nation: Nation = {
    ...(texte(brut.regime, 60) ? { regime: texte(brut.regime, 60) } : {}),
    ...(Object.keys(doctrines).length ? { doctrines } : {}),
    ...(texte(brut.devise, 160) ? { devise: texte(brut.devise, 160) } : {}),
    ...(texte(brut.dirigeant, 80) ? { dirigeant: texte(brut.dirigeant, 80) } : {}),
    ...(texte(brut.titreDirigeant, 60) ? { titreDirigeant: texte(brut.titreDirigeant, 60) } : {}),
    ...(Number.isFinite(avenement) ? { avenement: Math.round(avenement) } : {}),
  };

  politique.nations = { ...(politique.nations ?? {}) };
  // Une nation vidée de tout n'a plus lieu d'occuper une ligne.
  if (Object.keys(nation).length) politique.nations[entite] = nation;
  else delete politique.nations[entite];

  return ecrire(locals, politique);
}

/** Crée ou met à jour un axe. */
export async function enregistrerAxe(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Politique> {
  const politique = await lirePolitique(locals);
  const nom = texte(brut.nom, 80);
  if (!nom) throw new Error('Un axe a besoin d’un nom.');

  const id = typeof brut.id === 'string' && brut.id ? brut.id : identifiant();
  const existant = politique.axes.find((a) => a.id === id);

  const cibles = Array.isArray(brut.cibles)
    ? brut.cibles.map(String).filter((c) => (CIBLES as readonly string[]).includes(c))
    : existant?.cibles ?? ['etat'];

  const axe: Axe = {
    id,
    slug: slugLibre(nom, (s) => politique.axes.some((a) => a.slug === s && a.id !== id), 'axe'),
    nom,
    cibles: cibles.length ? cibles : ['etat'],
    multiple: Boolean(brut.multiple ?? existant?.multiple ?? false),
    ordre: existant?.ordre ?? politique.axes.length,
  };

  politique.axes = existant
    ? politique.axes.map((a) => (a.id === id ? axe : a))
    : [...politique.axes, axe];
  return ecrire(locals, politique);
}

/** Retire un axe, ses courants et toutes les adhésions qui en dépendaient. */
export async function supprimerAxe(locals: App.Locals, id: string): Promise<Politique> {
  const politique = await lirePolitique(locals);
  const courants = politique.courants.filter((c) => c.axeId === id).map((c) => c.id);
  politique.axes = politique.axes.filter((a) => a.id !== id);
  politique.courants = politique.courants.filter((c) => c.axeId !== id);
  politique.adhesions = politique.adhesions.filter((a) => !courants.includes(a.courantId));
  return ecrire(locals, politique);
}

/** Crée ou met à jour un courant. */
export async function enregistrerCourant(
  locals: App.Locals,
  brut: Record<string, unknown>
): Promise<Politique> {
  const politique = await lirePolitique(locals);
  const nom = texte(brut.nom, 80);
  const axeId = String(brut.axeId ?? '');
  if (!nom) throw new Error('Un courant a besoin d’un nom.');
  if (!politique.axes.some((a) => a.id === axeId)) throw new Error('Axe inconnu.');

  const id = typeof brut.id === 'string' && brut.id ? brut.id : identifiant();
  const existant = politique.courants.find((c) => c.id === id);

  const courant: Courant = {
    id,
    slug: slugLibre(nom, (s) => politique.courants.some((c) => c.slug === s && c.id !== id), 'courant'),
    axeId,
    nom,
    couleur: couleurValide(brut.couleur, existant?.couleur),
    symbole: symboleValide(brut.symbole, existant?.symbole ?? '◆'),
    resume: texte(brut.resume, 2000),
    ordre: existant?.ordre ?? politique.courants.filter((c) => c.axeId === axeId).length,
  };

  politique.courants = existant
    ? politique.courants.map((c) => (c.id === id ? courant : c))
    : [...politique.courants, courant];
  return ecrire(locals, politique);
}

export async function supprimerCourant(locals: App.Locals, id: string): Promise<Politique> {
  const politique = await lirePolitique(locals);
  politique.courants = politique.courants.filter((c) => c.id !== id);
  politique.adhesions = politique.adhesions.filter((a) => a.courantId !== id);
  return ecrire(locals, politique);
}

/**
 * Remplace d'un bloc les adhérents d'un courant.
 *
 * Le navigateur envoie la liste complète telle qu'elle doit être : plus simple
 * à raisonner qu'une suite d'ajouts et de retraits, et sans état intermédiaire
 * incohérent si une requête se perd.
 */
export async function enregistrerAdhesions(
  locals: App.Locals,
  courantId: string,
  brutes: unknown
): Promise<Politique> {
  const politique = await lirePolitique(locals);
  const courant = politique.courants.find((c) => c.id === courantId);
  if (!courant) throw new Error('Courant inconnu.');
  const axe = politique.axes.find((a) => a.id === courant.axeId);

  const liste = Array.isArray(brutes) ? brutes : [];
  const propres: Adhesion[] = [];
  const vues = new Set<string>();

  for (const brute of liste) {
    const b = brute as Record<string, unknown>;
    const entite = texte(b.entite, 60);
    if (!/^[a-z]+:[0-9a-z-]+$/.test(entite)) continue;
    if (!axe?.cibles.includes(entite.split(':')[0])) continue;
    if (vues.has(entite)) continue;
    vues.add(entite);

    const part = Number(b.part);
    propres.push({
      entite,
      courantId,
      ...(axe.multiple && Number.isFinite(part) && part > 0
        ? { part: Math.min(100, Math.round(part * 10) / 10) }
        : {}),
    });
  }

  // Sur un axe exclusif, adhérer ici c'est quitter les autres courants du même axe.
  const freres = new Set(
    politique.courants.filter((c) => c.axeId === courant.axeId).map((c) => c.id)
  );
  politique.adhesions = politique.adhesions.filter((a) => {
    if (a.courantId === courantId) return false;
    if (axe?.multiple) return true;
    return !(freres.has(a.courantId) && vues.has(a.entite));
  });

  politique.adhesions.push(...propres);
  return ecrire(locals, politique);
}
