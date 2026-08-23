/**
 * Le codex de Victorum.
 *
 *   GET  /api/lore   → tout, d'un bloc
 *   POST /api/lore   → { action, … }
 *
 * L'écriture exige le mot de passe de l'atelier, comme le reste : l'adresse du
 * site est faite pour être partagée, le lore n'est modifiable que par Romain.
 */

import type { APIRoute } from 'astro';
import { ecritureAutorisee, stockage } from '../../lib/stockage';
import {
  lireLore,
  enregistrerArticle,
  supprimerArticle,
  enregistrerCategorie,
  supprimerCategorie,
} from '../../lib/lore';

export const prerender = false;

const json = (donnees: unknown, statut = 200) =>
  new Response(JSON.stringify(donnees), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });

export const GET: APIRoute = async ({ locals }) =>
  json({ stockageActif: Boolean(stockage(locals)), lore: await lireLore(locals) });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!stockage(locals)) {
    return json({ erreur: "Le stockage n'est pas encore disponible." }, 503);
  }

  const autorisation = await ecritureAutorisee(locals, request.headers.get('x-mot-de-passe'));
  if (!autorisation.ok) return json({ erreur: autorisation.raison }, 401);

  let corps: Record<string, unknown>;
  try {
    corps = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400);
  }

  const id = typeof corps.id === 'string' ? corps.id : '';
  const slug = typeof corps.slug === 'string' ? corps.slug : '';

  try {
    switch (corps.action) {
      case 'article':
        return json({ ok: true, lore: await enregistrerArticle(locals, corps) });
      case 'supprimer-article':
        return json({ ok: true, lore: await supprimerArticle(locals, id) });
      case 'categorie':
        return json({ ok: true, lore: await enregistrerCategorie(locals, corps) });
      case 'supprimer-categorie':
        return json({ ok: true, lore: await supprimerCategorie(locals, slug) });
      default:
        return json({ erreur: 'Action inconnue.' }, 400);
    }
  } catch (erreur) {
    return json({ erreur: (erreur as Error).message }, 400);
  }
};
