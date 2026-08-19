/**
 * Les lieux que Romain pose sur sa carte.
 *
 *   GET  /api/lieux    → la liste
 *   POST /api/lieux    → { action: 'enregistrer' | 'supprimer', lieu }
 *
 * Comme pour les fiches, l'écriture exige le mot de passe de l'atelier :
 * le lien du site est fait pour être partagé.
 */

import type { APIRoute } from 'astro';
import { ecritureAutorisee, enregistrerLieu, listerLieux, stockage, supprimerLieu } from '../../lib/stockage';

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
  json({ stockageActif: Boolean(stockage(locals)), lieux: await listerLieux(locals) });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!stockage(locals)) {
    return json({ erreur: "Le stockage n'est pas encore disponible." }, 503);
  }

  const autorisation = await ecritureAutorisee(locals, request.headers.get('x-mot-de-passe'));
  if (!autorisation.ok) return json({ erreur: autorisation.raison }, 401);

  let corps: { action?: unknown; lieu?: Record<string, unknown>; id?: unknown };
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400);
  }

  try {
    if (corps.action === 'supprimer') {
      if (typeof corps.id !== 'string') return json({ erreur: 'Identifiant manquant.' }, 400);
      const retire = await supprimerLieu(locals, corps.id);
      return json({ ok: retire, lieux: await listerLieux(locals) });
    }

    if (!corps.lieu || typeof corps.lieu !== 'object') {
      return json({ erreur: 'Aucun lieu fourni.' }, 400);
    }
    const lieu = await enregistrerLieu(locals, corps.lieu);
    return json({ ok: true, lieu, lieux: await listerLieux(locals) });
  } catch (erreur) {
    return json({ erreur: (erreur as Error).message }, 400);
  }
};
