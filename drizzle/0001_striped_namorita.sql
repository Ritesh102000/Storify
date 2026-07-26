CREATE TABLE `detective_sessions` (
	`case_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
