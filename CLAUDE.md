# Victorum — consignes de travail

Site statique Astro : wiki et atlas du monde de Victorum, en français.
Interface en français ; les noms d'entités restent tels qu'ils sont dans la carte
(elle mélange déjà anglais et français : « Kingdom of Varenhold » vs « Royaume de
Levànzia »).

## La règle qui prime sur tout

**Ne jamais écrire le lore à la place de Romain.** Le monde lui appartient.

- L'import n'écrit que des faits : noms, positions, populations, hiérarchies,
  dates, relations. Jamais de résumé, de description, d'accroche ni de « deux
  phrases pour amorcer ».
- Ne jamais créer ni modifier un fichier de `src/contenu/` sans qu'il l'ait
  explicitement demandé et dicté le contenu.
- Le vocabulaire d'interface (libellés, états vides, textes d'aide) est en
  revanche à soigner : c'est le nôtre.
- Le contenu de démonstration écrit pour tester doit être effacé après.

## Architecture, et pourquoi

- **Astro, site statique.** Le projet précédent (Next + Prisma + SQLite) mettait
  4 minutes à builder et ne se déployait pas en hébergement gratuit. Ici :
  1028 pages en ~15 s, déployées sur Cloudflare Pages.
- **Faits et prose séparés.** `src/data/*.json` est régénérable et jetable ;
  `src/contenu/**/*.md` est sacré. Un réimport n'écrase donc rien.
- **Pas de fichier Markdown vide par entité.** Les fiches se rendent à partir des
  faits ; le `.md` n'est lu que s'il existe (`src/lib/contenu.ts`). Créer 1000
  stubs vides serait inutilisable.
- **Carte = SVG natif découpé en couches**, chargées à la demande, avec pan/zoom
  maison dans `src/pages/atlas.astro`. Pas de Leaflet : le SVG d'Azgaar et les
  coordonnées des entités partagent déjà le repère 1920×919. Rasteriser
  dégraderait la carte pour rien.
- **Aucune dépendance hors Astro.** Le pan/zoom, la recherche et les filtres sont
  écrits à la main, en JavaScript simple.
- **L'index de l'atlas est composé par Astro**, pas par l'import :
  `src/pages/carte/index.json.ts` prend les faits de `src/data/` et le
  vocabulaire de `src/lib/monde.ts` (« Sans nom » pour les 42 villes `???`,
  « Monarchie » pour `Monarchy`). Le script d'import ne l'écrit plus : il
  aurait fallu y recopier les tables de traduction.
- **Un clic renseigne, un double-clic emmène.** Sur la carte, un clic ouvre le
  panneau de droite ; un double-clic sur une cible visée — ville, lieu posé,
  nom d'un royaume — entre dans la fiche. Sur une étendue (territoire d'un
  royaume, aplat d'une province), qui couvre la moitié de la carte, le
  double-clic agrandit la vue comme partout ailleurs : c'est ce qui garde le
  geste de zoom utilisable.
- **La capture du pointeur masque la cible.** Le SVG appelle
  `setPointerCapture` dès qu'on appuie, pour ne pas perdre un déplacement qui
  sort de la fenêtre. Mais une fois la capture posée, le navigateur réattribue
  tous les événements suivants au SVG lui-même : au relâchement, `ev.target`
  n'est plus jamais la ville cliquée, et le clic reste sans effet. On cherche
  donc la cible par `document.elementFromPoint()`. Le symptôme est
  déroutant — le survol répond, le clic ne fait rien.

## Le parti visuel

Refait d'après des références que Romain a montrées : son reproche était que
l'interface avait l'air *générée* — bordures franches, mires d'angle, capitales
espacées partout, panneaux collés aux bords. Ce qui donne une âme, dans ces
références : des plaques de verre qui flottent, une atmosphère derrière, et
deux voix typographiques nettement séparées.

- **Deux voix, jamais mélangées.** Le monde parle en Almendra SC et EB Garamond
  (titres, noms, textes de Romain) ; l'appareil parle en IBM Plex Mono, petit
  et discret (boutons, étiquettes, réglages, chiffres). C'est le contraste qui
  fait le style : ni tout en serif, ni tout en mono.
- **Tout flotte.** Plaques de verre (`--verre`, `--flou`, `--rayon`), angles
  adoucis, ombre portée, filet de lumière en haut. Plus une seule mire d'angle.
