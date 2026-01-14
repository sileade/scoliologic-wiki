import axios from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";
const LLM_MODEL = process.env.LLM_MODEL || "mistral";

// Initialize Ollama client
const ollamaClient = axios.create({
  baseURL: OLLAMA_BASE_URL,
  timeout: 60000,
});

/**
 * Generate embeddings for text using Ollama
 * Used for semantic search and similarity matching
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ollamaClient.post("/api/embeddings", {
      model: EMBEDDING_MODEL,
      prompt: text,
    });
    return response.data.embedding;
  } catch (error) {
    console.error("[Ollama] Failed to generate embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

/**
 * Generate text using local LLM via Ollama
 * Used for AI writing assistance, summarization, etc.
 */
export async function generateText(
  prompt: string,
  options?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxTokens?: number;
  }
): Promise<string> {
  try {
    const response = await ollamaClient.post("/api/generate", {
      model: LLM_MODEL,
      prompt: prompt,
      stream: false,
      temperature: options?.temperature || 0.7,
      top_k: options?.topK || 40,
      top_p: options?.topP || 0.9,
      num_predict: options?.maxTokens || 512,
    });
    return response.data.response;
  } catch (error) {
    console.error("[Ollama] Failed to generate text:", error);
    throw new Error("Failed to generate text");
  }
}

/**
 * Improve text formatting and structure
 */
export async function improveText(text: string): Promise<string> {
  const prompt = `Please improve the following text by fixing grammar, spelling, and making it more professional and clear. Only return the improved text without any explanations:

${text}`;

  return generateText(prompt, { temperature: 0.3, maxTokens: 1024 });
}

/**
 * Generate article from topic/outline
 */
export async function generateArticle(topic: string, outline?: string): Promise<string> {
  const outlineText = outline ? `\n\nOutline:\n${outline}` : "";
  const prompt = `Write a comprehensive article about: ${topic}${outlineText}

Please write in a professional, clear, and well-structured manner. Include an introduction, main sections, and conclusion.`;

  return generateText(prompt, { temperature: 0.7, maxTokens: 2048 });
}

/**
 * Summarize text
 */
export async function summarizeText(text: string, maxLength?: number): Promise<string> {
  const lengthHint = maxLength ? ` Keep it to approximately ${maxLength} words.` : "";
  const prompt = `Please summarize the following text concisely.${lengthHint}

${text}`;

  return generateText(prompt, { temperature: 0.3, maxTokens: 512 });
}

/**
 * Expand text with more details
 */
export async function expandText(text: string): Promise<string> {
  const prompt = `Please expand the following text with more details, examples, and explanations while maintaining the original meaning:

${text}`;

  return generateText(prompt, { temperature: 0.6, maxTokens: 1024 });
}

/**
 * Generate SEO-optimized title and description
 */
export async function generateSEO(
  content: string
): Promise<{ title: string; description: string }> {
  const prompt = `Based on the following content, generate an SEO-optimized title (max 60 chars) and meta description (max 160 chars).

Content:
${content}

Respond in JSON format: {"title": "...", "description": "..."}`;

  const response = await generateText(prompt, { temperature: 0.3, maxTokens: 256 });

  try {
    const parsed = JSON.parse(response);
    return {
      title: parsed.title || "",
      description: parsed.description || "",
    };
  } catch {
    return { title: "", description: "" };
  }
}

/**
 * Check if Ollama is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await ollamaClient.get("/api/tags");
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Get list of available models
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await ollamaClient.get("/api/tags");
    return response.data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Calculate similarity between two texts using embeddings
 */
export async function calculateSimilarity(text1: string, text2: string): Promise<number> {
  try {
    const [embedding1, embedding2] = await Promise.all([
      generateEmbedding(text1),
      generateEmbedding(text2),
    ]);

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  } catch (error) {
    console.error("[Ollama] Failed to calculate similarity:", error);
    return 0;
  }
}

/**
 * Semantic search - find similar texts from a list
 */
export async function semanticSearch(
  query: string,
  texts: string[],
  topK: number = 5
): Promise<Array<{ text: string; score: number; index: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(query);

    const results = await Promise.all(
      texts.map(async (text, index) => {
        const textEmbedding = await generateEmbedding(text);

        // Calculate cosine similarity
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * textEmbedding[i];
          magnitude1 += queryEmbedding[i] * queryEmbedding[i];
          magnitude2 += textEmbedding[i] * textEmbedding[i];
        }

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        const similarity =
          magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);

        return { text, score: similarity, index };
      })
    );

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  } catch (error) {
    console.error("[Ollama] Failed to perform semantic search:", error);
    return [];
  }
}
