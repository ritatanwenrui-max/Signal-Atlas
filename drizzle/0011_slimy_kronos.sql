CREATE TABLE `monid_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`run_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`terms` text DEFAULT '[]' NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_monid_jobs_run_id` ON `monid_jobs` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_monid_jobs_brand_status` ON `monid_jobs` (`brand_id`,`status`);--> statement-breakpoint
CREATE TABLE `social_author_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text NOT NULL,
	`author_id` text DEFAULT '' NOT NULL,
	`username` text NOT NULL,
	`follower_count` integer DEFAULT 0 NOT NULL,
	`following_count` integer DEFAULT 0 NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_social_authors_brand_user_time` ON `social_author_snapshots` (`brand_id`,`username`,`captured_at`);--> statement-breakpoint
CREATE TABLE `social_post_metrics` (
	`mention_id` integer PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text NOT NULL,
	`post_id` text DEFAULT '' NOT NULL,
	`author_id` text DEFAULT '' NOT NULL,
	`author_username` text DEFAULT '' NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`follower_count` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`matched_terms` text DEFAULT '[]' NOT NULL,
	`metrics_updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_social_metrics_brand_platform` ON `social_post_metrics` (`brand_id`,`platform`);--> statement-breakpoint
CREATE INDEX `idx_social_metrics_author` ON `social_post_metrics` (`brand_id`,`author_username`);