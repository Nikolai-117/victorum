/**
 * Génère la texture d'océan que le SVG d'Azgaar attend (`images/pattern1.png`).
 *
 * Ce fichier fait partie des ressources d'Azgaar, pas de l'export : il n'est
 * donc pas dans le .map. Plutôt que de dépendre d'un téléchargement, on
 * reconstruit un bruit doux et raccordable, appliqué à 20 % d'opacité sur la
 * mer. Sans lui, la carte affiche une erreur 404 et un océan plat.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const octet of buffer) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, controle]);
}

/** Générateur pseudo-aléatoire déterministe : la texture est reproductible. */
function alea(graine) {
  let e = graine >>> 0;
  return () => {
    e = (e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lisser = (t) => t * t * (3 - 2 * t);

/**
 * Bruit de valeur raccordable : une grille grossière tirée au sort, interpolée
 * en repassant par le début aux bords — les tuiles se juxtaposent sans couture.
 */
function bruitRaccordable(taille, cellules, graine) {
  const hasard = alea(graine);
  const grille = Array.from({ length: cellules * cellules }, hasard);
  const valeurs = new Float32Array(taille * taille);
  const pas = taille / cellules;

  for (let y = 0; y < taille; y++) {
    const gy = y / pas;
    const y0 = Math.floor(gy) % cellules;
    const y1 = (y0 + 1) % cellules;
    const fy = lisser(gy - Math.floor(gy));
    for (let x = 0; x < taille; x++) {
      const gx = x / pas;
      const x0 = Math.floor(gx) % cellules;
      const x1 = (x0 + 1) % cellules;
      const fx = lisser(gx - Math.floor(gx));
      const haut = grille[y0 * cellules + x0] * (1 - fx) + grille[y0 * cellules + x1] * fx;
      const bas = grille[y1 * cellules + x0] * (1 - fx) + grille[y1 * cellules + x1] * fx;
      valeurs[y * taille + x] = haut * (1 - fy) + bas * fy;
    }
  }
  return valeurs;
}

/** Écrit un PNG gris + alpha de `taille`×`taille`. */
export function genererTextureOcean(chemin, taille = 100) {
  // Deux échelles superposées : de larges ondulations et un grain fin.
  const large = bruitRaccordable(taille, 5, 1337);
  const fin = bruitRaccordable(taille, 20, 424242);

  const brut = Buffer.alloc(taille * (taille * 2 + 1));
  let i = 0;
  for (let y = 0; y < taille; y++) {
    brut[i++] = 0; // octet de filtre : aucun
    for (let x = 0; x < taille; x++) {
      const v = large[y * taille + x] * 0.65 + fin[y * taille + x] * 0.35;
      // Gris sombre pour creuser la houle, alpha faible pour rester discret.
      brut[i++] = Math.round(40 + v * 90);
      brut[i++] = Math.round(30 + Math.pow(v, 1.6) * 95);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 4; // gris + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(chemin, png);
  return png.length;
}
