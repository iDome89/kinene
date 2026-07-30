import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const owners = sqliteTable(
  'owners',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    address: text('address'),
    gdprConsentAt: integer('gdpr_consent_at').notNull(),
    rulesAcceptedAt: integer('rules_accepted_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('owners_email_idx').on(table.email)],
);

export const dogs = sqliteTable(
  'dogs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    breed: text('breed'),
    birthDay: integer('birth_day').notNull(),
    sex: text('sex', { enum: ['M', 'F'] }).notNull(),
    neutered: integer('neutered', { mode: 'boolean' }).notNull().default(false),
    microchip: text('microchip').notNull(),
    insurancePolicy: text('insurance_policy'),
    vetName: text('vet_name'),
    vetPhone: text('vet_phone'),
    foodNotes: text('food_notes'),
    allergies: text('allergies'),
    medications: text('medications'),
    intakeTestStatus: text('intake_test_status', { enum: ['pending', 'passed', 'failed'] })
      .notNull()
      .default('pending'),
    intakeTestDay: integer('intake_test_day'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('dogs_owner_idx').on(table.ownerId),
    uniqueIndex('dogs_microchip_idx').on(table.microchip),
  ],
);

export const bookings = sqliteTable(
  'bookings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reference: text('reference').notNull(),
    dogId: integer('dog_id')
      .notNull()
      .references(() => dogs.id, { onDelete: 'cascade' }),
    service: text('service', { enum: ['asilo-diurno', 'asilo-notturno', 'pensione'] }).notNull(),
    startDay: integer('start_day').notNull(),
    endDay: integer('end_day').notNull(),
    occupiesFrom: integer('occupies_from').notNull(),
    occupiesTo: integer('occupies_to').notNull(),
    status: text('status', {
      enum: ['requested', 'confirmed', 'rejected', 'cancelled', 'completed'],
    })
      .notNull()
      .default('requested'),
    priceCents: integer('price_cents').notNull(),
    notes: text('notes'),
    staffNote: text('staff_note'),
    createdAt: integer('created_at').notNull(),
    decidedAt: integer('decided_at'),
  },
  (table) => [
    index('bookings_span_idx').on(table.status, table.occupiesFrom, table.occupiesTo),
    index('bookings_dog_idx').on(table.dogId),
    uniqueIndex('bookings_reference_idx').on(table.reference),
  ],
);

export const emergencyContacts = sqliteTable(
  'emergency_contacts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [index('emergency_contacts_booking_idx').on(table.bookingId)],
);

export const blackouts = sqliteTable(
  'blackouts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fromDay: integer('from_day').notNull(),
    toDayExclusive: integer('to_day_exclusive').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('blackouts_span_idx').on(table.fromDay, table.toDayExclusive)],
);

export const capacityOverrides = sqliteTable('capacity_overrides', {
  day: integer('day').primaryKey(),
  maxDogs: integer('max_dogs').notNull(),
});

export const galleryImages = sqliteTable(
  'gallery_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    alt: text('alt').notNull(),
    caption: text('caption'),
    category: text('category', { enum: ['struttura', 'cani', 'allevamento'] })
      .notNull()
      .default('struttura'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('gallery_images_slug_idx').on(table.slug),
    index('gallery_images_order_idx').on(table.category, table.position),
  ],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    /* Collected for moderation and never published. */
    email: text('email').notNull(),
    dogName: text('dog_name'),
    rating: integer('rating').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['pending', 'published', 'rejected'] })
      .notNull()
      .default('pending'),
    reply: text('reply'),
    createdAt: integer('created_at').notNull(),
    decidedAt: integer('decided_at'),
  },
  (table) => [index('reviews_status_idx').on(table.status, table.createdAt)],
);

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type Dog = typeof dogs.$inferSelect;
export type Owner = typeof owners.$inferSelect;
export type Blackout = typeof blackouts.$inferSelect;
export type EmergencyContactRow = typeof emergencyContacts.$inferSelect;
export type GalleryImage = typeof galleryImages.$inferSelect;
export type GalleryCategory = GalleryImage['category'];
export type Review = typeof reviews.$inferSelect;
