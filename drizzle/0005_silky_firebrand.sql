ALTER TABLE `mentions` ADD `parent_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `relation` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mentions` ADD `engagement` integer DEFAULT 0 NOT NULL;