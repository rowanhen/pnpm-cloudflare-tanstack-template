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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "email_deliveries_status" CHECK("email_deliveries"."status" IN ('sending','accepted','failed')),
	CONSTRAINT "email_deliveries_template" CHECK("email_deliveries"."template" IN ('waitlist','test'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_dedupe_key_unique` ON `email_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `email_deliveries_user` ON `email_deliveries` (`user_id`,`created_at`);