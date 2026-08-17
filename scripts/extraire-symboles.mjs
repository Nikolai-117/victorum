/**
 * Récupère les symboles de relief et d'icônes de villes d'Azgaar.
 *
 * Pourquoi ce script existe : l'export `.map` référence ces symboles
 * (`#relief-mount-1`, `#icon-star-circled-empty`…) sans les embarquer — ils
 * vivent dans l'application Azgaar elle-même. Sans eux, la carte s'affiche
 * sans montagnes, sans forêts et sans pastilles de villes.
 *
 * Le résultat est écrit une fois pour toutes dans `data/azgaar/` et versionné :
 * l'import et le build n'ont ensuite plus jamais besoin du réseau.
 *
 * Azgaar's Fantasy Map Generator — licence MIT, © 2017-2024 Max Haniyeu.
 *
 *   node scripts/extraire-symboles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(RACINE, 'data', 'azgaar');
const DEPOT = 'https://raw.githubusercontent.com/Azgaar/Fantasy-Map-Generator/master';

/** Extrait un `<g id="…">…</g>` complet en comptant la profondeur des `<g>`. */
function extraireG(texte, id) {
  const debut = texte.indexOf(`<g id="${id}"`);
  if (debut < 0) return null;
  const balises = /<(\/?)g\b[^>]*?(\/?)>/g;
  balises.lastIndex = debut;
  let profondeur = 0;
  let m;
  while ((m = balises.exec(texte))) {
    if (m[1] === '/') {
      if (--profondeur === 0) return texte.slice(debut, balises.lastIndex);
    } else if (m[2] !== '/') {
      profondeur++;
    } else if (profondeur === 0) {
      return texte.slice(debut, balises.lastIndex);
    }
  }
  return null;
}

/**
 * Ces symboles viennent d'un fichier HTML, où un attribut répété est toléré :
 * le navigateur garde le premier et ignore le reste. Les fragments SVG servis
 * ensuite sont lus en XML strict, qui refuse le document entier pour un seul
 * doublon. On ne garde donc que la première occurrence de chaque attribut.
 */
function dedupliquerAttributs(svg) {
  let corrections = 0;
  const resultat = svg.replace(
    /<([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))+)(\s*\/?)>/g,
    (tout, nom, attributs, fin) => {
      const vus = new Map();
      let doublon = false;
      for (const m of attributs.matchAll(/\s+([\w:.-]+)\s*=\s*("[^"]*"|'[^']*')/g)) {
        if (vus.has(m[1])) doublon = true;
        else vus.set(m[1], m[2]);
      }
      if (!doublon) return tout;
      corrections++;
      return `<${nom}${[...vus].map(([c, v]) => ` ${c}=${v}`).join('')}${fin}>`;
    }
  );
  return { svg: resultat, corrections };
}

/** Signale ce qui ferait encore échouer une lecture XML stricte. */
function anomaliesXml(svg) {
  const anomalies = [];
  const sansValeur = svg.match(/<[a-zA-Z][\w:.-]*[^>]*\s[\w:.-]+(?=[\s>/])(?![\s]*=)[^>]*>/g);
  if (sansValeur) anomalies.push(`${sansValeur.length} attribut(s) sans valeur`);
  const esperluettes = svg.match(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g);
  if (esperluettes) anomalies.push(`${esperluettes.length} « & » non échappé(s)`);
  return anomalies;
}

const octets = (n) => `${(n / 1024).toFixed(1)} Ko`;

fs.mkdirSync(DOSSIER, { recursive: true });

console.log(`\n  Source  ${DEPOT}/src/index.html`);
const reponse = await fetch(`${DEPOT}/src/index.html`);
if (!reponse.ok) {
  console.error(`  Échec du téléchargement : ${reponse.status}`);
  process.exit(1);
}
const html = await reponse.text();

// defs-relief : montagnes, collines, forêts. defs-icons : pastilles de villes.
// defs-compass-rose : la rose des vents. defs-hatching : les trames des zones
// (invasions, rébellions) — inutilisées dans l'export actuel, mais la couche
// « Zones » les réclamera dès que Romain l'activera dans Azgaar.
const blocs = [];
for (const id of ['defs-relief', 'defs-icons', 'defs-compass-rose', 'defs-hatching']) {
  const brut = extraireG(html, id);
  if (!brut) {
    console.error(`  MANQUANT : ${id} — la structure du dépôt Azgaar a changé.`);
    process.exit(1);
  }
  const { svg: bloc, corrections } = dedupliquerAttributs(brut);
  const symboles = [...bloc.matchAll(/<(?:symbol|g)\b[^>]*?\bid="([^"]+)"/g)].map((m) => m[1]).slice(1);
  const anomalies = anomaliesXml(bloc);
  console.log(
    `  ${id.padEnd(12)} ${octets(Buffer.byteLength(bloc)).padStart(9)}  ${symboles.length} symboles` +
      (corrections ? `, ${corrections} attribut(s) dupliqué(s) corrigé(s)` : '')
  );
  if (anomalies.length) console.log(`               reste à surveiller : ${anomalies.join(', ')}`);
  blocs.push(bloc);
}

const enTete =
  `<!-- Symboles de relief et d'icônes de villes d'Azgaar's Fantasy Map Generator (src/index.html).\n` +
  `     L'export .map les référence sans les embarquer. Licence MIT, © 2017-2024 Max Haniyeu.\n` +
  `     Régénérable par : node scripts/extraire-symboles.mjs -->\n`;
const cible = path.join(DOSSIER, 'defs-symboles.svg');
fs.writeFileSync(cible, enTete + blocs.join('\n') + '\n');
console.log(`\n  Écrit  data/azgaar/defs-symboles.svg (${octets(fs.statSync(cible).size)})`);

// La texture d'océan, elle aussi absente de l'export.
const texture = await fetch(`${DEPOT}/public/images/pattern1.png`);
if (texture.ok) {
  const dossierImages = path.join(RACINE, 'public', 'images');
  fs.mkdirSync(dossierImages, { recursive: true });
  const donnees = Buffer.from(await texture.arrayBuffer());
  fs.writeFileSync(path.join(dossierImages, 'pattern1.png'), donnees);
  console.log(`  Écrit  public/images/pattern1.png (${octets(donnees.length)})`);
} else {
  console.log(`  Texture d'océan indisponible (${texture.status}) — celle générée localement sera conservée.`);
}
console.log('');
