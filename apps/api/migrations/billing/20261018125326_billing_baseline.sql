CREATE TABLE `credit_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "credit_accounts_balance" CHECK("credit_accounts"."balance" BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE `credit_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`credits` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_grants_credits" CHECK("credit_grants"."credits" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_grants_order_id_unique` ON `credit_grants` (`order_id`);--> statement-breakpoint
CREATE INDEX `credit_grants_user` ON `credit_grants` (`user_id`,"created_at" desc);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`stripe_session_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`price_id` text,
	CONSTRAINT "orders_status" CHECK("orders"."status" IN ('pending','paid','expired','failed')),
	CONSTRAINT "orders_credits" CHECK("orders"."credits" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `orders_user` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_user_id_request_id_unique` ON `orders` (`user_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `paid_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_id` text,
	`idempotency_key` text NOT NULL,
	`operation` text NOT NULL,
	`input_hash` text NOT NULL,
	`credits` integer NOT NULL,
	`response` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "paid_requests_credits" CHECK("paid_requests"."credits" > 0),
	CONSTRAINT "paid_requests_response" CHECK(json_valid("paid_requests"."response"))
);
--> statement-breakpoint
CREATE INDEX `paid_requests_user` ON `paid_requests` (`user_id`,"created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `paid_requests_user_id_idempotency_key_unique` ON `paid_requests` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
