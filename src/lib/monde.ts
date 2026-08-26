/**
 * Accès aux données du monde et formatage.
 *
 * Tout ce qui est ici provient de l'export Azgaar via `npm run import`.
 * Ces fichiers sont régénérables : ne jamais les éditer à la main, les
 * modifications se font dans Azgaar puis par un réimport.
 */

import monde from '../data/monde.json';
import etats from '../data/etats.json';
import provinces from '../data/provinces.json';
import burgs from '../data/burgs.json';
import cultures from '../data/cultures.json';
import religions from '../data/religions.json';
import zones from '../data/zones.json';
import chronologie from '../data/chronologie.json';

export { monde, etats, provinces, burgs, cultures, religions, zones, chronologie };

export type Etat = (typeof etats)[number];
export type Province = (typeof provinces)[number];
export type Burg = (typeof burgs)[number];
export type Culture = (typeof cultures)[number];
export type Religion = (typeof religions)[number];

/* ------------------------------------------------------------------ index */

const parId = <T extends { id: number }>(liste: readonly T[]) => new Map(liste.map((e) => [e.id, e]));

/**
 * Le nom du site.
 *
 * À distinguer du nom du MONDE : Victorum est le monde de Romain, décrit par
 * les données ; Enluminure est l'ouvrage qui le met en pages. Le bandeau, les
 * titres d'onglet et le pied de page parlent donc d'Enluminure, tandis que le
 * contenu continue de parler de Victorum.
 */
export const SITE = {
  nom: 'Enluminure',
  /** Ce que le site est, en une ligne — pour les descriptions de page. */
  baseline: 'le wiki et l’atlas de Victorum',
};

/**
 * L'identité visuelle des royaumes.
 *
 * Azgaar sort des teintes très saturées (#ffcc1e pour Varenhold) qui jurent
 * avec le parchemin du site. Le thème en fixe des versions sourdes, appliquées
 * ici au chargement : la carte, les pastilles et les légendes parlent ainsi
 * d'une seule voix, et un réimport ne les efface pas.
 */
const IDENTITE_ROYAUMES: Record<string, string> = {
  levanzia: '#6d3a7a',
  varenhold: '#c8912f',
  ornebois: '#5b86b0',
};
for (const e of etats) {
  const t = IDENTITE_ROYAUMES[e.slug];
  if (t) e.couleur = t;
}

export const etatParId = parId(etats);
export const provinceParId = parId(provinces);
export const burgParId = parId(burgs);
export const cultureParId = parId(cultures);
export const religionParId = parId(religions);

/* ---------------------------------------------------------------- adresses */

export const SECTIONS = {
  etat: { url: 'etats', libelle: 'Royaumes', singulier: 'Royaume' },
  province: { url: 'provinces', libelle: 'Provinces', singulier: 'Province' },
  burg: { url: 'villes', libelle: 'Villes', singulier: 'Ville' },
  culture: { url: 'cultures', libelle: 'Cultures', singulier: 'Culture' },
  religion: { url: 'religions', libelle: 'Religions', singulier: 'Religion' },
  lieu: { url: 'lieux', libelle: 'Lieux', singulier: 'Lieu' },
} as const;

export type TypeEntite = keyof typeof SECTIONS;

/** Adresse publique d'une fiche. */
export function lien(type: TypeEntite, slug: string): string {
  return `/${SECTIONS[type].url}/${slug}`;
}

/** Chemin du fichier Markdown que Romain doit créer pour écrire cette fiche. */
export function cheminTexte(type: TypeEntite, slug: string): string {
  return `src/contenu/${SECTIONS[type].url}/${slug}.md`;
}

/* --------------------------------------------------------------- formatage */

const FR = 'fr-FR';

/**
 * 42 villes de la carte portent « ??? » : Azgaar les a créées sans nom.
 * On ne leur en invente pas — le monde appartient à Romain — mais on évite
 * d'afficher des points d'interrogation comme titre de page.
 */
const SANS_NOM = /^\s*\?+\s*$/;

export const estSansNom = (nom: string | null | undefined): boolean =>
  !nom || !nom.trim() || SANS_NOM.test(nom);

export const nomAffiche = (nom: string | null | undefined): string =>
  estSansNom(nom) ? 'Sans nom' : nom!.trim();

export function nombre(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(FR);
}

