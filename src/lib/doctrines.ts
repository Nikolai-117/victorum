/**
 * Les doctrines d'une nation, et le régime qui s'en déduit.
 *
 * Le principe est celui d'un Stellaris : chaque axe oppose deux doctrines, et
 * l'on se place quelque part entre les deux. Cinq crans, du fanatisme d'un
 * bord au fanatisme de l'autre, le cran central valant « ni l'un ni l'autre ».
 * Choisir un pôle exclut donc mécaniquement l'autre.
 *
 * Le vocabulaire, lui, est celui d'un monde médiéval : on n'y est pas
 * xénophile ou cybernétiste, on y est dévot ou séculier, chevaleresque ou
 * impitoyable, thaumaturge ou inquisiteur. Ce sont des grilles de lecture
 * générales, pas du lore : ce que Romain en fait — quelle nation professe
 * quoi, et pourquoi — lui appartient entièrement.
 */

export interface AxeDoctrine {
  id: string;
  /** Le pôle négatif (valeurs -1 et -2). */
  gauche: string;
  /** Le pôle positif (valeurs +1 et +2). */
  droite: string;
  /** Ce que l'axe met en jeu, dit en trois mots. */
  sujet: string;
  /** Les deux teintes, pour la carte et les jetons. */
  teinteGauche: string;
  teinteDroite: string;
}

/**
 * Quatorze axes. Assez pour dessiner une nation sans deux fois la même, assez
 * peu pour qu'on puisse les parcourir d'un regard.
 */
export const AXES: AxeDoctrine[] = [
  { id: 'foi', gauche: 'Dévot', droite: 'Séculier', sujet: 'La place de la foi', teinteGauche: '#c9a227', teinteDroite: '#7c8aa0' },
  { id: 'guerre', gauche: 'Belliqueux', droite: 'Pacifique', sujet: 'Le goût des armes', teinteGauche: '#a4483a', teinteDroite: '#5b8f7a' },
  { id: 'expansion', gauche: 'Conquérant', droite: 'Isolationniste', sujet: 'Le rapport au dehors', teinteGauche: '#b06a2c', teinteDroite: '#4a6b86' },
  { id: 'pouvoir', gauche: 'Centralisateur', droite: 'Féodal', sujet: 'Où siège le pouvoir', teinteGauche: '#8c4f9e', teinteDroite: '#8a7b4f' },
  { id: 'changement', gauche: 'Traditionaliste', droite: 'Réformateur', sujet: 'Le rapport au passé', teinteGauche: '#946a3d', teinteDroite: '#4f8ba0' },
  { id: 'etranger', gauche: 'Hospitalier', droite: 'Xénophobe', sujet: "L'accueil de l'étranger", teinteGauche: '#5b9c6a', teinteDroite: '#8f3f4a' },
  { id: 'richesse', gauche: 'Marchand', droite: 'Agrarien', sujet: "L'assise de la richesse", teinteGauche: '#c08a2e', teinteDroite: '#6f8f43' },
  { id: 'savoir', gauche: 'Érudit', droite: 'Obscurantiste', sujet: 'Le rapport au savoir', teinteGauche: '#5f86b8', teinteDroite: '#6a5a4a' },
  { id: 'magie', gauche: 'Thaumaturge', droite: 'Inquisiteur', sujet: "Le rapport à l'arcane", teinteGauche: '#7f4bd8', teinteDroite: '#a33b2f' },
  { id: 'honneur', gauche: 'Chevaleresque', droite: 'Impitoyable', sujet: 'La manière de faire la guerre', teinteGauche: '#c2b280', teinteDroite: '#6d2f33' },
  { id: 'condition', gauche: 'Émancipateur', droite: 'Servagiste', sujet: 'La condition des hommes', teinteGauche: '#5f9e8f', teinteDroite: '#7a4a3a' },
  { id: 'puissance', gauche: 'Maritime', droite: 'Terrien', sujet: 'Où se porte la puissance', teinteGauche: '#3f7fa8', teinteDroite: '#7d7040' },
  { id: 'cour', gauche: 'Fastueux', droite: 'Austère', sujet: 'Le train de la cour', teinteGauche: '#b8892f', teinteDroite: '#6b6b66' },
  { id: 'loi', gauche: 'Légaliste', droite: 'Arbitraire', sujet: 'Le rapport à la coutume', teinteGauche: '#6f86a8', teinteDroite: '#8a4436' },
];

export const AXE_PAR_ID = new Map(AXES.map((a) => [a.id, a]));

/** Les positions d'une nation sur les axes : identifiant d'axe → -2…+2. */
export type Doctrines = Record<string, number>;

export interface DoctrineRetenue {
  axeId: string;
  nom: string;
  fanatique: boolean;
  valeur: number;
  teinte: string;
}

/** Ce qu'une nation professe vraiment : les axes où elle a pris parti. */
export function doctrinesRetenues(doctrines: Doctrines | undefined): DoctrineRetenue[] {
  if (!doctrines) return [];
  const retenues: DoctrineRetenue[] = [];
  for (const axe of AXES) {
    const valeur = Number(doctrines[axe.id] ?? 0);
    if (!valeur) continue;
    retenues.push({
      axeId: axe.id,
      nom: valeur < 0 ? axe.gauche : axe.droite,
      fanatique: Math.abs(valeur) >= 2,
      valeur,
      teinte: valeur < 0 ? axe.teinteGauche : axe.teinteDroite,
    });
  }
  // Les convictions les plus fortes d'abord.
  return retenues.sort((a, b) => Math.abs(b.valeur) - Math.abs(a.valeur));
}

