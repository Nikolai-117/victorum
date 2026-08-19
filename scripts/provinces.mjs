/**
 * Reconstruction des territoires de provinces, à la manière d'un Crusader Kings.
 *
 * Azgaar n'exporte pas les surfaces des provinces : la couche `provs` est vide,
 * parce qu'elle n'était pas affichée au moment de l'enregistrement. En revanche
 * l'export contient deux choses exactes :
 *
 *   - `#statesBody`  : le contour de chaque royaume, en anneaux fermés
 *                      (les aires négatives sont des lacs ou des enclaves) ;
 *   - `#provinceBorders` : les cloisons intérieures, tracées le long des mêmes
 *                      arêtes de cellules — donc aux mêmes sommets, au pixel près.
 *
 * On redécoupe donc chaque royaume par ses cloisons, puis on attribue chaque
 * morceau à une province par son pôle d'inaccessibilité (qui est, par
 * construction, à l'intérieur) et, à défaut, par les villes qu'il contient.
 *
 * Rien n'est deviné : un morceau qu'aucune de ces deux preuves ne rattache
 * reste sans couleur — la teinte du royaume transparaît dessous — et il est
 * signalé dans le rapport d'import. Inventer une frontière serait pire que ne
 * pas la tracer.
 */

/* --------------------------------------------------------------- géométrie */

const CLE = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;

const aireDe = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

/** Lancer de rayon : le point est dedans si l'on croise un nombre impair de bords. */
function dansPolygone(point, pts) {
  const [x, y] = point;
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Dedans, mais pas dans l'un de ses trous. */
const dansMorceau = (point, morceau) =>
  dansPolygone(point, morceau.contour) && !morceau.trous.some((t) => dansPolygone(point, t));

const pointsDe = (d) =>
  (d.match(/-?\d+(?:\.\d+)?[ ,]-?\d+(?:\.\d+)?/g) || []).map((p) => p.split(/[ ,]/).map(Number));

/** Les points consécutifs identiques font trébucher les tests d'appartenance. */
function sansDoublons(pts) {
  const propre = [];
  for (const p of pts) {
    const dernier = propre[propre.length - 1];
    if (!dernier || CLE(dernier) !== CLE(p)) propre.push(p);
  }
  while (propre.length > 1 && CLE(propre[0]) === CLE(propre[propre.length - 1])) propre.pop();
  return propre;
}

/* ------------------------------------------------------------- extraction */

/** Un élément SVG complet, en tenant compte des `<g>` imbriqués. */
function elementComplet(texte, depuis) {
  let profondeur = 0;
  let i = depuis;
  while (i < texte.length) {
    const ouvre = texte.indexOf('<g', i);
    const ferme = texte.indexOf('</g>', i);
    if (ferme < 0) break;
    if (ouvre >= 0 && ouvre < ferme) {
      profondeur++;
      i = ouvre + 2;
    } else {
      if (profondeur === 0) return texte.slice(depuis, ferme + 4);
      profondeur--;
      i = ferme + 4;
    }
  }
  return texte.slice(depuis);
}

const groupe = (svg, id) => {
  const i = svg.indexOf(`id="${id}"`);
  return i < 0 ? '' : elementComplet(svg, i);
};

/** Les anneaux de chaque royaume : positifs = terres, négatifs = trous. */
function anneauxDesEtats(svg) {
  const anneaux = [];
  for (const m of groupe(svg, 'statesBody').matchAll(/<path d="([^"]+)"[^>]*id="state(\d+)"/g)) {
    const etatId = Number(m[2]);
    for (const sous of m[1].split(/M/).filter((s) => s.trim())) {
      const pts = sansDoublons(pointsDe(sous));
      if (pts.length < 3) continue;
      anneaux.push({ etatId, pts, aire: aireDe(pts) });
    }
  }
  return anneaux;
}

/** Les cloisons intérieures, une par tronçon entre deux provinces. */
const cloisonsDesProvinces = (svg) =>
  [...groupe(svg, 'provinceBorders').matchAll(/d="([^"]+)"/g)]
    .map((m) => m[1])
    .join(' ')
    .split('M')
    .map((sous) => sansDoublons(pointsDe(sous)))
    .filter((pts) => pts.length > 1);

/* ---------------------------------------------------------------- découpe */

/**
 * Coupe un contour le long d'une cloison dont les deux extrémités sont des
 * sommets du contour. On obtient deux morceaux : celui qui longe la cloison à
 * l'aller, celui qui la longe au retour.
 */
