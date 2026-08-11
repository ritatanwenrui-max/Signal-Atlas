CREATE TABLE `brand_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DELETE FROM `mentions`;
--> statement-breakpoint
DELETE FROM `alerts`;
--> statement-breakpoint
DELETE FROM `traffic_signals`;
--> statement-breakpoint
DELETE FROM `tracked_entities`;
--> statement-breakpoint
DELETE FROM `sync_runs`;
--> statement-breakpoint
DELETE FROM `sync_locks`;
