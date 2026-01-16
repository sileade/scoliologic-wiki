/**
 * Batch Embeddings Processing Module
 * 
 * Provides functionality for batch generation of embeddings for all pages.
 * Useful for initial indexing and periodic re-indexing.
 */

import { getDb, getAllPages, savePageEmbeddings } from './db';
import { generateEmbedding } from './ollama';
import { cacheEmbedding, getCachedEmbedding } from './cache';

// Batch processing configuration
export const BATCH_CONFIG = {
  CONCURRENT_LIMIT: 5,        // Max concurrent embedding requests
  BATCH_SIZE: 10,             // Pages per batch
  DELAY_BETWEEN_BATCHES: 100, // ms delay between batches
  RETRY_ATTEMPTS: 3,          // Retry failed embeddings
  RETRY_DELAY: 1000,          // ms delay between retries
} as const;

// Processing status types
export type BatchStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface BatchProgress {
  status: BatchStatus;
  total: number;
  processed: number;
  failed: number;
  cached: number;
  currentBatch: number;
  totalBatches: number;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedTimeRemaining: number | null; // in seconds
  errors: Array<{ pageId: number; error: string }>;
}

// Global state for batch processing
let batchProgress: BatchProgress = {
  status: 'idle',
  total: 0,
  processed: 0,
  failed: 0,
  cached: 0,
  currentBatch: 0,
  totalBatches: 0,
  startedAt: null,
  completedAt: null,
  estimatedTimeRemaining: null,
  errors: [],
};

let abortController: AbortController | null = null;

/**
 * Get current batch processing progress
 */
export function getBatchProgress(): BatchProgress {
  return { ...batchProgress };
}

/**
 * Reset batch progress
 */
function resetProgress(): void {
  batchProgress = {
    status: 'idle',
    total: 0,
    processed: 0,
    failed: 0,
    cached: 0,
    currentBatch: 0,
    totalBatches: 0,
    startedAt: null,
    completedAt: null,
    estimatedTimeRemaining: null,
    errors: [],
  };
}

/**
 * Process a single page embedding with retry logic
 */
async function processPageEmbedding(
  page: { id: number; title: string; content: string | null },
  signal: AbortSignal
): Promise<{ success: boolean; cached: boolean; error?: string }> {
  const textToEmbed = `${page.title}\n\n${page.content || ''}`.trim();
  
  if (!textToEmbed || textToEmbed.length < 10) {
    return { success: true, cached: false }; // Skip empty pages
  }
  
  // Check cache first
  const cachedEmbedding = await getCachedEmbedding(textToEmbed);
  if (cachedEmbedding) {
    // Update page with cached embedding
    await savePageEmbeddings(page.id, [{ text: textToEmbed, embedding: cachedEmbedding }]);
    return { success: true, cached: true };
  }
  
  // Generate new embedding with retries
  for (let attempt = 1; attempt <= BATCH_CONFIG.RETRY_ATTEMPTS; attempt++) {
    if (signal.aborted) {
      return { success: false, cached: false, error: 'Aborted' };
    }
    
    try {
      const embedding = await generateEmbedding(textToEmbed);
      
      if (embedding && embedding.length > 0) {
        // Update page and cache
        await savePageEmbeddings(page.id, [{ text: textToEmbed, embedding }]);
        await cacheEmbedding(textToEmbed, embedding);
        return { success: true, cached: false };
      }
    } catch (error) {
      if (attempt === BATCH_CONFIG.RETRY_ATTEMPTS) {
        return { 
          success: false, 
          cached: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.RETRY_DELAY));
    }
  }
  
  return { success: false, cached: false, error: 'Max retries exceeded' };
}

/**
 * Process a batch of pages concurrently
 */
async function processBatch(
  pages: Array<{ id: number; title: string; content: string | null }>,
  signal: AbortSignal
): Promise<void> {
  const chunks: Array<Array<{ id: number; title: string; content: string | null }>> = [];
  
  // Split into concurrent chunks
  for (let i = 0; i < pages.length; i += BATCH_CONFIG.CONCURRENT_LIMIT) {
    chunks.push(pages.slice(i, i + BATCH_CONFIG.CONCURRENT_LIMIT));
  }
  
  for (const chunk of chunks) {
    if (signal.aborted) break;
    
    const results = await Promise.all(
      chunk.map(page => processPageEmbedding(page, signal))
    );
    
    // Update progress
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const page = chunk[i];
      
      batchProgress.processed++;
      
      if (result.success) {
        if (result.cached) {
          batchProgress.cached++;
        }
      } else {
        batchProgress.failed++;
        batchProgress.errors.push({
          pageId: page.id,
          error: result.error || 'Unknown error',
        });
      }
    }
    
    // Calculate estimated time remaining
    if (batchProgress.startedAt && batchProgress.processed > 0) {
      const elapsed = Date.now() - batchProgress.startedAt.getTime();
      const avgTimePerPage = elapsed / batchProgress.processed;
      const remaining = batchProgress.total - batchProgress.processed;
      batchProgress.estimatedTimeRemaining = Math.round((remaining * avgTimePerPage) / 1000);
    }
  }
}

