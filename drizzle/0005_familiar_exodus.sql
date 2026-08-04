PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`service` text NOT NULL,
	`start_day` integer NOT NULL,
	`end_day` integer NOT NULL,
	`occupies_from` integer NOT NULL,
	`occupies_to` integer NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`price_cents` integer NOT NULL,
	`shared_space` integer DEFAULT false NOT NULL,
	`notes` text,
	`staff_note` text,
	`created_at` integer NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_bookings`("id", "reference", "service", "start_day", "end_day", "occupies_from", "occupies_to", "status", "price_cents", "shared_space", "notes", "staff_note", "created_at", "decided_at") SELECT "id", "reference", "service", "start_day", "end_day", "occupies_from", "occupies_to", "status", "price_cents", "shared_space", "notes", "staff_note", "created_at", "decided_at" FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bookings_span_idx` ON `bookings` (`status`,`occupies_from`,`occupies_to`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_idx` ON `bookings` (`reference`);