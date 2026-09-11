CREATE TABLE IF NOT EXISTS `analysis_usage` (
	`workspace_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY (`workspace_id`, `window_start`)
);
