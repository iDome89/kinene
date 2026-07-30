import { and, eq, gte, inArray, lt, lte, or } from 'drizzle-orm';
import { db } from './client';
import { blackouts, bookings, capacityOverrides, dogs, owners, rateLimits } from './schema';
import { buildOccupancy, type DaySpan, type OccupancyGrid } from '@/lib/availability';
import { business } from '@/config/business';

export const OCCUPYING_STATUSES = ['confirmed'] as const;

export async function loadOccupancy(originDay: number, dayCount: number): Promise<OccupancyGrid> {
  const endExclusive = originDay + dayCount;

  const [spans, blocks, overrides] = await Promise.all([
    db
      .select({ from: bookings.occupiesFrom, toExclusive: bookings.occupiesTo })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, [...OCCUPYING_STATUSES]),
          lt(bookings.occupiesFrom, endExclusive),
          gte(bookings.occupiesTo, originDay + 1),
        ),
      ),
    db
      .select({ from: blackouts.fromDay, toExclusive: blackouts.toDayExclusive })
      .from(blackouts)
      .where(and(lt(blackouts.fromDay, endExclusive), gte(blackouts.toDayExclusive, originDay + 1))),
    db
      .select()
      .from(capacityOverrides)
      .where(and(gte(capacityOverrides.day, originDay), lt(capacityOverrides.day, endExclusive))),
  ]);

  return buildOccupancy({
    originDay,
    dayCount,
    defaultCapacity: business.capacity.defaultMaxDogs,
    closedWeekdays: business.capacity.closedWeekdays,
    occupied: spans as DaySpan[],
    blackouts: blocks as DaySpan[],
    capacityOverrides: overrides.map((row) => ({ day: row.day, maxDogs: row.maxDogs })),
  });
}

export async function findDogByMicrochip(microchip: string) {
  const [row] = await db.select().from(dogs).where(eq(dogs.microchip, microchip)).limit(1);
  return row ?? null;
}

export async function findOwnerByEmail(email: string) {
  const [row] = await db.select().from(owners).where(eq(owners.email, email)).limit(1);
  return row ?? null;
}

export async function listBookings(statuses: readonly (typeof bookings.$inferSelect)['status'][]) {
  return db
    .select({
      booking: bookings,
      dog: dogs,
      owner: owners,
    })
    .from(bookings)
    .innerJoin(dogs, eq(bookings.dogId, dogs.id))
    .innerJoin(owners, eq(dogs.ownerId, owners.id))
    .where(inArray(bookings.status, [...statuses]))
    .orderBy(bookings.startDay);
}

export async function listBookingsOverlapping(fromDay: number, toDayExclusive: number) {
  return db
    .select({ booking: bookings, dog: dogs, owner: owners })
    .from(bookings)
    .innerJoin(dogs, eq(bookings.dogId, dogs.id))
    .innerJoin(owners, eq(dogs.ownerId, owners.id))
    .where(
      and(
        inArray(bookings.status, ['requested', 'confirmed']),
        lt(bookings.occupiesFrom, toDayExclusive),
        gte(bookings.occupiesTo, fromDay + 1),
      ),
    )
    .orderBy(bookings.startDay);
}

export async function listBlackouts(fromDay: number) {
  return db
    .select()
    .from(blackouts)
    .where(gte(blackouts.toDayExclusive, fromDay))
    .orderBy(blackouts.fromDay);
}

const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function consumeRateLimit(key: string, limit: number, now: number): Promise<boolean> {
  const [existing] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!existing) {
    await db.insert(rateLimits).values({ key, windowStart: now, count: 1 });
    return true;
  }

  if (now - existing.windowStart > RATE_WINDOW_MS) {
    await db.update(rateLimits).set({ windowStart: now, count: 1 }).where(eq(rateLimits.key, key));
    return true;
  }

  if (existing.count >= limit) return false;

  await db
    .update(rateLimits)
    .set({ count: existing.count + 1 })
    .where(eq(rateLimits.key, key));
  return true;
}

export { db, bookings, dogs, owners, blackouts, capacityOverrides };
export { and, eq, gte, lt, lte, or, inArray };
