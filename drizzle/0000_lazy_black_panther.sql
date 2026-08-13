CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mention_id` integer,
	`title` text NOT NULL,
	`severity` text NOT NULL,
	`country` text NOT NULL,
	`reason` text NOT NULL,
	`acknowledged` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`platform` text NOT NULL,
	`source_country` text NOT NULL,
	`content_country` text NOT NULL,
	`language` text NOT NULL,
	`sentiment` text NOT NULL,
	`risk` integer DEFAULT 20 NOT NULL,
	`impact` integer DEFAULT 50 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`cluster_key` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracked_entities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`language` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `traffic_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country` text NOT NULL,
	`visitors` integer NOT NULL,
	`views` integer NOT NULL,
	`baseline` integer NOT NULL,
	`landing_page` text NOT NULL,
	`anomaly_ratio` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
