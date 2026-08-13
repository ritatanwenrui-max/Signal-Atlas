CREATE TABLE `comment_analyses` (
	`mention_id` integer PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`adapter` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'unsupported' NOT NULL,
	`reported_count` integer DEFAULT 0 NOT NULL,
	`analyzed_count` integer DEFAULT 0 NOT NULL,
	`positive_count` integer DEFAULT 0 NOT NULL,
	`neutral_count` integer DEFAULT 0 NOT NULL,
	`negative_count` integer DEFAULT 0 NOT NULL,
	`mixed_count` integer DEFAULT 0 NOT NULL,
	`sentiment` text DEFAULT '样本不足' NOT NULL,
	`sentiment_score` integer DEFAULT 0 NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`last_collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comment_analyses_brand_collected` ON `comment_analyses` (`brand_id`,`last_collected_at`);--> statement-breakpoint
CREATE TABLE `mention_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mention_id` integer NOT NULL,
	`brand_id` integer NOT NULL,
	`source_comment_id` text NOT NULL,
	`content` text NOT NULL,
	`sentiment` text NOT NULL,
	`sentiment_score` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`replies` integer DEFAULT 0 NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`collected_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mention_comments_source` ON `mention_comments` (`mention_id`,`source_comment_id`);--> statement-breakpoint
CREATE INDEX `idx_mention_comments_brand_mention` ON `mention_comments` (`brand_id`,`mention_id`);