/**
 * Le contexte d'une fiche : tout ce dont les blocs ont besoin, sous une forme
 * unique et sérialisable.
 *
 * C'est la charnière du système. Les gabarits de page ne décrivent plus une
 * mise en page, ils décrivent des faits ; c'est la disposition de blocs qui
 * décide de ce qu'on montre et dans quel ordre. Le même objet est envoyé au
 * navigateur pour que l'éditeur puisse recomposer la page sans rien réinventer.
 */

import {
  etats, provinces, burgs, cultures, religions, monde,
  etatParId, provinceParId, cultureParId, burgParId,
  villesDeLEtat, villesDeLaProvince, provincesDeLEtat, villesDeLaCulture,
  habitants, nombre, superficie, annee, formeEtat, natureCulture, natureReligion,
  formeReligion, natureBurg, relation, unite, lien, nomAffiche, cheminTexte,
  type TypeEntite,
} from './monde';
import { htmlDe } from './contenu';
import type { Lieu as LieuEnregistre } from './stockage';
import type { CourantSuivi } from './politique';

export interface Fait {
  cle: string;
  valeur: string | null;
  href?: string;
}

export interface Item {
  nom: string;
  href: string;
  meta?: string;
  couleur?: string;
  valeur?: number;
}

export interface Cellule {
  t: string;
  href?: string;
  classe?: string;
}

export interface Groupe {
  titre: string;
  items?: Item[];
  colonnes?: string[];
  lignes?: Cellule[][];
  colonne?: string;
  colonneMeta?: string;
}

export interface Contexte {
  type: TypeEntite;
  /**
   * L'identifiant d'origine — celui d'Azgaar, ou celui du stockage pour un
   * lieu. Les adhésions politiques s'y accrochent plutôt qu'au slug, qui
   * changerait si Romain renommait l'entité dans sa carte.
   */
  identifiant: number | string;
  slug: string;
  titre: string;
  surtitre: string | null;
  couleur: string | null;
  blason: string | null;
  url: string;
  cheminTexte: string;
  corpsHtml: string | null;
  position: { x: number; y: number } | null;
  /**
   * Ce que l'entité professe : idéologies, doctrines, allégeances. Vide tant
   * que Romain n'a rien défini — rien n'est jamais supposé à sa place. La
   * fiche les injecte depuis le stockage, car ils n'existent pas dans la carte.
   */
  courants?: CourantSuivi[];
  /**
   * Ce que la nation est en propre : son régime — choisi ou déduit de ses
   * doctrines — et les doctrines elles-mêmes. Injecté par la fiche, comme les
   * courants : rien de tout cela n'existe dans la carte.
   */
  nation?: {
    regime: string;
    choisi: boolean;
    raison: string;
    doctrines: { axeId: string; nom: string; fanatique: boolean; teinte: string; sujet: string }[];
    devise?: string;
    dirigeant?: string;
    titreDirigeant?: string;
    avenement?: number;
  };
  faits: Fait[];
  chiffres: Fait[];
  groupes: Record<string, Groupe>;
}

/** Retire les faits vides : un registre lacunaire vaut mieux qu'un registre menteur. */
const nettoyer = (faits: Fait[]): Fait[] =>
  faits.filter((f) => f.valeur !== null && f.valeur !== undefined && f.valeur !== '' && f.valeur !== '—');

/** Vignette d'une ville, réutilisée par tous les types de fiches. */
const vignetteVille = (b: (typeof burgs)[number]): Item => ({
  nom: nomAffiche(b.nom),
  href: lien('burg', b.slug),
  meta: `${b.capitale ? 'Capitale' : b.categorie || 'Localité'}${b.port ? ' · port' : ''} · ${nombre(b.population)} hab.`,
  valeur: b.population,
});

/** Tableau détaillé des villes : le format le plus consulté du wiki. */
const tableauVilles = (liste: (typeof burgs)[number][], titre: string): Groupe => ({
  titre,
  colonnes: ['Ville', 'Statut', 'Habitants'],
  lignes: liste.map((b) => [
    { t: nomAffiche(b.nom), href: lien('burg', b.slug) },
    { t: `${b.capitale ? 'Capitale' : b.categorie || 'Localité'}${b.port ? ' · port' : ''}`, classe: 'discret' },
    { t: nombre(b.population), classe: 'num' },
  ]),
  items: liste.map(vignetteVille),
});

/* -------------------------------------------------------------- par type */

