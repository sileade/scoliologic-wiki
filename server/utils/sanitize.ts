/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize and validate user input
 * to prevent XSS, SQL injection, and other security issues.
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Escape special characters for SQL LIKE queries
 */
export function escapeForLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Remove potentially dangerous HTML tags
 */
export function stripDangerousTags(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  // Remove javascript: URLs
  html = html.replace(/javascript:/gi, "");
  // Remove data: URLs (can be used for XSS)
  html = html.replace(/data:/gi, "");
  return html;
}

/**
 * Sanitize a string for use as a slug
 */
export function sanitizeSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric except spaces and hyphens
    .replace(/[\s_]+/g, "-")      // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-")          // Replace multiple hyphens with single
    .replace(/^-|-$/g, "");       // Remove leading/trailing hyphens
}

/**
 * Sanitize a filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "")         // Remove directory traversal
    .replace(/[/\\]/g, "")        // Remove path separators
    .replace(/[<>:"|?*]/g, "")    // Remove invalid filename characters
    .trim();
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Sanitize URL to ensure it's safe
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Truncate string to maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Remove null bytes and other control characters
 */
export function removeControlChars(str: string): string {
  // Remove null bytes and control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Normalize whitespace (collapse multiple spaces, trim)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Validate that a string contains only alphanumeric characters
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Validate that a string is a valid integer
 */
export function isValidInteger(str: string): boolean {
  return /^-?\d+$/.test(str);
}

/**
 * Sanitize JSON string to prevent injection
 */
export function sanitizeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Create a safe search pattern for database queries
 */
export function createSearchPattern(query: string): string {
  const sanitized = escapeForLike(query.trim());
  return `%${sanitized}%`;
}

/**
 * Validate color hex code
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Sanitize color to ensure it's a valid hex code
 */
export function sanitizeColor(color: string): string | null {
  const trimmed = color.trim();
  if (isValidHexColor(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Try to fix common issues
  if (/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }
  return null;
}