/**
 * Start batch embedding generation for all pages
 */
export async function startBatchEmbeddings(options?: {
  forceRegenerate?: boolean;
  pageIds?: number[];
}): Promise<void> {
  if (batchProgress.status === 'running') {
    throw new Error('Batch processing already in progress');
  }
  
  resetProgress();
  abortController = new AbortController();
  
  try {
    batchProgress.status = 'running';
    batchProgress.startedAt = new Date();
    
    // Get pages to process
    let pages: Array<{ id: number; title: string; content: string | null }>;
    
    if (options?.pageIds && options.pageIds.length > 0) {
      // Process specific pages
      const db = getDb();
      const allPages = await getAllPages();
      pages = allPages.filter(p => options.pageIds!.includes(p.id));
    } else {
      // Process all pages
      pages = await getAllPages();
    }
    
    // Filter pages that need embedding (unless force regenerate)
    if (!options?.forceRegenerate) {
      pages = pages.filter(p => !p.content || p.content.length >= 10);
    }
    
    batchProgress.total = pages.length;
    batchProgress.totalBatches = Math.ceil(pages.length / BATCH_CONFIG.BATCH_SIZE);
    
    console.log(`[BatchEmbeddings] Starting batch processing for ${pages.length} pages`);
    
    // Process in batches
    for (let i = 0; i < pages.length; i += BATCH_CONFIG.BATCH_SIZE) {
      if (abortController.signal.aborted) {
        batchProgress.status = 'paused';
        console.log('[BatchEmbeddings] Processing paused');
        return;
      }
      
      batchProgress.currentBatch = Math.floor(i / BATCH_CONFIG.BATCH_SIZE) + 1;
      
      const batch = pages.slice(i, i + BATCH_CONFIG.BATCH_SIZE);
      await processBatch(batch, abortController.signal);
      
      // Small delay between batches to prevent overload
      if (i + BATCH_CONFIG.BATCH_SIZE < pages.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.DELAY_BETWEEN_BATCHES));
      }
    }
    
    batchProgress.status = 'completed';
    batchProgress.completedAt = new Date();
    batchProgress.estimatedTimeRemaining = 0;
    
    console.log(`[BatchEmbeddings] Completed: ${batchProgress.processed} processed, ${batchProgress.cached} cached, ${batchProgress.failed} failed`);
    
  } catch (error) {
    batchProgress.status = 'error';
    console.error('[BatchEmbeddings] Error:', error);
    throw error;
  }
}

/**
 * Stop batch processing
 */
export function stopBatchEmbeddings(): void {
  if (abortController) {
    abortController.abort();
    batchProgress.status = 'paused';
    console.log('[BatchEmbeddings] Stop requested');
  }
}

/**
 * Resume batch processing from where it stopped
 */
export async function resumeBatchEmbeddings(): Promise<void> {
  if (batchProgress.status !== 'paused') {
    throw new Error('Can only resume paused processing');
  }
  
  // Get remaining pages
  const allPages = await getAllPages();
  const processedIds = new Set(
    batchProgress.errors.map(e => e.pageId)
  );
  
  // Continue with unprocessed pages
  const remainingPages = allPages.slice(batchProgress.processed);
  
  if (remainingPages.length === 0) {
    batchProgress.status = 'completed';
    return;
  }
  
  abortController = new AbortController();
  batchProgress.status = 'running';
  
  // Process remaining pages
  for (let i = 0; i < remainingPages.length; i += BATCH_CONFIG.BATCH_SIZE) {
    if (abortController.signal.aborted) {
      batchProgress.status = 'paused';
      return;
    }
    
    batchProgress.currentBatch++;
    
    const batch = remainingPages.slice(i, i + BATCH_CONFIG.BATCH_SIZE);
    await processBatch(batch, abortController.signal);
    
    if (i + BATCH_CONFIG.BATCH_SIZE < remainingPages.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.DELAY_BETWEEN_BATCHES));
    }
  }
  
  batchProgress.status = 'completed';
  batchProgress.completedAt = new Date();
  batchProgress.estimatedTimeRemaining = 0;
}

/**
 * Get statistics about embeddings coverage
 */
export async function getEmbeddingsStats(): Promise<{
  totalPages: number;
  pagesWithEmbeddings: number;
  pagesWithoutEmbeddings: number;
  coveragePercent: number;
}> {
  const pages = await getAllPages();
  
  // This is a simplified check - in production you'd check the actual embedding column
  const totalPages = pages.length;
  const pagesWithContent = pages.filter(p => p.content && p.content.length >= 10).length;
  
  return {
    totalPages,
    pagesWithEmbeddings: pagesWithContent, // Approximation
    pagesWithoutEmbeddings: totalPages - pagesWithContent,
    coveragePercent: totalPages > 0 ? Math.round((pagesWithContent / totalPages) * 100) : 0,
  };
}
