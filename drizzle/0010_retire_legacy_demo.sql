UPDATE `brand_profiles`
SET `active` = 0, `user_id` = '', `updated_at` = CURRENT_TIMESTAMP
WHERE `created_at` < '2026-08-12 03:24:52';--> statement-breakpoint
PRAGMA optimize;
