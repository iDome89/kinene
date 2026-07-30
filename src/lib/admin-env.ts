import { ADMIN_PASSWORD_HASH, SESSION_SECRET } from 'astro:env/server';

export function adminSecret(): string | null {
  return SESSION_SECRET || null;
}

export function adminPasswordHash(): string | null {
  return ADMIN_PASSWORD_HASH || null;
}
