CREATE TABLE `provider_health` (
	`provider` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'online' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`retry_after` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`last_attempt_at` text DEFAULT '' NOT NULL,
	`last_success_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `provider_health`
  (`provider`, `status`, `consecutive_failures`, `retry_after`, `last_error`, `last_attempt_at`, `last_success_at`, `updated_at`)
SELECT
  'GDELT',
  'limited',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+10 minutes'),
  'GDELT HTTP 429',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  '',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM `sync_runs` WHERE `error` LIKE '%GDELT HTTP 429%'
);
