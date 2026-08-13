ALTER TABLE `mention_comments` ADD `translation_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translation_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translation_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translation_source_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_mention_comments_brand_translation` ON `mention_comments` (`brand_id`,`translation_status`);--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_source_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_mentions_brand_translation` ON `mentions` (`brand_id`,`translation_status`);