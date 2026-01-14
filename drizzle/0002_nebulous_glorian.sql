CREATE TABLE `page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) DEFAULT 'general',
	`content` json NOT NULL,
	`icon` varchar(100) DEFAULT 'file-text',
	`isPublic` boolean DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `template_category_idx` ON `page_templates` (`category`);--> statement-breakpoint
CREATE INDEX `template_creator_idx` ON `page_templates` (`createdById`);