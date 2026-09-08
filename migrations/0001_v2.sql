CREATE TABLE `job_backups` (
  `id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `reason` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE TABLE `job_state_v2` (
  `id` integer PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `revision` integer NOT NULL
);