- **L'atmosphère** (`.atmosphere`) est l'aperçu de la carte, flouté à 70 px
  derrière chaque page : le wiki est posé sur son propre monde. L'atlas s'en
  passe — la vraie carte l'occupe déjà, et un flou plein écran s'y paierait
  cher.
- **L'entête est une pilule flottante** au centre, avec la date du monde en
  guise d'horloge. Les plaques de l'atlas pendent dessous (`top: 4.7rem`), ce
  qui évite toute collision quelle que soit la largeur.
- **Piège rencontré** : une règle `body > *:not(.atmosphere) { position:
  relative }` a une spécificité de (0,1,1) et écrase donc le `position: fixed`
  d'une classe. L'entête retombait dans le flux, la carte débordait de 45 px.
  Viser `main, .pied` plutôt que `body > *`.

## Le moteur de mise en page

Une fiche est une suite de blocs décrite en JSON, pas un gabarit figé.

- `src/lib/blocs.js` est le **seul** moteur de rendu, en JavaScript sans
  dépendance. Astro l'utilise à la construction, l'éditeur le recharge tel quel
  dans le navigateur. Ne jamais dupliquer cette logique côté client : ce que
  Romain voit en composant doit être exactement ce qui est publié.
- `src/lib/contexte.ts` transforme une entité en faits sérialisables
  (`faits`, `chiffres`, `groupes`). Les gabarits de page ne décrivent plus de
  mise en page ; ils appellent `contexteDe.<type>()` et rendent `<Fiche>`.
- Un groupe se présente soit en `items` (vignettes, jauges), soit en
  `colonnes`/`lignes` (tableaux riches : ordre de bataille, campagnes). La
  disposition par défaut doit tester les deux — l'oubli des `lignes` avait fait
  disparaître deux tableaux.
- Les styles des blocs sont **globaux** (`src/styles/blocs.css`) : le HTML est
  injecté par `set:html` et ne porte pas les attributs de portée d'Astro.
- L'éditeur enregistre dans `localStorage`. Une disposition ne devient celle du
  site qu'une fois versionnée dans `src/contenu/mises-en-page/`.

## L'enregistrement depuis le site

- Les fiches sont **rendues à la demande** (`export const prerender = false`) :
  c'est ce qui permet de servir le dernier enregistrement sans clignotement.
  Tout le reste (accueil, index, atlas) reste statique — voir `dist/_routes.json`.
- `src/lib/stockage.ts` lit et écrit dans l'espace KV lié sous le nom
  `VICTORUM`. **La liaison est déclarée sans identifiant** dans
  `wrangler.jsonc` : Cloudflare provisionne la ressource au déploiement, ce qui
  évite à Romain d'avoir à la créer. Il ne veut rien administrer — le lui
  demander est un échec de conception, pas une étape normale.
- Le mot de passe n'est pas une variable secrète : **le premier saisi dans
  l'atelier devient celui du site** (`config:mot-de-passe` en KV, stocké en
  SHA-256). Au moment où Romain ouvre son atelier, personne ne connaît encore
  l'adresse. Une variable `MOT_DE_PASSE` reste prioritaire si elle existe.
- Le site est **privé au sens où Romain l'entend** : non indexable
  (`robots.txt`, `X-Robots-Tag`, `<meta robots>`), l'adresse valant clé. Ce
  n'est pas un contrôle d'accès ; ne pas le présenter comme tel.
- Toute écriture exige la variable secrète `MOT_DE_PASSE`. Sans elle, on refuse
  tout : le site est public, un point d'écriture ouvert serait une porte ouverte
  sur le lore de Romain. Comparaison à durée constante, adresses validées contre
  une liste blanche de sections.
- `Astro.rewrite()` ne sait pas cibler une page pré-générée depuis une route à
  la demande. C'est pourquoi `404.astro` porte aussi `prerender = false`.
- Le quota gratuit de KV est de 1 000 écritures par jour : l'envoi est différé
  de deux secondes après la dernière frappe, jamais déclenché à chaque touche.
- Une disposition enregistrée vide retombe sur celle par défaut : une page
  blanche n'est jamais un résultat voulu.

## Déploiement sur Cloudflare

Le dépôt est relié à **Workers Builds** (pas Pages) : chaque poussée sur
`main` déclenche une construction, et le résultat est visible sans le tableau
de bord via les *check runs* GitHub :

```bash
curl -s "https://api.github.com/repos/Nikolai-117/victorum/commits/HEAD_SHA/check-runs"
```

