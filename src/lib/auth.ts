import { scrypt } from '@noble/hashes/scrypt.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 } as const;
export const SESSION_COOKIE = 'kinene_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/* Separator is "." not "$": dotenv-expand treats $NAME in .env files as a variable
   reference and silently truncates the value. */
const HASH_SEPARATOR = '.';

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const key = scrypt(utf8ToBytes(password), salt, SCRYPT_PARAMS);
  return ['scrypt', bytesToHex(salt), bytesToHex(key)].join(HASH_SEPARATOR);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(HASH_SEPARATOR);
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = hexToBytes(parts[1]!);
    const expected = hexToBytes(parts[2]!);
    return timingSafeEqual(scrypt(utf8ToBytes(password), salt, SCRYPT_PARAMS), expected);
  } catch {
    return false;
  }
}

function sign(payload: string, secret: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(payload)));
}

export function createSession(secret: string, now = Date.now()): string {
  const payload = String(now + SESSION_TTL_MS);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = sign(payload, secret);
  if (!timingSafeEqual(utf8ToBytes(signature), utf8ToBytes(expected))) return false;

  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > now;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  };
}

