/**
 * Notifications Module
 * 
 * Provides integration with Telegram and Slack for sending alert notifications.
 */

import { getDb } from "./db";
import { notificationIntegrations, notificationLogs, traefikAlerts } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Types
export interface TelegramConfig {
  botToken: string;
  chatId: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface NotificationPayload {
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  serviceName?: string;
  metricValue?: string;
  thresholdValue?: string;
  timestamp?: Date;
}

export interface NotificationResult {
  success: boolean;
  provider: "telegram" | "slack" | "email" | "webhook";
  error?: string;
  messageId?: string;
}

// Telegram API
export async function sendTelegramNotification(
  config: TelegramConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const { botToken, chatId, parseMode = "HTML" } = config;
  
  if (!botToken || !chatId) {
    return {
      success: false,
      provider: "telegram",
      error: "Missing bot token or chat ID",
    };
  }

  const severityEmoji = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    critical: "🚨",
  };

  const emoji = severityEmoji[payload.severity] || "📢";
  const timestamp = payload.timestamp || new Date();

  let text: string;
  if (parseMode === "HTML") {
    text = `${emoji} <b>${escapeHtml(payload.title)}</b>\n\n`;
    text += `${escapeHtml(payload.message)}\n\n`;
    if (payload.serviceName) {
      text += `<b>Сервис:</b> ${escapeHtml(payload.serviceName)}\n`;
    }
    if (payload.metricValue && payload.thresholdValue) {
      text += `<b>Значение:</b> ${escapeHtml(payload.metricValue)} (порог: ${escapeHtml(payload.thresholdValue)})\n`;
    }
    text += `<i>${timestamp.toLocaleString("ru-RU")}</i>`;
  } else {
    text = `${emoji} *${payload.title}*\n\n`;
    text += `${payload.message}\n\n`;
    if (payload.serviceName) {
      text += `*Сервис:* ${payload.serviceName}\n`;
    }
    if (payload.metricValue && payload.thresholdValue) {
      text += `*Значение:* ${payload.metricValue} (порог: ${payload.thresholdValue})\n`;
    }
    text += `_${timestamp.toLocaleString("ru-RU")}_`;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      }
    );

    const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!data.ok) {
      return {
        success: false,
        provider: "telegram",
        error: data.description || "Unknown Telegram API error",
      };
    }

    return {
      success: true,
      provider: "telegram",
      messageId: data.result?.message_id?.toString(),
    };
  } catch (error) {
    return {
      success: false,
      provider: "telegram",
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Slack API
export async function sendSlackNotification(
  config: SlackConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const { webhookUrl, channel, username = "Scoliologic Wiki", iconEmoji = ":bell:" } = config;

  if (!webhookUrl) {
    return {
      success: false,
      provider: "slack",
      error: "Missing webhook URL",
    };
  }

  const severityColor = {
    info: "#36a64f",
    warning: "#ffcc00",
    error: "#ff6600",
    critical: "#ff0000",
  };

  const timestamp = payload.timestamp || new Date();

  const slackPayload: Record<string, unknown> = {
    username,
    icon_emoji: iconEmoji,
    attachments: [
      {
        color: severityColor[payload.severity] || "#808080",
        title: payload.title,
        text: payload.message,
        fields: [] as Array<{ title: string; value: string; short: boolean }>,
        footer: "Scoliologic Wiki Alerts",
        ts: Math.floor(timestamp.getTime() / 1000),
      },
    ],
  };

  if (channel) {
    slackPayload.channel = channel;
  }

  const attachment = (slackPayload.attachments as Array<Record<string, unknown>>)[0];
  const fields = attachment.fields as Array<{ title: string; value: string; short: boolean }>;

  if (payload.serviceName) {
    fields.push({
      title: "Сервис",
      value: payload.serviceName,
      short: true,
    });
  }

  if (payload.metricValue) {
    fields.push({
      title: "Значение",
      value: payload.metricValue,
      short: true,
    });
  }

  if (payload.thresholdValue) {
    fields.push({
      title: "Порог",
      value: payload.thresholdValue,
      short: true,
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        provider: "slack",
        error: `Slack API error: ${response.status} - ${errorText}`,
      };
    }

    return {
      success: true,
      provider: "slack",
    };
  } catch (error) {
    return {
      success: false,
      provider: "slack",
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Database operations
export async function getIntegrationSettings(provider: "telegram" | "slack") {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(notificationIntegrations)
    .where(eq(notificationIntegrations.provider, provider))
    .limit(1);
  
  return result[0] || null;
}

export async function getAllIntegrations() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(notificationIntegrations);
}

export async function saveIntegrationSettings(
  provider: "telegram" | "slack",
  config: TelegramConfig | SlackConfig,
  isEnabled: boolean = true
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getIntegrationSettings(provider);
  
  if (existing) {
    await db
      .update(notificationIntegrations)
      .set({
        config: JSON.stringify(config),
        isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(notificationIntegrations.id, existing.id));
    
    return { ...existing, config: JSON.stringify(config), isEnabled };
  } else {
    const result = await db
      .insert(notificationIntegrations)
      .values({
        provider,
        config: JSON.stringify(config),
        isEnabled,
      });
    
    return {
      id: Number((result as unknown as { insertId: number }).insertId),
      provider,
      config: JSON.stringify(config),
      isEnabled,
    };
  }
}

export async function toggleIntegration(provider: "telegram" | "slack", isEnabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(notificationIntegrations)
    .set({ isEnabled, updatedAt: new Date() })
    .where(eq(notificationIntegrations.provider, provider));
}

export async function updateTestResult(provider: "telegram" | "slack", success: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(notificationIntegrations)
    .set({ 
      lastTestedAt: new Date(),
      lastTestSuccess: success,
      updatedAt: new Date(),
    })
    .where(eq(notificationIntegrations.provider, provider));
}

export async function deleteIntegration(provider: "telegram" | "slack") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(notificationIntegrations)
    .where(eq(notificationIntegrations.provider, provider));
}

export async function logNotification(
  provider: "telegram" | "slack" | "email" | "webhook",
  alertId: number | null,
  payload: NotificationPayload,
  result: NotificationResult
) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(notificationLogs).values({
    provider,
    alertId,
    title: payload.title,
    message: payload.message,
    severity: payload.severity,
    success: result.success,
    error: result.error || null,
    messageId: result.messageId || null,
  });
}

export async function getNotificationLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(notificationLogs)
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}

// Send notification to all enabled integrations
export async function sendAlertNotification(
  payload: NotificationPayload,
  alertId?: number
): Promise<NotificationResult[]> {
  const db = await getDb();
  if (!db) return [];
  
  const results: NotificationResult[] = [];

  // Get all enabled integrations
  const integrations = await db
    .select()
    .from(notificationIntegrations)
    .where(eq(notificationIntegrations.isEnabled, true));

  for (const integration of integrations) {
    let result: NotificationResult;
    const config = JSON.parse(integration.config);

    if (integration.provider === "telegram") {
      result = await sendTelegramNotification(config as TelegramConfig, payload);
    } else if (integration.provider === "slack") {
      result = await sendSlackNotification(config as SlackConfig, payload);
    } else {
      continue;
    }

    // Log the notification
    await logNotification(integration.provider as "telegram" | "slack", alertId || null, payload, result);
    results.push(result);
  }

  return results;
}

// Test notification
export async function testNotification(
  provider: "telegram" | "slack",
  config: TelegramConfig | SlackConfig
): Promise<NotificationResult> {
  const testPayload: NotificationPayload = {
    title: "Тестовое уведомление",
    message: "Это тестовое сообщение для проверки интеграции с " + 
      (provider === "telegram" ? "Telegram" : "Slack") + ".",
    severity: "info",
    serviceName: "test-service",
    metricValue: "42",
    thresholdValue: "50",
    timestamp: new Date(),
  };

  let result: NotificationResult;
  if (provider === "telegram") {
    result = await sendTelegramNotification(config as TelegramConfig, testPayload);
  } else {
    result = await sendSlackNotification(config as SlackConfig, testPayload);
  }
  
  // Update test result in database
  await updateTestResult(provider, result.success);
  
  return result;
}

// Helper functions
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Validate Telegram bot token format
export function validateTelegramToken(token: string): boolean {
  // Telegram bot tokens have format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
  return /^\d+:[A-Za-z0-9_-]+$/.test(token);
}

// Validate Slack webhook URL format
export function validateSlackWebhook(url: string): boolean {
  return url.startsWith("https://hooks.slack.com/services/");
}

// Get Telegram bot info
export async function getTelegramBotInfo(botToken: string): Promise<{
  success: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json() as { 
      ok: boolean; 
      result?: { username: string; first_name: string }; 
      description?: string 
    };

    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Invalid bot token",
      };
    }

    return {
      success: true,
      username: data.result?.username,
      firstName: data.result?.first_name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
