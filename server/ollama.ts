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


/**
 * Auto-correct formatting and structure of text
 */
export async function autoCorrectFormat(text: string): Promise<string> {
  const prompt = `Please fix the formatting and structure of the following text. Ensure proper punctuation, capitalization, and paragraph breaks. Only return the corrected text:

${text}`;

  return generateText(prompt, { temperature: 0.2, maxTokens: 1024 });
}

/**
 * Adjust tone of text
 */
export async function adjustTone(
  text: string,
  tone: "formal" | "casual" | "technical" | "friendly"
): Promise<string> {
  const toneDescriptions: Record<string, string> = {
    formal: "formal and professional",
    casual: "casual and conversational",
    technical: "technical and precise",
    friendly: "friendly and approachable",
  };

  const prompt = `Please rewrite the following text in a ${toneDescriptions[tone]} tone. Maintain the original meaning and information:

${text}`;

  return generateText(prompt, { temperature: 0.5, maxTokens: 1024 });
}

/**
 * Generate outline from content
 */
export async function generateOutline(content: string): Promise<string> {
  const prompt = `Based on the following content, generate a clear and organized outline with main sections and subsections. Format as a numbered list:

${content}`;

  return generateText(prompt, { temperature: 0.3, maxTokens: 512 });
}

/**
 * Generate content from outline
 */
export async function generateFromOutline(outline: string, topic: string): Promise<string> {
  const prompt = `Write a comprehensive article about "${topic}" following this outline:

${outline}

Make it well-structured, informative, and professional.`;

  return generateText(prompt, { temperature: 0.6, maxTokens: 2048 });
}

/**
 * Check grammar and provide suggestions
 */
