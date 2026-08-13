CREATE TABLE `workspace_invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`accepted_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_email_status` ON `workspace_invites` (`email`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_workspace_status` ON `workspace_invites` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user_active` ON `workspace_members` (`user_id`,`status`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_workspace_members_email` ON `workspace_members` (`email`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`credential_owner_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner` ON `workspaces` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `brand_profiles` ADD `workspace_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_brand_profiles_workspace_active` ON `brand_profiles` (`workspace_id`,`active`);
