CREATE TABLE `gallery_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`alt` text NOT NULL,
	`caption` text,
	`category` text DEFAULT 'struttura' NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_images_slug_idx` ON `gallery_images` (`slug`);--> statement-breakpoint
CREATE INDEX `gallery_images_order_idx` ON `gallery_images` (`category`,`position`);