/* ------------------------------------------------------------- régimes */

/**
 * Les formes de gouvernement proposées. Volontairement longue : un monde
 * médiéval en a connu bien plus que « monarchie » et « république », et rien
 * n'oblige Romain à s'y tenir — la saisie libre reste toujours ouverte.
 */
export const REGIMES: { famille: string; formes: string[] }[] = [
  {
    famille: 'Couronnes',
    formes: [
      'Royaume', 'Empire', 'Principauté', 'Grand-duché', 'Duché', 'Comté',
      'Marche', 'Seigneurie', 'Vice-royauté', 'Régence', 'Despotat',
    ],
  },
  {
    famille: 'Assemblées',
    formes: [
      'République marchande', 'Sérénissime République', 'Cité-État', 'Commune libre',
      'Ligue de cités', 'Confédération', 'Oligarchie', 'Conseil des Anciens',
      'Assemblée des clans', 'Chefferie',
    ],
  },
  {
    famille: 'Autels',
    formes: [
      'Théocratie', 'Prince-évêché', 'Ordre militaire', 'État monastique',
      'Hiérocratie', 'Magocratie',
    ],
  },
  {
    famille: 'Armes',
    formes: ['Stratocratie', 'Junte', 'Horde', 'Khanat', 'Sultanat', 'Califat', 'Émirat'],
  },
  {
    famille: 'Autres',
    formes: ['Hégémonie', 'Tyrannie', 'Gérontocratie', 'Ploutocratie', 'Interrègne', 'Anarchie'],
  },
];

export const TOUS_REGIMES = REGIMES.flatMap((f) => f.formes);

/** Ce que la carte d'Azgaar dit, faute de mieux. */
const REGIME_SELON_AZGAAR: Record<string, string> = {
  Monarchy: 'Royaume',
  Republic: 'Sérénissime République',
  Theocracy: 'Théocratie',
  Union: 'Confédération',
  Empire: 'Empire',
  Anarchy: 'Interrègne',
};

/**
 * Le régime déduit des doctrines.
 *
 * Chaque règle est une lecture défendable : un peuple fanatiquement dévot est
 * gouverné par ses autels, un peuple qui confie tout à ses vassaux n'a plus de
 * couronne que le nom. La première qui s'applique l'emporte, et l'on dit
 * toujours d'où vient la conclusion — Romain peut la contredire d'un choix.
 */
export function regimeDeduit(
  doctrines: Doctrines | undefined,
  formeAzgaar?: string | null
): { nom: string; raison: string } {
  const v = (id: string) => Number(doctrines?.[id] ?? 0);
  const axe = (id: string) => AXE_PAR_ID.get(id)!;
  const pole = (id: string) => (v(id) < 0 ? axe(id).gauche : axe(id).droite);

  const regles: { si: boolean; nom: string; cause: string[] }[] = [
    { si: v('magie') <= -2, nom: 'Magocratie', cause: ['magie'] },
    { si: v('foi') <= -2 && v('magie') >= 1, nom: 'Hiérocratie', cause: ['foi', 'magie'] },
    { si: v('foi') <= -2 && v('guerre') <= -1, nom: 'Ordre militaire', cause: ['foi', 'guerre'] },
    { si: v('foi') <= -2, nom: 'Théocratie', cause: ['foi'] },
    { si: v('guerre') <= -2 && v('expansion') <= -1, nom: 'Horde', cause: ['guerre', 'expansion'] },
    { si: v('guerre') <= -2 && v('pouvoir') <= -1, nom: 'Stratocratie', cause: ['guerre', 'pouvoir'] },
    { si: v('richesse') <= -2 && v('pouvoir') >= 1, nom: 'Ligue de cités', cause: ['richesse', 'pouvoir'] },
    { si: v('richesse') <= -2, nom: 'République marchande', cause: ['richesse'] },
    { si: v('loi') >= 2 && v('pouvoir') <= -1, nom: 'Tyrannie', cause: ['loi', 'pouvoir'] },
    { si: v('pouvoir') >= 2, nom: 'Assemblée des clans', cause: ['pouvoir'] },
    { si: v('pouvoir') <= -2 && v('expansion') <= -1, nom: 'Empire', cause: ['pouvoir', 'expansion'] },
    { si: v('pouvoir') <= -2, nom: 'Despotat', cause: ['pouvoir'] },
    { si: v('condition') >= 2, nom: 'Oligarchie', cause: ['condition'] },
    { si: v('savoir') <= -2, nom: 'Conseil des Anciens', cause: ['savoir'] },
  ];

  for (const regle of regles) {
    if (!regle.si) continue;
    const motifs = regle.cause.map((id) => {
      const fanatique = Math.abs(v(id)) >= 2 ? ' fanatique' : '';
      return `${pole(id)}${fanatique}`;
    });
    return { nom: regle.nom, raison: `déduit de : ${motifs.join(', ')}` };
  }

  const secours = REGIME_SELON_AZGAAR[formeAzgaar ?? ''] ?? 'Royaume';
  return { nom: secours, raison: 'selon la carte, faute de doctrine marquée' };
}
