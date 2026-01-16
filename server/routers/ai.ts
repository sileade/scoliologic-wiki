import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { aiRateLimiter, embeddingRateLimiter, searchRateLimiter } from "../rateLimit";
import {
  generateEmbedding,
  semanticSearch,
  improveText,
  expandText,
  summarizeText,
  checkGrammar,
  adjustTone,
  generateKeywords,
  checkOllamaHealth,
  getAvailableModels,
  generateText,
} from "../ollama";
import {
  startBatchEmbeddings,
  stopBatchEmbeddings,
  resumeBatchEmbeddings,
  getBatchProgress,
  getEmbeddingsStats,
} from "../batchEmbeddings";

// Helper function to split text into chunks
function splitIntoChunks(text: string, maxLength: number = 500): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += para + "\n\n";
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

export const aiRouter = router({
  // AI-powered semantic search
  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Rate limiting: 60 requests per minute
      searchRateLimiter(ctx.user?.id || 'anonymous', 'ai.search');
      
      const allPages = await db.getAllPages();
      
      // Get all embeddings
      const allEmbeddings = await db.getAllEmbeddings();
      
      if (allEmbeddings.length === 0) {
        // Fallback to simple text matching
        const results = allPages
          .filter(p => 
            p.title.toLowerCase().includes(input.query.toLowerCase()) ||
            (p.content && p.content.toLowerCase().includes(input.query.toLowerCase()))
          )
          .slice(0, 10)
          .map(p => ({
            pageId: p.id,
            pageTitle: p.title,
            pageSlug: p.slug,
            snippet: p.content?.substring(0, 200) || "",
            score: 1,
          }));
        return results;
      }
      
      // Extract texts for semantic search
      const textsForSearch = allEmbeddings.map(e => e.chunkText);
      const searchResults = await semanticSearch(input.query, textsForSearch, 20);
      
      // Map results back to pages using index
      const scored: { pageId: number; score: number; snippet: string }[] = [];
      for (const result of searchResults) {
        const embedding = allEmbeddings[result.index];
        if (embedding) {
          scored.push({
            pageId: embedding.pageId,
            score: result.score,
            snippet: embedding.chunkText.substring(0, 200),
          });
        }
      }
      
      // Deduplicate by pageId, keeping highest score
      scored.sort((a, b) => b.score - a.score);
      const seen = new Set<number>();
      const results = [];
      for (const item of scored) {
        if (!seen.has(item.pageId)) {
          seen.add(item.pageId);
          results.push(item);
          if (results.length >= 10) break;
        }
      }
      
      // Enrich with page data
      const enriched = await Promise.all(
        results.map(async (r) => {
          const page = await db.getPageById(r.pageId);
          return {
            pageId: r.pageId,
            pageTitle: page?.title || "Unknown",
            pageSlug: page?.slug || "",
            snippet: r.snippet,
            score: r.score,
          };
        })
      );
      
      return enriched;
    }),
  
  // Generate embeddings for a page (parallel processing)
  generateEmbeddings: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Rate limiting: 10 requests per minute (resource intensive)
      embeddingRateLimiter(ctx.user?.id || 'anonymous', 'ai.generateEmbeddings');
      
      const page = await db.getPageById(input.pageId);
      if (!page) {
        throw new Error("Page not found");
      }
      
      const text = `${page.title}\n\n${page.content || ""}`;
      const chunks = splitIntoChunks(text, 500);
      
      // Parallel embedding generation (optimized)
      const embeddingPromises = chunks.map(chunk => 
        generateEmbedding(chunk).then(embedding => ({ text: chunk, embedding }))
      );
      const embeddedChunks = await Promise.all(embeddingPromises);
      
      await db.savePageEmbeddings(input.pageId, embeddedChunks);
      
      return { success: true, chunksProcessed: embeddedChunks.length };
    }),
  
  // AI text assistance
  assist: protectedProcedure
    .input(z.object({
      text: z.string(),
      action: z.enum([
        "improve",
        "expand",
        "summarize",
        "grammar",
        "formal",
        "casual",
        "translate_en",
        "translate_ru",
        "keywords",
      ]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limiting: 30 requests per minute
      aiRateLimiter(ctx.user?.id || 'anonymous', 'ai.assist');
      switch (input.action) {
        case "improve":
          return { result: await improveText(input.text) };
        case "expand":
          return { result: await expandText(input.text) };
        case "summarize":
          return { result: await summarizeText(input.text) };
        case "grammar": {
          const grammarResult = await checkGrammar(input.text);
          return { result: grammarResult.corrected, suggestions: grammarResult.suggestions };
        }
        case "formal":
          return { result: await adjustTone(input.text, "formal") };
        case "casual":
          return { result: await adjustTone(input.text, "casual") };
        case "translate_en":
          return { result: await generateText(`Translate the following text to English. Only return the translated text:\n\n${input.text}`) };
        case "translate_ru":
          return { result: await generateText(`Translate the following text to Russian. Only return the translated text:\n\n${input.text}`) };
        case "keywords": {
          const keywords = await generateKeywords(input.text);
          return { result: keywords.join(", "), keywords };
        }
        default:
          throw new Error("Unknown action");
      }
    }),
  
  // Check AI availability
  status: publicProcedure.query(async () => {
    const available = await checkOllamaHealth();
    const models = available ? await getAvailableModels() : [];
    return { available, models };
  }),
  
  // Batch embeddings: start processing
  batchStart: protectedProcedure
    .input(z.object({
      forceRegenerate: z.boolean().optional(),
      pageIds: z.array(z.number()).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      await startBatchEmbeddings(input);
      return { success: true, message: 'Batch processing started' };
    }),
  
  // Batch embeddings: stop processing
  batchStop: protectedProcedure
    .mutation(async () => {
      stopBatchEmbeddings();
      return { success: true, message: 'Batch processing stopped' };
    }),
  
  // Batch embeddings: resume processing
  batchResume: protectedProcedure
    .mutation(async () => {
      await resumeBatchEmbeddings();
      return { success: true, message: 'Batch processing resumed' };
    }),
  
  // Batch embeddings: get progress
  batchProgress: protectedProcedure
    .query(async () => {
      return getBatchProgress();
    }),
  
  // Get embeddings coverage statistics
  embeddingsStats: protectedProcedure
    .query(async () => {
      return getEmbeddingsStats();
    }),
});
