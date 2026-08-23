/**
 * Le téléversement d'images.
 *
 *   POST /api/images   (multipart, champ « image »)  → { url: '/img/<id>' }
 *
 * Les images vivent dans l'espace KV déjà relié — pas de service à créer, rien
 * à administrer. Le navigateur les réduit avant l'envoi (voir lib/upload.js),
 * si bien qu'elles restent légères. Servies ensuite par `/img/[id]`, mises en
 * cache par Cloudflare et le navigateur : une image n'est lue qu'une fois.
 *
 * Comme toute écriture, le mot de passe de l'atelier est exigé.
 */

import type { APIRoute } from 'astro';
import { ecritureAutorisee, stockage } from '../../lib/stockage';

export const prerender = false;

const json = (donnees: unknown, statut = 200) =>
  new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Plafond de sécurité : le client réduit déjà, ceci n'attrape que les abus. */
const MAX_OCTETS = 5 * 1024 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  const espace = stockage(locals);
  if (!espace) return json({ erreur: "Le stockage n'est pas encore disponible." }, 503);

  const autorisation = await ecritureAutorisee(locals, request.headers.get('x-mot-de-passe'));
  if (!autorisation.ok) return json({ erreur: autorisation.raison }, 401);

  let fichier: File | null = null;
  try {
    const form = await request.formData();
    const valeur = form.get('image');
    if (valeur instanceof File) fichier = valeur;
  } catch {
    return json({ erreur: 'Envoi illisible.' }, 400);
  }

  if (!fichier) return json({ erreur: 'Aucune image reçue.' }, 400);
  if (!fichier.type.startsWith('image/')) return json({ erreur: "Ce fichier n'est pas une image." }, 415);
  if (fichier.size > MAX_OCTETS) return json({ erreur: 'Image trop lourde (5 Mo maximum).' }, 413);

  const octets = await fichier.arrayBuffer();
  const id = crypto.randomUUID().replace(/-/g, '');
  await espace.put(`image:${id}`, octets, {
    metadata: { ct: fichier.type, taille: octets.byteLength },
  });

  return json({ ok: true, url: `/img/${id}` });
};
