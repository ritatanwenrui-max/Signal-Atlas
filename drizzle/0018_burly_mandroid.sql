CREATE TABLE `llm_analysis_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`kind` text NOT NULL,
	`target_id` integer NOT NULL,
	`source_hash` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`model` text NOT NULL,
	`trigger_reason` text DEFAULT '' NOT NULL,
	`result_json` text DEFAULT '' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`next_retry_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_llm_analysis_jobs_target` ON `llm_analysis_jobs` (`brand_id`,`kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_llm_analysis_jobs_brand_status` ON `llm_analysis_jobs` (`brand_id`,`kind`,`status`,`updated_at`);