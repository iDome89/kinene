CREATE TABLE `blackouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_day` integer NOT NULL,
	`to_day_exclusive` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blackouts_span_idx` ON `blackouts` (`from_day`,`to_day_exclusive`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`dog_id` integer NOT NULL,
	`service` text NOT NULL,
	`start_day` integer NOT NULL,
	`end_day` integer NOT NULL,
	`occupies_from` integer NOT NULL,
	`occupies_to` integer NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`price_cents` integer NOT NULL,
	`notes` text,
	`staff_note` text,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`dog_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookings_span_idx` ON `bookings` (`status`,`occupies_from`,`occupies_to`);--> statement-breakpoint
CREATE INDEX `bookings_dog_idx` ON `bookings` (`dog_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_idx` ON `bookings` (`reference`);--> statement-breakpoint
CREATE TABLE `capacity_overrides` (
	`day` integer PRIMARY KEY NOT NULL,
	`max_dogs` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`breed` text,
	`birth_day` integer NOT NULL,
	`sex` text NOT NULL,
	`neutered` integer DEFAULT false NOT NULL,
	`microchip` text NOT NULL,
	`insurance_policy` text,
	`vet_name` text,
	`vet_phone` text,
	`food_notes` text,
	`allergies` text,
	`medications` text,
	`intake_test_status` text DEFAULT 'pending' NOT NULL,
	`intake_test_day` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dogs_owner_idx` ON `dogs` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dogs_microchip_idx` ON `dogs` (`microchip`);--> statement-breakpoint
CREATE TABLE `owners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text,
	`gdpr_consent_at` integer NOT NULL,
	`rules_accepted_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `owners_email_idx` ON `owners` (`email`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
