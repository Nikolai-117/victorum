/**
 * Télécharge et auto-héberge les polices du site.
 *
 * Pourquoi ne pas simplement pointer vers Google Fonts : une requête vers un
 * tiers à chaque visite, un rendu qui saute le temps du chargement, et une
 * dépendance externe pour un site qui doit rester lisible seul. Les fichiers
 * sont donc versionnés dans public/polices/.
 *
 * Almendra SC est la police qu'Azgaar utilise pour les étiquettes de la carte :
 * la reprendre pour les titres relie visuellement l'atlas et le wiki.
 *
 * Polices sous licence SIL Open Font License 1.1, redistribuables.
 *
 *   node scripts/recuperer-polices.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(RACINE, 'public', 'polices');
const NAVIGATEUR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** Seuls ces sous-ensembles nous concernent : le français et les noms de la carte. */
const SOUS_ENSEMBLES = ['latin', 'latin-ext'];

const FAMILLES = [
  { requete: 'Almendra+SC', nom: 'Almendra SC', fichier: 'almendra-sc', graisses: { 400: 'normal' } },
  { requete: 'EB+Garamond:wght@400;500;600', nom: 'EB Garamond', fichier: 'eb-garamond', graisses: { 400: 'normal', 500: 'normal', 600: 'normal' } },
];

/** Découpe le CSS de Google en blocs @font-face, en gardant le nom du sous-ensemble. */
function analyser(css) {
  const blocs = [];
  const motif = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = motif.exec(css))) {
    const corps = m[2];
    blocs.push({
      sousEnsemble: m[1],
      graisse: (corps.match(/font-weight:\s*(\d+)/) || [])[1] || '400',
      style: (corps.match(/font-style:\s*(\w+)/) || [])[1] || 'normal',
      url: (corps.match(/url\((https:[^)]+\.woff2)\)/) || [])[1],
      plage: (corps.match(/unicode-range:\s*([^;]+);/) || [])[1],
    });
  }
  return blocs;
}

fs.mkdirSync(DOSSIER, { recursive: true });
const regles = [];
let total = 0;

for (const famille of FAMILLES) {
  const reponse = await fetch(
    `https://fonts.googleapis.com/css2?family=${famille.requete}&display=swap`,
    { headers: { 'User-Agent': NAVIGATEUR } }
  );
  if (!reponse.ok) {
    console.error(`  Échec pour ${famille.nom} : ${reponse.status}`);
    process.exit(1);
  }
  const blocs = analyser(await reponse.text()).filter(
    (b) => SOUS_ENSEMBLES.includes(b.sousEnsemble) && b.url && famille.graisses[b.graisse]
  );

  for (const bloc of blocs) {
    const nomFichier = `${famille.fichier}-${bloc.graisse}-${bloc.sousEnsemble}.woff2`;
    const fonte = await fetch(bloc.url, { headers: { 'User-Agent': NAVIGATEUR } });
    const donnees = Buffer.from(await fonte.arrayBuffer());
    fs.writeFileSync(path.join(DOSSIER, nomFichier), donnees);
    total += donnees.length;
    console.log(`  ${nomFichier.padEnd(38)} ${(donnees.length / 1024).toFixed(1).padStart(7)} Ko`);

    regles.push(
      `@font-face {\n` +
        `  font-family: '${famille.nom}';\n` +
        `  font-style: ${bloc.style};\n` +
        `  font-weight: ${bloc.graisse};\n` +
        `  font-display: swap;\n` +
        `  src: url('/polices/${nomFichier}') format('woff2');\n` +
        `  unicode-range: ${bloc.plage};\n` +
        `}`
    );
  }
}

const enTete =
  `/* Polices auto-hébergées — SIL Open Font License 1.1.\n` +
  `   Almendra SC : la police des étiquettes de la carte Azgaar.\n` +
  `   Régénérer avec : node scripts/recuperer-polices.mjs */\n\n`;
fs.writeFileSync(path.join(RACINE, 'src', 'styles', 'polices.css'), enTete + regles.join('\n\n') + '\n');

console.log(`\n  ${regles.length} fichiers, ${(total / 1024).toFixed(0)} Ko au total`);
console.log(`  Écrit  src/styles/polices.css\n`);
