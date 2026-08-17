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

## Particularités de cette carte

- 42 villes s'appellent littéralement `???` dans les données. `nomAffiche()`
  les présente comme « Sans nom » ; ne pas leur inventer de nom.
- Couches vides dans l'export : `terrs`, `provs`, `population`, `goods`,
  `emblems`. Les marqueurs sont dessinés par nos soins depuis `index.json`.
- La rose des vents est exclue : son `<use>` n'a aucune transformation et le
  symbole s'étale sur 56 000 px.
- Population réelle = valeur Azgaar × 1000. Superficie = valeur × 3² (3 km/px).

## Environnement

- Node est installé mais le PATH n'est pas rafraîchi dans les shells déjà
  ouverts : utiliser `C:\Program Files\nodejs\node.exe` au besoin.
- Le répertoire de travail des sessions est `C:\Users\romai\Downloads\files`
  (projet Unreal), pas ce projet. `preview_start` lit le `.claude/launch.json`
  de CE dossier-là ; la configuration qui marche passe par
  `cmd /c "cd /d E:\victorum && C:\PROGRA~1\nodejs\node.exe node_modules\astro\astro.js dev"`.
- `npx astro check` réclame une installation interactive : préférer `npm run build`
  pour valider.
