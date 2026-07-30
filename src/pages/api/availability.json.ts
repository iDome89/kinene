import type { APIRoute } from 'astro';
import { loadOccupancy } from '@/db/queries';
import { availabilityWindow } from '@/lib/availability';
import { formatDay, parseDay, todayInBusinessTimezone } from '@/lib/dates';
import { isHighSeason } from '@/lib/season';

export const prerender = false;

const MAX_DAYS = 400;

export const GET: APIRoute = async ({ url }) => {
  const today = todayInBusinessTimezone();
  const requestedFrom = parseDay(url.searchParams.get('from') ?? '');
  const originDay = Math.max(today, requestedFrom ?? today);
  const dayCount = Math.min(MAX_DAYS, Math.max(1, Number(url.searchParams.get('days') ?? 120)));

  const grid = await loadOccupancy(originDay, dayCount);

  const days = availabilityWindow(grid).map((day) => ({
    d: formatDay(day.day),
    s: day.available ? 0 : day.reason === 'closed' ? 2 : 1,
    left: Math.max(0, day.capacity - day.taken),
    hs: isHighSeason(day.day) ? 1 : 0,
  }));

  return new Response(JSON.stringify({ originDay: formatDay(originDay), today: formatDay(today), days }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
