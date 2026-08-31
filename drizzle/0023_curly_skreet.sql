CREATE TABLE `event_origins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer DEFAULT 0 NOT NULL,
	`event_key` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`platform` text DEFAULT 'X' NOT NULL,
	`source` text NOT NULL,
	`source_country` text DEFAULT '全球' NOT NULL,
	`published_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_event_origins_brand_url` ON `event_origins` (`brand_id`,`url`);--> statement-breakpoint
CREATE INDEX `idx_event_origins_brand_event` ON `event_origins` (`brand_id`,`event_key`,`active`);--> statement-breakpoint
CREATE TABLE `search_demand_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer DEFAULT 0 NOT NULL,
	`signal_date` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`ctr_micros` integer DEFAULT 0 NOT NULL,
	`position_millis` integer DEFAULT 0 NOT NULL,
	`complete` integer DEFAULT true NOT NULL,
	`source` text DEFAULT 'gsc' NOT NULL,
	`collected_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_search_demand_brand_date` ON `search_demand_signals` (`brand_id`,`signal_date`);--> statement-breakpoint
CREATE TABLE `search_event_windows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer DEFAULT 0 NOT NULL,
	`event_key` text NOT NULL,
	`peak_date` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`peak_clicks` integer DEFAULT 0 NOT NULL,
	`peak_impressions` integer DEFAULT 0 NOT NULL,
	`baseline_clicks` integer DEFAULT 0 NOT NULL,
	`spike_ratio` integer DEFAULT 0 NOT NULL,
	`trigger_source` text DEFAULT 'gsc' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_search_events_brand_key` ON `search_event_windows` (`brand_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_search_events_brand_peak` ON `search_event_windows` (`brand_id`,`peak_date`);