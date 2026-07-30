import type { APIRoute } from 'astro';
import { sqlite } from '@/db/client';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    await sqlite.execute('select 1');
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, db: 'unreachable' }), {
      status: 503,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
};