function contexteEtat(e: (typeof etats)[number]): Contexte {
  const villes = villesDeLEtat(e.id);
  const prov = provincesDeLEtat(e.id);
  const capitale = e.capitaleId ? burgParId.get(e.capitaleId) : undefined;
  const culture = e.cultureId ? cultureParId.get(e.cultureId) : undefined;
  const armee = e.regiments.reduce((n, r) => n + r.effectif, 0);

  const groupes: Record<string, Groupe> = {};

  if (prov.length) {
    groupes.provinces = {
      titre: 'Provinces',
      items: prov.map((p) => ({
        nom: p.nom,
        href: lien('province', p.slug),
        meta: `${p.titre} · ${habitants(p.population)} hab.`,
        couleur: p.couleur,
        valeur: p.population,
      })),
    };
  }

  if (villes.length) groupes.villes = tableauVilles(villes, 'Villes du royaume');

  if (e.campagnes.length) {
    groupes.campagnes = {
      titre: 'Campagnes militaires',
      colonnes: ['Campagne', 'Période', 'Adversaire', 'Rôle'],
      lignes: [...e.campagnes]
        .sort((a, b) => a.debut - b.debut)
        .map((c) => {
          const menee = c.attaquantId === e.id;
          const autre = etatParId.get(menee ? c.defenseurId : c.attaquantId);
          return [
            { t: c.nom },
            { t: `${annee(c.debut)} – ${annee(c.fin)}`, classe: 'chiffre' },
            autre
              ? { t: autre.nom, href: lien('etat', autre.slug) }
              : { t: 'un royaume aujourd’hui disparu', classe: 'discret' },
            { t: menee ? 'Assaillant' : 'Défenseur', classe: 'discret' },
          ];
        }),
    };
  }

  if (e.regiments.length) {
    groupes.regiments = {
      titre: 'Ordre de bataille',
      colonnes: ['Régiment', 'Effectif', 'Composition'],
      lignes: e.regiments.map((r) => [
        { t: `${r.icone} ${r.nom}` },
        { t: nombre(r.effectif), classe: 'num' },
        {
          t: Object.entries(r.unites)
            .sort((a, b) => b[1] - a[1])
            .map(([u, n]) => `${unite(u)} ${nombre(n)}`)
            .join(' · '),
          classe: 'discret',
        },
      ]),
    };
  }

  const voisins = e.diplomatie
    .map((d) => ({ d, autre: etatParId.get(d.etatId) }))
    .filter((x) => x.autre);
  if (voisins.length) {
    groupes.relations = {
      titre: 'Relations',
      items: voisins.map(({ d, autre }) => ({
        nom: autre!.nom,
        href: lien('etat', autre!.slug),
        meta: relation(d.relation),
        couleur: autre!.couleur,
      })),
    };
  }

  return {
    type: 'etat',
    identifiant: e.id,
    slug: e.slug,
    titre: e.nomComplet,
    surtitre: [formeEtat(e.forme), e.titre].filter(Boolean).join(' · '),
    couleur: e.couleur,
    blason: e.blason,
    url: lien('etat', e.slug),
    cheminTexte: cheminTexte('etat', e.slug),
    corpsHtml: htmlDe('etats', e.slug),
    position: e.x !== null && e.y !== null ? { x: e.x, y: e.y } : null,
    chiffres: nettoyer([
      { cle: 'Habitants', valeur: habitants(e.population) },
      { cle: 'Superficie', valeur: superficie(e.superficieKm2) },
      { cle: 'Villes', valeur: nombre(e.nbBurgs) },
      { cle: 'Provinces', valeur: nombre(prov.length) },
      { cle: 'Sous les armes', valeur: armee ? habitants(armee) : null },
    ]),
    faits: nettoyer([
      { cle: 'Capitale', valeur: capitale ? nomAffiche(capitale.nom) : null, href: capitale && lien('burg', capitale.slug) },
      { cle: 'Régime', valeur: formeEtat(e.forme) },
      { cle: 'Dont urbains', valeur: habitants(e.populationUrbaine) },
      { cle: 'Culture', valeur: culture?.nom ?? null, href: culture && lien('culture', culture.slug) },
    ]),
    groupes,
  };
}

