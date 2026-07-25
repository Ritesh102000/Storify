CREATE TABLE `generation_logs` (
	`log_id` text PRIMARY KEY NOT NULL,
	`universe_id` text,
	`operation` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`latency_ms` text NOT NULL,
	`used_fallback` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_previews` (
	`preview_id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_sessions` (
	`universe_id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`template_id` text,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
