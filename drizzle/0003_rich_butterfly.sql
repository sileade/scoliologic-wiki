CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailEnabled` boolean NOT NULL DEFAULT true,
	`pageUpdates` boolean NOT NULL DEFAULT true,
	`pageComments` boolean NOT NULL DEFAULT true,
	`mentions` boolean NOT NULL DEFAULT true,
	`accessRequests` boolean NOT NULL DEFAULT true,
	`systemNotifications` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('page_updated','page_commented','page_shared','mention','access_granted','access_requested','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`pageId` int,
	`actorId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `notification_user_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notification_read_idx` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `notification_page_idx` ON `notifications` (`pageId`);