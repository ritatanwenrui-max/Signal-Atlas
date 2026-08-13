CREATE TABLE `media_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`name` text NOT NULL,
	`country` text DEFAULT '地区未披露' NOT NULL,
	`language` text DEFAULT '自动识别' NOT NULL,
	`homepage_url` text NOT NULL,
	`feed_url` text DEFAULT '' NOT NULL,
	`sitemap_url` text DEFAULT '' NOT NULL,
	`robots_policy` text DEFAULT '' NOT NULL,
	`robots_checked_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`last_discovered_at` text NOT NULL,
	`last_crawled_at` text DEFAULT '' NOT NULL,
	`next_crawl_at` text NOT NULL,
	`etag` text DEFAULT '' NOT NULL,
	`last_modified` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_sources_domain_unique` ON `media_sources` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_media_sources_next_crawl` ON `media_sources` (`status`,`next_crawl_at`);--> statement-breakpoint
CREATE INDEX `idx_media_sources_country` ON `media_sources` (`country`);--> statement-breakpoint
CREATE TABLE `propagation_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cluster_key` text NOT NULL,
	`from_mention_id` integer NOT NULL,
	`to_mention_id` integer NOT NULL,
	`similarity` integer NOT NULL,
	`confidence` integer NOT NULL,
	`method` text NOT NULL,
	`evidence` text NOT NULL,
	`time_gap_minutes` integer NOT NULL,
	`cross_border` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_propagation_edges_cluster` ON `propagation_edges` (`cluster_key`);--> statement-breakpoint
CREATE INDEX `idx_propagation_edges_to_mention` ON `propagation_edges` (`to_mention_id`);--> statement-breakpoint
ALTER TABLE `mentions` ADD `excerpt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `author` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `discovered_via` text DEFAULT 'global_discovery' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `content_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `word_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `sentiment_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `topics` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `keywords` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `first_seen_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `archived_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `mentions` SET `first_seen_at` = `created_at`, `archived_at` = `created_at` WHERE `first_seen_at` = '' OR `archived_at` = '';
