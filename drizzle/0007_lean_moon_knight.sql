CREATE TABLE `notification_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('telegram','slack','discord','email') NOT NULL,
	`config` text NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastTestedAt` timestamp,
	`lastTestSuccess` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('telegram','slack','discord','email','webhook') NOT NULL,
	`alertId` int,
	`title` varchar(255) NOT NULL,
	`message` text,
	`severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'info',
	`success` boolean NOT NULL DEFAULT false,
	`error` text,
	`messageId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `notification_integrations_provider_idx` ON `notification_integrations` (`provider`);--> statement-breakpoint
CREATE INDEX `notification_logs_provider_idx` ON `notification_logs` (`provider`);--> statement-breakpoint
CREATE INDEX `notification_logs_alert_idx` ON `notification_logs` (`alertId`);--> statement-breakpoint
CREATE INDEX `notification_logs_time_idx` ON `notification_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `notification_logs_success_idx` ON `notification_logs` (`success`);