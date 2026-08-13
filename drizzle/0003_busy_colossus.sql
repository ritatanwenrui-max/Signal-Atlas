CREATE TABLE `sync_locks` (
	`name` text PRIMARY KEY NOT NULL,
	`locked_until` text NOT NULL
);
