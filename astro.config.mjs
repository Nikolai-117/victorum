import { defineConfig } from 'astro/config';

export default defineConfig({
  // Site statique : `npm run build` produit du HTML pur dans dist/,
  // que Cloudflare Pages sert tel quel. Aucun serveur, aucune base de données.
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // Un dossier par page (/atlas/index.html) : URLs propres sans configuration serveur.
    format: 'directory',
  },
  // Cultures et religions se consultent depuis la page Peuples : ces deux
  // adresses restent valides plutôt que de renvoyer une page introuvable.
  redirects: {
    "/cultures": "/peuples",
    "/religions": "/peuples",
  },
  devToolbar: { enabled: false },
});
