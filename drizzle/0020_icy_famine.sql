PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_pipeline_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`task_type` text DEFAULT 'main' NOT NULL,
	`force` integer DEFAULT false NOT NULL,
	`stage` text DEFAULT 'maintenance' NOT NULL,
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
INSERT INTO `__new_sync_pipeline_jobs`("id", "brand_id", "owner_user_id", "task_type", "force", "stage", "status", "attempts", "max_attempts", "next_retry_at", "lease_until", "last_error", "result_json", "created_at", "updated_at", "completed_at") SELECT "id", "brand_id", "owner_user_id", CASE WHEN "stage" = 'reddit' THEN 'reddit' ELSE 'main' END, "force", "stage", "status", "attempts", "max_attempts", "next_retry_at", "lease_until", "last_error", "result_json", "created_at", "updated_at", "completed_at" FROM `sync_pipeline_jobs`;--> statement-breakpoint
DROP TABLE `sync_pipeline_jobs`;--> statement-breakpoint
ALTER TABLE `__new_sync_pipeline_jobs` RENAME TO `sync_pipeline_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sync_pipeline_brand_task_status_retry` ON `sync_pipeline_jobs` (`brand_id`,`task_type`,`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_pipeline_status_lease` ON `sync_pipeline_jobs` (`status`,`lease_until`);