/** Population lisible : au-delà du million, on abrège sans perdre l'ordre de grandeur. */
export function habitants(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(FR, { maximumFractionDigits: 1 })} M`;
  return n.toLocaleString(FR);
}

export function superficie(km2: number | null | undefined): string {
  if (!km2) return '—';
  return `${km2.toLocaleString(FR)} km²`;
}

export function annee(a: number | null | undefined): string {
  if (a === null || a === undefined) return '—';
  return `${a} ${monde.ereCourte ?? ''}`.trim();
}

/* -------------------------------------------- vocabulaire d'Azgaar en français */

const FORMES_ETAT: Record<string, string> = {
  Monarchy: 'Monarchie', Republic: 'République', Theocracy: 'Théocratie',
  Union: 'Union', Anarchy: 'Anarchie', Empire: 'Empire',
};
const NATURES_CULTURE: Record<string, string> = {
  Generic: 'Sédentaire', River: 'Fluviale', Lake: 'Lacustre', Naval: 'Maritime',
  Nomadic: 'Nomade', Hunting: 'Chasseresse', Highland: 'Montagnarde',
};
const NATURES_RELIGION: Record<string, string> = {
  Folk: 'Populaire', Organized: 'Organisée', Cult: 'Culte', Heresy: 'Hérésie',
};
const FORMES_RELIGION: Record<string, string> = {
  Animism: 'Animisme', Shamanism: 'Chamanisme', 'Ancestor worship': 'Culte des ancêtres',
  Polytheism: 'Polythéisme', Dualism: 'Dualisme', Monotheism: 'Monothéisme',
  'Non-theism': 'Non-théisme', Cult: 'Culte', 'Dark Cult': 'Culte sombre',
  Heresy: 'Hérésie', Sect: 'Secte',
};
const NATURES_BURG: Record<string, string> = {
  Generic: 'Terrienne', River: 'Fluviale', Lake: 'Lacustre', Naval: 'Maritime',
  Nomadic: 'Nomade', Hunting: 'Chasseresse', Highland: 'Montagnarde',
};
const RELATIONS: Record<string, string> = {
  Ally: 'Alliance', Friendly: 'Amicale', Neutral: 'Neutre', Suspicion: 'Défiance',
  Enemy: 'Ennemie', Unknown: 'Inconnue', Rival: 'Rivalité', Vassal: 'Vassale',
  Suzerain: 'Suzeraine',
};
const UNITES: Record<string, string> = {
  infantry: 'Infanterie', archers: 'Archers', cavalry: 'Cavalerie',
  artillery: 'Artillerie', fleet: 'Flotte',
};

const traduire = (table: Record<string, string>) => (v: string | null | undefined) =>
  (v && (table[v] ?? v)) || '—';

export const formeEtat = traduire(FORMES_ETAT);
export const natureCulture = traduire(NATURES_CULTURE);
export const natureReligion = traduire(NATURES_RELIGION);
export const formeReligion = traduire(FORMES_RELIGION);
export const natureBurg = traduire(NATURES_BURG);
export const relation = traduire(RELATIONS);
export const unite = traduire(UNITES);

/* ------------------------------------------------------------ agrégations */

/** Villes d'un état, de la plus peuplée à la plus modeste. */
export function villesDeLEtat(etatId: number): Burg[] {
  return burgs.filter((b) => b.etatId === etatId).sort((a, b) => b.population - a.population);
}

export function villesDeLaProvince(provinceId: number): Burg[] {
  return burgs.filter((b) => b.provinceId === provinceId).sort((a, b) => b.population - a.population);
}

export function provincesDeLEtat(etatId: number): Province[] {
  return provinces.filter((p) => p.etatId === etatId).sort((a, b) => b.population - a.population);
}

export function villesDeLaCulture(cultureId: number): Burg[] {
  return burgs.filter((b) => b.cultureId === cultureId).sort((a, b) => b.population - a.population);
}

/** Chiffres d'ouverture affichés sur l'accueil. */
export function chiffresDuMonde() {
  const population = etats.reduce((n, e) => n + e.population, 0);
  return {
    annee: monde.annee,
    ere: monde.ere,
    etats: etats.length,
    provinces: provinces.length,
    villes: burgs.length,
    cultures: cultures.length,
    religions: religions.length,
    population,
    superficie: etats.reduce((n, e) => n + e.superficieKm2, 0),
    ports: burgs.filter((b) => b.port).length,
  };
}
