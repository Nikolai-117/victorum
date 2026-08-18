# Victorum

Le wiki et l'atlas du monde de Victorum. Site statique : chaque page est du HTML
pur, sans base de données ni serveur à administrer.

## Les trois commandes

```bash
npm run dev      # travailler en local, sur http://localhost:4321
npm run build    # fabriquer le site dans dist/ (≈ 15 s pour 1028 pages)
npm run import   # relire la carte Azgaar et régénérer les données
```

## Où sont les choses

| Chemin | Contenu | Qui l'écrit |
| --- | --- | --- |
| `data/source/victorum.map` | L'export Azgaar. **Hors dépôt** (14,8 Mo). | Toi, depuis Azgaar |
| `src/contenu/**/*.md` | **Ton lore.** | Toi, uniquement |
| `src/data/*.json` | Les faits extraits de la carte. | `npm run import` |
| `public/carte/` | La carte découpée en couches. | `npm run import` |
| `src/pages/` | Les gabarits de pages. | Le code |

## Écrire une fiche

Une fiche existe déjà pour chaque entité de la carte : elle affiche ses faits et,
tant que tu n'as rien écrit, l'indication du fichier à créer. Pour écrire la fiche
du royaume de Levànzia (`/etats/levanzia`), crée :

```
src/contenu/etats/levanzia.md
```

N'importe quel Markdown fait l'affaire. Un titre `#` en tête n'est pas nécessaire :
le nom et les faits sont déjà affichés au-dessus.

Les sections disponibles : `etats`, `provinces`, `villes`, `lieux`, `cultures`,
`religions`, et `articles` pour les pages libres. `articles/accueil.md` remplit
l'introduction de la page d'accueil, `articles/chronologie.md` celle de la frise.

## Composer une page

Chaque fiche s'ouvre avec une disposition déduite de ses faits. Pour la
singulariser, le bouton **Mettre en page**, en bas à droite de la fiche :

- **+ Bloc** ouvre le catalogue, rangé par famille (en-tête, identité, chiffres,
  textes, relations, visuels, mise en forme).
- Chaque bloc se déplace à la poignée ⣿ ou aux flèches, change de largeur
  (pleine, 2/3, 1/2, 1/3), se duplique, se règle (⚙) et se supprime.
- **Modèles** applique une disposition entière : Récit, Dossier, Vitrine.

Le travail est gardé dans ton navigateur au fur et à mesure. Pour qu'il devienne
la version publiée du site, clique **Exporter** : le JSON est copié dans le
presse-papiers et téléchargé. Colle-le-moi et je l'enregistre dans
`src/contenu/mises-en-page/<section>/<slug>.json`.

Les illustrations se déposent dans `public/illustrations/` ; le bloc
Illustration attend alors un chemin comme `/illustrations/mon-image.jpg`.

## Mettre à jour la carte

1. Dans Azgaar, sauvegarde ta carte (`.map`).
2. Remplace `data/source/victorum.map`.
3. `npm run import`.

**L'import ne touche jamais à tes fichiers Markdown.** Il ne réécrit que les faits :
noms, populations, positions, hiérarchies, dates. Tu peux réimporter autant de fois
que tu veux sans risquer une ligne de ton texte.

Si l'import signale des libellés manquants (nouveaux types de marqueurs ou de zones),
c'est qu'Azgaar a introduit une catégorie inconnue : elle s'affichera en anglais tant
qu'elle n'est pas traduite dans `scripts/import-map.mjs`.

## Publication

Le site est publié sur Cloudflare Pages. Toute modification poussée sur la branche
`main` de GitHub déclenche une reconstruction automatique, en une minute environ.

```bash
git add -A
git commit -m "ce que j'ai changé"
git push
```

## Crédits

Cartographie produite avec [Azgaar's Fantasy Map Generator](https://azgaar.github.io/Fantasy-Map-Generator/)
(licence MIT, © 2017-2024 Max Haniyeu). Les symboles de relief et d'icônes de villes
présents dans `data/azgaar/` en proviennent — voir `scripts/extraire-symboles.mjs`.
