CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sus_id` integer NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`username` text NOT NULL,
	`avatar` text,
	`coins` integer DEFAULT 0 NOT NULL,
	`admin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_sus_id_unique` ON `users` (`sus_id`);--> statement-breakpoint
CREATE TABLE `wc_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(1) NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wc_groups_name_unique` ON `wc_groups` (`name`);--> statement-breakpoint
CREATE TABLE `wc_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`match_date` text NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `wc_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_team_id`) REFERENCES `wc_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `wc_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wc_predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`match_id` integer NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`points` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `wc_matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_match_uniq` ON `wc_predictions` (`user_id`,`match_id`);--> statement-breakpoint
CREATE TABLE `wc_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`flag` text,
	`fifa_code` text(3),
	FOREIGN KEY (`group_id`) REFERENCES `wc_groups`(`id`) ON UPDATE no action ON DELETE no action
);
