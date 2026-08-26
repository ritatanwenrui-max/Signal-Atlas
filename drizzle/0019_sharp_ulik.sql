CREATE TABLE `sync_pipeline_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`force` integer DEFAULT false NOT NULL,
	`stage` text DEFAULT 'reddit' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`next_retry_at` text DEFAULT '' NOT NULL,
	`lease_until` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sync_pipeline_brand_status_retry` ON `sync_pipeline_jobs` (`brand_id`,`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_pipeline_status_lease` ON `sync_pipeline_jobs` (`status`,`lease_until`);