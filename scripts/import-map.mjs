/**
 * Import d'un export Azgaar's Fantasy Map Generator (.map) vers les données du site.
 *
 * RÈGLE ABSOLUE : ce script n'écrit QUE des faits.
 * Noms, positions, populations, hiérarchies, dates, relations — rien d'autre.
 * Il ne rédige aucun résumé, aucune description, aucune accroche, et ne crée ni
 * ne modifie jamais un fichier Markdown : le lore appartient à Romain seul.
 * Réimporter une carte mise à jour est donc toujours sans risque pour ses textes.
 *
 *   node scripts/import-map.mjs [chemin/vers/carte.map]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genererTextureOcean } from './generer-texture.mjs';
import { composerProvinces } from './provinces.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2] || path.join(RACINE, 'data', 'source', 'victorum.map');
const SORTIE_DONNEES = path.join(RACINE, 'src', 'data');
const SORTIE_CARTE = path.join(RACINE, 'public', 'carte');
const SORTIE_COUCHES = path.join(SORTIE_CARTE, 'couches');
const SORTIE_BLASONS = path.join(SORTIE_CARTE, 'blasons');

/* ------------------------------------------------------------------ outils */

const ko = (n) => (n / 1024).toFixed(0) + ' Ko';
const mo = (n) => (n / 1048576).toFixed(2) + ' Mo';
const DIACRITIQUES = /[̀-ͯ]/g;

/** Slug d'URL : sans accents, sans espaces, stable d'un import à l'autre. */
function slugifier(nom, secours) {
  const base = String(nom ?? '')
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `sans-nom-${secours}`;
}

/** Attribue des slugs uniques : en cas d'homonymes, on suffixe par l'identifiant Azgaar. */
function slugsUniques(items) {
  const occurrences = new Map();
  for (const it of items) {
    const base = slugifier(it.nom, it.id);
    occurrences.set(base, (occurrences.get(base) || 0) + 1);
  }
  for (const it of items) {
    const base = slugifier(it.nom, it.id);
    it.slug = occurrences.get(base) > 1 ? `${base}-${it.id}` : base;
  }
  return items;
}

