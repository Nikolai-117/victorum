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
  // Les liaisons Cloudflare ne sont pas simulées pendant `astro dev` : on
  // vérifie le Worker avec `npx wrangler dev`, qui exécute le vrai runtime.
  adapter: cloudflare(),
  trailingSlash: 'ignore',
  build: {
    // Un dossier par page (/atlas/index.html) : URLs propres sans configuration serveur.
    format: 'directory',
  },
  // Cultures et religions se consultent depuis la page Peuples : ces deux
  // adresses restent valides plutôt que de renvoyer une page introuvable.
  // Les index d'antan redirigent vers le codex : les cultures et religions n'ont
  // plus de page d'ensemble propre, elles vivent dans le lore ; leurs fiches
  // individuelles (/cultures/[slug]) restent atteignables.
  redirects: {
    '/peuples': '/lore',
    '/courants': '/lore',
    '/cultures': '/lore',
    '/religions': '/lore',
  },
  devToolbar: { enabled: false },
});
