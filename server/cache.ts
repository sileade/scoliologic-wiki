/**
 * Redis Cache Module for Embeddings and AI Results
 * 
 * Provides caching layer for expensive AI operations:
 * - Embedding vectors (TTL: 24 hours)
 * - Search results (TTL: 5 minutes)
 * - AI assist results (TTL: 1 hour)
 */

import Redis from 'ioredis';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  EMBEDDING: 24 * 60 * 60,      // 24 hours
  SEARCH_RESULTS: 5 * 60,       // 5 minutes
  AI_ASSIST: 60 * 60,           // 1 hour
  RATE_LIMIT: 60,               // 1 minute
} as const;

// Cache key prefixes
export const CACHE_PREFIX = {
  EMBEDDING: 'emb:',
  SEARCH: 'search:',
  AI_ASSIST: 'assist:',
  RATE_LIMIT: 'rate:',
} as const;

let redisClient: Redis | null = null;
let connectionAttempted = false;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  if (connectionAttempted) return null;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.debug('[Cache] REDIS_URL not configured, caching disabled');
    connectionAttempted = true;
    return null;
  }
  
  try {
    redisClient = new Redis(redisUrl);
    
    redisClient.on('error', (err) => {
      console.warn('[Cache] Redis error:', err.message);
    });
    
    redisClient.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
    
    connectionAttempted = true;
    return redisClient;
  } catch (error) {
    console.warn('[Cache] Failed to create Redis client:', error);
    connectionAttempted = true;
    return null;
  }
}

/**
 * Generate cache key for embedding
 */
export function embeddingCacheKey(text: string): string {
  // Use hash of text to create consistent key
  const hash = simpleHash(text);
  return `${CACHE_PREFIX.EMBEDDING}${hash}`;
}

/**
 * Generate cache key for search results
 */
export function searchCacheKey(query: string): string {
  const hash = simpleHash(query.toLowerCase().trim());
  return `${CACHE_PREFIX.SEARCH}${hash}`;
}

/**
 * Generate cache key for AI assist results
 */
export function assistCacheKey(text: string, action: string): string {
  const hash = simpleHash(`${action}:${text}`);
  return `${CACHE_PREFIX.AI_ASSIST}${hash}`;
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached embedding vector
 */
export async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const key = embeddingCacheKey(text);
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.debug('[Cache] Error getting embedding:', error);
    return null;
  }
}

/**
 * Cache embedding vector
 */
export async function cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    const key = embeddingCacheKey(text);
    await client.setex(key, CACHE_TTL.EMBEDDING, JSON.stringify(embedding));
  } catch (error) {
    console.debug('[Cache] Error caching embedding:', error);
  }
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults<T>(query: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const key = searchCacheKey(query);
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.debug('[Cache] Error getting search results:', error);
    return null;
  }
}

/**
 * Cache search results
 */
export async function cacheSearchResults<T>(query: string, results: T): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    const key = searchCacheKey(query);
    await client.setex(key, CACHE_TTL.SEARCH_RESULTS, JSON.stringify(results));
  } catch (error) {
    console.debug('[Cache] Error caching search results:', error);
  }
}

/**
 * Get cached AI assist result
 */
export async function getCachedAssistResult(text: string, action: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const key = assistCacheKey(text, action);
    const cached = await client.get(key);
    return cached;
  } catch (error) {
    console.debug('[Cache] Error getting assist result:', error);
    return null;
  }
}

/**
 * Cache AI assist result
 */
export async function cacheAssistResult(text: string, action: string, result: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    const key = assistCacheKey(text, action);
    await client.setex(key, CACHE_TTL.AI_ASSIST, result);
  } catch (error) {
    console.debug('[Cache] Error caching assist result:', error);
  }
}

/**
 * Invalidate cache for a specific page (when content changes)
 */
export async function invalidatePageCache(pageId: number): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    // Invalidate all search results (they may contain this page)
    const searchKeys = await client.keys(`${CACHE_PREFIX.SEARCH}*`);
    if (searchKeys.length > 0) {
      await client.del(...searchKeys);
    }
    console.debug(`[Cache] Invalidated ${searchKeys.length} search cache entries for page ${pageId}`);
  } catch (error) {
    console.debug('[Cache] Error invalidating page cache:', error);
  }
}

/**
 * Clear all cache (for maintenance)
 */
export async function clearAllCache(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    await client.flushdb();
    console.log('[Cache] All cache cleared');
  } catch (error) {
    console.debug('[Cache] Error clearing cache:', error);
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
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const info = await client.info('memory');
    const dbsize = await client.dbsize();
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch ? memoryMatch[1] : 'unknown';
    
    return {
      connected: true,
      keys: dbsize,
      memory,
    };
  } catch (error) {
    return {
      connected: false,
      keys: 0,
      memory: '0',
    };
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    connectionAttempted = false;
    console.log('[Cache] Redis connection closed');
  }
}
