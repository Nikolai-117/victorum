/**
 * L'API d'enregistrement de l'atelier.
 *
 *   GET  /api/page?section=etats&slug=levanzia   → ce qui est enregistré
 *   POST /api/page                                → enregistre une fiche
 *
 * L'écriture exige le mot de passe de l'atelier, envoyé dans l'en-tête
 * `x-mot-de-passe`. Le site est public : sans cela, n'importe quel visiteur
 * pourrait effacer le travail de Romain.
 */

import type { APIRoute } from 'astro';
import { adresseValide, ecrirePage, ecritureAutorisee, lirePage, stockage } from '../../lib/stockage';

export const prerender = false;

const json = (donnees: unknown, statut = 200) =>
  new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const GET: APIRoute = async ({ url, locals }) => {
  const section = url.searchParams.get('section');
  const slug = url.searchParams.get('slug');
  if (!adresseValide(section, slug)) return json({ erreur: 'Adresse de fiche invalide.' }, 400);

  return json({
    stockageActif: Boolean(stockage(locals)),
    page: await lirePage(locals, section, slug as string),
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!stockage(locals)) {
    return json(
      {
        erreur:
          "Le stockage n'est pas encore relié à ce site. L'atelier continue d'enregistrer dans ton navigateur en attendant.",
        stockageActif: false,
      },
      503
    );
  }

  const autorisation = ecritureAutorisee(locals, request.headers.get('x-mot-de-passe'));
  if (!autorisation.ok) return json({ erreur: autorisation.raison }, 401);

  let corps: { section?: unknown; slug?: unknown; blocs?: unknown; texte?: unknown };
  try {
    corps = await request.json();
  } catch {
    return json({ erreur: 'Requête illisible.' }, 400);
  }

  const { section, slug } = corps;
  if (!adresseValide(section, slug)) return json({ erreur: 'Adresse de fiche invalide.' }, 400);

  if (corps.blocs !== undefined && !Array.isArray(corps.blocs)) {
    return json({ erreur: 'La mise en page doit être une liste de blocs.' }, 400);
  }
  if (corps.texte !== undefined && typeof corps.texte !== 'string') {
    return json({ erreur: 'Le texte doit être une chaîne.' }, 400);
  }
  // Garde-fou de volume : le plan gratuit de KV plafonne à 25 Mo par valeur,
  // mais une fiche qui dépasse le mégaoctet trahit surtout une erreur.
  const poids = JSON.stringify(corps).length;
  if (poids > 1_000_000) return json({ erreur: 'Fiche trop volumineuse (1 Mo maximum).' }, 413);

  try {
    const page = await ecrirePage(locals, section, slug as string, {
      blocs: corps.blocs as unknown[] | undefined,
      texte: corps.texte as string | undefined,
    });
    return json({ ok: true, page });
  } catch (erreur) {
    return json({ erreur: `Enregistrement impossible : ${(erreur as Error).message}` }, 500);
  }
};
