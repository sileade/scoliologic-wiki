/**
 * Rate Limiting Middleware for AI Endpoints
 * 
 * Protects AI endpoints from abuse and overload by limiting
 * the number of requests per time window.
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// For production with multiple instances, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // AI endpoints - more restrictive
  ai: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 30,         // 30 requests per minute
    message: 'Too many AI requests. Please wait before trying again.'
  },
  // Embedding generation - very resource intensive
  embedding: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,         // 10 requests per minute
    message: 'Too many embedding requests. Please wait before trying again.'
  },
  // Search - moderate limits
  search: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 60,         // 60 requests per minute
    message: 'Too many search requests. Please wait before trying again.'
  },
  // General API - lenient
  general: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 100,        // 100 requests per minute
    message: 'Too many requests. Please wait before trying again.'
  }
} as const;

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (usually IP + endpoint)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now
  };
}

/**
 * Create a rate limit key from user/IP and endpoint
 */
export function createRateLimitKey(
  identifier: string | number,
  endpoint: string
): string {
  return `${identifier}:${endpoint}`;
}

/**
 * Clean up expired entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Reset rate limit for a specific key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): { count: number; remaining: number; resetIn: number } | null {
  const entry = rateLimitStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.resetTime) {
    rateLimitStore.delete(key);
    return null;
  }

  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: entry.resetTime - now
  };
}

/**
 * Middleware helper for tRPC procedures
 * Returns a function that checks rate limit and throws if exceeded
 */
export function createRateLimiter(configType: keyof typeof RATE_LIMIT_CONFIGS) {
  const config = RATE_LIMIT_CONFIGS[configType];
  
  return function rateLimiter(userId: number | string, endpoint: string): void {
    const key = createRateLimitKey(userId, endpoint);
    const result = checkRateLimit(key, config);
    
    if (!result.allowed) {
      const waitSeconds = Math.ceil(result.resetIn / 1000);
      throw new Error(
        `${config.message} Try again in ${waitSeconds} seconds.`
      );
    }
  };
}

// Pre-configured rate limiters
export const aiRateLimiter = createRateLimiter('ai');
export const embeddingRateLimiter = createRateLimiter('embedding');
export const searchRateLimiter = createRateLimiter('search');
export const generalRateLimiter = createRateLimiter('general');
