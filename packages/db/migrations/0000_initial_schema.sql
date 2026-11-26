CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`time` text NOT NULL,
	`duration_minutes` integer,
	`notes` text,
	`reminder_minutes_before` integer,
	`next_reminder_at` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_routine_idx` ON `activities` (`routine_id`);--> statement-breakpoint
CREATE INDEX `activities_next_reminder_idx` ON `activities` (`next_reminder_at`);--> statement-breakpoint
CREATE TABLE `completions` (
	`user_id` text NOT NULL,
	`routine_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`date` text NOT NULL,
	`completed_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `routine_id`, `activity_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_codes_email_idx` ON `login_codes` (`email`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_success_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`days` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routines_user_idx` ON `routines` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);