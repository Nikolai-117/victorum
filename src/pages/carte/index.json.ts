/**
 * L'index de l'atlas : tout ce que la carte doit savoir des entités qu'elle
 * dessine, en un seul fichier téléchargé au chargement.
 *
 * Il est composé ici plutôt qu'à l'import parce qu'il est *affiché* : noms des
 * villes sans nom, formes d'État en français, natures de culture… tout ce
 * vocabulaire vit dans `monde.ts`, et le recopier dans le script d'import en
 * ferait deux versions à tenir. Les faits, eux, restent ceux de l'import :
 * rien n'est inventé ici, seulement mis en forme.
 */

import type { APIRoute } from 'astro';
import {
  burgs, etats, provinces, cultures, religions,
  burgParId, cultureParId, etatParId,
  nomAffiche, natureBurg, formeEtat, natureCulture, natureReligion, formeReligion,
} from '../../lib/monde';

/** Part de la population du plus gros représentant : la jauge du panneau. */
const partDe = (valeur: number, maximum: number) =>
  maximum > 0 ? Math.round((valeur / maximum) * 100) / 100 : undefined;

const vide = <T,>(v: T | null | undefined | 0 | ''): T | undefined =>
  v === null || v === undefined || v === 0 || v === '' ? undefined : (v as T);

const plusGrandeVille = Math.max(...burgs.map((b) => b.population), 0);
const plusGrandEtat = Math.max(...etats.map((e) => e.population), 0);
const plusGrandeProvince = Math.max(...provinces.map((p) => p.population), 0);

/** Rang par la population, au sein de sa propre famille. */
const classement = (liste: { id: number; population: number }[]) =>
  new Map(
    [...liste]
      .sort((a, b) => b.population - a.population)
      .map((e, i) => [e.id, i + 1])
  );

const rangVille = classement(burgs);
const rangEtat = classement(etats);
const rangProvince = classement(provinces);

const nomEtat = (id: number | null | undefined) => (id ? etatParId.get(id)?.nom : undefined);
const slugEtat = (id: number | null | undefined) => (id ? etatParId.get(id)?.slug : undefined);
const nomCulture = (id: number | null | undefined) => (id ? cultureParId.get(id)?.nom : undefined);

/** Ce qu'une ville a de remarquable, dit en un mot chacun. */
function traitsVille(b: (typeof burgs)[number]): string[] {
  const traits: string[] = [];
  if (b.port) traits.push('Port');
  if (b.citadelle) traits.push('Citadelle');
  if (b.remparts) traits.push('Remparts');
  if (b.temple) traits.push('Temple');
  if (b.place) traits.push('Halle');
  if (b.bidonville) traits.push('Faubourgs');
  return traits;
}

const index = [
  ...burgs.map((b) => {
    const etat = b.etatId ? etatParId.get(b.etatId) : undefined;
    const province = b.provinceId ? provinces.find((p) => p.id === b.provinceId) : undefined;
    return {
      t: 'burg',
      s: b.slug,
      n: nomAffiche(b.nom),
      x: b.x,
      y: b.y,
      i: b.id,
      d: b.capitale ? 'Capitale' : b.categorie || 'Localité',
      col: etat?.couleur,
      bl: etat?.blason ?? undefined,
      f: {
        pop: b.population,
        part: partDe(b.population, plusGrandeVille),
        rang: rangVille.get(b.id),
        etat: etat?.nom,
        etatSlug: etat?.slug,
        prov: province?.nom,
        provSlug: province?.slug,
        cult: vide(nomCulture(b.cultureId)),
        nat: b.nature ? natureBurg(b.nature) : undefined,
        traits: traitsVille(b),
      },
    };
  }),

  ...etats.map((e) => {
    const capitale = e.capitaleId ? burgParId.get(e.capitaleId) : undefined;
    return {
      t: 'etat',
      s: e.slug,
      n: e.nomComplet,
      x: e.x,
      y: e.y,
      i: e.id,
      d: formeEtat(e.forme),
      // La forme brute d'Azgaar : l'atlas s'en sert pour déduire un régime
      // quand la nation n'a pas encore de doctrine marquée.
      forme: e.forme,
      col: e.couleur,
      bl: e.blason ?? undefined,
      f: {
        pop: e.population,
        part: partDe(e.population, plusGrandEtat),
        rang: rangEtat.get(e.id),
        urb: vide(e.populationUrbaine),
        rur: vide(e.populationRurale),
        km2: e.superficieKm2,
        burgs: e.nbBurgs,
        prov: vide(e.provinceIds.length),
        cap: capitale ? nomAffiche(capitale.nom) : undefined,
        capSlug: capitale?.slug,
        cult: vide(nomCulture(e.cultureId)),
        armee: vide(e.regiments.reduce((n, r) => n + r.effectif, 0)),
      },
    };
  }),

  ...provinces.map((p) => {
    const capitale = p.capitaleId ? burgParId.get(p.capitaleId) : undefined;
    return {
      t: 'province',
      s: p.slug,
      n: p.nomComplet,
      x: p.x,
      y: p.y,
      i: p.id,
      d: p.titre || 'Province',
      col: p.couleur,
      bl: p.blason ?? undefined,
      f: {
        pop: p.population,
        part: partDe(p.population, plusGrandeProvince),
        rang: rangProvince.get(p.id),
        km2: p.superficieKm2,
        etat: nomEtat(p.etatId),
        etatSlug: slugEtat(p.etatId),
        burgs: vide(p.burgIds.length),
        cap: capitale ? nomAffiche(capitale.nom) : undefined,
        capSlug: capitale?.slug,
      },
    };
  }),

  ...cultures.map((c) => ({
    t: 'culture',
    s: c.slug,
    n: c.nom,
    x: null,
    y: null,
    i: c.id,
    d: 'Culture',
    col: c.couleur,
    f: {
      nat: natureCulture(c.nature),
      pop: vide(c.populationUrbaine + c.populationRurale),
      km2: vide(c.superficieKm2),
    },
  })),

  ...religions.map((r) => ({
    t: 'religion',
    s: r.slug,
    n: r.nom,
    x: null,
    y: null,
    i: r.id,
    d: natureReligion(r.nature),
    col: r.couleur,
    f: {
      forme: formeReligion(r.forme),
      pop: vide(r.fideles),
      km2: vide(r.superficieKm2),
      cult: vide(nomCulture(r.cultureId)),
      dieu: vide(r.divinite),
    },
  })),
];

export const GET: APIRoute = () =>
  new Response(JSON.stringify(index), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