export async function checkGrammar(text: string): Promise<{ corrected: string; suggestions: string[] }> {
  const prompt = `Analyze the following text for grammar, spelling, and style issues. Provide:
1. A corrected version
2. A list of issues found and suggestions

Text: ${text}

Respond in JSON format: {"corrected": "...", "suggestions": ["..."]}`;

  const response = await generateText(prompt, { temperature: 0.2, maxTokens: 512 });

  try {
    const parsed = JSON.parse(response);
    return {
      corrected: parsed.corrected || text,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { corrected: text, suggestions: [] };
  }
}

/**
 * Generate keywords/tags from content
 */
export async function generateKeywords(content: string, maxKeywords: number = 10): Promise<string[]> {
  const prompt = `Extract the top ${maxKeywords} most relevant keywords or tags from the following content. Return only the keywords as a JSON array:

${content}

Respond in JSON format: ["keyword1", "keyword2", ...]`;

  const response = await generateText(prompt, { temperature: 0.2, maxTokens: 256 });

  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
}

/**
 * Condense text to specific length
 */
export async function condenseText(text: string, targetLength: number): Promise<string> {
  const prompt = `Please condense the following text to approximately ${targetLength} words while preserving the key information:

${text}`;

  return generateText(prompt, { temperature: 0.3, maxTokens: Math.ceil(targetLength * 1.5) });
}


/**
 * Test connection to Ollama server at specific URL
 */
export async function testConnection(url: string): Promise<{
  connected: boolean;
  version?: string;
  models?: string[];
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  try {
    const client = axios.create({
      baseURL: url,
      timeout: 10000,
    });
    
    // Get version info
    const versionResponse = await client.get("/api/version");
    const responseTime = Date.now() - startTime;
    
    // Get available models
    const modelsResponse = await client.get("/api/tags");
    const models = modelsResponse.data.models?.map((m: { name: string }) => m.name) || [];
    
    return {
      connected: true,
      version: versionResponse.data.version || "unknown",
      models,
      responseTime,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      connected: false,
      error: errorMessage,
      responseTime,
    };
  }
}

/**
 * Get health status of Ollama server
 */
export async function getHealthStatus(url: string): Promise<{
  connected: boolean;
  version?: string;
  models?: string[];
  error?: string;
  responseTime?: number;
  lastChecked: number;
}> {
  const result = await testConnection(url);
  return {
    ...result,
    lastChecked: Date.now(),
  };
}


/**
 * Chat with LLM - compatible with invokeLLM interface
 * This function provides OpenAI-like message format support
 */
export async function chat(options: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ choices: Array<{ message: { content: string } }> }> {
  try {
    // Convert messages to a single prompt
    const prompt = options.messages
      .map((m) => {
        if (m.role === "system") {
          return `System: ${m.content}`;
        } else if (m.role === "user") {
          return `User: ${m.content}`;
        } else if (m.role === "assistant") {
          return `Assistant: ${m.content}`;
        }
        return m.content;
      })
      .join("\n\n");

    const response = await ollamaClient.post("/api/generate", {
      model: LLM_MODEL,
      prompt: prompt + "\n\nAssistant:",
      stream: false,
      temperature: options.temperature || 0.7,
      num_predict: options.maxTokens || 1024,
    });

    return {
      choices: [
        {
          message: {
            content: response.data.response || "",
          },
        },
      ],
    };
  } catch (error) {
    console.error("[Ollama] Chat error:", error);
    throw new Error("Failed to generate response from Ollama");
  }
}

/**
 * Translate text to specified language
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const prompt = `Translate the following text to ${targetLanguage}. Only return the translated text without any explanations:

${text}`;

  return generateText(prompt, { temperature: 0.3, maxTokens: 1024 });
}

/**
 * Analyze file content and generate article structure
 * Used for folder import feature
 */
export async function analyzeFileContent(
  content: string,
  filename: string,
  mimeType: string
): Promise<{
  title: string;
  summary: string;
  suggestedTags: string[];
  markdownContent: string;
}> {
  const prompt = `Analyze the following file content and convert it to a wiki article.

Filename: ${filename}
Type: ${mimeType}
Content:
${content.substring(0, 4000)}

Please provide:
1. A clear title for the article
2. A brief summary (1-2 sentences)
3. Suggested tags (3-5 keywords)
4. The content formatted as proper Markdown

Respond in JSON format:
{
  "title": "...",
  "summary": "...",
  "suggestedTags": ["tag1", "tag2"],
  "markdownContent": "..."
}`;

  const response = await generateText(prompt, { temperature: 0.4, maxTokens: 2048 });

  try {
    const parsed = JSON.parse(response);
    return {
      title: parsed.title || filename.replace(/\.[^/.]+$/, ""),
      summary: parsed.summary || "",
      suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
      markdownContent: parsed.markdownContent || content,
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      title: filename.replace(/\.[^/.]+$/, ""),
      summary: "",
      suggestedTags: [],
      markdownContent: content,
    };
  }
}

/**
 * Generate folder structure description for import
 */
export async function analyzeFolderStructure(
  files: Array<{ path: string; name: string; type: string }>
): Promise<{
  suggestedStructure: Array<{
    path: string;
    title: string;
    isFolder: boolean;
    children?: string[];
  }>;
  summary: string;
}> {
  const fileList = files.map((f) => `${f.path} (${f.type})`).join("\n");

  const prompt = `Analyze the following folder structure and suggest how to organize it as wiki pages:

Files:
${fileList}

Suggest a hierarchical structure for wiki pages based on the folder structure.
Respond in JSON format:
{
  "suggestedStructure": [
    {"path": "folder/file.txt", "title": "Suggested Title", "isFolder": false}
  ],
  "summary": "Brief description of the folder contents"
}`;

  const response = await generateText(prompt, { temperature: 0.3, maxTokens: 1024 });

  try {
    return JSON.parse(response);
  } catch {
    return {
      suggestedStructure: files.map((f) => ({
        path: f.path,
        title: f.name.replace(/\.[^/.]+$/, ""),
        isFolder: f.type === "folder",
      })),
      summary: "Folder structure imported",
    };
  }
}
