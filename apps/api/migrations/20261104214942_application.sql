CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` date,
	`refreshTokenExpiresAt` date,
	`scope` text,
	`password` text,
	`createdAt` date NOT NULL,
	`updatedAt` date NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_used_at` text,
	`scope` text DEFAULT 'todos:read' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "api_keys_scope" CHECK("api_keys"."scope" IN ('todos:read','summary:read'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_key_unique` ON `auth_rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` date NOT NULL,
	`token` text NOT NULL,
	`createdAt` date NOT NULL,
	`updatedAt` date NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` date NOT NULL,
	`updatedAt` date NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` date NOT NULL,
	`createdAt` date NOT NULL,
	`updatedAt` date NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
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
--> statement-breakpoint
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