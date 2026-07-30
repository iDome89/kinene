import type { APIRoute } from 'astro';
import { readMedia } from '@/lib/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const body = await readMedia(params.file ?? '');
  if (body === null) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'image/webp',
      /* Slugs are random and derivatives never change, so this can be immutable. */
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(body.byteLength),
      'x-content-type-options': 'nosniff',
    },
  });
};
