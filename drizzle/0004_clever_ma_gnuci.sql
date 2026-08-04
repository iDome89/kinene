CREATE TABLE `booking_dogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`dog_id` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dog_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booking_dogs_booking_idx` ON `booking_dogs` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_dogs_dog_idx` ON `booking_dogs` (`dog_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_dogs_slot_idx` ON `booking_dogs` (`booking_id`,`position`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `shared_space` integer DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO `booking_dogs` (`booking_id`, `dog_id`, `position`) SELECT `id`, `dog_id`, 0 FROM `bookings`;
