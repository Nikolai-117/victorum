/**
 * Le moteur de mise en page.
 *
 * Une fiche n'est plus un gabarit figé mais une suite de blocs décrits par du
 * JSON. Ce module sait faire deux choses : proposer une disposition par défaut
 * selon le type d'entité, et transformer une suite de blocs en HTML.
 *
 * Il est volontairement écrit en JavaScript pur, sans aucune dépendance :
 * Astro l'utilise à la construction du site, et l'éditeur le recharge tel quel
 * dans le navigateur. Une seule logique de rendu, donc jamais de décalage entre
 * ce que Romain voit en composant et ce qui sera publié.
 */

/* ------------------------------------------------------------------ outils */

const ECHAPPEMENTS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Échappe tout ce qui vient des données ou de la saisie. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c]);
}

/**
 * Markdown réduit à l'essentiel, pour les textes saisis dans l'éditeur.
 * Les longs textes de Romain passent, eux, par le Markdown complet d'Astro
 * (fichiers de `src/contenu/`) : ce rendu-ci ne sert qu'aux blocs courts.
 */
export function markdownCourt(source) {
  if (!source) return '';
  const enLigne = (t) =>
    esc(t)
      .replace(/\[\[([^\]]+)\]\]/g, '<span class="lien-interne">$1</span>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const sortie = [];
  let liste = null;

  const fermerListe = () => {
    if (liste) {
      sortie.push(`</${liste}>`);
      liste = null;
    }
  };

  for (const brut of String(source).split(/\r?\n/)) {
    const ligne = brut.trim();
    if (!ligne) {
      fermerListe();
      continue;
    }
    const titre = ligne.match(/^(#{2,4})\s+(.*)$/);
    const puce = ligne.match(/^[-*]\s+(.*)$/);
    const numero = ligne.match(/^\d+[.)]\s+(.*)$/);

    if (titre) {
      fermerListe();
      sortie.push(`<h${titre[1].length}>${enLigne(titre[2])}</h${titre[1].length}>`);
    } else if (ligne.startsWith('>')) {
      fermerListe();
      sortie.push(`<blockquote>${enLigne(ligne.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (puce) {
      if (liste !== 'ul') {
        fermerListe();
        sortie.push('<ul>');
        liste = 'ul';
      }
      sortie.push(`<li>${enLigne(puce[1])}</li>`);
    } else if (numero) {
      if (liste !== 'ol') {
        fermerListe();
        sortie.push('<ol>');
        liste = 'ol';
      }
      sortie.push(`<li>${enLigne(numero[1])}</li>`);
    } else {
      fermerListe();
      sortie.push(`<p>${enLigne(ligne)}</p>`);
    }
  }
  fermerListe();
  return sortie.join('\n');
}

/* ------------------------------------------------------------- catalogue */

export const LARGEURS = [
  { valeur: 'pleine', libelle: 'Pleine' },
  { valeur: 'deux-tiers', libelle: '2/3' },
  { valeur: 'moitie', libelle: '1/2' },
  { valeur: 'tiers', libelle: '1/3' },
];

const COLONNES = { pleine: 12, 'deux-tiers': 8, moitie: 6, tiers: 4 };

/**
 * Le catalogue des blocs, rangé par famille — c'est ce que présente la
 * fenêtre « Ajouter une section ».
 */
export const CATALOGUE = [
  {
    famille: 'En-tête',
    blocs: [
      { type: 'bandeau', nom: 'Bandeau', apercu: 'Grand titre, blason et surtitre', largeur: 'pleine' },
      { type: 'titre', nom: 'Titre de section', apercu: 'Ouvre une partie de la fiche', largeur: 'pleine' },
    ],
  },
  {
    famille: 'Identité',
    blocs: [
      { type: 'identite', nom: "Fiche d'identité", apercu: 'Les faits extraits de la carte', largeur: 'tiers' },
      { type: 'blason', nom: 'Blason', apercu: 'Les armes, en grand', largeur: 'tiers' },
      { type: 'courants', nom: 'Courants', apercu: 'Idéologies et doctrines professées', largeur: 'tiers' },
      { type: 'nation', nom: 'Régime et doctrines', apercu: 'Ce que la nation professe et comment elle est gouvernée', largeur: 'deux-tiers' },
    ],
  },
  {
    famille: 'Chiffres',
    blocs: [
      { type: 'chiffres', nom: 'Bandeau de chiffres', apercu: 'Une rangée de statistiques', largeur: 'pleine' },
      { type: 'jauge', nom: 'Comparaison', apercu: 'Barres comparant les entités liées', largeur: 'pleine' },
    ],
  },
  {
    famille: 'Textes',
    blocs: [
      { type: 'texte', nom: 'Texte de la fiche', apercu: 'Ce que tu écris dans le fichier Markdown', largeur: 'deux-tiers' },
      { type: 'note', nom: 'Texte libre', apercu: 'Un paragraphe saisi ici même', largeur: 'deux-tiers' },
      { type: 'chapeau', nom: 'Accroche', apercu: 'Une phrase d’ouverture, en plus grand', largeur: 'pleine' },
      { type: 'citation', nom: 'Citation', apercu: 'Un extrait mis en exergue', largeur: 'deux-tiers' },
    ],
  },
  {
    famille: 'Relations',
    blocs: [
      { type: 'liens', nom: 'Grille de liens', apercu: 'Vignettes cliquables', largeur: 'pleine' },
      { type: 'tableau', nom: 'Tableau', apercu: 'Les entités liées, en liste', largeur: 'pleine' },
    ],
  },
  {
    famille: 'Visuels',
    blocs: [
      { type: 'carte', nom: 'Situation', apercu: 'Un extrait de carte centré sur le lieu', largeur: 'moitie' },
      { type: 'image', nom: 'Illustration', apercu: 'Une image et sa légende', largeur: 'pleine' },
    ],
  },
  {
    famille: 'Mise en forme',
    blocs: [
      { type: 'separateur', nom: 'Séparateur', apercu: 'Un filet orné', largeur: 'pleine' },
      { type: 'espace', nom: 'Espace', apercu: 'Une respiration verticale', largeur: 'pleine' },
    ],
  },
];

export const BLOCS_CONNUS = new Map(
  CATALOGUE.flatMap((f) => f.blocs.map((b) => [b.type, { ...b, famille: f.famille }]))
);

/** Crée un bloc neuf, avec les options par défaut de son type. */
export function nouveauBloc(type) {
  const modele = BLOCS_CONNUS.get(type);
  const bloc = { type, largeur: modele?.largeur || 'pleine', options: {} };
  if (type === 'titre') bloc.options.texte = 'Nouvelle section';
  if (type === 'note') bloc.options.md = 'Un texte à remplacer.';
  if (type === 'chapeau') bloc.options.texte = 'Une phrase d’ouverture.';
  if (type === 'citation') bloc.options.texte = 'Une citation.';
  if (type === 'espace') bloc.options.hauteur = 3;
  if (type === 'separateur') bloc.options.motif = '❧';
  return bloc;
}

/* --------------------------------------------------------------- rendu */

function ouvrir(bloc, index, contexte) {
  const colonnes = COLONNES[bloc.largeur] || 12;
  return (
    `<section class="bloc bloc--${esc(bloc.type)}" data-bloc="${index}" ` +
    `data-type="${esc(bloc.type)}" data-largeur="${esc(bloc.largeur)}" ` +
    `style="--colonnes:${colonnes}">`
  );
}

const RENDUS = {
  bandeau(o, c) {
    const blason = c.blason && o.blason !== false
      ? `<img class="bandeau__blason" src="${esc(c.blason)}" alt="" width="120" height="120">`
      : '';
    const sous = o.sousTitre ?? c.surtitre;
    return (
      `<header class="bandeau">${blason}<div class="bandeau__texte">` +
      (sous ? `<p class="etiquette">${esc(sous)}</p>` : '') +
      `<h1>${esc(o.titre ?? c.titre)}</h1>` +
      (o.accroche ? `<p class="bandeau__accroche">${esc(o.accroche)}</p>` : '') +
      `</div></header>`
    );
  },

  titre(o) {
    return `<h2 class="etiquette etiquette--filet titre-section">${esc(o.texte || '')}</h2>`;
  },

  chapeau(o) {
    return `<p class="chapeau">${esc(o.texte || '')}</p>`;
  },

  citation(o) {
    return (
      `<figure class="citation"><blockquote>${esc(o.texte || '')}</blockquote>` +
      (o.source ? `<figcaption>${esc(o.source)}</figcaption>` : '') +
      `</figure>`
    );
  },

  note(o) {
    return `<div class="prose">${markdownCourt(o.md)}</div>`;
  },

  texte(o, c) {
    if (c.corpsHtml) return `<div class="prose">${c.corpsHtml}</div>`;
    return (
      `<div class="a-ecrire"><p class="etiquette">Page à écrire</p>` +
      `<p>Cette fiche n'affiche que les faits de la carte. Pour l'écrire, crée le fichier :</p>` +
      `<p><code>${esc(c.cheminTexte)}</code></p>` +
      `<p class="discret">Ou demande-le-moi : « écris-moi la fiche de ${esc(c.titre)} ».</p></div>`
    );
  },

  identite(o, c) {
    const faits = (c.faits || []).filter((f) => f.valeur);
    if (!faits.length) return '';
    const lignes = faits
      .map(
        (f) =>
          `<div class="identite__ligne"><dt>${esc(f.cle)}</dt><dd>` +
          (f.href ? `<a href="${esc(f.href)}">${esc(f.valeur)}</a>` : esc(f.valeur)) +
          `</dd></div>`
      )
      .join('');
    return (
      `<div class="identite cadre"><p class="etiquette">${esc(o.titre || "Fiche d'identité")}</p>` +
      `<dl>${lignes}</dl></div>`
    );
  },

  /**
   * Le régime d'une nation et les doctrines qu'elle tient.
   *
   * Le régime est celui que Romain a choisi ; à défaut, celui que ses
   * doctrines impliquent — et l'on dit alors d'où vient la conclusion, pour
   * qu'elle se discute au lieu de tomber du ciel.
   */
  nation(o, c) {
    const n = c.nation;
    if (!n) return '';
    const jetons = n.doctrines
      .map(
        (d) =>
          `<li class="doctrine${d.fanatique ? ' doctrine--fanatique' : ''}" ` +
          `style="--teinte:${esc(d.teinte)}" title="${esc(d.sujet)}">` +
          `<span>${esc(d.nom)}</span>` +
          (d.fanatique ? `<small>fanatique</small>` : '') +
          `</li>`
      )
      .join('');

    const cour = [
      n.dirigeant
        ? `<div class="nation__ligne"><dt>${esc(n.titreDirigeant || 'Dirigeant')}</dt>` +
          `<dd>${esc(n.dirigeant)}</dd></div>`
        : '',
      n.avenement !== undefined && n.avenement !== null
        ? `<div class="nation__ligne"><dt>Avènement</dt><dd>${esc(n.avenement)}</dd></div>`
        : '',
      ...(n.champs || []).map(
        (c) => `<div class="nation__ligne"><dt>${esc(c.cle)}</dt><dd>${esc(c.valeur)}</dd></div>`
      ),
    ].join('');

    return (
      `<div class="nation cadre">` +
      `<p class="etiquette">Régime${n.choisi ? '' : ' <span class="nation__deduit">déduit</span>'}</p>` +
      `<p class="nation__regime">${esc(n.regime)}</p>` +
      (n.raison ? `<p class="nation__raison">${esc(n.raison)}</p>` : '') +
      (n.devise ? `<p class="nation__devise">« ${esc(n.devise)} »</p>` : '') +
      (jetons
        ? `<p class="etiquette nation__titre">Doctrines</p><ul class="doctrines">${jetons}</ul>`
        : `<p class="nation__vide">Aucune doctrine arrêtée.</p>`) +
      (cour ? `<dl class="nation__cour">${cour}</dl>` : '') +
      `</div>`
    );
  },

  /**
   * Ce que l'entité professe. Les courants sont groupés par axe, dans l'ordre
   * où Romain les a définis ; un axe qui porte des parts se lit en barres,
   * les autres en simple liste de jetons.
   */
  courants(o, c) {
    const suivis = c.courants || [];
    if (!suivis.length) return '';

    const axes = [];
    for (const courant of suivis) {
      let axe = axes.find((a) => a.nom === courant.axe);
      if (!axe) axes.push((axe = { nom: courant.axe, courants: [] }));
      axe.courants.push(courant);
    }

    const corps = axes
      .map((axe) => {
        const lignes = axe.courants
          .map((k) => {
            const part =
              typeof k.part === 'number'
                ? `<span class="courant__barre"><i style="width:${Math.max(2, Math.min(100, k.part))}%;` +
                  `background:${esc(k.couleur)}"></i></span>` +
                  `<span class="courant__part">${esc(k.part)} %</span>`
                : '';
            return (
              `<li class="courant">` +
              `<span class="courant__marque" style="--teinte:${esc(k.couleur)}">${esc(k.symbole)}</span>` +
              `<a class="courant__nom" href="/courants/${esc(k.slug)}">${esc(k.nom)}</a>` +
              part +
              `</li>`
            );
          })
          .join('');
        return (
          (axe.nom ? `<p class="etiquette courants__axe">${esc(axe.nom)}</p>` : '') +
          `<ul class="courants__liste">${lignes}</ul>`
        );
      })
      .join('');

    return (
      `<div class="courants cadre"><p class="etiquette">${esc(o.titre || 'Courants')}</p>${corps}</div>`
    );
  },

  blason(o, c) {
    if (!c.blason) return '';
    return (
      `<figure class="blason-bloc cadre"><img src="${esc(c.blason)}" alt="Armes de ${esc(c.titre)}">` +
      `<figcaption class="etiquette">${esc(o.legende || 'Armes')}</figcaption></figure>`
    );
  },

  chiffres(o, c) {
    const source = (c.chiffres || []).filter((f) => f.valeur);
    if (!source.length) return '';
    return (
      `<dl class="faits">` +
      source
        .map((f) => `<div class="fait"><dt>${esc(f.cle)}</dt><dd>${esc(f.valeur)}</dd></div>`)
        .join('') +
      `</dl>`
    );
  },

  jauge(o, c) {
    const groupe = (c.groupes || {})[o.groupe] || Object.values(c.groupes || {})[0];
    const items = (groupe?.items || []).filter((i) => i.valeur > 0).slice(0, o.limite || 10);
    if (!items.length) return '';
    const max = Math.max(...items.map((i) => i.valeur));
    return (
      `<div class="jauges">` +
      items
        .map(
          (i) =>
            `<div class="jauge-ligne"><a class="jauge-ligne__nom" href="${esc(i.href)}">${esc(i.nom)}</a>` +
            `<span class="jauge-ligne__barre"><i style="width:${((i.valeur / max) * 100).toFixed(1)}%"></i></span>` +
            `<span class="jauge-ligne__valeur">${esc(i.meta || i.valeur)}</span></div>`
        )
        .join('') +
      `</div>`
    );
  },

  liens(o, c) {
    const groupe = (c.groupes || {})[o.groupe] || Object.values(c.groupes || {})[0];
    const items = (groupe?.items || []).slice(0, o.limite || 24);
    if (!items.length) return '';
    return (
      `<div class="grille">` +
      items
        .map(
          (i) =>
            `<a class="carte" href="${esc(i.href)}"><span class="carte__titre">` +
            (i.couleur ? `<i class="pastille" style="background:${esc(i.couleur)}"></i>` : '') +
            `${esc(i.nom)}</span>` +
            (i.meta ? `<span class="carte__meta">${esc(i.meta)}</span>` : '') +
            `</a>`
        )
        .join('') +
      `</div>`
    );
  },

  tableau(o, c) {
    const groupe = (c.groupes || {})[o.groupe] || Object.values(c.groupes || {})[0];
    if (!groupe) return '';
    const limite = o.limite || 40;

    // Forme riche : des colonnes décrites une à une (ordre de bataille, campagnes).
    if (groupe.lignes?.length) {
      const entetes = (groupe.colonnes || []).map((n) => `<th>${esc(n)}</th>`).join('');
      const corps = groupe.lignes
        .slice(0, limite)
        .map(
          (ligne) =>
            '<tr>' +
            ligne
              .map((cel) => {
                const contenu = cel.href ? `<a href="${esc(cel.href)}">${esc(cel.t)}</a>` : esc(cel.t);
                return `<td class="${esc(cel.classe || '')}">${contenu}</td>`;
              })
              .join('') +
            '</tr>'
        )
        .join('');
      return `<div class="defilable"><table class="tableau"><thead><tr>${entetes}</tr></thead><tbody>${corps}</tbody></table></div>`;
    }

    // Forme simple : la même liste de vignettes que la grille, présentée en tableau.
    const items = (groupe.items || []).slice(0, limite);
    if (!items.length) return '';
    return (
      `<div class="defilable"><table class="tableau"><thead><tr>` +
      `<th>${esc(groupe.colonne || 'Nom')}</th><th>${esc(groupe.colonneMeta || 'Détail')}</th>` +
      `</tr></thead><tbody>` +
      items
        .map(
          (i) =>
            `<tr><td><a href="${esc(i.href)}">${esc(i.nom)}</a></td>` +
            `<td class="discret">${esc(i.meta || '')}</td></tr>`
        )
        .join('') +
      `</tbody></table></div>`
    );
  },

  carte(o, c) {
    if (!c.position) return '';
    const zoom = o.zoom || 6;
    return (
      `<figure class="situation cadre">` +
      `<a href="/atlas?x=${c.position.x}&y=${c.position.y}&z=${zoom}" ` +
      `style="--x:${c.position.x};--y:${c.position.y};--z:${zoom}">` +
      `<span class="situation__mire"></span></a>` +
      `<figcaption class="etiquette">Situer sur l'atlas</figcaption></figure>`
    );
  },

  image(o) {
    if (!o.src) {
      return `<div class="a-ecrire"><p class="etiquette">Illustration</p><p>Aucune image choisie.</p></div>`;
    }
    return (
      `<figure class="illustration"><img src="${esc(o.src)}" alt="${esc(o.alt || '')}" loading="lazy">` +
      (o.legende ? `<figcaption>${esc(o.legende)}</figcaption>` : '') +
      `</figure>`
    );
  },

  separateur(o) {
    return `<div class="ornement"><span>${esc(o.motif || "❧")}</span></div>`;
  },

  espace(o) {
    return `<div style="height:${Number(o.hauteur) || 3}rem"></div>`;
  },
};

