import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";

/**
 * Rate Limiting Configuration
 * 
 * Provides different rate limiters for various API endpoints
 * to prevent abuse and ensure fair usage.
 * 
 * Uses ipKeyGenerator helper for proper IPv6 address handling.
 */

/**
 * Create a key generator that handles both authenticated users and IP addresses
 * Uses ipKeyGenerator for proper IPv6 support as recommended by express-rate-limit
 */
function createKeyGenerator(prefix: string = ""): Options["keyGenerator"] {
  return (req: Request): string => {
    const user = (req as Request & { user?: { id: number } }).user;
    if (user?.id) {
      return `${prefix}user:${user.id}`;
    }
    // Use ipKeyGenerator helper for proper IPv6 handling
    const ip = req.ip || "";
    return `${prefix}${ipKeyGenerator(ip)}`;
  };
}

// General API rate limiter - 100 requests per minute
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: 60,
  },
  keyGenerator: createKeyGenerator("general:"),
});

// Strict rate limiter for AI endpoints - 20 requests per minute
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AI request limit exceeded. Please wait before trying again.",
    retryAfter: 60,
  },
  keyGenerator: createKeyGenerator("ai:"),
});

// Very strict limiter for auth endpoints - 10 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please try again later.",
    retryAfter: 900,
  },
  keyGenerator: createKeyGenerator("auth:"),
});

// Search rate limiter - 30 requests per minute
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Search limit exceeded. Please wait before searching again.",
    retryAfter: 60,
  },
  keyGenerator: createKeyGenerator("search:"),
});

// File upload limiter - 10 uploads per minute
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Upload limit exceeded. Please wait before uploading again.",
    retryAfter: 60,
  },
  keyGenerator: createKeyGenerator("upload:"),
});

// Admin operations limiter - 50 requests per minute
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Admin operation limit exceeded. Please wait.",
    retryAfter: 60,
  },
  keyGenerator: createKeyGenerator("admin:"),
});

/**
 * Skip rate limiting for certain conditions
 */
export function shouldSkipRateLimit(req: Request): boolean {
  // Skip for health checks
  if (req.path === "/health" || req.path === "/api/health") {
    return true;
  }
  
  // Skip for static assets
  if (req.path.startsWith("/assets/") || req.path.startsWith("/static/")) {
    return true;
  }
  
  return false;
}