- **`dist/.assetsignore` est indispensable.** Le Worker produit par Astro vit
  dans `dist/_worker.js/`, à l'intérieur du répertoire d'actifs. Sans ce
  fichier, Wrangler le traite à la fois comme point d’entrée et comme
  ressource à servir, et le déploiement échoue. `scripts/finaliser-build.mjs`
  l'écrit en fin de construction ; l'adaptateur Astro ne le fait pas.
- **Le symptôme est trompeur** : `wrangler deploy --dry-run` passe sans un mot,
  parce qu'il ne parcourt pas les actifs. Deux constructions ont échoué avant
  que la cause soit trouvée — vérifier les check runs plutôt que de supposer.
- Un échec de construction ne casse rien : Cloudflare continue de servir le
  dernier déploiement réussi. Le site reste donc en ligne pendant les essais.
- `compatibility_date` ne doit pas dépasser ce que supporte le `workerd`
  installé, sinon `wrangler dev` retombe en arrière avec un avertissement.

## Pièges de l'export Azgaar, tous rencontrés et corrigés

Le format `.map` est un fichier à lignes indexées. `scripts/import-map.mjs` les
identifie **par signature de clés**, jamais par numéro de ligne : l'ordre change
entre versions d'Azgaar.

1. **L'index 0 est une entrée neutre** (« Neutrals », « Wildlands », « No
   religion ») aux clés incomplètes. La détection teste l'union des clés d'un
   échantillon, sinon les états et les cultures passent inaperçus.
2. **Les `<g/>` auto-fermants** signalent les couches désactivées. Un découpeur
   qui les traite comme ouvrantes saute des couches entières (`regions`,
   `borders`, `coastline` ont disparu ainsi).
3. **Azgaar garde `display:none`** sur les couches masquées au moment de la
   sauvegarde. On le retire du groupe racine, sinon la case à cocher n'a aucun
   effet. (`terrain` et `prec` sont concernés.)
4. **Les symboles ne sont pas dans l'export.** `#relief-*`, `#icon-*`,
   `#defs-compass-rose`, `#defs-hatching` vivent dans l'application Azgaar. Sans
   `data/azgaar/defs-symboles.svg`, la carte perd montagnes, forêts et pastilles
   de villes — silencieusement, sans erreur. Régénérer avec
   `node scripts/extraire-symboles.mjs`.
5. **Les fragments sont lus en XML strict** (`DOMParser`, `image/svg+xml`). Un
   seul attribut dupliqué — toléré en HTML — fait échouer *tout* le document. Le
   script d'extraction déduplique.
6. **`images/pattern1.png` est référencé en relatif** et absent de l'export. Le
   chemin est rendu absolu à l'import ; le fichier est téléchargé par
   `extraire-symboles.mjs`, avec un générateur de secours
   (`scripts/generer-texture.mjs`).
7. **~100 notes de marqueurs contiennent des `<iframe>` externes** (donjons
   Watabou). Assainies à l'import ; ne jamais injecter une légende brute.
8. **Les états supprimés sont réduits à `{i, removed:true}`** : leur nom est
   perdu. Les adversaires des guerres passées sont donc anonymes — c'est un fait,
   pas un bug à contourner en inventant un nom.

## Les courants : la politique du monde

Demandé « plus vaste, comme Stellaris ou Hearts of Iron, et personnalisable à
fond ». Azgaar ne produit rien de tel — et ne le pourrait pas, puisque c'est du
lore. On fournit donc la **mécanique**, jamais le contenu.

- **Un axe** est une grille de lecture : « Idéologies », « Doctrines
  militaires », « Obédiences »… Romain en crée autant qu'il veut, et choisit à
  quels types d'entités chacun s'applique.
- **Un courant** est une valeur de cet axe, avec nom, couleur, symbole et un
  texte qu'il écrit lui-même.
- **Une adhésion** relie une entité à un courant, avec une part facultative.
  Un axe *exclusif* n'admet qu'un courant par entité ; un axe *multiple* en
  accepte plusieurs avec leurs pourcentages — les partis d'un HOI 4.

- **Les adhésions s'accrochent à l'identifiant d'origine** (`etat:3`), pas au
  slug : un renommage dans Azgaar changerait le slug, jamais l'identifiant.
  C'est pourquoi `Contexte` porte désormais un champ `identifiant`.