function contexteProvince(p: (typeof provinces)[number]): Contexte {
  const etat = p.etatId ? etatParId.get(p.etatId) : undefined;
  const capitale = p.capitaleId ? burgParId.get(p.capitaleId) : undefined;
  const villes = villesDeLaProvince(p.id);

  return {
    type: 'province',
    identifiant: p.id,
    slug: p.slug,
    titre: p.nomComplet,
    surtitre: [p.titre, etat?.nom].filter(Boolean).join(' · '),
    couleur: p.couleur,
    blason: p.blason,
    url: lien('province', p.slug),
    cheminTexte: cheminTexte('province', p.slug),
    corpsHtml: htmlDe('provinces', p.slug),
    position: p.x !== null && p.y !== null ? { x: p.x, y: p.y } : null,
    chiffres: nettoyer([
      { cle: 'Habitants', valeur: habitants(p.population) },
      { cle: 'Superficie', valeur: superficie(p.superficieKm2) },
      { cle: 'Villes', valeur: nombre(villes.length) },
    ]),
    faits: nettoyer([
      { cle: 'Chef-lieu', valeur: capitale ? nomAffiche(capitale.nom) : null, href: capitale && lien('burg', capitale.slug) },
      { cle: 'Royaume', valeur: etat?.nom ?? null, href: etat && lien('etat', etat.slug) },
      { cle: 'Dont urbains', valeur: habitants(p.populationUrbaine) },
    ]),
    groupes: villes.length ? { villes: tableauVilles(villes, 'Villes de la province') } : {},
  };
}

function contexteVille(b: (typeof burgs)[number]): Contexte {
  const etat = b.etatId ? etatParId.get(b.etatId) : undefined;
  const province = b.provinceId ? provinceParId.get(b.provinceId) : undefined;
  const culture = b.cultureId ? cultureParId.get(b.cultureId) : undefined;

  const equipements = [
    b.remparts && 'Remparts',
    b.citadelle && 'Citadelle',
    b.temple && 'Temple',
    b.place && 'Place de marché',
    b.bidonville && 'Faubourgs pauvres',
    b.port && 'Port',
  ].filter(Boolean) as string[];

  const voisines = burgs
    .filter((v) => v.id !== b.id)
    .map((v) => ({ v, d: Math.hypot(v.x - b.x, v.y - b.y) }))
    .sort((a, x) => a.d - x.d)
    .slice(0, 6);

  return {
    type: 'burg',
    identifiant: b.id,
    slug: b.slug,
    titre: nomAffiche(b.nom),
    surtitre: [b.capitale ? 'Capitale' : b.categorie || 'Localité', etat?.nom].filter(Boolean).join(' · '),
    couleur: etat?.couleur ?? null,
    blason: null,
    url: lien('burg', b.slug),
    cheminTexte: cheminTexte('burg', b.slug),
    corpsHtml: htmlDe('villes', b.slug),
    position: { x: b.x, y: b.y },
    chiffres: nettoyer([
      { cle: 'Habitants', valeur: nombre(b.population) },
      { cle: 'Vocation', valeur: natureBurg(b.nature) },
      { cle: 'Aménagements', valeur: equipements.length ? String(equipements.length) : null },
    ]),
    faits: nettoyer([
      { cle: 'Royaume', valeur: etat?.nom ?? null, href: etat && lien('etat', etat.slug) },
      { cle: 'Province', valeur: province?.nom ?? null, href: province && lien('province', province.slug) },
      { cle: 'Culture', valeur: culture?.nom ?? null, href: culture && lien('culture', culture.slug) },
      { cle: 'Ce qu’on y trouve', valeur: equipements.join(', ') || null },
      { cle: 'Position', valeur: `${Math.round(b.x)}, ${Math.round(b.y)}` },
    ]),
    groupes: {
      alentours: {
        titre: 'Alentours',
        items: voisines.map(({ v, d }) => ({
          nom: nomAffiche(v.nom),
          href: lien('burg', v.slug),
          meta: `à ${nombre(Math.round(d * monde.echelleKmParPixel))} km · ${habitants(v.population)} hab.`,
          valeur: v.population,
        })),
      },
    },
  };
}

function contexteCulture(c: (typeof cultures)[number]): Contexte {
  const villes = villesDeLaCulture(c.id);
  const cultes = religions.filter((r) => r.cultureId === c.id);
  const royaumes = etats.filter((e) => e.cultureId === c.id);
  const origine = c.origines.map((id) => cultureParId.get(id)).find(Boolean);

  const groupes: Record<string, Groupe> = {};
  if (royaumes.length) {
    groupes.royaumes = {
      titre: 'Royaumes de cette culture',
      items: royaumes.map((e) => ({
        nom: e.nom,
        href: lien('etat', e.slug),
        meta: `${habitants(e.population)} habitants`,
        couleur: e.couleur,
        valeur: e.population,
      })),
    };
  }
  if (cultes.length) {
    groupes.religions = {
      titre: 'Religions issues de cette culture',
      items: cultes.map((r) => ({
        nom: r.nom,
        href: lien('religion', r.slug),
        meta: formeReligion(r.forme),
        couleur: r.couleur,
        valeur: r.fideles,
      })),
    };
  }
  if (villes.length) groupes.villes = tableauVilles(villes, 'Villes de cette culture');

  return {
    type: 'culture',
    identifiant: c.id,
    slug: c.slug,
    titre: c.nom,
    surtitre: `Culture · ${natureCulture(c.nature)}`,
    couleur: c.couleur,
    blason: null,
    url: lien('culture', c.slug),
    cheminTexte: cheminTexte('culture', c.slug),
    corpsHtml: htmlDe('cultures', c.slug),
    position: null,
    chiffres: nettoyer([
      { cle: 'Villes', valeur: nombre(villes.length) },
      { cle: 'Population', valeur: habitants(villes.reduce((n, b) => n + b.population, 0)) },
      { cle: 'Emprise', valeur: superficie(c.superficieKm2) },
    ]),
    faits: nettoyer([
      { cle: 'Mode de vie', valeur: natureCulture(c.nature) },
      { cle: 'Issue de', valeur: origine?.nom ?? null, href: origine && lien('culture', origine.slug) },
      { cle: 'Code', valeur: c.code },
    ]),
    groupes,
  };
}

