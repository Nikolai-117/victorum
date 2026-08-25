/**
 * Les chroniques du monde : frises et événements.
 *
 *   GET  /api/chroniques   → tout, d'un bloc
 *   POST /api/chroniques   → { action, … }
 *
 * L'écriture exige le mot de passe de l'atelier, comme le reste.
 */

import type { APIRoute } from 'astro';
import { ecritureAutorisee, stockage } from '../../lib/stockage';
import {
  lireChroniques,
  enregistrerChronique,
  supprimerChronique,
  enregistrerEvenement,
  supprimerEvenement,
  enregistrerAge,
  supprimerAge,
} from '../../lib/chroniques';

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
  json({ stockageActif: Boolean(stockage(locals)), chroniques: await lireChroniques(locals) });

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
      case 'chronique':
        return json({ ok: true, chroniques: await enregistrerChronique(locals, corps) });
      case 'supprimer-chronique':
        return json({ ok: true, chroniques: await supprimerChronique(locals, slug) });
      case 'evenement':
        return json({ ok: true, chroniques: await enregistrerEvenement(locals, corps) });
      case 'supprimer-evenement':
        return json({ ok: true, chroniques: await supprimerEvenement(locals, id) });
      case 'age':
        return json({ ok: true, chroniques: await enregistrerAge(locals, corps) });
      case 'supprimer-age':
        return json({ ok: true, chroniques: await supprimerAge(locals, id) });
      default:
        return json({ erreur: 'Action inconnue.' }, 400);
    }
  } catch (erreur) {
    return json({ erreur: (erreur as Error).message }, 400);
  }
};
