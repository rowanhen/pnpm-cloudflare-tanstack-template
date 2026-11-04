CREATE TABLE `email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`user_id` text,
	`to_email` text NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'sending' NOT NULL,
	`message_id` text,
	`error_code` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "email_deliveries_status" CHECK("email_deliveries"."status" IN ('sending','accepted','failed')),
	CONSTRAINT "email_deliveries_template" CHECK("email_deliveries"."template" IN ('waitlist','test'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_dedupe_key_unique` ON `email_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `email_deliveries_user` ON `email_deliveries` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`user_id` text,
	CONSTRAINT "todos_title_length" CHECK(length("todos"."title") BETWEEN 1 AND 200),
	CONSTRAINT "todos_completed" CHECK("todos"."completed" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `todos_created_at` ON `todos` ("created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `todos_user_created` ON `todos` (`user_id`,"created_at" desc,"id" desc);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text collate nocase NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`consent` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "waitlist_consent" CHECK("waitlist"."consent" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_unique` ON `waitlist` (`email`);