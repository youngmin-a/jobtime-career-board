CREATE TABLE `name_imports` (
	`source_workspace_id` text PRIMARY KEY NOT NULL,
	`target_workspace_id` text NOT NULL,
	`import_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `name_imports_import_id_unique` ON `name_imports` (`import_id`);--> statement-breakpoint
CREATE TABLE `name_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`session_tag` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `named_spaces`(`workspace_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `name_sessions_expiry_idx` ON `name_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `named_spaces` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`name_key` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `named_spaces_name_key_unique` ON `named_spaces` (`name_key`);
