CREATE TABLE `connector_credentials` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`iv` text NOT NULL,
	`last_four` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`last_test_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `provider`)
);
