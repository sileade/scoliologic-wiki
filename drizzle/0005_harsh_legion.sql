CREATE TABLE `page_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdById` int,
	CONSTRAINT `page_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#6B7280',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdById` int,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `page_tag_idx` ON `page_tags` (`pageId`,`tagId`);