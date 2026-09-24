CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`proposal` text,
	`has_image` integer DEFAULT false NOT NULL,
	`image_uri` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_thread_idx` ON `chat_messages` (`thread_id`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_messages_sync_idx` ON `chat_messages` (`sync_status`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_threads_user_idx` ON `chat_threads` (`user_id`,`deleted_at`,`updated_at`);--> statement-breakpoint
CREATE INDEX `chat_threads_sync_idx` ON `chat_threads` (`sync_status`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tracker_id` text,
	`topic_id` text NOT NULL,
	`subtopic_id` text,
	`body` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_topic_idx` ON `notes` (`topic_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `notes_user_idx` ON `notes` (`user_id`,`deleted_at`,`updated_at`);--> statement-breakpoint
CREATE INDEX `notes_sync_idx` ON `notes` (`sync_status`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tracker_id` text,
	`topic_id` text,
	`topic_name` text NOT NULL,
	`chapter_name` text,
	`subject_name` text,
	`difficulty` text NOT NULL,
	`allow_multiple` integer DEFAULT true NOT NULL,
	`questions` text NOT NULL,
	`answers` text NOT NULL,
	`correct` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_idx` ON `quiz_attempts` (`user_id`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_sync_idx` ON `quiz_attempts` (`sync_status`);