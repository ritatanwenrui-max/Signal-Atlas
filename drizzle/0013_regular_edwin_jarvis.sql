CREATE TABLE `social_comment_reply_queue` (
	`mention_id` integer NOT NULL,
	`brand_id` integer NOT NULL,
	`media_id` text NOT NULL,
	`parent_comment_id` text NOT NULL,
	`reported_count` integer DEFAULT 0 NOT NULL,
	`collected_count` integer DEFAULT 0 NOT NULL,
	`cursor` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`pages_fetched` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`mention_id`, `parent_comment_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_social_comment_replies_brand_status` ON `social_comment_reply_queue` (`brand_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `social_comment_targets` (
	`mention_id` integer PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text DEFAULT 'Instagram' NOT NULL,
	`media_id` text NOT NULL,
	`post_url` text NOT NULL,
	`reported_count` integer DEFAULT 0 NOT NULL,
	`collected_count` integer DEFAULT 0 NOT NULL,
	`cursor` text DEFAULT '' NOT NULL,
	`top_level_complete` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`pages_fetched` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_social_comment_targets_brand_status` ON `social_comment_targets` (`brand_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `platform` text DEFAULT '网页新闻' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `parent_comment_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `author_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `author_username` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `author_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `is_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `language` text DEFAULT '语言待确认' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `topic` text DEFAULT '其他讨论' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `comment_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `fetched_via` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_mention_comments_brand_platform_time` ON `mention_comments` (`brand_id`,`platform`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_mention_comments_brand_sentiment` ON `mention_comments` (`brand_id`,`sentiment`,`sentiment_score`);--> statement-breakpoint
ALTER TABLE `monid_jobs` ADD `mention_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_monid_jobs_mention_stage` ON `monid_jobs` (`mention_id`,`stage`,`status`);