function couper(contour, cloison) {
  const cles = contour.map(CLE);
  const depart = cles.indexOf(CLE(cloison[0]));
  const arrivee = cles.indexOf(CLE(cloison[cloison.length - 1]));
  if (depart < 0 || arrivee < 0 || depart === arrivee) return null;

  const chemin = cloison.slice(1, -1);
  const tranche = (a, b) => {
    const morceau = [];
    for (let i = a; i !== b; i = (i + 1) % contour.length) morceau.push(contour[i]);
    morceau.push(contour[b]);
    return morceau;
  };

  const premier = [...tranche(depart, arrivee), ...[...chemin].reverse()];
  const second = [...tranche(arrivee, depart), ...chemin];
  if (premier.length < 3 || second.length < 3) return null;
  return [premier, second];
}

/**
 * Le milieu d'une cloison, pris au centre d'un segment plutôt que sur un
 * sommet : un sommet peut appartenir au bord du morceau qu'on teste, et le
 * lancer de rayon ne sait pas dire de quel côté se trouve un point posé
 * exactement sur la frontière.
 */
function milieuDe(cloison) {
  const i = Math.max(0, Math.floor(cloison.length / 2) - 1);
  const a = cloison[i];
  const b = cloison[Math.min(cloison.length - 1, i + 1)];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Recolle deux cloisons qui se touchent par un bout.
 *
 * Aux points triples — là où trois provinces se rejoignent — aucune des trois
 * branches n'a ses deux extrémités sur le contour du royaume : chacune attend
 * que le point triple existe, et le point triple n'existe qu'une fois l'une
 * d'elles tracée. On sort de l'impasse en soudant deux branches en une seule
 * coupe, qui traverse alors le royaume de bord à bord.
 */
function souder(a, b) {
  const debutA = CLE(a[0]);
  const finA = CLE(a[a.length - 1]);
  const debutB = CLE(b[0]);
  const finB = CLE(b[b.length - 1]);
  if (finA === debutB) return [...a, ...b.slice(1)];
  if (finA === finB) return [...a, ...[...b].reverse().slice(1)];
  if (debutA === debutB) return [...[...a].reverse(), ...b.slice(1)];
  if (debutA === finB) return [...b, ...a.slice(1)];
  return null;
}

/**
 * Découpe les terres d'un royaume par ses cloisons. Certaines ne deviennent
 * applicables qu'après une autre — leurs extrémités sont des points triples,
 * qui n'existent qu'une fois la première coupe faite. D'où la reprise tant
 * qu'une coupe a été possible.
 */
function decouper(terres, cloisons) {
  let morceaux = terres.map((pts) => ({ contour: pts, trous: [] }));
  const restantes = [...cloisons];
  let progresse = true;

  while (restantes.length) {
    progresse = false;

    for (let c = 0; c < restantes.length; c++) {
      const cloison = restantes[c];
      const boucle = CLE(cloison[0]) === CLE(cloison[cloison.length - 1]);

      for (let m = 0; m < morceaux.length; m++) {
        const morceau = morceaux[m];

        // Une cloison fermée cerne une enclave : elle devient un morceau, et
        // un trou dans celui qui l'entoure.
        if (boucle) {
          const interieur = cloison.slice(0, -1);
          if (interieur.length < 3 || !dansMorceau(milieuDe(interieur), morceau)) continue;
          morceau.trous.push(interieur);
          morceaux.push({ contour: interieur, trous: [] });
        } else {
          if (!dansMorceau(milieuDe(cloison), morceau)) continue;
          const parts = couper(morceau.contour, cloison);
          if (!parts) continue;
          // Les trous du morceau coupé retrouvent leur camp plus bas.
          const orphelins = morceau.trous;
          morceaux.splice(m, 1, ...parts.map((contour) => ({ contour, trous: [] })));
          for (const trou of orphelins) {
            const hote = morceaux.find((x) => dansPolygone(trou[0], x.contour));
            if (hote) hote.trous.push(trou);
          }
        }

        restantes.splice(c, 1);
        c--;
        progresse = true;
        break;
      }
    }

    // Plus rien ne s'applique : on soude deux branches et on recommence.
    if (!progresse) {
      let soudee = false;
      for (let i = 0; i < restantes.length && !soudee; i++) {
        for (let j = i + 1; j < restantes.length && !soudee; j++) {
          const ensemble = souder(restantes[i], restantes[j]);
          if (!ensemble) continue;
          restantes.splice(j, 1);
          restantes.splice(i, 1, ensemble);
          soudee = true;
        }
      }
      if (!soudee) break;
    }
  }

  return { morceaux, delaissees: restantes };
}

/* ------------------------------------------------------------ attribution */

/**
 * À qui appartient chaque morceau. Deux preuves, dans cet ordre : le pôle de
 * la province (toujours à l'intérieur d'elle-même), puis les villes.
 */
function attribuer(morceaux, provinces, burgs) {
  const attribution = new Map(); // morceau → id de province
  const libres = new Set(morceaux.map((_, i) => i));

  for (const p of provinces) {
    if (p.x === null || p.y === null) continue;
    for (const i of libres) {
      if (dansMorceau([p.x, p.y], morceaux[i])) {
        attribution.set(i, p.id);
        libres.delete(i);
        break;
      }
    }
  }

  for (const i of [...libres]) {
    const compte = new Map();
    for (const b of burgs) {
      if (!b.provinceId) continue;
      if (dansMorceau([b.x, b.y], morceaux[i])) compte.set(b.provinceId, (compte.get(b.provinceId) || 0) + 1);
    }
    const gagnant = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
    if (gagnant) {
      attribution.set(i, gagnant[0]);
      libres.delete(i);
    }
  }

  return { attribution, libres };
}

/* ------------------------------------------------------------------ sortie */

const SAUT = String.fromCharCode(10);

/** Un nom de province est une donnée, pas du balisage. */
const echapper = (texte) =>
  String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const arrondir = (v) => Math.round(v * 10) / 10;
const enChemin = (pts) => `M${pts.map((p) => `${arrondir(p[0])},${arrondir(p[1])}`).join(' ')}Z`;

/**
 * Compose la couche des provinces.
 *
 * @returns {{fragment: string|null, rapport: object}}
 */
export function composerProvinces(svg, provinces, burgs) {
  const anneaux = anneauxDesEtats(svg);
  const cloisons = cloisonsDesProvinces(svg);
  if (!anneaux.length || !cloisons.length) {
    return { fragment: null, rapport: { raison: 'ni contours d’États ni cloisons dans l’export' } };
  }

  const parEtat = new Map();
  for (const a of anneaux) {
    if (!parEtat.has(a.etatId)) parEtat.set(a.etatId, { terres: [], trous: [] });
    parEtat.get(a.etatId)[a.aire >= 0 ? 'terres' : 'trous'].push(a.pts);
  }

  const surfaces = new Map(); // id de province → liste de {contour, trous}
  let delaissees = 0;
  let sansPreuve = 0;

  for (const [etatId, { terres, trous }] of parEtat) {
    const miennes = cloisons.filter((c) =>
      terres.some((t) => dansPolygone(milieuDe(c), t))
    );
    const { morceaux, delaissees: restantes } = decouper(terres, miennes);
    delaissees += restantes.length;

    // Les lacs et enclaves rejoignent le morceau qui les contient.
    for (const trou of trous) {
      const hote = morceaux.find((m) => dansPolygone(trou[0], m.contour));
      if (hote) hote.trous.push(trou);
    }

    const desEtats = provinces.filter((p) => p.etatId === etatId);
    const villes = burgs.filter((b) => b.etatId === etatId);
    const { attribution, libres } = attribuer(morceaux, desEtats, villes);
    sansPreuve += libres.size;

    for (const [i, provinceId] of attribution) {
      if (!surfaces.has(provinceId)) surfaces.set(provinceId, []);
      surfaces.get(provinceId).push(morceaux[i]);
    }
  }

  const corps = [];
  for (const p of provinces) {
    const parts = surfaces.get(p.id);
    if (!parts) continue;
    const d = parts
      .map((m) => [enChemin(m.contour), ...m.trous.map(enChemin)].join(''))
      .join('');
    // Le nom accompagne l'aplat : une couleur seule ne dit pas quelle province
    // on regarde. Le groupe porte l'identifiant attendu par l'atlas, pour que
    // le clic retrouve la fiche sans table de correspondance.
    const nom =
      p.x === null || p.y === null
        ? ''
        : `<text x="${arrondir(p.x)}" y="${arrondir(p.y)}">${echapper(p.nom)}</text>`;
    corps.push(
      `<g id="province${p.id}" class="province"><path d="${d}" fill="${p.couleur}" fill-rule="evenodd"/>${nom}</g>`
    );
  }

  if (!corps.length) return { fragment: null, rapport: { raison: 'aucune province reconstruite' } };

  const fragment =
    `<g id="provincesBody" opacity="0.78" stroke="#0c0b09" stroke-opacity="0.5" ` +
    `stroke-width="0.5" stroke-linejoin="round" ` +
    `font-family="Almendra SC, Georgia, serif" font-size="7" text-anchor="middle" ` +
    `letter-spacing="0.6">${SAUT}  ${corps.join(SAUT + '  ')}${SAUT}</g>`;

  return {
    fragment,
    rapport: {
      provinces: surfaces.size,
      total: provinces.length,
      manquantes: provinces.filter((p) => !surfaces.has(p.id)).map((p) => p.nom),
      cloisons: cloisons.length,
      delaissees,
      sansPreuve,
    },
  };
}
