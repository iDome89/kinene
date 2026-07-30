import { expect, test } from '@playwright/test';
import { clearRateLimits } from './helpers';

/*
  Render terminates TLS and proxies to the container, so the browser's Origin
  never matches the server's own URL. Without security.allowedDomains every POST
  on the deployed site returns 403 "Cross-site POST form submissions are
  forbidden" — booking, login, confirm, blackouts, all of it.
*/

const LOGIN = '/admin/login';
const body = { password: 'not-the-password' };

test.beforeEach(async () => {
  await clearRateLimits();
});

test.describe('CSRF behind a reverse proxy', () => {
  test('accepts a POST proxied from the Render domain', async ({ request }) => {
    const response = await request.post(LOGIN, {
      form: body,
      headers: {
        origin: 'https://kinene.onrender.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'kinene.onrender.com',
      },
    });
    expect(response.status()).not.toBe(403);
  });

  test('accepts a POST proxied from the custom domain and its subdomains', async ({ request }) => {
    for (const host of ['kinene.it', 'www.kinene.it']) {
      const response = await request.post(LOGIN, {
        form: body,
        headers: {
          origin: `https://${host}`,
          'x-forwarded-proto': 'https',
          'x-forwarded-host': host,
        },
      });
      expect(response.status(), `proxied from ${host}`).not.toBe(403);
    }
  });

  test('still rejects a cross-site POST from an unknown origin', async ({ request }) => {
    const response = await request.post(LOGIN, {
      form: body,
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status()).toBe(403);
  });

  test('still rejects an attacker spoofing a forwarded host off the allowlist', async ({ request }) => {
    const response = await request.post(LOGIN, {
      form: body,
      headers: {
        origin: 'https://evil.example',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'evil.example',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('still rejects when the origin does not match an allowed forwarded host', async ({ request }) => {
    const response = await request.post(LOGIN, {
      form: body,
      headers: {
        origin: 'https://evil.example',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'kinene.it',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('protects the booking endpoint, not just the admin login', async ({ request }) => {
    const response = await request.post('/prenota', {
      form: { service: 'pensione' },
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status()).toBe(403);
  });
});
