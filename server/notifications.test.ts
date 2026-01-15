import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateTelegramToken,
  validateSlackWebhook,
  sendTelegramNotification,
  sendSlackNotification,
  testNotification,
} from "./notifications";

describe("Notifications Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateTelegramToken", () => {
    it("should validate correct Telegram bot token format", () => {
      expect(validateTelegramToken("123456789:ABCdefGHIjklMNOpqrsTUVwxyz")).toBe(true);
      expect(validateTelegramToken("1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-0123456789")).toBe(true);
    });

    it("should reject invalid Telegram bot token format", () => {
      expect(validateTelegramToken("")).toBe(false);
      expect(validateTelegramToken("invalid")).toBe(false);
      expect(validateTelegramToken("123456789")).toBe(false);
      expect(validateTelegramToken(":ABCdefGHI")).toBe(false);
      expect(validateTelegramToken("abc:ABCdefGHI")).toBe(false);
    });
  });

  describe("validateSlackWebhook", () => {
    it("should validate correct Slack webhook URL format", () => {
      expect(validateSlackWebhook("https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX")).toBe(true);
      expect(validateSlackWebhook("https://hooks.slack.com/services/T12345678/B12345678/abcdefghijklmnopqrstuvwx")).toBe(true);
    });

    it("should reject invalid Slack webhook URL format", () => {
      expect(validateSlackWebhook("")).toBe(false);
      expect(validateSlackWebhook("https://example.com/webhook")).toBe(false);
      expect(validateSlackWebhook("http://hooks.slack.com/services/T00000000/B00000000/XXX")).toBe(false);
      expect(validateSlackWebhook("https://hooks.slack.com/")).toBe(false);
    });
  });

  describe("sendTelegramNotification", () => {
    it("should return error for missing bot token", async () => {
      const result = await sendTelegramNotification(
        { botToken: "", chatId: "123" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      expect(result.success).toBe(false);
      expect(result.provider).toBe("telegram");
      expect(result.error).toBe("Missing bot token or chat ID");
    });

    it("should return error for missing chat ID", async () => {
      const result = await sendTelegramNotification(
        { botToken: "123:ABC", chatId: "" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      expect(result.success).toBe(false);
      expect(result.provider).toBe("telegram");
      expect(result.error).toBe("Missing bot token or chat ID");
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      
      const result = await sendTelegramNotification(
        { botToken: "123:ABC", chatId: "123456" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(false);
      expect(result.provider).toBe("telegram");
      expect(result.error).toBe("Network error");
    });

    it("should handle Telegram API errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: false, description: "Bad Request: chat not found" }),
      });
      
      const result = await sendTelegramNotification(
        { botToken: "123:ABC", chatId: "123456" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bad Request: chat not found");
    });

    it("should return success with message ID on successful send", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: { message_id: 12345 } }),
      });
      
      const result = await sendTelegramNotification(
        { botToken: "123:ABC", chatId: "123456" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe("telegram");
      expect(result.messageId).toBe("12345");
    });
  });

  describe("sendSlackNotification", () => {
    it("should return error for missing webhook URL", async () => {
      const result = await sendSlackNotification(
        { webhookUrl: "" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      expect(result.success).toBe(false);
      expect(result.provider).toBe("slack");
      expect(result.error).toBe("Missing webhook URL");
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
      
      const result = await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(false);
      expect(result.provider).toBe("slack");
      expect(result.error).toBe("Connection refused");
    });

    it("should handle Slack API errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("invalid_payload"),
      });
      
      const result = await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Slack API error");
    });

    it("should return success on successful send", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      
      const result = await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe("slack");
    });

    it("should include custom channel in payload", async () => {
      let capturedPayload: any;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({ ok: true });
      });
      
      await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX", channel: "#alerts" },
        { title: "Test", message: "Test message", severity: "info" }
      );
      
      expect(capturedPayload.channel).toBe("#alerts");
    });
  });

  describe("Severity colors and emojis", () => {
    it("should use correct severity colors for Slack", async () => {
      let capturedPayload: any;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({ ok: true });
      });
      
      await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX" },
        { title: "Test", message: "Test", severity: "critical" }
      );
      
      expect(capturedPayload.attachments[0].color).toBe("#ff0000");
    });

    it("should include service name and metric values in Slack fields", async () => {
      let capturedPayload: any;
      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedPayload = JSON.parse(options.body);
        return Promise.resolve({ ok: true });
      });
      
      await sendSlackNotification(
        { webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX" },
        { 
          title: "Alert", 
          message: "Test", 
          severity: "warning",
          serviceName: "my-service",
          metricValue: "95",
          thresholdValue: "80",
        }
      );
      
      const fields = capturedPayload.attachments[0].fields;
      expect(fields.some((f: any) => f.title === "Сервис" && f.value === "my-service")).toBe(true);
      expect(fields.some((f: any) => f.title === "Значение" && f.value === "95")).toBe(true);
      expect(fields.some((f: any) => f.title === "Порог" && f.value === "80")).toBe(true);
    });
  });
});
