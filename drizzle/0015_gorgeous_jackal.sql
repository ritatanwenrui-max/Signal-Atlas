CREATE TABLE `comment_annotations` (
	`comment_id` integer PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`workspace_id` integer DEFAULT 0 NOT NULL,
	`mention_id` integer NOT NULL,
	`annotator_user_id` text NOT NULL,
	`model_sentiment` text NOT NULL,
	`model_emotion` text NOT NULL,
	`model_topic` text NOT NULL,
	`model_score` integer DEFAULT 0 NOT NULL,
	`manual_sentiment` text NOT NULL,
	`manual_emotion` text NOT NULL,
	`manual_topic` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comment_annotations_brand_updated` ON `comment_annotations` (`brand_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_comment_annotations_workspace` ON `comment_annotations` (`workspace_id`,`brand_id`);--> statement-breakpoint
CREATE TABLE `sentiment_calibration_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`token` text NOT NULL,
	`sentiment` text NOT NULL,
	`emotion` text NOT NULL,
	`weight` integer DEFAULT 0 NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sentiment_calibration_brand_token` ON `sentiment_calibration_rules` (`brand_id`,`token`);--> statement-breakpoint
CREATE INDEX `idx_sentiment_calibration_brand_weight` ON `sentiment_calibration_rules` (`brand_id`,`weight`);--> statement-breakpoint
ALTER TABLE `social_comment_reply_queue` ADD `adapter` text DEFAULT 'v2' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_comment_reply_queue` ADD `v2_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `social_comment_reply_queue` ADD `v1_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `social_comment_targets` ADD `adapter` text DEFAULT 'v2' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_comment_targets` ADD `v2_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `social_comment_targets` ADD `v1_failures` integer DEFAULT 0 NOT NULL;