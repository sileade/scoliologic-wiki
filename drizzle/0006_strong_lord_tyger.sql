CREATE TABLE `traefik_alert_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`serviceName` varchar(255),
	`metricType` enum('errors_4xx_rate','errors_5xx_rate','latency_avg','latency_p95','requests_per_second','error_total_rate') NOT NULL,
	`operator` enum('gt','lt','gte','lte','eq') NOT NULL,
	`threshold` decimal(10,2) NOT NULL,
	`windowMinutes` int NOT NULL DEFAULT 5,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`notifyEmail` boolean NOT NULL DEFAULT true,
	`notifyWebhook` boolean NOT NULL DEFAULT false,
	`webhookUrl` text,
	`cooldownMinutes` int NOT NULL DEFAULT 15,
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdById` int,
	CONSTRAINT `traefik_alert_thresholds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traefik_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thresholdId` int NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`metricType` varchar(100) NOT NULL,
	`currentValue` decimal(10,2) NOT NULL,
	`thresholdValue` decimal(10,2) NOT NULL,
	`status` enum('triggered','resolved','acknowledged') NOT NULL DEFAULT 'triggered',
	`message` text,
	`acknowledgedById` int,
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traefik_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traefik_config_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`filePath` text NOT NULL,
	`format` enum('yaml','toml') NOT NULL DEFAULT 'yaml',
	`content` text,
	`isAutoApply` boolean NOT NULL DEFAULT false,
	`lastAppliedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdById` int,
	CONSTRAINT `traefik_config_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traefik_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`requestsTotal` int NOT NULL DEFAULT 0,
	`requestsPerSecond` decimal(10,2) DEFAULT '0',
	`avgLatencyMs` int NOT NULL DEFAULT 0,
	`errors4xx` int NOT NULL DEFAULT 0,
	`errors5xx` int NOT NULL DEFAULT 0,
	`openConnections` int DEFAULT 0,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traefik_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `traefik_alerts_threshold_idx` ON `traefik_alerts` (`thresholdId`);--> statement-breakpoint
CREATE INDEX `traefik_alerts_service_idx` ON `traefik_alerts` (`serviceName`);--> statement-breakpoint
CREATE INDEX `traefik_alerts_status_idx` ON `traefik_alerts` (`status`);--> statement-breakpoint
CREATE INDEX `traefik_alerts_time_idx` ON `traefik_alerts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `traefik_metrics_service_idx` ON `traefik_metrics` (`serviceName`);--> statement-breakpoint
CREATE INDEX `traefik_metrics_time_idx` ON `traefik_metrics` (`collectedAt`);--> statement-breakpoint
CREATE INDEX `traefik_metrics_service_time_idx` ON `traefik_metrics` (`serviceName`,`collectedAt`);