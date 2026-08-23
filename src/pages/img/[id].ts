/**
 * Sert une image téléversée, depuis l'espace KV.
 *
 * L'identifiant est unique et l'image ne change jamais : on la déclare donc
 * immuable et cachée un an. Cloudflare et le navigateur la gardent, si bien que
 * KV n'est lu qu'à la toute première demande.
 */

import type { APIRoute } from 'astro';
import { stockage } from '../../lib/stockage';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const espace = stockage(locals);
  const id = String(params.id ?? '');
  if (!espace || !/^[0-9a-f]{32}$/.test(id)) return new Response('Introuvable', { status: 404 });

  const { value, metadata } = await espace.getWithMetadata<{ ct?: string }>(`image:${id}`, 'arrayBuffer');
  if (!value) return new Response('Introuvable', { status: 404 });

  return new Response(value, {
    headers: {
      'content-type': metadata?.ct || 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-robots-tag': 'noindex',
    },
  });
};
