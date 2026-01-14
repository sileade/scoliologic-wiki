/**
 * Redis Cache Module
 * 
 * Provides caching functionality for sessions, permissions, and general data.
 * Falls back gracefully when Redis is unavailable.
 */

import Redis from "ioredis";

// Cache configuration
const CACHE_CONFIG = {
  // TTL in seconds
  SESSION_TTL: 60 * 60 * 24, // 24 hours
  PERMISSION_TTL: 60 * 5,    // 5 minutes
  PAGE_TTL: 60 * 10,         // 10 minutes
  USER_TTL: 60 * 15,         // 15 minutes
  SEARCH_TTL: 60 * 2,        // 2 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  SESSION: "session:",
  PERMISSION: "perm:",
  USER_PERMISSIONS: "user_perms:",
  PAGE: "page:",
  USER: "user:",
  SEARCH: "search:",
  STATS: "stats:",
};

let redis: Redis | null = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export function initRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log("[Redis] No REDIS_URL configured, caching disabled");
    return null;
  }

  try {
    redis = new Redis(redisUrl);

    redis.on("connect", () => {
      isConnected = true;
      console.log("[Redis] Connected successfully");
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
      isConnected = false;
    });

    redis.on("close", () => {
      isConnected = false;
      console.log("[Redis] Connection closed");
    });

    // Attempt connection
    redis.connect().catch((err) => {
      console.error("[Redis] Failed to connect:", err.message);
    });

    return redis;
  } catch (error) {
    console.error("[Redis] Initialization error:", error);
    return null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null && isConnected;
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) return null;

  try {
    const value = await redis!.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    console.error("[Redis] Get error:", error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis!.setex(key, ttlSeconds, serialized);
    } else {
      await redis!.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.error("[Redis] Set error:", error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  try {
    await redis!.del(key);
    return true;
  } catch (error) {
    console.error("[Redis] Delete error:", error);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable()) return 0;

  try {
    const keys = await redis!.keys(pattern);
    if (keys.length > 0) {
      await redis!.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error("[Redis] Delete pattern error:", error);
    return 0;
  }
}

// ============ SESSION CACHE ============

/**
 * Cache user session
 */
export async function cacheSession(
  sessionId: string,
  userId: number,
  userData: Record<string, unknown>
): Promise<boolean> {
  const key = `${CACHE_KEYS.SESSION}${sessionId}`;
  return cacheSet(key, { userId, ...userData }, CACHE_CONFIG.SESSION_TTL);
}

/**
 * Get cached session
 */
export async function getCachedSession(
  sessionId: string
): Promise<{ userId: number; [key: string]: unknown } | null> {
  const key = `${CACHE_KEYS.SESSION}${sessionId}`;
  return cacheGet(key);
}

/**
 * Invalidate session
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  const key = `${CACHE_KEYS.SESSION}${sessionId}`;
  return cacheDelete(key);
}

// ============ PERMISSION CACHE ============

/**
 * Cache user permission for a page
 */
export async function cachePermission(
  userId: number,
  pageId: number,
  permission: "admin" | "edit" | "read" | null
): Promise<boolean> {
  const key = `${CACHE_KEYS.PERMISSION}${userId}:${pageId}`;
  return cacheSet(key, permission, CACHE_CONFIG.PERMISSION_TTL);
}

/**
 * Get cached permission
 */
export async function getCachedPermission(
  userId: number,
  pageId: number
): Promise<"admin" | "edit" | "read" | null | undefined> {
  const key = `${CACHE_KEYS.PERMISSION}${userId}:${pageId}`;
  const result = await cacheGet<"admin" | "edit" | "read" | null>(key);
  // undefined means not in cache, null means no permission
  return result === null ? undefined : result;
}

/**
 * Cache batch permissions for user
 */
export async function cacheUserPermissions(
  userId: number,
  permissions: Map<number, "admin" | "edit" | "read" | null>
): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  try {
    const pipeline = redis!.pipeline();
    
    permissions.forEach((permission, pageId) => {
      const key = `${CACHE_KEYS.PERMISSION}${userId}:${pageId}`;
      pipeline.setex(key, CACHE_CONFIG.PERMISSION_TTL, JSON.stringify(permission));
    });

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error("[Redis] Cache user permissions error:", error);
    return false;
  }
}

/**
 * Invalidate all permissions for a user
 */
export async function invalidateUserPermissions(userId: number): Promise<number> {
  return cacheDeletePattern(`${CACHE_KEYS.PERMISSION}${userId}:*`);
}

/**
 * Invalidate all permissions for a page
 */
export async function invalidatePagePermissions(pageId: number): Promise<number> {
  return cacheDeletePattern(`${CACHE_KEYS.PERMISSION}*:${pageId}`);
}

// ============ PAGE CACHE ============

/**
 * Cache page data
 */
export async function cachePage(
  pageId: number,
  pageData: Record<string, unknown>
): Promise<boolean> {
  const key = `${CACHE_KEYS.PAGE}${pageId}`;
  return cacheSet(key, pageData, CACHE_CONFIG.PAGE_TTL);
}

/**
 * Get cached page
 */
export async function getCachedPage(
  pageId: number
): Promise<Record<string, unknown> | null> {
  const key = `${CACHE_KEYS.PAGE}${pageId}`;
  return cacheGet(key);
}

/**
 * Invalidate page cache
 */
export async function invalidatePage(pageId: number): Promise<boolean> {
  const key = `${CACHE_KEYS.PAGE}${pageId}`;
  return cacheDelete(key);
}

// ============ USER CACHE ============

/**
 * Cache user data
 */
export async function cacheUser(
  userId: number,
  userData: Record<string, unknown>
): Promise<boolean> {
  const key = `${CACHE_KEYS.USER}${userId}`;
  return cacheSet(key, userData, CACHE_CONFIG.USER_TTL);
}

/**
 * Get cached user
 */
export async function getCachedUser(
  userId: number
): Promise<Record<string, unknown> | null> {
  const key = `${CACHE_KEYS.USER}${userId}`;
  return cacheGet(key);
}

/**
 * Invalidate user cache
 */
export async function invalidateUser(userId: number): Promise<boolean> {
  const key = `${CACHE_KEYS.USER}${userId}`;
  return cacheDelete(key);
}

// ============ SEARCH CACHE ============

/**
 * Cache search results
 */
export async function cacheSearchResults(
  query: string,
  results: unknown[]
): Promise<boolean> {
  const key = `${CACHE_KEYS.SEARCH}${Buffer.from(query).toString("base64")}`;
  return cacheSet(key, results, CACHE_CONFIG.SEARCH_TTL);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  query: string
): Promise<unknown[] | null> {
  const key = `${CACHE_KEYS.SEARCH}${Buffer.from(query).toString("base64")}`;
  return cacheGet(key);
}

// ============ STATS CACHE ============

/**
 * Cache stats data
 */
export async function cacheStats(
  statType: string,
  data: unknown
): Promise<boolean> {
  const key = `${CACHE_KEYS.STATS}${statType}`;
  return cacheSet(key, data, CACHE_CONFIG.PAGE_TTL);
}

/**
 * Get cached stats
 */
export async function getCachedStats(statType: string): Promise<unknown | null> {
  const key = `${CACHE_KEYS.STATS}${statType}`;
  return cacheGet(key);
}

// ============ CACHE UTILITIES ============

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  try {
    await redis!.flushdb();
    console.log("[Redis] All cache cleared");
    return true;
  } catch (error) {
    console.error("[Redis] Clear cache error:", error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keys: number;
  memory: string;
} | null> {
  if (!isRedisAvailable()) {
    return { connected: false, keys: 0, memory: "0" };
  }

  try {
    const info = await redis!.info("memory");
    const dbSize = await redis!.dbsize();
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch ? memoryMatch[1] : "unknown";

    return {
      connected: true,
      keys: dbSize,
      memory,
    };
  } catch (error) {
    console.error("[Redis] Get stats error:", error);
    return null;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    isConnected = false;
    console.log("[Redis] Connection closed");
  }
}

// Export config for external use
export { CACHE_CONFIG, CACHE_KEYS };
