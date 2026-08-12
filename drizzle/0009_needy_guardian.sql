DROP INDEX `idx_alerts_ack_severity`;--> statement-breakpoint
ALTER TABLE `alerts` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_alerts_brand_ack_severity` ON `alerts` (`brand_id`,`acknowledged`,`severity`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer DEFAULT 0 NOT NULL,
	`domain` text NOT NULL,
	`name` text NOT NULL,
	`country` text DEFAULT '地区待确认' NOT NULL,
	`language` text DEFAULT '语言待确认' NOT NULL,
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
INSERT INTO `__new_media_sources`("id", "brand_id", "domain", "name", "country", "language", "homepage_url", "feed_url", "sitemap_url", "robots_policy", "robots_checked_at", "status", "error_count", "last_error", "last_discovered_at", "last_crawled_at", "next_crawl_at", "etag", "last_modified", "created_at", "updated_at") SELECT "id", 0, "domain", "name", "country", "language", "homepage_url", "feed_url", "sitemap_url", "robots_policy", "robots_checked_at", "status", "error_count", "last_error", "last_discovered_at", "last_crawled_at", "next_crawl_at", "etag", "last_modified", "created_at", "updated_at" FROM `media_sources`;--> statement-breakpoint
DROP TABLE `media_sources`;--> statement-breakpoint
ALTER TABLE `__new_media_sources` RENAME TO `media_sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_sources_brand_domain` ON `media_sources` (`brand_id`,`domain`);--> statement-breakpoint
CREATE INDEX `idx_media_sources_brand_next_crawl` ON `media_sources` (`brand_id`,`status`,`next_crawl_at`);--> statement-breakpoint
CREATE INDEX `idx_media_sources_brand_country` ON `media_sources` (`brand_id`,`country`);--> statement-breakpoint
DROP INDEX `idx_mentions_published_at`;--> statement-breakpoint
DROP INDEX `idx_mentions_country_platform`;--> statement-breakpoint
DROP INDEX `idx_mentions_cluster_key`;--> statement-breakpoint
ALTER TABLE `mentions` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `location_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `location_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_mentions_brand_published` ON `mentions` (`brand_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_mentions_brand_country_platform` ON `mentions` (`brand_id`,`source_country`,`platform`);--> statement-breakpoint
CREATE INDEX `idx_mentions_brand_cluster` ON `mentions` (`brand_id`,`cluster_key`);--> statement-breakpoint
DROP INDEX `idx_propagation_edges_cluster`;--> statement-breakpoint
ALTER TABLE `propagation_edges` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_propagation_edges_brand_cluster` ON `propagation_edges` (`brand_id`,`cluster_key`);--> statement-breakpoint
DROP INDEX `idx_sync_runs_started_at`;--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sync_runs_brand_started` ON `sync_runs` (`brand_id`,`started_at`);--> statement-breakpoint
DROP INDEX `idx_traffic_country_recorded`;--> statement-breakpoint
ALTER TABLE `traffic_signals` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_traffic_brand_country_recorded` ON `traffic_signals` (`brand_id`,`country`,`recorded_at`);--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_brand_profiles_user_active` ON `brand_profiles` (`user_id`,`active`);--> statement-breakpoint
ALTER TABLE `tracked_entities` ADD `brand_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tracked_entities_brand` ON `tracked_entities` (`brand_id`,`active`);
