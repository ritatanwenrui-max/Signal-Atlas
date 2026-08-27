CREATE TABLE `collection_diagnostics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`sync_run_id` integer NOT NULL,
	`platform` text NOT NULL,
	`providers` text DEFAULT '' NOT NULL,
	`query_count` integer DEFAULT 0 NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`relevant_count` integer DEFAULT 0 NOT NULL,
	`inserted_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`filtered_count` integer DEFAULT 0 NOT NULL,
	`invalid_count` integer DEFAULT 0 NOT NULL,
	`pending_count` integer DEFAULT 0 NOT NULL,
	`filter_reasons` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_collection_diagnostics_run_platform` ON `collection_diagnostics` (`sync_run_id`,`platform`);--> statement-breakpoint
CREATE INDEX `idx_collection_diagnostics_brand_completed` ON `collection_diagnostics` (`brand_id`,`completed_at`);