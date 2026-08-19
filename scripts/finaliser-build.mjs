/**
 * Dernière étape de la construction : dire à Cloudflare ce qui n'est pas
 * un fichier à servir.
 *
 * Le Worker produit par Astro vit dans `dist/_worker.js/`, c'est-à-dire à
 * l'intérieur du dossier déclaré comme répertoire d'actifs. Sans exclusion,
 * Wrangler traite ces fichiers à la fois comme le point d'entrée du Worker et
 * comme des ressources statiques à téléverser — et refuse de déployer.
 *
 * Le symptôme est trompeur : `wrangler deploy --dry-run` passe sans un mot,
 * parce qu'il ne parcourt pas les actifs. L'échec n'apparaît qu'au vrai
 * déploiement, côté Cloudflare.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('  dist/ est absent : rien à finaliser.');
  process.exit(1);
}

const EXCLUS = [
  '_worker.js', // le Worker lui-même
  '_routes.json', // sa table de routage
  '.assetsignore', // et cette liste
];

fs.writeFileSync(path.join(DIST, '.assetsignore'), EXCLUS.join('\n') + '\n');
console.log(`  dist/.assetsignore écrit (${EXCLUS.length} entrées exclues des actifs)`);