- **Tout tient dans une seule clé KV** (`politique`) : l'ensemble est petit,
  toujours lu en entier, et une écriture atomique évite d'avoir à arbitrer des
  conflits.
- **Le mode de carte** de l'atlas recolore royaumes et provinces selon l'axe
  choisi, avec légende et comptes. Les teintes d'origine sont mémorisées avant
  d'être remplacées : revenir au mode « Royaumes » les rend exactement.
- **L'atelier des courants** (`/courants`) écrit par `/api/politique`, sous le
  même mot de passe que le reste. Après un enregistrement il recharge la page :
  la vue publique est rendue par le serveur, et la recharger évite d'en tenir
  une seconde version côté navigateur.
- Le système démarre **vide**, et le dit. Aucun axe, aucun courant, aucune
  couleur n'est proposé d'avance : ce serait écrire le monde à sa place.

## Le régime et les doctrines d'une nation

Demandé d'après une référence montrée : des doctrines sur axes opposés et un
mode de gouvernement, mais en vocabulaire médiéval plutôt que spatial.
`src/lib/doctrines.ts` tient tout le catalogue.

- **Quatorze axes**, chacun opposant deux doctrines (Dévot ↔ Séculier,
  Thaumaturge ↔ Inquisiteur, Chevaleresque ↔ Impitoyable…), réglés sur cinq
  crans : le cran extrême vaut position *fanatique*, le cran central « ni l'un
  ni l'autre ». Choisir un pôle exclut mécaniquement l'autre — c'est ce qui
  évite les nations à la fois belliqueuses et pacifiques.
- **Le régime se déduit des doctrines** par une liste de règles lues dans
  l'ordre, et l'on affiche toujours d'où vient la conclusion (« déduit de :
  Dévot fanatique, Inquisiteur »). Romain peut la contredire en choisissant une
  forme parmi quarante, ou en saisissant la sienne.
- Ce catalogue est du **vocabulaire**, pas du lore : il ne dit pas ce que
  professe tel royaume, seulement les cases où se placer. Ce que Romain en fait
  reste à lui, et rien n'est coché d'avance.
- **Les particularités** d'une nation sont des couples libellé / valeur libres
  (`champs`) : berceau, dynastie, ce que Romain veut. Ils s'affichent tels quels
  sur la fiche et dans le panneau de la carte, à côté de la cour.
- **`Number(null)` vaut zéro** : sans garde, effacer l'année d'avènement la
  remplaçait par l'an 0 et empêchait la nation vide d'être supprimée.
- L'atlas gagne des **modes de carte par doctrine** : chaque axe colore le
  monde de son pôle gauche à son pôle droit, le neutre en gris, avec une
  légende à cinq crans. Le mode « Régime » colore par forme de gouvernement.
  Les provinces empruntent les doctrines de leur royaume.

## Le codex : le lore du monde

Demandé en remplacement de la page « Courants » : un endroit pour tout ce que
la carte ne dit pas. `src/lib/lore.ts`, `/api/lore`, `/lore` et `/lore/[slug]`.

- **Sept catégories intégrées** — Bestiaire, Faune, Géographie, Religion,
  Culture, Magie, Science — parce que Romain les a nommées. Ce sont des
  étagères, pas du lore : les fournir n'écrit rien à sa place. Il en ajoute
  d'autres à volonté ; les intégrées, elles, ne se suppriment pas (mais peuvent
  recevoir une intro).
- **Un article** = titre, catégorie, symbole, couleur, accroche et un corps en
  Markdown court. Rangé par catégorie sur `/lore`, sa propre page sur
  `/lore/[slug]`. Rien n'est pré-rempli : le codex vierge le dit et s'arrête là.
- L'atelier écrit par `/api/lore`, sous le même mot de passe que le reste, et
  recharge après enregistrement — la vue publique est rendue par le serveur.
- **« Peuples » a disparu de la navigation** : la culture est désormais une
  catégorie du codex. Les fiches de cultures et de religions
  (`/cultures/[slug]`, `/religions/[slug]`) restent atteignables ; seuls les
  index d'ensemble redirigent vers `/lore` (voir `astro.config.mjs`).
- **La page « Courants » est retirée** au profit du codex. Le moteur d'axes et
  d'adhésions reste dans `politique.ts` — les nations en partagent le stockage —
  mais son atelier n'est plus exposé : sans axe créable, les modes de carte par
  courant ne s'affichent tout simplement pas.

## Les lieux remarquables