/** Rend un bloc isolé. Un type inconnu est signalé plutôt qu'ignoré. */
export function rendreBloc(bloc, index, contexte) {
  const rendu = RENDUS[bloc.type];
  const corps = rendu
    ? rendu(bloc.options || {}, contexte)
    : `<div class="a-ecrire"><p>Bloc inconnu : <code>${esc(bloc.type)}</code></p></div>`;
  return `${ouvrir(bloc, index, contexte)}${corps}</section>`;
}

/** Rend la page entière. */
export function rendrePage(blocs, contexte) {
  return `<div class="blocs">${(blocs || [])
    .map((b, i) => rendreBloc(b, i, contexte))
    .join('')}</div>`;
}

/* --------------------------------------------------- dispositions de départ */

/**
 * Ce que voit Romain avant d'avoir composé quoi que ce soit. L'idée est qu'une
 * fiche soit déjà digne d'être lue sans mise en page manuelle, et que l'éditeur
 * serve à la singulariser, pas à la rendre acceptable.
 */
export function dispositionParDefaut(type, contexte) {
  const groupes = Object.keys(contexte.groupes || {});
  const blocs = [{ type: 'bandeau', largeur: 'pleine', options: {} }];

  if ((contexte.chiffres || []).length) {
    blocs.push({ type: 'chiffres', largeur: 'pleine', options: {} });
  }

  if (contexte.nation) {
    blocs.push({ type: 'titre', largeur: 'pleine', options: { texte: 'Régime et doctrines' } });
    blocs.push({ type: 'nation', largeur: 'pleine', options: {} });
  }

  blocs.push({ type: 'titre', largeur: 'pleine', options: { texte: 'Présentation' } });
  blocs.push({ type: 'texte', largeur: 'deux-tiers', options: {} });
  if ((contexte.faits || []).length) {
    blocs.push({ type: 'identite', largeur: 'tiers', options: {} });
  }
  if ((contexte.courants || []).length) {
    blocs.push({ type: 'courants', largeur: 'tiers', options: {} });
  }

  for (const cle of groupes) {
    const groupe = contexte.groupes[cle];
    const parItems = groupe.items?.length ?? 0;
    const parLignes = groupe.lignes?.length ?? 0;
    if (!parItems && !parLignes) continue;
    blocs.push({ type: 'titre', largeur: 'pleine', options: { texte: groupe.titre } });
    blocs.push({
      // Un groupe décrit en colonnes ne sait se rendre qu'en tableau ; une
      // longue liste de vignettes y gagne aussi en lisibilité.
      type: parLignes || parItems > 12 ? 'tableau' : 'liens',
      largeur: 'pleine',
      options: { groupe: cle },
    });
  }

  return blocs;
}

