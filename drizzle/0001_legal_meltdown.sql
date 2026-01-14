CREATE TABLE `access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pageId` int,
	`groupId` int,
	`requestedPermission` enum('read','edit','admin') NOT NULL DEFAULT 'read',
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`message` text,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`details` json,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(7) DEFAULT '#3B82F6',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdById` int,
	CONSTRAINT `groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(500) NOT NULL,
	`originalName` varchar(500) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`uploadedById` int NOT NULL,
	`pageId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`chunkIndex` int NOT NULL DEFAULT 0,
	`chunkText` text NOT NULL,
	`embedding` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`groupId` int,
	`userId` int,
	`permission` enum('read','edit','admin') NOT NULL DEFAULT 'read',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text,
	`contentJson` json,
	`version` int NOT NULL,
	`changeDescription` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`slug` varchar(500) NOT NULL,
	`content` text,
	`contentJson` json,
	`icon` varchar(100),
	`coverImage` text,
	`parentId` int,
	`order` int DEFAULT 0,
	`isPublic` boolean NOT NULL DEFAULT false,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdById` int NOT NULL,
	`lastEditedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `user_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`groupId` int NOT NULL,
	`role` enum('member','editor','admin') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','guest') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
CREATE INDEX `access_req_user_idx` ON `access_requests` (`userId`);--> statement-breakpoint
CREATE INDEX `access_req_status_idx` ON `access_requests` (`status`);--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `activity_entity_idx` ON `activity_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `media_page_idx` ON `media_files` (`pageId`);--> statement-breakpoint
CREATE INDEX `media_user_idx` ON `media_files` (`uploadedById`);--> statement-breakpoint
CREATE INDEX `embedding_page_idx` ON `page_embeddings` (`pageId`);--> statement-breakpoint
CREATE INDEX `page_perm_idx` ON `page_permissions` (`pageId`);--> statement-breakpoint
CREATE INDEX `group_perm_idx` ON `page_permissions` (`groupId`);--> statement-breakpoint
CREATE INDEX `user_perm_idx` ON `page_permissions` (`userId`);--> statement-breakpoint
CREATE INDEX `page_version_idx` ON `page_versions` (`pageId`,`version`);--> statement-breakpoint
CREATE INDEX `parent_idx` ON `pages` (`parentId`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `public_idx` ON `pages` (`isPublic`);--> statement-breakpoint
CREATE INDEX `user_group_idx` ON `user_groups` (`userId`,`groupId`);