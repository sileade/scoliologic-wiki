import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as ollama from "./ollama";
import { generatePDF, generateMultiPagePDF } from "./pdf";
import { generateMarkdownFile, generateMarkdownBundle, markdownToTipTap } from "./markdown";

// Admin procedure middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Editor procedure - allows edit or admin
const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Edit access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ USER MANAGEMENT ============
  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),
    
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin", "guest"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserRole(input.userId, input.role);
        await db.logActivity({
          userId: ctx.user.id,
          action: "update_user_role",
          entityType: "user",
          entityId: input.userId,
          details: { newRole: input.role },
        });
        return { success: true };
      }),
    
    getGroups: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserGroups(input.userId);
      }),
  }),

  // ============ GROUP MANAGEMENT ============
  groups: router({
    list: protectedProcedure.query(async () => {
      return db.getAllGroups();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getGroupById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createGroup({
          name: input.name,
          description: input.description,
          color: input.color,
          createdById: ctx.user.id,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "create_group",
          entityType: "group",
          entityId: id,
          details: { name: input.name },
        });
        return { id };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateGroup(id, data);
        await db.logActivity({
          userId: ctx.user.id,
          action: "update_group",
          entityType: "group",
          entityId: id,
          details: data,
        });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteGroup(input.id);
        await db.logActivity({
          userId: ctx.user.id,
          action: "delete_group",
          entityType: "group",
          entityId: input.id,
        });
        return { success: true };
      }),
    
    getMembers: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return db.getGroupMembers(input.groupId);
      }),
    
    addMember: adminProcedure
      .input(z.object({
        groupId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "editor", "admin"]).default("member"),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addUserToGroup({
          groupId: input.groupId,
          userId: input.userId,
          role: input.role,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "add_group_member",
          entityType: "group",
          entityId: input.groupId,
          details: { memberId: input.userId, role: input.role },
        });
        return { success: true };
      }),
    
    removeMember: adminProcedure
      .input(z.object({
        groupId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.removeUserFromGroup(input.userId, input.groupId);
        await db.logActivity({
          userId: ctx.user.id,
          action: "remove_group_member",
          entityType: "group",
          entityId: input.groupId,
          details: { memberId: input.userId },
        });
        return { success: true };
      }),
    
    updateMemberRole: adminProcedure
      .input(z.object({
        groupId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "editor", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addUserToGroup({
          groupId: input.groupId,
          userId: input.userId,
          role: input.role,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "update_member_role",
          entityType: "group",
          entityId: input.groupId,
          details: { memberId: input.userId, newRole: input.role },
        });
        return { success: true };
      }),
  }),

  // ============ PAGE MANAGEMENT ============
  pages: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        // Guest: only public pages
        return db.getPublicPages();
      }
      if (ctx.user.role === "admin") {
        return db.getAllPages();
      }
      // Regular user: filter by permissions using batch query (optimized)
      const allPages = await db.getAllPages();
      const privatePages = allPages.filter(p => !p.isPublic);
      const privatePageIds = privatePages.map(p => p.id);
      
      // Single batch query instead of N+1
      const permissions = await db.checkUserPagePermissionsBatch(ctx.user.id, privatePageIds);
      
      return allPages.filter(page => {
        if (page.isPublic) return true;
        return permissions.get(page.id) !== null;
      });
    }),
    
    getRootPages: publicProcedure.query(async ({ ctx }) => {
      const rootPages = await db.getRootPages();
      if (!ctx.user) {
        return rootPages.filter(p => p.isPublic);
      }
      if (ctx.user.role === "admin") {
        return rootPages;
      }
      // Batch permission check (optimized)
      const privatePages = rootPages.filter(p => !p.isPublic);
      const privatePageIds = privatePages.map(p => p.id);
      const permissions = await db.checkUserPagePermissionsBatch(ctx.user.id, privatePageIds);
      
      return rootPages.filter(page => {
        if (page.isPublic) return true;
        return permissions.get(page.id) !== null;
      });
    }),
    
    getChildren: publicProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const children = await db.getChildPages(input.parentId);
        if (!ctx.user) {
          return children.filter(p => p.isPublic);
        }
        if (ctx.user.role === "admin") {
          return children;
        }
        // Batch permission check (optimized)
        const privatePages = children.filter(p => !p.isPublic);
        const privatePageIds = privatePages.map(p => p.id);
        const permissions = await db.checkUserPagePermissionsBatch(ctx.user.id, privatePageIds);
        
        return children.filter(page => {
          if (page.isPublic) return true;
          return permissions.get(page.id) !== null;
        });
      }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const page = await db.getPageById(input.id);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }
        
        // Check access
        if (!ctx.user && !page.isPublic) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        if (ctx.user && ctx.user.role !== "admin" && !page.isPublic) {
          const perm = await db.checkUserPagePermission(ctx.user.id, page.id);
          if (!perm) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        
        return page;
      }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input, ctx }) => {
        const page = await db.getPageBySlug(input.slug);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }
        
        if (!ctx.user && !page.isPublic) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        if (ctx.user && ctx.user.role !== "admin" && !page.isPublic) {
          const perm = await db.checkUserPagePermission(ctx.user.id, page.id);
          if (!perm) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        
        return page;
      }),
    
    create: editorProcedure
      .input(z.object({
        title: z.string().min(1).max(500),
        content: z.string().optional(),
        contentJson: z.any().optional(),
        parentId: z.number().optional(),
        icon: z.string().optional(),
        isPublic: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nanoid(6)}`;
        const id = await db.createPage({
          title: input.title,
          slug,
          content: input.content,
          contentJson: input.contentJson,
          parentId: input.parentId,
          icon: input.icon,
          isPublic: input.isPublic,
          createdById: ctx.user.id,
          lastEditedById: ctx.user.id,
        });
        
        // Create initial version
        await db.createPageVersion({
          pageId: id,
          title: input.title,
          content: input.content,
          contentJson: input.contentJson,
          version: 1,
          changeDescription: "Initial version",
          createdById: ctx.user.id,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "create_page",
          entityType: "page",
          entityId: id,
          details: { title: input.title },
        });
        
        return { id, slug };
      }),
    
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(500).optional(),
        content: z.string().optional(),
        contentJson: z.any().optional(),
        icon: z.string().optional(),
        coverImage: z.string().optional(),
        isPublic: z.boolean().optional(),
        parentId: z.number().nullable().optional(),
        order: z.number().optional(),
        changeDescription: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const page = await db.getPageById(input.id);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }
        
        // Check edit permission
        if (ctx.user.role !== "admin") {
          const perm = await db.checkUserPagePermission(ctx.user.id, input.id);
          if (perm !== "edit" && perm !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Edit access required" });
          }
        }
        
        const { id, changeDescription, ...updateData } = input;
        await db.updatePage(id, {
          ...updateData,
          lastEditedById: ctx.user.id,
        });
        
        // Create new version if content changed
        if (input.content !== undefined || input.contentJson !== undefined || input.title !== undefined) {
          const latestVersion = await db.getLatestVersionNumber(id);
          await db.createPageVersion({
            pageId: id,
            title: input.title || page.title,
            content: input.content ?? page.content,
            contentJson: input.contentJson ?? page.contentJson,
            version: latestVersion + 1,
            changeDescription: changeDescription || "Updated content",
            createdById: ctx.user.id,
          });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "update_page",
          entityType: "page",
          entityId: id,
          details: { title: input.title || page.title },
        });
        
        // Notify page author about the update
        await db.notifyPageAuthor(
          id,
          ctx.user.id,
          "page_updated",
          `Страница "${input.title || page.title}" была отредактирована`,
          `${ctx.user.name || 'Пользователь'} внёс изменения в вашу страницу`,
          { changeDescription: changeDescription || "Updated content" }
        );
        
        return { success: true };
      }),
    
    delete: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const page = await db.getPageById(input.id);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }
        
        if (ctx.user.role !== "admin") {
          const perm = await db.checkUserPagePermission(ctx.user.id, input.id);
          if (perm !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required to delete" });
          }
        }
        
        await db.deletePage(input.id);
        await db.logActivity({
          userId: ctx.user.id,
          action: "delete_page",
          entityType: "page",
          entityId: input.id,
          details: { title: page.title },
        });
        
        return { success: true };
      }),
    
    archive: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updatePage(input.id, { isArchived: true });
        await db.logActivity({
          userId: ctx.user.id,
          action: "archive_page",
          entityType: "page",
          entityId: input.id,
        });
        return { success: true };
      }),
    
    search: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().default(20) }))
      .query(async ({ input, ctx }) => {
        const results = await db.searchPages(input.query, input.limit);
        if (!ctx.user) {
          return results.filter(p => p.isPublic);
        }
        if (ctx.user.role === "admin") {
          return results;
        }
        // Batch permission check (optimized)
        const privatePages = results.filter(p => !p.isPublic);
        const privatePageIds = privatePages.map(p => p.id);
        const permissions = await db.checkUserPagePermissionsBatch(ctx.user.id, privatePageIds);
        
        return results.filter(page => {
          if (page.isPublic) return true;
          return permissions.get(page.id) !== null;
        });
      }),
    
    // Permissions
    getPermissions: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPagePermissions(input.pageId);
      }),
    
    setPermission: adminProcedure
      .input(z.object({
        pageId: z.number(),
        groupId: z.number().optional(),
        userId: z.number().optional(),
        permission: z.enum(["read", "edit", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setPagePermission({
          pageId: input.pageId,
          groupId: input.groupId,
          userId: input.userId,
          permission: input.permission,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "set_page_permission",
          entityType: "page",
          entityId: input.pageId,
          details: input,
        });
        return { success: true };
      }),
    
    removePermission: adminProcedure
      .input(z.object({ permissionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removePagePermission(input.permissionId);
        await db.logActivity({
          userId: ctx.user.id,
          action: "remove_page_permission",
          entityType: "permission",
          entityId: input.permissionId,
        });
        return { success: true };
      }),
    
    // Versions
    getVersions: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPageVersions(input.pageId);
      }),
    
    getVersion: protectedProcedure
      .input(z.object({ pageId: z.number(), version: z.number() }))
      .query(async ({ input }) => {
        return db.getPageVersion(input.pageId, input.version);
      }),
    
    rollback: editorProcedure
      .input(z.object({ pageId: z.number(), version: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const version = await db.getPageVersion(input.pageId, input.version);
        if (!version) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
        }
        
        await db.updatePage(input.pageId, {
          title: version.title,
          content: version.content,
          contentJson: version.contentJson,
          lastEditedById: ctx.user.id,
        });
        
        const latestVersion = await db.getLatestVersionNumber(input.pageId);
        await db.createPageVersion({
          pageId: input.pageId,
          title: version.title,
          content: version.content,
          contentJson: version.contentJson,
          version: latestVersion + 1,
          changeDescription: `Rolled back to version ${input.version}`,
          createdById: ctx.user.id,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "rollback_page",
          entityType: "page",
          entityId: input.pageId,
          details: { toVersion: input.version },
        });
        
        return { success: true };
      }),
  }),

  // ============ AI FEATURES ============
  ai: router({
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Get all embeddings
        const embeddings = await db.getAllEmbeddings();
        if (embeddings.length === 0) {
          // Fallback to text search
          const results = await db.searchPages(input.query, 10);
          return results.map(r => ({
            pageId: r.id,
            pageTitle: r.title,
            pageSlug: r.slug,
            snippet: r.content?.substring(0, 200) || "",
            score: 1,
          }));
        }
        
        // Generate query embedding using LLM
        const queryEmbedding = await generateEmbedding(input.query);
        
        // Calculate cosine similarity
        const scored = embeddings.map(emb => {
          const embedding = emb.embedding as number[];
          const score = cosineSimilarity(queryEmbedding, embedding);
          return {
            pageId: emb.pageId,
            pageTitle: emb.pageTitle,
            pageSlug: emb.pageSlug,
            snippet: emb.chunkText?.substring(0, 200) || "",
            score,
          };
        });
        
        // Sort by score and deduplicate by page
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
        
        // Filter by access
        if (!ctx.user) {
          const publicPages = await db.getPublicPages();
          const publicIds = new Set(publicPages.map(p => p.id));
          return results.filter(r => publicIds.has(r.pageId));
        }
        
        return results;
      }),
    
    generateEmbeddings: adminProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input }) => {
        const page = await db.getPageById(input.pageId);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }
        
        const text = `${page.title}\n\n${page.content || ""}`;
        const chunks = splitIntoChunks(text, 500);
        
        const embeddedChunks = [];
        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk);
          embeddedChunks.push({ text: chunk, embedding });
        }
        
        await db.savePageEmbeddings(input.pageId, embeddedChunks);
        return { success: true, chunksCount: embeddedChunks.length };
      }),
    
    assist: protectedProcedure
      .input(z.object({
        action: z.enum(["improve", "expand", "summarize", "grammar", "translate", "generate"]),
        text: z.string(),
        context: z.string().optional(),
        targetLanguage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompts: Record<string, string> = {
          improve: "Improve the writing style and clarity of the following text while preserving its meaning. Return only the improved text:",
          expand: "Expand and elaborate on the following text with more details and examples. Return only the expanded text:",
          summarize: "Summarize the following text concisely. Return only the summary:",
          grammar: "Fix any grammar and spelling errors in the following text. Return only the corrected text:",
          translate: `Translate the following text to ${input.targetLanguage || "English"}. Return only the translation:`,
          generate: "Based on the following context or topic, generate relevant wiki content. Return only the generated content:",
        };
        
        const systemPrompt = "You are a professional wiki content assistant. Help users write clear, well-structured documentation.";
        const userPrompt = `${prompts[input.action]}\n\n${input.context ? `Context: ${input.context}\n\n` : ""}${input.text}`;
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        
        return {
          result: response.choices[0]?.message?.content || "",
        };
      }),
    
    autocomplete: protectedProcedure
      .input(z.object({
        text: z.string(),
        cursorPosition: z.number(),
      }))
      .mutation(async ({ input }) => {
        const textBeforeCursor = input.text.substring(0, input.cursorPosition);
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a wiki content assistant. Complete the following text naturally. Return only the completion, not the original text." },
            { role: "user", content: `Complete this text:\n\n${textBeforeCursor}` },
          ],
        });
        
        return {
          completion: response.choices[0]?.message?.content || "",
        };
      }),
    
    autoCorrectFormat: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => {
        const corrected = await ollama.autoCorrectFormat(input.text);
        return { corrected };
      }),
    
    adjustTone: protectedProcedure
      .input(z.object({
        text: z.string(),
        tone: z.enum(["formal", "casual", "technical", "friendly"]),
      }))
      .mutation(async ({ input }) => {
        const adjusted = await ollama.adjustTone(input.text, input.tone);
        return { adjusted };
      }),
    
    generateOutline: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ input }) => {
        const outline = await ollama.generateOutline(input.content);
        return { outline };
      }),
    
    generateFromOutline: protectedProcedure
      .input(z.object({
        outline: z.string(),
        topic: z.string(),
      }))
      .mutation(async ({ input }) => {
        const content = await ollama.generateFromOutline(input.outline, input.topic);
        return { content };
      }),
    
    checkGrammar: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => {
        const result = await ollama.checkGrammar(input.text);
        return result;
      }),
    
    generateKeywords: protectedProcedure
      .input(z.object({
        content: z.string(),
        maxKeywords: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const keywords = await ollama.generateKeywords(input.content, input.maxKeywords);
        return { keywords };
      }),
    
    condenseText: protectedProcedure
      .input(z.object({
        text: z.string(),
        targetLength: z.number(),
      }))
      .mutation(async ({ input }) => {
        const condensed = await ollama.condenseText(input.text, input.targetLength);
        return { condensed };
      }),
  }),

  // ============ MEDIA FILES ============
  media: router({
    upload: protectedProcedure
      .input(z.object({
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
        pageId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `wiki-media/${ctx.user.id}/${nanoid()}-${input.filename}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        const id = await db.createMediaFile({
          filename: input.filename,
          originalName: input.filename,
          mimeType: input.mimeType,
          size: buffer.length,
          url,
          fileKey,
          uploadedById: ctx.user.id,
          pageId: input.pageId,
        });
        
        return { id, url };
      }),
    
    list: protectedProcedure
      .input(z.object({ pageId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getMediaFiles(input.pageId);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMediaFile(input.id);
        return { success: true };
      }),
  }),

  // ============ ADMIN FEATURES ============
  admin: router({
    getActivityLogs: adminProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return db.getActivityLogs(input.limit);
      }),
    
    getSettings: adminProcedure.query(async () => {
      return db.getAllSettings();
    }),
    
    updateSetting: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setSetting(input.key, input.value, input.description);
        await db.logActivity({
          userId: ctx.user.id,
          action: "update_setting",
          entityType: "setting",
          details: { key: input.key },
        });
        return { success: true };
      }),
    
    getPendingAccessRequests: adminProcedure.query(async () => {
      return db.getPendingAccessRequests();
    }),
    
    handleAccessRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        action: z.enum(["approve", "reject"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateAccessRequest(
          input.requestId,
          input.action === "approve" ? "approved" : "rejected",
          ctx.user.id
        );
        await db.logActivity({
          userId: ctx.user.id,
          action: `${input.action}_access_request`,
          entityType: "access_request",
          entityId: input.requestId,
        });
        return { success: true };
      }),
    
    getDashboardStats: adminProcedure.query(async () => {
      const allUsers = await db.getAllUsers();
      const allPages = await db.getAllPages();
      const allGroups = await db.getAllGroups();
      const recentActivity = await db.getActivityLogs(10);
      
      return {
        totalUsers: allUsers.length,
        totalPages: allPages.length,
        totalGroups: allGroups.length,
        recentActivity,
      };
    }),
  }),

  // ============ ACCESS REQUESTS ============
  accessRequests: router({
    create: protectedProcedure
      .input(z.object({
        pageId: z.number().optional(),
        groupId: z.number().optional(),
        requestedPermission: z.enum(["read", "edit", "admin"]).default("read"),
        message: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createAccessRequest({
          userId: ctx.user.id,
          pageId: input.pageId,
          groupId: input.groupId,
          requestedPermission: input.requestedPermission,
          message: input.message,
        });
        return { id };
      }),
  }),

  // ============ PDF EXPORT ============
  pdf: router({
    // Export single page to PDF
    exportPage: protectedProcedure
      .input(z.object({
        pageId: z.number(),
        options: z.object({
          format: z.enum(["A4", "Letter", "Legal"]).optional(),
          landscape: z.boolean().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const page = await db.getPageById(input.pageId);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }

        // Check access
        if (!page.isPublic && ctx.user.role !== "admin") {
          const perm = await db.checkUserPagePermission(ctx.user.id, page.id);
          if (!perm) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }

        // Get author info
        const author = page.createdById ? await db.getUserById(page.createdById) : null;

        // Generate PDF
        const pdfBuffer = await generatePDF(
          {
            title: page.title,
            content: page.content || "",
            author: author?.name || undefined,
            createdAt: page.createdAt ? new Date(page.createdAt) : undefined,
            updatedAt: page.updatedAt ? new Date(page.updatedAt) : undefined,
          },
          input.options
        );

        // Upload to storage
        const fileName = `exports/${ctx.user.id}/${Date.now()}-${page.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
        const { url } = await storagePut(fileName, pdfBuffer, "application/pdf");

        // Log activity
        await db.logActivity({
          userId: ctx.user.id,
          action: "export_pdf",
          entityType: "page",
          entityId: input.pageId,
          details: { pageTitle: page.title },
        });

        return { url, fileName: `${page.title}.pdf` };
      }),

    // Export multiple pages to PDF
    exportPages: protectedProcedure
      .input(z.object({
        pageIds: z.array(z.number()),
        options: z.object({
          format: z.enum(["A4", "Letter", "Legal"]).optional(),
          landscape: z.boolean().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.pageIds.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No pages specified" });
        }

        if (input.pageIds.length > 50) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 50 pages per export" });
        }

        // Get all pages
        const pages = await Promise.all(
          input.pageIds.map(async (pageId) => {
            const page = await db.getPageById(pageId);
            if (!page) return null;

            // Check access
            if (!page.isPublic && ctx.user.role !== "admin") {
              const perm = await db.checkUserPagePermission(ctx.user.id, pageId);
              if (!perm) return null;
            }

            const author = page.createdById ? await db.getUserById(page.createdById) : null;

            return {
              title: page.title,
              content: page.content || "",
              author: author?.name || undefined,
              createdAt: page.createdAt ? new Date(page.createdAt) : undefined,
              updatedAt: page.updatedAt ? new Date(page.updatedAt) : undefined,
            };
          })
        );

        const validPages = pages.filter((p): p is NonNullable<typeof p> => p !== null);

        if (validPages.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No accessible pages found" });
        }

        // Generate multi-page PDF
        const pdfBuffer = await generateMultiPagePDF(validPages, input.options);

        // Upload to storage
        const fileName = `exports/${ctx.user.id}/${Date.now()}-wiki-export.pdf`;
        const { url } = await storagePut(fileName, pdfBuffer, "application/pdf");

        // Log activity
        await db.logActivity({
          userId: ctx.user.id,
          action: "export_pdf",
          entityType: "page",
          entityId: input.pageIds[0],
          details: { pageCount: validPages.length },
        });

        return { url, fileName: `wiki-export-${validPages.length}-pages.pdf`, pageCount: validPages.length };
      }),

    // Export page with children
    exportWithChildren: protectedProcedure
      .input(z.object({
        pageId: z.number(),
        includeChildren: z.boolean().default(true),
        options: z.object({
          format: z.enum(["A4", "Letter", "Legal"]).optional(),
          landscape: z.boolean().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const rootPage = await db.getPageById(input.pageId);
        if (!rootPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }

        // Check access to root page
        if (!rootPage.isPublic && ctx.user.role !== "admin") {
          const perm = await db.checkUserPagePermission(ctx.user.id, rootPage.id);
          if (!perm) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }

        // Collect all pages to export
        const pagesToExport: Array<{
          title: string;
          content: string;
          author?: string;
          createdAt?: Date;
          updatedAt?: Date;
        }> = [];

        // Helper to recursively get children
        async function collectPages(pageId: number, depth: number = 0) {
          if (depth > 10) return; // Prevent infinite recursion

          const page = await db.getPageById(pageId);
          if (!page) return;

          if (!page.isPublic && ctx.user.role !== "admin") {
            const perm = await db.checkUserPagePermission(ctx.user.id, pageId);
            if (!perm) return;
          }

          const author = page.createdById ? await db.getUserById(page.createdById) : null;

          pagesToExport.push({
            title: page.title,
            content: page.content || "",
            author: author?.name || undefined,
            createdAt: page.createdAt ? new Date(page.createdAt) : undefined,
            updatedAt: page.updatedAt ? new Date(page.updatedAt) : undefined,
          });

          if (input.includeChildren) {
            const children = await db.getChildPages(pageId);
            for (const child of children) {
              await collectPages(child.id, depth + 1);
            }
          }
        }

        await collectPages(input.pageId);

        if (pagesToExport.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No accessible pages found" });
        }

        // Generate PDF
        const pdfBuffer = await generateMultiPagePDF(pagesToExport, input.options);

        // Upload to storage
        const fileName = `exports/${ctx.user.id}/${Date.now()}-${rootPage.title.replace(/[^a-zA-Z0-9]/g, "_")}-export.pdf`;
        const { url } = await storagePut(fileName, pdfBuffer, "application/pdf");

        // Log activity
        await db.logActivity({
          userId: ctx.user.id,
          action: "export_pdf",
          entityType: "page",
          entityId: input.pageId,
          details: { pageTitle: rootPage.title, pageCount: pagesToExport.length, includeChildren: input.includeChildren },
        });

        return { url, fileName: `${rootPage.title}-export.pdf`, pageCount: pagesToExport.length };
      }),
  }),

  // ============ NOTIFICATIONS ============
  notifications: router({
    // Get user notifications
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        unreadOnly: z.boolean().default(false),
      }).optional())
      .query(async ({ input, ctx }) => {
        const notifications = await db.getUserNotifications(ctx.user.id, input);
        const unreadCount = await db.getUnreadNotificationCount(ctx.user.id);
        return { notifications, unreadCount };
      }),

    // Get unread count only
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),

    // Mark single notification as read
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.markNotificationAsRead(input.id, ctx.user.id);
        return { success: true };
      }),

    // Mark all notifications as read
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),

    // Delete notification
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteNotification(input.id, ctx.user.id);
        return { success: true };
      }),

    // Get notification preferences
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getNotificationPreferences(ctx.user.id);
      // Return defaults if no preferences set
      return prefs || {
        emailEnabled: true,
        pageUpdates: true,
        pageComments: true,
        mentions: true,
        accessRequests: true,
        systemNotifications: true,
      };
    }),

    // Update notification preferences
    updatePreferences: protectedProcedure
      .input(z.object({
        emailEnabled: z.boolean().optional(),
        pageUpdates: z.boolean().optional(),
        pageComments: z.boolean().optional(),
        mentions: z.boolean().optional(),
        accessRequests: z.boolean().optional(),
        systemNotifications: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.upsertNotificationPreferences(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ==================== FAVORITES ====================
  favorites: router({
    // Add page to favorites
    add: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.addToFavorites(ctx.user.id, input.pageId);
        if (!result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add to favorites" });
        }
        return { success: true, id: result.id };
      }),

    // Remove page from favorites
    remove: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removeFromFavorites(ctx.user.id, input.pageId);
        return { success: true };
      }),

    // Check if page is favorited
    isFavorited: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .query(async ({ input, ctx }) => {
        const isFavorited = await db.isPageFavorited(ctx.user.id, input.pageId);
        return { isFavorited };
      }),

    // Get user's favorite pages
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const favorites = await db.getUserFavorites(ctx.user.id);
        return favorites;
      }),

    // Get favorite page IDs (for batch checking)
    getIds: protectedProcedure
      .query(async ({ ctx }) => {
        const ids = await db.getUserFavoritePageIds(ctx.user.id);
        return ids;
      }),
  }),

  // ==================== MARKDOWN EXPORT ====================
  markdown: router({
    // Export single page to Markdown
    exportPage: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const page = await db.getPageById(input.pageId);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }

        // Check access
        const hasAccess = await db.checkUserPagePermission(ctx.user.id, input.pageId);
        if (!hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        const author = page.createdById ? await db.getUserById(page.createdById) : null;
        
        const markdown = generateMarkdownFile({
          title: page.title,
          slug: page.slug,
          icon: page.icon,
          contentJson: page.contentJson as object | null,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          authorName: author?.name,
        });

        return {
          filename: `${page.slug}.md`,
          content: markdown,
        };
      }),

    // Export multiple pages to Markdown
    exportPages: protectedProcedure
      .input(z.object({ pageIds: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        const results: Array<{ filename: string; content: string }> = [];

        for (const pageId of input.pageIds) {
          const page = await db.getPageById(pageId);
          if (!page) continue;

          const hasAccess = await db.checkUserPagePermission(ctx.user.id, pageId);
          if (!hasAccess) continue;

          const author = page.createdById ? await db.getUserById(page.createdById) : null;
          const parent = page.parentId ? await db.getPageById(page.parentId) : null;

          const markdown = generateMarkdownFile({
            title: page.title,
            slug: page.slug,
            icon: page.icon,
            contentJson: page.contentJson as object | null,
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
            authorName: author?.name,
          });

          const filename = parent 
            ? `${parent.slug}/${page.slug}.md`
            : `${page.slug}.md`;

          results.push({ filename, content: markdown });
        }

        return results;
      }),

    // Export page with all subpages
    exportWithChildren: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const page = await db.getPageById(input.pageId);
        if (!page) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }

        const hasAccess = await db.checkUserPagePermission(ctx.user.id, input.pageId);
        if (!hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        const results: Array<{ filename: string; content: string }> = [];

        // Helper function to recursively get pages
        async function processPage(p: typeof page, parentPath: string = "") {
          if (!p) return;
          
          const author = p.createdById ? await db.getUserById(p.createdById) : null;
          const markdown = generateMarkdownFile({
            title: p.title,
            slug: p.slug,
            icon: p.icon,
            contentJson: p.contentJson as object | null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            authorName: author?.name,
          });

          const filename = parentPath 
            ? `${parentPath}/${p.slug}.md`
            : `${p.slug}.md`;

          results.push({ filename, content: markdown });

          // Get children
          const children = await db.getChildPages(p.id);
          for (const child of children) {
            const childHasAccess = await db.checkUserPagePermission(ctx.user.id, child.id);
            if (childHasAccess) {
              await processPage(child, parentPath ? `${parentPath}/${p.slug}` : p.slug);
            }
          }
        }

        await processPage(page);
        return results;
      }),

    // Import Markdown content
    importPage: editorProcedure
      .input(z.object({
        markdown: z.string(),
        parentId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = markdownToTipTap(input.markdown);
        
        // Create the page
        const pageId = await db.createPage({
          title: result.title,
          slug: result.metadata.slug || result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: result.metadata.icon || '📄',
          contentJson: result.content,
          parentId: input.parentId || null,
          createdById: ctx.user.id,
        });

        return {
          pageId,
          title: result.title,
          metadata: result.metadata,
        };
      }),

    // Import multiple Markdown files
    importMultiple: editorProcedure
      .input(z.object({
        files: z.array(z.object({
          filename: z.string(),
          content: z.string(),
        })),
        parentId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const results: Array<{ pageId: number; title: string; filename: string }> = [];

        for (const file of input.files) {
          const result = markdownToTipTap(file.content);
          
          // Use filename as title if no title found
          const title = result.title !== 'Imported Page' 
            ? result.title 
            : file.filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
          
          const pageId = await db.createPage({
            title,
            slug: result.metadata.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            icon: result.metadata.icon || '📄',
            contentJson: result.content,
            parentId: input.parentId || null,
            createdById: ctx.user.id,
          });

          results.push({
            pageId,
            title,
            filename: file.filename,
          });
        }

        return results;
      }),
  }),

  // ==================== TAGS ====================
  tags: router({
    // List all tags
    list: publicProcedure.query(async () => {
      return db.getAllTags();
    }),

    // List tags with page count
    listWithCount: publicProcedure.query(async () => {
      return db.getTagsWithPageCount();
    }),

    // Search tags
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchTags(input.query);
      }),

    // Get tag by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getTagById(input.id);
      }),

    // Get tag by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return db.getTagBySlug(input.slug);
      }),

    // Create tag
    create: editorProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        color: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const tagId = await db.createTag({
          name: input.name,
          slug,
          color: input.color || '#6B7280',
          description: input.description,
          createdById: ctx.user.id,
        });
        return { id: tagId, slug };
      }),

    // Update tag
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.name) {
          (data as any).slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
        await db.updateTag(id, data);
        return { success: true };
      }),

    // Delete tag
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTag(input.id);
        return { success: true };
      }),

    // Get pages by tag
    getPages: publicProcedure
      .input(z.object({ tagId: z.number() }))
      .query(async ({ input }) => {
        return db.getPagesByTag(input.tagId);
      }),

    // Get tags for a page
    getForPage: publicProcedure
      .input(z.object({ pageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPageTags(input.pageId);
      }),

    // Add tag to page
    addToPage: editorProcedure
      .input(z.object({
        pageId: z.number(),
        tagId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addTagToPage(input.pageId, input.tagId, ctx.user.id);
        return { success: true };
      }),

    // Remove tag from page
    removeFromPage: editorProcedure
      .input(z.object({
        pageId: z.number(),
        tagId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removeTagFromPage(input.pageId, input.tagId);
        return { success: true };
      }),

    // Set all tags for a page
    setForPage: editorProcedure
      .input(z.object({
        pageId: z.number(),
        tagIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setPageTags(input.pageId, input.tagIds, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// Helper functions
function splitIntoChunks(text: string, maxLength: number): string[] {
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

async function generateEmbedding(text: string): Promise<number[]> {
  // Use LLM to generate a simple embedding representation
  // In production, this would use a dedicated embedding model
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Generate a semantic representation of the following text as a JSON array of 384 floating point numbers between -1 and 1. Return only the JSON array." },
      { role: "user", content: text.substring(0, 1000) },
    ],
  });
  
  try {
    const rawContent = response.choices[0]?.message?.content || "[]";
    const content = typeof rawContent === "string" ? rawContent : "[]";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {
    // Fallback: simple hash-based embedding
  }
  
  // Fallback: generate deterministic pseudo-embedding from text
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    const charCode = text.charCodeAt(i % text.length) || 0;
    embedding.push((charCode / 128) - 1);
  }
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