function contexteReligion(r: (typeof religions)[number]): Contexte {
  const culture = r.cultureId ? cultureParId.get(r.cultureId) : undefined;
  const soeurs = religions.filter((x) => x.id !== r.id && x.cultureId === r.cultureId);

  return {
    type: 'religion',
    identifiant: r.id,
    slug: r.slug,
    titre: r.nom,
    surtitre: `Religion · ${natureReligion(r.nature)}`,
    couleur: r.couleur,
    blason: null,
    url: lien('religion', r.slug),
    cheminTexte: cheminTexte('religion', r.slug),
    corpsHtml: htmlDe('religions', r.slug),
    position: null,
    chiffres: nettoyer([
      { cle: 'Fidèles', valeur: habitants(r.fideles) },
      { cle: 'Emprise', valeur: superficie(r.superficieKm2) },
      { cle: 'Forme', valeur: formeReligion(r.forme) },
    ]),
    faits: nettoyer([
      { cle: 'Nature', valeur: natureReligion(r.nature) },
      { cle: 'Divinité', valeur: r.divinite },
      { cle: 'Culture d’origine', valeur: culture?.nom ?? null, href: culture && lien('culture', culture.slug) },
    ]),
    groupes: soeurs.length
      ? {
          soeurs: {
            titre: 'Nées de la même culture',
            items: soeurs.map((x) => ({
              nom: x.nom,
              href: lien('religion', x.slug),
              meta: formeReligion(x.forme),
              couleur: x.couleur,
              valeur: x.fideles,
            })),
          },
        }
      : {},
  };
}

function contexteLieu(l: LieuEnregistre): Contexte {
  const proches = burgs
    .map((b) => ({ b, d: Math.hypot(b.x - l.x, b.y - l.y) }))
    .sort((a, x) => a.d - x.d)
    .slice(0, 4);
  const laPlusProche = proches[0];
  const etat = laPlusProche?.b.etatId ? etatParId.get(laPlusProche.b.etatId) : undefined;

  return {
    type: 'lieu',
    identifiant: l.id,
    slug: l.slug,
    titre: l.nom,
    surtitre: `${l.icone} ${l.categorie}`.trim(),
    couleur: l.couleur,
    blason: null,
    url: lien('lieu', l.slug),
    cheminTexte: cheminTexte('lieu', l.slug),
    corpsHtml: htmlDe('lieux', l.slug),
    position: { x: l.x, y: l.y },
    chiffres: nettoyer([{ cle: 'Nature', valeur: l.categorie }]),
    faits: nettoyer([
      { cle: 'Nature', valeur: l.categorie },
      {
        cle: 'Ville la plus proche',
        valeur: laPlusProche
          ? `${nomAffiche(laPlusProche.b.nom)} (${nombre(Math.round(laPlusProche.d * monde.echelleKmParPixel))} km)`
          : null,
        href: laPlusProche && lien('burg', laPlusProche.b.slug),
      },
      { cle: 'Contrée', valeur: etat?.nom ?? null, href: etat && lien('etat', etat.slug) },
      { cle: 'Position', valeur: `${Math.round(l.x)}, ${Math.round(l.y)}` },
    ]),
    groupes: {
      alentours: {
        titre: 'Aux alentours',
        items: proches.map(({ b, d }) => ({
          nom: nomAffiche(b.nom),
          href: lien('burg', b.slug),
          meta: `à ${nombre(Math.round(d * monde.echelleKmParPixel))} km · ${habitants(b.population)} hab.`,
          valeur: b.population,
        })),
      },
    },
  };
}

/* ------------------------------------------------------------- aiguillage */

export const contexteDe = {
  etat: contexteEtat,
  province: contexteProvince,
  burg: contexteVille,
  culture: contexteCulture,
  religion: contexteReligion,
  lieu: contexteLieu,
};
