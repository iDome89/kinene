import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { adminSecret } from '@/lib/admin-env';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  if (!path.startsWith('/admin')) return next();
  if (path === '/admin/login') return next();

  const secret = adminSecret();
  if (!secret) {
    return new Response(
      'Admin non configurato. Imposta SESSION_SECRET e ADMIN_PASSWORD_HASH nelle variabili d’ambiente.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  if (!verifySession(context.cookies.get(SESSION_COOKIE)?.value, secret)) {
    return context.redirect(`/admin/login?next=${encodeURIComponent(path)}`, 302);
  }

  return next();
});
