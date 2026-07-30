import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://kinene.it',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [preact({ compat: false }), sitemap()],
  vite: { plugins: [tailwindcss()] },
  image: { responsiveStyles: true },
  /*
    Render terminates TLS and proxies to the container, so the server sees
    http://0.0.0.0:4321 while the browser sends the public origin. Without this
    allowlist Astro's CSRF check rejects every POST with 403. Listing the domains
    keeps checkOrigin enabled rather than disabling it; an X-Forwarded-Host that
    does not match is ignored and the real host is used.
  */
  security: {
    allowedDomains: [
      { hostname: '**.onrender.com', protocol: 'https' },
      { hostname: 'kinene.it', protocol: 'https' },
      { hostname: '**.kinene.it', protocol: 'https' },
    ],
  },
  env: {
    schema: {
      SESSION_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      ADMIN_PASSWORD_HASH: envField.string({ context: 'server', access: 'secret', optional: true }),
      DATABASE_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        default: 'file:./data/kinene.db',
      }),
      DATABASE_AUTH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  build: { inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
});
