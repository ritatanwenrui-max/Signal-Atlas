CREATE INDEX `idx_alerts_ack_severity` ON `alerts` (`acknowledged`,`severity`);--> statement-breakpoint
CREATE INDEX `idx_mentions_published_at` ON `mentions` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_mentions_country_platform` ON `mentions` (`source_country`,`platform`);--> statement-breakpoint
CREATE INDEX `idx_mentions_cluster_key` ON `mentions` (`cluster_key`);--> statement-breakpoint
CREATE INDEX `idx_traffic_country_recorded` ON `traffic_signals` (`country`,`recorded_at`);