/** Neutralise le HTML des légendes Azgaar : ~100 notes embarquent des iframes externes. */
function assainir(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/* -------------------------------------------------- lecture et détection */

if (!fs.existsSync(SOURCE)) {
  console.error(`\n  Carte introuvable : ${SOURCE}\n  Place ton export Azgaar là, ou passe son chemin en argument.\n`);
  process.exit(1);
}

const brut = fs.readFileSync(SOURCE, 'utf8');
const lignes = brut.split('\n');
console.log(`\n  Source  ${path.basename(SOURCE)}  (${mo(Buffer.byteLength(brut))}, ${lignes.length} lignes)`);

/**
 * Le .map est un fichier à lignes indexées dont l'ordre a déjà changé entre
 * versions d'Azgaar. On identifie donc chaque tableau par sa signature de clés
 * plutôt que par son numéro de ligne : un réexport reste lisible sans retoucher
 * ce script. La signature est cherchée dans l'union des clés d'un échantillon,
 * car Azgaar réserve l'index 0 à une entrée neutre aux clés incomplètes
 * (« Neutrals », « Wildlands », « No religion »).
 */
const SIGNATURES = {
  burgs: ['cell', 'x', 'y', 'i', 'state', 'culture', 'population'],
  etats: ['i', 'name', 'diplomacy', 'provinces', 'capital', 'center'],
  cultures: ['name', 'base', 'shield', 'center', 'i', 'expansionism'],
  provinces: ['i', 'state', 'center', 'burg', 'formName', 'fullName'],
  religions: ['name', 'type', 'form', 'culture', 'deity', 'expansion'],
  notes: ['id', 'name', 'legend'],
  zones: ['i', 'name', 'type', 'cells', 'color'],
};

const trouve = {};
for (const ligne of lignes) {
  if (ligne.charCodeAt(0) !== 91 /* [ */) continue;
  let tableau;
  try {
    tableau = JSON.parse(ligne);
  } catch {
    continue;
  }
  if (!Array.isArray(tableau) || tableau.length === 0) continue;

  const cles = new Set();
  for (let k = 0; k < Math.min(tableau.length, 30); k++) {
    const e = tableau[k];
    if (e && typeof e === 'object' && !Array.isArray(e)) for (const c of Object.keys(e)) cles.add(c);
  }
  if (cles.size === 0) continue;

  for (const [nom, requises] of Object.entries(SIGNATURES)) {
    if (trouve[nom]) continue;
    if (requises.every((k) => cles.has(k))) {
      trouve[nom] = tableau;
      break;
    }
  }
}

const manquants = Object.keys(SIGNATURES).filter((k) => !trouve[k]);
if (manquants.length) console.log(`  ATTENTION, non détecté : ${manquants.join(', ')}`);

/* ------------------------------------------------------------ métadonnées */

const [version, , dateExport, graine, largeur, hauteur] = lignes[0].split('|');
const s = lignes[1].split('|');
let options = {};
try {
  options = JSON.parse(s[19] || '{}');
} catch {}

const echelle = Number(s[1]) || 1; // km par pixel
const tauxPopulation = Number(s[12]) || 1000;
const urbanisation = Number(s[13]) || 1;

/** Population réelle : Azgaar stocke des milliers d'habitants. */
const pop = (v) => Math.round((Number(v) || 0) * tauxPopulation);
/** Superficie réelle : Azgaar stocke des pixels², convertis par l'échelle. */
const aire = (v) => Math.round((Number(v) || 0) * echelle * echelle);

const monde = {
  nom: s[20] || 'Victorum',
  versionAzgaar: version,
  dateExport,
  graine,
  largeur: Number(largeur),
  hauteur: Number(hauteur),
  uniteDistance: s[0] || 'km',
  echelleKmParPixel: echelle,
  tauxPopulation,
  urbanisation,
  annee: options.year ?? null,
  ere: options.era ?? null,
  ereCourte: options.eraShort ?? null,
  importeLe: new Date().toISOString(),
};

/* -------------------------------------------------------------- entités */

const notesParId = new Map((trouve.notes || []).map((n) => [n.id, n]));
const vivant = (e) => e && !e.removed && e.i !== 0 && e.name;

/**
 * Les états supprimés d'Azgaar n'ont plus de territoire, mais ils ont existé :
 * ce sont les adversaires des guerres passées. On garde leurs noms pour que la
 * chronologie dise « contre le Royaume de Rotham » plutôt que « état disparu ».
 */
const nomsHistoriques = new Map(
  (trouve.etats || []).filter((e) => e && e.i !== 0 && e.name).map((e) => [e.i, e.fullName || e.name])
);
const etatsVivants = new Set((trouve.etats || []).filter(vivant).map((e) => e.i));

// — Cultures
const cultures = slugsUniques(
  (trouve.cultures || []).filter(vivant).map((c) => ({
    id: c.i,
    type: 'culture',
    nom: c.name,
    code: c.code,
    couleur: c.color,
    nature: c.type, // Nomadic, Highland, Naval, River, Lake, Hunting, Generic
    expansionnisme: c.expansionism,
    origines: (c.origins || []).filter(Boolean),
    superficieKm2: aire(c.area),
    populationUrbaine: pop(c.urban),
    populationRurale: pop(c.rural),
  }))
);

// — États
const etats = slugsUniques(
  (trouve.etats || []).filter(vivant).map((e) => ({
    id: e.i,
    type: 'etat',
    nom: e.name,
    nomComplet: e.fullName || e.name,
    forme: e.form, // Monarchy, Republic…
    titre: e.formName, // Kingdom, Duchy…
    couleur: e.color,
    capitaleId: e.capital || null,
    cultureId: e.culture || null,
    provinceIds: e.provinces || [],
    nbBurgs: e.burgs || 0,
    superficieKm2: aire(e.area),
    populationUrbaine: pop(e.urban),
    populationRurale: pop(e.rural),
    population: pop(e.urban) + pop(e.rural),
    voisinIds: (e.neighbors || []).filter(Boolean),
    x: e.pole?.[0] ?? null,
    y: e.pole?.[1] ?? null,
    diplomatie: (e.diplomacy || [])
      .map((relation, etatId) => ({ etatId, relation }))
      .filter((d) => d.relation && d.relation !== 'x' && d.etatId !== 0),
    campagnes: (e.campaigns || []).map((c) => ({
      nom: c.name,
      debut: c.start,
      fin: c.end,
      attaquantId: c.attacker,
      defenseurId: c.defender,
      attaquant: nomsHistoriques.get(c.attacker) ?? null,
      defenseur: nomsHistoriques.get(c.defender) ?? null,
      attaquantDisparu: !etatsVivants.has(c.attacker),
      defenseurDisparu: !etatsVivants.has(c.defender),
    })),
    regiments: (e.military || []).map((r) => ({
      nom: r.name,
      effectif: Math.round((r.a || 0) * tauxPopulation),
      icone: r.icon,
      naval: r.n === 1,
      x: r.x,
      y: r.y,
      unites: Object.fromEntries(
        Object.entries(r.u || {}).map(([k, v]) => [k, Math.round(v * tauxPopulation)])
      ),
    })),
  }))
);

// — Provinces
const provinces = slugsUniques(
  (trouve.provinces || []).filter(vivant).map((p) => ({
    id: p.i,
    type: 'province',
    nom: p.name,
    nomComplet: p.fullName || p.name,
    titre: p.formName,
    couleur: p.color,
    etatId: p.state || null,
    capitaleId: p.burg || null,
    burgIds: p.burgs || [],
    superficieKm2: aire(p.area),
    populationUrbaine: pop(p.urban),
    populationRurale: pop(p.rural),
    population: pop(p.urban) + pop(p.rural),
    x: p.pole?.[0] ?? null,
    y: p.pole?.[1] ?? null,
  }))
);

// — Religions
const religions = slugsUniques(
  (trouve.religions || []).filter(vivant).map((r) => ({
    id: r.i,
    type: 'religion',
    nom: r.name,
    code: r.code,
    couleur: r.color,
    nature: r.type, // Folk, Organized, Cult, Heresy
    forme: r.form, // Animism, Polytheism…
    divinite: r.deity,
    cultureId: r.culture || null,
    expansion: r.expansion,
    superficieKm2: aire(r.area),
    fideles: pop(r.urban) + pop(r.rural),
  }))
);

// — Burgs. On jette production/trade/coa : des centaines de Ko sans usage éditorial.
//
// Seules les villes rattachées à l'un des royaumes vivants sont retenues : les
// centaines de bourgs neutres générés par Azgaar n'appartiennent à aucune nation
// du monde de Victorum et noieraient le wiki sous des fiches sans objet.
const burgs = slugsUniques(
  (trouve.burgs || []).filter((b) => vivant(b) && etatsVivants.has(b.state)).map((b) => ({
    id: b.i,
    type: 'burg',
    nom: String(b.name).trim(),
    x: b.x,
    y: b.y,
    etatId: b.state || null,
    cultureId: b.culture || null,
    population: pop(b.population),
    capitale: !!b.capital,
    port: !!b.port,
    categorie: b.group || null, // libellés déjà en français dans la carte
    nature: b.type, // Naval, Highland, Generic…
    citadelle: !!b.citadel,
    remparts: !!b.walls,
    temple: !!b.temple,
    place: !!b.plaza,
    bidonville: !!b.shanty,
  }))
);

// Rattachement burg → province (la province porte la liste de ses burgs)
const provinceParBurg = new Map();
for (const p of provinces) for (const bid of p.burgIds) provinceParBurg.set(bid, p.id);
for (const b of burgs) b.provinceId = provinceParBurg.get(b.id) ?? null;

// — Lieux remarquables : plus rien n'est importé ici.
//
// Azgaar en génère des centaines, tous identiques : 140 « Dungeon », 71
// « Encounter », 41 « Ruins »… Des noms de remplissage, en anglais, sans
// rapport avec le monde de Romain. Ils noyaient le wiki et la carte.
// Les lieux sont désormais posés par Romain lui-même depuis l'atlas, avec
// leur nom, leur icône et leur couleur, et vivent dans le stockage du site.
const marqueurs = [];

// — Zones (invasions, rébellions, catastrophes)
const NATURES_ZONES = {
  Invasion: 'Invasion', Rebellion: 'Rébellion', Rebels: 'Rébellion', Eruption: 'Éruption',
  Flood: 'Inondation', Disease: 'Épidémie', Plague: 'Peste', Disaster: 'Catastrophe',
  Catastrophe: 'Catastrophe', Landslide: 'Glissement de terrain', Tsunami: 'Tsunami',
  Drought: 'Sécheresse', Wildfire: 'Incendie', Avalanche: 'Avalanche',
  Proselytism: 'Prosélytisme', Crusade: 'Croisade', Persecution: 'Persécution',
  Raid: 'Razzia', Scourge: 'Fléau', Earthquake: 'Séisme',
};
const zones = slugsUniques(
  (trouve.zones || []).map((z) => ({
    id: z.i,
    type: 'zone',
    nom: z.name,
    nature: NATURES_ZONES[z.type] || z.type,
    natureBrute: z.type,
    nbCellules: (z.cells || []).length,
  }))
);

// — Chronologie : campagnes militaires datées, dédoublonnées entre belligérants
const nomEtat = new Map(etats.map((e) => [e.id, e.nom]));
const slugEtatParId = new Map(etats.map((e) => [e.id, e.slug]));
const vues = new Set();
const chronologie = [];
for (const e of etats) {
  for (const c of e.campagnes) {
    const cle = `${c.nom}|${c.debut}|${c.fin}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    chronologie.push({
      nom: c.nom,
      debut: c.debut,
      fin: c.fin,
      attaquant: c.attaquant,
      defenseur: c.defenseur,
      attaquantSlug: slugEtatParId.get(c.attaquantId) ?? null,
      defenseurSlug: slugEtatParId.get(c.defenseurId) ?? null,
      attaquantDisparu: c.attaquantDisparu,
      defenseurDisparu: c.defenseurDisparu,
    });
  }
}
chronologie.sort((a, b) => a.debut - b.debut || a.fin - b.fin);

/* -------------------------------------------------- découpage du SVG */

const iDebutSvg = lignes.findIndex((l) => l.trimStart().startsWith('<svg'));
const iFinSvg = lignes.findIndex((l) => l.trimEnd().endsWith('</svg>'));
const svg = lignes.slice(iDebutSvg, iFinSvg + 1).join('\n');

/**
 * Découpe les enfants directs `<g id="…">` d'une portion de SVG.
 * Les balises auto-fermantes `<g id="x"/>` (couches désactivées dans Azgaar)
 * sont fréquentes et ne doivent surtout pas ouvrir un niveau de profondeur.
 */
function enfantsDirects(texte, debut, fin) {
  const balises = /<(\/?)g\b([^>]*?)(\/?)>/g;
  balises.lastIndex = debut;
  const enfants = [];
  let profondeur = 0;
  let debutEnfant = -1;
  let idEnfant = null;
  let m;
  while ((m = balises.exec(texte)) && m.index < fin) {
    const fermante = m[1] === '/';
    const autoFermante = m[3] === '/';
    if (fermante) {
      profondeur--;
      if (profondeur === 0 && debutEnfant >= 0) {
        enfants.push({ id: idEnfant, contenu: texte.slice(debutEnfant, balises.lastIndex) });
        debutEnfant = -1;
      }
    } else if (!autoFermante) {
      if (profondeur === 0) {
        debutEnfant = m.index;
        idEnfant = (m[2].match(/\bid="([^"]+)"/) || [])[1] || `couche-${enfants.length}`;
      }
      profondeur++;
    }
  }
  return enfants;
}

/** Une couche n'est utile que si elle contient autre chose que des groupes vides. */
function contientDuDessin(fragment) {
  return /<(path|use|text|circle|rect|image|polygon|polyline|line|ellipse)\b/.test(fragment);
}

/**
 * Aperçu de la carte, servi comme fond du bloc « Situation » des fiches.
 *
 * On ne réutilise pas les couches de l'atlas : elles pèsent trop lourd pour une
 * vignette et dépendent d'un mégaoctet de définitions. On recompose donc une
 * carte muette et autonome — mer, littoral, royaumes, frontières — dont les
 * tracés se suffisent à eux-mêmes. Les renvois à des filtres ou des masques
 * sont retirés, sans quoi le fichier ne s'afficherait pas seul.
 */
function composerApercu(fragments, largeur, hauteur) {
  const autonome = (svg) =>
    (svg || '')
      .replace(/\s(?:filter|mask|clip-path)="[^"]*"/g, '')
      .replace(/\sfilter:\s*url\([^)]*\);?/g, '');

  const couches = ['coastline', 'lakes', 'regions', 'borders']
    .map((id) => autonome(fragments.get(id)))
    .filter(Boolean)
    .join('\n');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}">\n` +
    `<rect width="${largeur}" height="${hauteur}" fill="#22384f"/>\n` +
    couches +
    `\n</svg>\n`
  );
}

/**
 * Le SVG d'Azgaar dessine les 451 bourgs de la carte, y compris ceux qu'on
 * vient d'écarter des données. Sans ce nettoyage, la carte afficherait des
 * pastilles et des noms qui ne mènent à aucune fiche.
 */
function retirerVillesEcartees(fragment, idsRetenus) {
  let retires = 0;
  const garder = (id) => idsRetenus.has(Number(id));

  // Pastilles de villes et ancres de ports : éléments auto-fermants.
  let sortie = fragment.replace(/<use\b[^>]*?\bid="(?:burg|anchor)(\d+)"[^>]*?\/>/g, (tout, id) => {
    if (garder(id)) return tout;
    retires++;
    return '';
  });

  // Étiquettes de villes : élément texte avec son contenu.
  sortie = sortie.replace(/<text\b[^>]*?\bid="burgLabel(\d+)"[\s\S]*?<\/text>/g, (tout, id) =>
    garder(id) ? tout : ''
  );

  return { fragment: sortie, retires };
}

/**
 * Azgaar conserve `display:none` sur les couches que l'auteur avait masquées
 * au moment de la sauvegarde. Ici, c'est l'interface du site qui décide de ce
 * qui s'affiche : on retire ce verrou du groupe racine, sinon la case à cocher
 * correspondante n'a aucun effet visible.
 */
function rendreVisible(fragment) {
  let masquee = false;
  const corrige = fragment.replace(/^<g\b[^>]*>/, (ouverture) => {
    if (!/display\s*[:=]\s*["']?\s*none/i.test(ouverture)) return ouverture;
    masquee = true;
    return ouverture
      .replace(/\sstyle="([^"]*)"/i, (_, style) => {
        const reste = style.replace(/display\s*:\s*none\s*;?/gi, '').trim();
        return reste ? ` style="${reste}"` : '';
      })
      .replace(/\sdisplay="none"/gi, '');
  });
  return { fragment: corrige, masquee };
}

