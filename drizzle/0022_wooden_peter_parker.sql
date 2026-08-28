CREATE TABLE `provider_daily_usage` (
	`credential_owner_user_id` text NOT NULL,
	`provider` text NOT NULL,
	`usage_date` text NOT NULL,
	`units_used` integer DEFAULT 0 NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`credential_owner_user_id`, `provider`, `usage_date`)
);
--> statement-breakpoint
CREATE INDEX `idx_provider_daily_usage_date` ON `provider_daily_usage` (`usage_date`,`provider`);