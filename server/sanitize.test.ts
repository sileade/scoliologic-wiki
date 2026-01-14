import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  escapeForLike,
  stripDangerousTags,
  sanitizeSlug,
  sanitizeFilename,
  sanitizeEmail,
  sanitizeUrl,
  truncate,
  removeControlChars,
  normalizeWhitespace,
  isAlphanumeric,
  isValidInteger,
  createSearchPattern,
  isValidHexColor,
  sanitizeColor,
} from "./utils/sanitize";

describe("escapeHtml", () => {
  it("should escape HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  it("should escape ampersand", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("should escape quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should not modify safe strings", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("escapeForLike", () => {
  it("should escape percent sign", () => {
    expect(escapeForLike("100%")).toBe("100\\%");
  });

  it("should escape underscore", () => {
    expect(escapeForLike("test_value")).toBe("test\\_value");
  });

  it("should escape backslash", () => {
    expect(escapeForLike("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("should handle multiple special characters", () => {
    expect(escapeForLike("50% off_sale")).toBe("50\\% off\\_sale");
  });
});

describe("stripDangerousTags", () => {
  it("should remove script tags", () => {
    expect(stripDangerousTags("<script>alert('xss')</script>")).toBe("");
  });

  it("should remove event handlers", () => {
    expect(stripDangerousTags('<img src="x" onerror="alert(1)">')).toBe(
      '<img src="x">'
    );
  });

  it("should remove javascript: URLs", () => {
    expect(stripDangerousTags('<a href="javascript:alert(1)">click</a>')).toBe(
      '<a href="alert(1)">click</a>'
    );
  });

  it("should preserve safe HTML", () => {
    expect(stripDangerousTags("<p>Hello <strong>World</strong></p>")).toBe(
      "<p>Hello <strong>World</strong></p>"
    );
  });
});

describe("sanitizeSlug", () => {
  it("should convert to lowercase", () => {
    expect(sanitizeSlug("Hello World")).toBe("hello-world");
  });

  it("should replace spaces with hyphens", () => {
    expect(sanitizeSlug("my page title")).toBe("my-page-title");
  });

  it("should remove special characters", () => {
    expect(sanitizeSlug("Hello! World?")).toBe("hello-world");
  });

  it("should handle multiple spaces", () => {
    expect(sanitizeSlug("multiple   spaces")).toBe("multiple-spaces");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(sanitizeSlug("-hello-world-")).toBe("hello-world");
  });

  it("should handle empty string", () => {
    expect(sanitizeSlug("")).toBe("");
  });
});

describe("sanitizeFilename", () => {
  it("should remove directory traversal", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
  });

  it("should remove path separators", () => {
    expect(sanitizeFilename("path/to/file.txt")).toBe("pathtofile.txt");
  });

  it("should remove invalid characters", () => {
    expect(sanitizeFilename('file<>:"|?*.txt')).toBe("file.txt");
  });

  it("should preserve valid filename", () => {
    expect(sanitizeFilename("my-file_v2.pdf")).toBe("my-file_v2.pdf");
  });
});

describe("sanitizeEmail", () => {
  it("should validate correct email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("should lowercase email", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("should trim whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("should return null for invalid email", () => {
    expect(sanitizeEmail("not-an-email")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(sanitizeEmail("")).toBeNull();
  });
});

describe("sanitizeUrl", () => {
  it("should accept valid http URL", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("should accept valid https URL", () => {
    expect(sanitizeUrl("https://example.com/path")).toBe(
      "https://example.com/path"
    );
  });

  it("should reject javascript: URL", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("should reject data: URL", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("should reject invalid URL", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });
});

describe("truncate", () => {
  it("should truncate long strings", () => {
    expect(truncate("Hello World", 8)).toBe("Hello...");
  });

  it("should not truncate short strings", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
  });

  it("should handle exact length", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });
});

describe("removeControlChars", () => {
  it("should remove null bytes", () => {
    expect(removeControlChars("hello\x00world")).toBe("helloworld");
  });

  it("should preserve newlines", () => {
    expect(removeControlChars("hello\nworld")).toBe("hello\nworld");
  });

  it("should preserve tabs", () => {
    expect(removeControlChars("hello\tworld")).toBe("hello\tworld");
  });
});

describe("normalizeWhitespace", () => {
  it("should collapse multiple spaces", () => {
    expect(normalizeWhitespace("hello    world")).toBe("hello world");
  });

  it("should trim leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
  });

  it("should handle mixed whitespace", () => {
    expect(normalizeWhitespace("hello\t\n  world")).toBe("hello world");
  });
});

describe("isAlphanumeric", () => {
  it("should return true for alphanumeric", () => {
    expect(isAlphanumeric("Hello123")).toBe(true);
  });

  it("should return false for spaces", () => {
    expect(isAlphanumeric("Hello World")).toBe(false);
  });

  it("should return false for special characters", () => {
    expect(isAlphanumeric("Hello!")).toBe(false);
  });
});

describe("isValidInteger", () => {
  it("should validate positive integer", () => {
    expect(isValidInteger("123")).toBe(true);
  });

  it("should validate negative integer", () => {
    expect(isValidInteger("-123")).toBe(true);
  });

  it("should reject decimal", () => {
    expect(isValidInteger("12.34")).toBe(false);
  });

  it("should reject non-numeric", () => {
    expect(isValidInteger("abc")).toBe(false);
  });
});

describe("createSearchPattern", () => {
  it("should create LIKE pattern", () => {
    expect(createSearchPattern("test")).toBe("%test%");
  });

  it("should escape special characters", () => {
    expect(createSearchPattern("50%")).toBe("%50\\%%");
  });

  it("should trim whitespace", () => {
    expect(createSearchPattern("  test  ")).toBe("%test%");
  });
});

describe("isValidHexColor", () => {
  it("should validate 6-digit hex", () => {
    expect(isValidHexColor("#FF0000")).toBe(true);
  });

  it("should validate 3-digit hex", () => {
    expect(isValidHexColor("#F00")).toBe(true);
  });

  it("should reject without hash", () => {
    expect(isValidHexColor("FF0000")).toBe(false);
  });

  it("should reject invalid characters", () => {
    expect(isValidHexColor("#GG0000")).toBe(false);
  });
});

describe("sanitizeColor", () => {
  it("should accept valid hex color", () => {
    expect(sanitizeColor("#FF0000")).toBe("#ff0000");
  });

  it("should add hash if missing", () => {
    expect(sanitizeColor("FF0000")).toBe("#ff0000");
  });

  it("should return null for invalid color", () => {
    expect(sanitizeColor("red")).toBeNull();
  });

  it("should lowercase the result", () => {
    expect(sanitizeColor("#AABBCC")).toBe("#aabbcc");
  });
});
