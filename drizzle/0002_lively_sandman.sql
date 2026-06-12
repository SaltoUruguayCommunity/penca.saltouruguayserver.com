CREATE TABLE `sync_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
