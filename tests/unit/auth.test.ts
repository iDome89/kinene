import { describe, expect, it } from 'vitest';
import {
  createSession,
  hashPassword,
  sessionCookieOptions,
  verifyPassword,
  verifySession,
} from '@/lib/auth';

describe('hashPassword', () => {
  it('accepts the correct password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('Correct horse battery staple', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
    expect(verifyPassword('correct horse battery stapl', stored)).toBe(false);
  });

  it('salts, so the same password never yields the same hash', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('never emits "$", which dotenv-expand would silently truncate in a .env file', () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(hashPassword(`password-${attempt}`)).not.toContain('$');
    }
  });

  it('survives a round trip through a .env-style line', () => {
    const stored = hashPassword('kinene');
    const line = `ADMIN_PASSWORD_HASH=${stored}`;
    const parsed = line.slice(line.indexOf('=') + 1);
    expect(verifyPassword('kinene', parsed)).toBe(true);
  });

  it('rejects malformed stored values instead of throwing', () => {
    for (const bad of ['', 'scrypt', 'scrypt.abc', 'bcrypt.aa.bb', 'scrypt.zz.zz', 'scrypt.a.b.c']) {
      expect(verifyPassword('anything', bad)).toBe(false);
    }
  });
});

describe('sessions', () => {
  const secret = 'a'.repeat(64);

  it('accepts a freshly minted session', () => {
    expect(verifySession(createSession(secret), secret)).toBe(true);
  });

  it('rejects a session signed with a different secret', () => {
    expect(verifySession(createSession(secret), 'b'.repeat(64))).toBe(false);
  });

  it('rejects an expired session', () => {
    const now = 1_800_000_000_000;
    const token = createSession(secret, now);
    expect(verifySession(token, secret, now + 1000)).toBe(true);
    expect(verifySession(token, secret, now + 9 * 60 * 60 * 1000)).toBe(false);
  });

  it('rejects a tampered expiry, because the signature covers it', () => {
    const token = createSession(secret);
    const [, signature] = token.split('.');
    expect(verifySession(`99999999999999.${signature}`, secret)).toBe(false);
  });

  it('rejects missing and malformed tokens', () => {
    for (const bad of [undefined, '', 'nosignature', '.abc', 'abc.']) {
      expect(verifySession(bad, secret)).toBe(false);
    }
  });
});

describe('sessionCookieOptions', () => {
  it('is httpOnly and strict, and secure only over https', () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
    });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
