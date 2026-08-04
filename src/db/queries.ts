import { and, count, desc, eq, gte, inArray, lt, lte, or } from 'drizzle-orm';
import { db } from './client';
import {
  blackouts,
  bookingDogs,
  bookings,
  capacityOverrides,
  dogs,
  emergencyContacts,
  galleryImages,
  owners,
  rateLimits,
  reviews,
} from './schema';
import { buildOccupancy, type DaySpan, type OccupancyGrid } from '@/lib/availability';
import { business } from '@/config/business';

export const OCCUPYING_STATUSES = ['confirmed'] as const;

export async function loadOccupancy(originDay: number, dayCount: number): Promise<OccupancyGrid> {
  const endExclusive = originDay + dayCount;

  const [spans, blocks, overrides] = await Promise.all([
    /* Il peso e' il numero di cani: due cani tolgono due posti, non uno. */
    db
      .select({
        from: bookings.occupiesFrom,
        toExclusive: bookings.occupiesTo,
        weight: count(bookingDogs.id),
      })
      .from(bookings)
      .innerJoin(bookingDogs, eq(bookingDogs.bookingId, bookings.id))
      .where(
        and(
          inArray(bookings.status, [...OCCUPYING_STATUSES]),
          lt(bookings.occupiesFrom, endExclusive),
          gte(bookings.occupiesTo, originDay + 1),
        ),
      )
      .groupBy(bookings.id),
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

export async function contactsForBookings(bookingIds: readonly number[]) {
  if (bookingIds.length === 0) return new Map<number, (typeof emergencyContacts.$inferSelect)[]>();

  const rows = await db
    .select()
    .from(emergencyContacts)
    .where(inArray(emergencyContacts.bookingId, [...bookingIds]))
    .orderBy(emergencyContacts.position);

  const byBooking = new Map<number, (typeof emergencyContacts.$inferSelect)[]>();
  for (const row of rows) {
    const list = byBooking.get(row.bookingId);
    if (list) list.push(row);
    else byBooking.set(row.bookingId, [row]);
  }
  return byBooking;
}

export async function listGallery() {
  return db.select().from(galleryImages).orderBy(galleryImages.position, galleryImages.id);
}

export async function nextGalleryPosition(): Promise<number> {
  const rows = await db.select({ position: galleryImages.position }).from(galleryImages);
  return rows.reduce((max, row) => Math.max(max, row.position), 0) + 1;
}

export interface BookingWithDogs {
  readonly booking: typeof bookings.$inferSelect;
  readonly dogs: (typeof dogs.$inferSelect)[];
  readonly owner: typeof owners.$inferSelect;
}

function groupByBooking(
  rows: readonly {
    booking: typeof bookings.$inferSelect;
    dog: typeof dogs.$inferSelect;
    owner: typeof owners.$inferSelect;
  }[],
): BookingWithDogs[] {
  const byId = new Map<number, BookingWithDogs>();
  for (const row of rows) {
    const found = byId.get(row.booking.id);
    if (found) found.dogs.push(row.dog);
    else byId.set(row.booking.id, { booking: row.booking, dogs: [row.dog], owner: row.owner });
  }
  return [...byId.values()];
}

const bookingDogJoin = () =>
  db
    .select({ booking: bookings, dog: dogs, owner: owners })
    .from(bookings)
    .innerJoin(bookingDogs, eq(bookingDogs.bookingId, bookings.id))
    .innerJoin(dogs, eq(bookingDogs.dogId, dogs.id))
    .innerJoin(owners, eq(dogs.ownerId, owners.id));

export async function findBookingWithOwner(id: number): Promise<BookingWithDogs | null> {
  const rows = await bookingDogJoin().where(eq(bookings.id, id)).orderBy(bookingDogs.position);
  return groupByBooking(rows)[0] ?? null;
}

export async function listPublishedReviews() {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.status, 'published'))
    .orderBy(desc(reviews.createdAt));
}

export async function listReviewsByStatus(statuses: readonly (typeof reviews.$inferSelect)['status'][]) {
  return db
    .select()
    .from(reviews)
    .where(inArray(reviews.status, [...statuses]))
    .orderBy(desc(reviews.createdAt));
}

export async function findDogByMicrochip(microchip: string) {
  const [row] = await db.select().from(dogs).where(eq(dogs.microchip, microchip)).limit(1);
  return row ?? null;
}

export async function findOwnerByEmail(email: string) {
  const [row] = await db.select().from(owners).where(eq(owners.email, email)).limit(1);
  return row ?? null;
}

export async function listBookings(
  statuses: readonly (typeof bookings.$inferSelect)['status'][],
): Promise<BookingWithDogs[]> {
  const rows = await bookingDogJoin()
    .where(inArray(bookings.status, [...statuses]))
    .orderBy(bookings.startDay, bookingDogs.position);
  return groupByBooking(rows);
}

export async function listBookingsOverlapping(
  fromDay: number,
  toDayExclusive: number,
): Promise<BookingWithDogs[]> {
  const rows = await bookingDogJoin()
    .where(
      and(
        inArray(bookings.status, ['requested', 'confirmed']),
        lt(bookings.occupiesFrom, toDayExclusive),
        gte(bookings.occupiesTo, fromDay + 1),
      ),
    )
    .orderBy(bookings.startDay, bookingDogs.position);
  return groupByBooking(rows);
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

export { db, bookingDogs, bookings, dogs, owners, blackouts, capacityOverrides, emergencyContacts, galleryImages, reviews };
export { and, count, desc, eq, gte, lt, lte, or, inArray };
