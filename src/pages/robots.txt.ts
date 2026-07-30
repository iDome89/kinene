import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      'Disallow: /media/',
      '',
      `Sitemap: ${new URL('sitemap-index.xml', site ?? 'https://kinene.it').href}`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
