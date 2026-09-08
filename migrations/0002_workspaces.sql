CREATE TABLE `workspace_state` (
  `workspace_id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `revision` integer NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE `workspace_backups` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `payload` text NOT NULL,
  `reason` text NOT NULL,
  `created_at` text NOT NULL,
  `revision` integer NOT NULL
);

CREATE INDEX `workspace_backups_workspace_idx` ON `workspace_backups` (`workspace_id`, `created_at`);
