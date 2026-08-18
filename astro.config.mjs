import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  /**
   * Statique par défaut : les index, l'atlas et l'accueil restent du HTML pur,
   * servis depuis le cache de Cloudflare. Seules les fiches et l'API sont
   * rendues à la demande (`export const prerender = false`), parce qu'elles
   * doivent lire ce que Romain a enregistré depuis le site lui-même.
   */
  output: 'static',
  adapter: cloudflare({
    // Donne accès aux liaisons Cloudflare (dont le stockage) pendant `astro dev`.
    platformProxy: { enabled: true },
  }),
  trailingSlash: 'ignore',
  build: {
    // Un dossier par page (/atlas/index.html) : URLs propres sans configuration serveur.
    format: 'directory',
  },
  // Cultures et religions se consultent depuis la page Peuples : ces deux
  // adresses restent valides plutôt que de renvoyer une page introuvable.
  redirects: {
    '/cultures': '/peuples',
    '/religions': '/peuples',
  },
  devToolbar: { enabled: false },
});