/** Les modèles proposés par le bouton « Modèles ». */
export function modeles(contexte) {
  const premierGroupe = Object.keys(contexte.groupes || {})[0];
  return [
    {
      id: 'defaut',
      nom: 'Disposition d’origine',
      description: 'Celle générée automatiquement à partir des faits.',
      blocs: () => dispositionParDefaut(contexte.type, contexte),
    },
    {
      id: 'recit',
      nom: 'Récit',
      description: 'Le texte d’abord, les faits en second plan.',
      blocs: () => [
        { type: 'bandeau', largeur: 'pleine', options: {} },
        { type: 'chapeau', largeur: 'pleine', options: { texte: 'Une phrase d’ouverture.' } },
        { type: 'texte', largeur: 'pleine', options: {} },
        { type: 'separateur', largeur: 'pleine', options: { motif: '❧' } },
        { type: 'identite', largeur: 'moitie', options: {} },
        { type: 'carte', largeur: 'moitie', options: {} },
      ],
    },
    {
      id: 'dossier',
      nom: 'Dossier',
      description: 'Tout ce que l’on sait, dense et tabulaire.',
      blocs: () => [
        { type: 'bandeau', largeur: 'pleine', options: {} },
        { type: 'chiffres', largeur: 'pleine', options: {} },
        { type: 'identite', largeur: 'tiers', options: {} },
        { type: 'texte', largeur: 'deux-tiers', options: {} },
        ...(premierGroupe
          ? [
              { type: 'titre', largeur: 'pleine', options: { texte: contexte.groupes[premierGroupe].titre } },
              { type: 'jauge', largeur: 'pleine', options: { groupe: premierGroupe } },
              { type: 'tableau', largeur: 'pleine', options: { groupe: premierGroupe } },
            ]
          : []),
      ],
    },
    {
      id: 'vitrine',
      nom: 'Vitrine',
      description: 'Une image pleine largeur et peu de texte.',
      blocs: () => [
        { type: 'bandeau', largeur: 'pleine', options: {} },
        { type: 'image', largeur: 'pleine', options: {} },
        { type: 'chapeau', largeur: 'pleine', options: { texte: 'Une phrase d’ouverture.' } },
        { type: 'chiffres', largeur: 'pleine', options: {} },
        { type: 'texte', largeur: 'pleine', options: {} },
      ],
    },
  ];
}