- **Ils ne sont plus importés.** Azgaar en produisait 532 dont 140 « Dungeon »
  strictement identiques : du remplissage anglais qui noyait le wiki. Romain a
  demandé leur retrait ; ne pas les réintroduire.
- Ils vivent dans le stockage KV (clé `lieux`), posés depuis l’atlas avec nom,
  nature, icône et couleur. `/lieux` et `/lieux/[slug]` se rendent donc à la
  demande, comme les fiches.
- L'icône est validée côté serveur (`iconeValide`) : au moins un pictogramme,
  aucun caractère de balisage. Une saisie libre finirait sinon stockée telle
  quelle, en attente d'un endroit où elle serait interprétée.
- Chaque lieu est un `<g>` mis à l’échelle inverse du zoom, pour garder sa
  taille à l'écran. Supprimer un lieu efface aussi le texte de sa fiche.

## Particularités de cette carte

- **Seules les villes des trois royaumes sont retenues** (150 sur 451) : les
  bourgs neutres d'Azgaar n'appartiennent à aucune nation. Le filtrage vaut
  aussi pour le SVG, sans quoi la carte afficherait des pastilles sans fiche.
- Le relief est écarté sur demande de Romain (3,3 Mo de pictogrammes).
- Les blasons extraits n'ont pas de déclaration `xmlns` : elle était portée par
  la carte qui les contenait. Sans elle, ils ne s'affichent pas en `<img>`.

- 42 villes s'appellent littéralement `???` dans les données. `nomAffiche()`
  les présente comme « Sans nom » ; ne pas leur inventer de nom.
- Couches vides dans l'export : `terrs`, `provs`, `population`, `goods`,
  `emblems`. Les marqueurs sont dessinés par nos soins depuis `index.json`.
- La rose des vents est exclue : son `<use>` n'a aucune transformation et le
  symbole s'étale sur 56 000 px.
- Population réelle = valeur Azgaar × 1000. Superficie = valeur × 3² (3 km/px).

## Les provinces, reconstruites

Azgaar n'exporte pas la surface des provinces : la couche `provs` ne contient
que des étiquettes, et elle était masquée à l'enregistrement. Deux choses sont
en revanche exactes dans le SVG, et suffisent — `scripts/provinces.mjs` :

- `#statesBody` : le contour de chaque royaume, en anneaux fermés (les aires
  négatives sont des lacs ou des enclaves) ;
- `#provinceBorders` : les cloisons intérieures, tracées le long des mêmes
  arêtes de cellules, donc aux mêmes sommets, au pixel près.

On découpe donc chaque royaume par ses cloisons, puis on attribue chaque morceau
par le **pôle d'inaccessibilité** de la province (il est par construction à
l'intérieur), et à défaut par les villes qu'il contient.

- **Le piège, ce sont les points triples.** Là où trois provinces se
  rejoignent, aucune des trois branches n'a ses deux bouts sur le contour du
  royaume : chacune attend le point triple, que seule une autre peut créer. On
  en sort en soudant deux branches en une seule coupe, qui traverse alors de
  bord à bord. Sans cette soudure : 9 provinces sur 13.
- **La vérification qui compte** est la comparaison des surfaces reconstruites
  aux superficies déclarées par Azgaar : écart total de 1,6 %. Les provinces
  d'archipel s'écartent davantage (Selenor, −40 %) parce qu'Azgaar somme des
  cellules là où nous mesurons des polygones : un îlot minuscule compte pour
  une cellule entière.
- **Ornebois n'a aucune province** : 0 % de couverture pour cet État est le bon
  résultat, pas un bug.
- Un morceau que ni pôle ni ville ne rattache **reste sans couleur** : la teinte
  du royaume transparaît dessous, et le rapport d'import le signale. Inventer
  une frontière serait pire que ne pas la tracer.

## Environnement

- Node est installé mais le PATH n'est pas rafraîchi dans les shells déjà
  ouverts : utiliser `C:\Program Files\nodejs\node.exe` au besoin.
- Le répertoire de travail des sessions est `C:\Users\romai\Downloads\files`
  (projet Unreal), pas ce projet. `preview_start` lit le `.claude/launch.json`
  de CE dossier-là ; la configuration qui marche passe par
  `cmd /c "cd /d E:\victorum && C:\PROGRA~1\nodejs\node.exe node_modules\astro\astro.js dev"`.
- `npx astro check` réclame une installation interactive : préférer `npm run build`
  pour valider.
