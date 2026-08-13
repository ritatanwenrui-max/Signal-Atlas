ALTER TABLE `mention_comments` ADD `translation_error` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translation_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mention_comments` ADD `translation_next_retry_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_error` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `translation_next_retry_at` text DEFAULT '' NOT NULL;