/** Extrait un élément complet `<balise …>…</balise>` commençant à `depuis`. */
function elementComplet(texte, depuis, nomBalise) {
  const balises = new RegExp(`<(\\/?)${nomBalise}\\b[^>]*?(\\/?)>`, 'g');
  balises.lastIndex = depuis;
  let profondeur = 0;
  let m;
  while ((m = balises.exec(texte))) {
    if (m[1] === '/') {
      if (--profondeur === 0) return texte.slice(depuis, balises.lastIndex);
    } else if (m[2] !== '/') {
      profondeur++;
    } else if (profondeur === 0) {
      return texte.slice(depuis, balises.lastIndex);
    }
  }
  return texte.slice(depuis);
}

// defs : indispensable (les couches y référencent chemins de côtes, symboles, filtres)
const iDefs = svg.indexOf('<defs');
let defs = iDefs >= 0 ? elementComplet(svg, iDefs, 'defs') : '';

// Azgaar référence ses textures en relatif : on rend le chemin absolu pour
// qu'il se résolve depuis n'importe quelle page du site.
defs = defs.replace(/href="\.?\/?images\//g, 'href="/images/');
const dossierImages = path.join(RACINE, 'public', 'images');
fs.mkdirSync(dossierImages, { recursive: true });
const cheminTexture = path.join(dossierImages, 'pattern1.png');
if (!fs.existsSync(cheminTexture)) genererTextureOcean(cheminTexture);

// Symboles de relief et d'icônes : référencés par l'export, jamais embarqués.
// Sans eux, la carte perd ses montagnes, ses forêts et ses pastilles de villes.
const cheminSymboles = path.join(RACINE, 'data', 'azgaar', 'defs-symboles.svg');
let symbolesAjoutes = 0;
if (fs.existsSync(cheminSymboles)) {
  const symboles = fs.readFileSync(cheminSymboles, 'utf8');
  symbolesAjoutes = (symboles.match(/<(?:symbol|g)\b[^>]*?\bid="/g) || []).length;
  defs = defs.replace(/<\/defs>\s*$/, `${symboles}\n</defs>`);
} else {
  console.log('  ATTENTION : data/azgaar/defs-symboles.svg absent.');
  console.log('              Lance « node scripts/extraire-symboles.mjs », sinon la carte');
  console.log('              s’affichera sans reliefs ni icônes de villes.');
}

// Les blasons personnalisés sont des PNG base64 : plus d'un mégaoctet à eux seuls,
// et la couche « emblems » de la carte est vide. On les sort des defs pour les
// servir un par un sur les fiches concernées.
fs.rmSync(SORTIE_BLASONS, { recursive: true, force: true });
fs.mkdirSync(SORTIE_BLASONS, { recursive: true });
const blasons = new Map();
const iEmblemes = defs.indexOf('<g id="defs-emblems"');
if (iEmblemes >= 0) {
  const bloc = elementComplet(defs, iEmblemes, 'g');
  for (const m of bloc.matchAll(/<svg\b[^>]*?\bid="(state|province)COA(\d+)"/g)) {
    const contenu = elementComplet(bloc, m.index, 'svg');
    // Extrait d'une carte qui portait la déclaration de namespace, ce SVG en
    // est dépourvu. Chargé seul dans une balise <img>, il serait rejeté.
    const autonome = contenu.replace(
      /^<svg/,
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
    const nom = `${m[1] === 'state' ? 'etat' : 'province'}-${m[2]}.svg`;
    fs.writeFileSync(path.join(SORTIE_BLASONS, nom), autonome);
    blasons.set(`${m[1]}-${m[2]}`, `/carte/blasons/${nom}`);
  }
  defs = defs.slice(0, iEmblemes) + defs.slice(iEmblemes + bloc.length);
}
for (const e of etats) e.blason = blasons.get(`state-${e.id}`) || null;
for (const p of provinces) p.blason = blasons.get(`province-${p.id}`) || null;

// Couches : uniquement les enfants de #viewbox (scaleBar, vignette et legend
// vivent hors du repère de la carte et ne suivraient pas le zoom).
const iViewbox = svg.indexOf('<g id="viewbox"');
const zoneCouches = iViewbox >= 0
  ? { debut: iViewbox, fin: iViewbox + elementComplet(svg, iViewbox, 'g').length }
  : { debut: 0, fin: svg.length };
const couchesBrutes = enfantsDirects(svg, zoneCouches.debut + 1, zoneCouches.fin);

/**
 * Couches sans intérêt pour un wiki : le brouillard de guerre sert à masquer
 * des régions pendant une partie, pas à consulter un atlas. Il encombrerait la
 * liste des réglages sans jamais servir.
 */
const COUCHES_EXCLUES = new Set([
  'fogging-cont',
  'debug',
  'ruler',
  // La rose des vents n'a jamais été positionnée dans Azgaar : son `<use>` est
  // dépourvu de transformation et le symbole s'étale alors sur 56 000 pixels.
  // Elle réapparaîtra ici dès qu'elle sera placée sur la carte d'origine.
  'compass',
  // Relief écarté sur demande de Romain : les 42 000 pictogrammes de montagnes
  // pesaient 3,3 Mo et chargeaient la carte au détriment de sa lisibilité.
  'terrain',
]);

/** Couches affichées d'emblée : de quoi lire la carte sans la surcharger. */
const PAR_DEFAUT = new Set([
  'ocean', 'lakes', 'landmass', 'terrs', 'rivers', 'terrain', 'regions',
  'borders', 'routes', 'coastline', 'ice', 'icons', 'labels',
]);
const LIBELLES_COUCHES = {
  ocean: 'Océan', lakes: 'Lacs', landmass: 'Terres', texture: 'Texture', terrs: 'Altitudes',
  biomes: 'Biomes', cells: 'Cellules', gridOverlay: 'Grille', coordinates: 'Coordonnées',
  compass: 'Rose des vents', rivers: 'Rivières', terrain: 'Reliefs', relig: 'Religions',
  cults: 'Cultures', regions: 'États', provs: 'Provinces', provinces: 'Provinces', zones: 'Zones',
  borders: 'Frontières', routes: 'Routes', temperature: 'Températures', coastline: 'Littoral',
  ice: 'Glaces', prec: 'Vents', population: 'Population', emblems: 'Blasons',
  labels: 'Noms', icons: 'Villes', markers: 'Marqueurs', 'fogging-cont': 'Brouillard',
  ruler: 'Règles', debug: 'Débogage', goods: 'Ressources', markets: 'Marchés',
};

fs.rmSync(SORTIE_COUCHES, { recursive: true, force: true });
fs.mkdirSync(SORTIE_COUCHES, { recursive: true });
fs.mkdirSync(SORTIE_DONNEES, { recursive: true });

const entete = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${monde.largeur} ${monde.hauteur}">`;
const ecrireFragment = (nom, contenu) => {
  const chemin = path.join(SORTIE_COUCHES, `${nom}.svg`);
  fs.writeFileSync(chemin, `${entete}\n${contenu}\n</svg>\n`);
  return fs.statSync(chemin).size;
};

const tailleDefs = ecrireFragment('_defs', defs);

/**
 * Les territoires des provinces, absents de l'export, sont reconstruits depuis
 * le contour des royaumes et leurs cloisons intérieures (voir provinces.mjs).
 */
const provincesRendu = composerProvinces(svg, provinces, burgs);

const couches = [];
const ignorees = [];
const demasquees = [];
const idsVillesRetenues = new Set(burgs.map((b) => b.id));
const fragmentsRetenus = new Map();
let villesRetireesDeLaCarte = 0;
for (const c of couchesBrutes) {
  if (COUCHES_EXCLUES.has(c.id)) continue;
  if (!contientDuDessin(c.contenu)) {
    ignorees.push(c.id);
    continue;
  }
  let { fragment, masquee } = rendreVisible(c.contenu);
  if (masquee) demasquees.push(c.id);
  if (c.id === 'icons' || c.id === 'labels') {
    const nettoyage = retirerVillesEcartees(fragment, idsVillesRetenues);
    fragment = nettoyage.fragment;
    villesRetireesDeLaCarte += nettoyage.retires;
  }
  fragmentsRetenus.set(c.id, fragment);
  couches.push({
    id: c.id,
    libelle: LIBELLES_COUCHES[c.id] || c.id,
    ordre: couches.length,
    octets: ecrireFragment(c.id, fragment),
    parDefaut: PAR_DEFAUT.has(c.id),
  });

  // Les provinces se posent juste au-dessus des royaumes qu'elles découpent :
  // devant leur aplat, derrière les frontières et les noms.
  if (c.id === 'regions' && provincesRendu.fragment) {
    fragmentsRetenus.set('provinces', provincesRendu.fragment);
    couches.push({
      id: 'provinces',
      libelle: LIBELLES_COUCHES.provinces,
      ordre: couches.length,
      octets: ecrireFragment('provinces', provincesRendu.fragment),
      parDefaut: false,
    });
  }
}

const apercu = composerApercu(fragmentsRetenus, monde.largeur, monde.hauteur);
fs.writeFileSync(path.join(SORTIE_CARTE, 'apercu.svg'), apercu);

fs.writeFileSync(
  path.join(SORTIE_CARTE, 'manifeste.json'),
  JSON.stringify(
    { largeur: monde.largeur, hauteur: monde.hauteur, defsOctets: tailleDefs, couches },
    null,
    2
  )
);

/* ------------------------------------------------------------- écriture */

const ecrire = (nom, donnees) =>
  fs.writeFileSync(path.join(SORTIE_DONNEES, nom), JSON.stringify(donnees, null, 1));

ecrire('monde.json', monde);
ecrire('etats.json', etats);
ecrire('provinces.json', provinces);
ecrire('burgs.json', burgs);
ecrire('cultures.json', cultures);
ecrire('religions.json', religions);
ecrire('zones.json', zones);
ecrire('chronologie.json', chronologie);

/**
 * L'index de l'atlas (recherche, repères, panneau) n'est plus écrit ici : il
 * est composé par `src/pages/carte/index.json.ts`, qui dispose du vocabulaire
 * français de `monde.ts`. L'import se contente des faits.
 */

/* -------------------------------------------------------------- rapport */

const totalCouches = couches.reduce((n, c) => n + c.octets, 0);
console.log(`  Monde   ${monde.nom} — an ${monde.annee} ${monde.ereCourte || ''}, ${monde.echelleKmParPixel} km/px, ${monde.largeur}×${monde.hauteur}`);
console.log(`\n  Entités`);
for (const [nom, arr] of [
  ['États', etats], ['Provinces', provinces], ['Burgs', burgs], ['Cultures', cultures],
  ['Religions', religions], ['Zones', zones], ['Campagnes', chronologie],
]) console.log(`    ${String(arr.length).padStart(5)}  ${nom}`);
console.log(`    ${String(blasons.size).padStart(5)}  Blasons extraits`);

console.log(`\n  Couches SVG retenues (${couches.length}, ${mo(totalCouches)} + defs ${ko(tailleDefs)} dont ${symbolesAjoutes} symboles Azgaar)`);
for (const c of [...couches].sort((a, b) => b.octets - a.octets)) {
  console.log(`    ${ko(c.octets).padStart(9)}  ${c.parDefaut ? '●' : '○'} ${c.libelle} (${c.id})`);
}
const rp = provincesRendu.rapport;
if (provincesRendu.fragment) {
  console.log(`\n  Provinces reconstruites : ${rp.provinces}/${rp.total} depuis ${rp.cloisons} cloisons`);
  if (rp.manquantes.length) console.log(`    Sans territoire, faute de preuve : ${rp.manquantes.join(', ')}`);
  if (rp.delaissees) console.log(`    Cloisons inutilisables, extrémités dans le vide : ${rp.delaissees}`);
  if (rp.sansPreuve) console.log(`    Morceaux laissés à la teinte du royaume : ${rp.sansPreuve}`);
} else {
  console.log(`\n  Provinces non reconstruites : ${rp.raison}`);
}

if (ignorees.length) console.log(`\n  Couches vides dans l'export, ignorées : ${ignorees.join(', ')}`);
if (demasquees.length) console.log(`  Couches masquées dans Azgaar, rendues pilotables : ${demasquees.join(', ')}`);
console.log(`  Villes hors des trois royaumes effacées de la carte : ${villesRetireesDeLaCarte}`);

const zonesInconnues = [...new Set(zones.map((z) => z.natureBrute))].filter((t) => !NATURES_ZONES[t]);
if (zonesInconnues.length) console.log(`  Types de zones sans libellé français : ${zonesInconnues.join(', ')}`);
console.log(`\n  Aucun fichier Markdown touché : les textes de lore sont intacts.\n`);
