/**
 * La politique du monde : axes, courants, adhésions.
 *
 *   GET  /api/politique   → tout, d'un bloc
 *   POST /api/politique   → { action, … }
 *
 * Comme pour les fiches et les lieux, l'écriture exige le mot de passe de
 * l'atelier : l'adresse du site est faite pour être partagée, et le lore de
 * Romain n'est pas modifiable par qui la connaît.
 */

import type { APIRoute } from 'astro';
import { ecritureAutorisee, stockage } from '../../lib/stockage';
import {
  lirePolitique,
  enregistrerAxe,
  supprimerAxe,
  enregistrerCourant,
  supprimerCourant,
  enregistrerAdhesions,
  enregistrerNation,
} from '../../lib/politique';

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
  json({
    stockageActif: Boolean(stockage(locals)),
    politique: await lirePolitique(locals),
  });

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

  try {
    switch (corps.action) {
      case 'axe':
        return json({ ok: true, politique: await enregistrerAxe(locals, corps) });
      case 'supprimer-axe':
        return json({ ok: true, politique: await supprimerAxe(locals, id) });
      case 'courant':
        return json({ ok: true, politique: await enregistrerCourant(locals, corps) });
      case 'supprimer-courant':
        return json({ ok: true, politique: await supprimerCourant(locals, id) });
      case 'nation':
        return json({
          ok: true,
          politique: await enregistrerNation(locals, String(corps.entite ?? ''), corps),
        });
      case 'adhesions':
        return json({
          ok: true,
          politique: await enregistrerAdhesions(locals, id, corps.adhesions),
        });
      default:
        return json({ erreur: 'Action inconnue.' }, 400);
    }
  } catch (erreur) {
    return json({ erreur: (erreur as Error).message }, 400);
  }
};
