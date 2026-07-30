import type { APIRoute } from 'astro';
import { db } from '@/db/client';
import {
  blackouts,
  bookings,
  capacityOverrides,
  dogs,
  emergencyContacts,
  galleryImages,
  owners,
  reviews,
} from '@/db/schema';
import { formatDay, todayInBusinessTimezone } from '@/lib/dates';

export const prerender = false;

/* The volume can be lost; a file on Valeria's laptop cannot. Guarded by the /admin middleware. */
export const GET: APIRoute = async () => {
  const [
    ownerRows,
    dogRows,
    bookingRows,
    contactRows,
    reviewRows,
    galleryRows,
    blackoutRows,
    capacityRows,
  ] = await Promise.all([
    db.select().from(owners),
    db.select().from(dogs),
    db.select().from(bookings),
    db.select().from(emergencyContacts),
    db.select().from(reviews),
    db.select().from(galleryImages),
    db.select().from(blackouts),
    db.select().from(capacityOverrides),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    owners: ownerRows,
    dogs: dogRows,
    bookings: bookingRows,
    emergencyContacts: contactRows,
    reviews: reviewRows,
    galleryImages: galleryRows,
    blackouts: blackoutRows,
    capacityOverrides: capacityRows,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="kinene-backup-${formatDay(todayInBusinessTimezone())}.json"`,
      'cache-control': 'no-store',
    },
  });
};
