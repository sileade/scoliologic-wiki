import { eq, and, or, like, desc, asc, isNull, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users,
  InsertGroup, groups,
  InsertUserGroup, userGroups,
  InsertPage, pages,
  InsertPageVersion, pageVersions,
  InsertPagePermission, pagePermissions,
  InsertPageEmbedding, pageEmbeddings,
  InsertMediaFile, mediaFiles,
  InsertActivityLog, activityLogs,
  InsertSystemSetting, systemSettings,
  InsertAccessRequest, accessRequests,
  InsertPageTemplate, pageTemplates,
  InsertNotification, notifications,
  InsertNotificationPreference, notificationPreferences,
  InsertFavorite, favorites,
  InsertTag, tags,
  InsertPageTag, pageTags,
  User, Group, Page, PageVersion, PagePermission, Notification, NotificationPreference, Tag
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
      // Create indexes after connection
      await createIndexesIfNeeded();
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Create IVFFlat and other performance indexes
async function createIndexesIfNeeded() {
  if (!_client) return;
  
  try {
    // Call the PostgreSQL function to create IVFFlat index
    await _client`SELECT create_embedding_index() WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_embedding_index')`;
    await _client`SELECT create_search_indexes() WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_search_indexes')`;
  } catch (error) {
    // Functions may not exist yet, ignore
    console.debug("[Database] Index creation skipped (functions not available)");
  }
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatar"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "guest") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ============ GROUP FUNCTIONS ============

export async function createGroup(data: InsertGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(groups).values(data).returning({ id: groups.id });
  return result[0]?.id;
}

export async function updateGroup(id: number, data: Partial<InsertGroup>) {
  const db = await getDb();
  if (!db) return;
  await db.update(groups).set(data).where(eq(groups.id, id));
}

export async function deleteGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userGroups).where(eq(userGroups.groupId, id));
  await db.delete(pagePermissions).where(eq(pagePermissions.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
}

export async function getGroupById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groups).orderBy(asc(groups.name));
}

export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userGroups.id,
    userId: userGroups.userId,
    role: userGroups.role,
    userName: users.name,
    userEmail: users.email,
    userAvatar: users.avatar,
  })
    .from(userGroups)
    .innerJoin(users, eq(userGroups.userId, users.id))
    .where(eq(userGroups.groupId, groupId));
}

export async function addUserToGroup(data: InsertUserGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userGroups).values(data).onConflictDoNothing();
}

export async function removeUserFromGroup(userId: number, groupId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userGroups).where(
    and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId))
  );
}

export async function getUserGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: groups.id,
    name: groups.name,
    description: groups.description,
    color: groups.color,
    role: userGroups.role,
  })
    .from(userGroups)
    .innerJoin(groups, eq(userGroups.groupId, groups.id))
    .where(eq(userGroups.userId, userId));
}

// ============ PAGE FUNCTIONS ============

export async function createPage(data: InsertPage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pages).values(data).returning({ id: pages.id });
  return result[0]?.id;
}

export async function updatePage(id: number, data: Partial<InsertPage>) {
  const db = await getDb();
  if (!db) return;
  await db.update(pages).set(data).where(eq(pages.id, id));
}

export async function deletePage(id: number) {
  const db = await getDb();
  if (!db) return;
  // Recursively delete children
  const children = await db.select().from(pages).where(eq(pages.parentId, id));
  for (const child of children) {
    await deletePage(child.id);
  }
  // Delete related data
  await db.delete(pageVersions).where(eq(pageVersions.pageId, id));
  await db.delete(pagePermissions).where(eq(pagePermissions.pageId, id));
  await db.delete(pageEmbeddings).where(eq(pageEmbeddings.pageId, id));
  await db.delete(mediaFiles).where(eq(mediaFiles.pageId, id));
  await db.delete(pages).where(eq(pages.id, id));
}

export async function getPageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPageBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRootPages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pages)
    .where(and(isNull(pages.parentId), eq(pages.isArchived, false)))
    .orderBy(asc(pages.order), asc(pages.title));
}

export async function getChildPages(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pages)
    .where(and(eq(pages.parentId, parentId), eq(pages.isArchived, false)))
    .orderBy(asc(pages.order), asc(pages.title));
}

export async function getPublicPages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pages)
    .where(and(eq(pages.isPublic, true), eq(pages.isArchived, false)))
    .orderBy(asc(pages.order), asc(pages.title));
}

export async function getAllPages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pages)
    .where(eq(pages.isArchived, false))
    .orderBy(asc(pages.order), asc(pages.title));
}

export async function searchPages(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  // Normalize query for better matching
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
  
  // Build search patterns for fuzzy matching
  const searchPatterns = [
    `%${normalizedQuery}%`, // Exact phrase
    ...queryWords.map(w => `%${w}%`), // Individual words
  ];
  
  // Get all non-archived pages and filter/rank in memory for better fuzzy matching
  const allPages = await db.select().from(pages)
    .where(eq(pages.isArchived, false));
  
  // Score and filter pages
  const scoredPages = allPages.map(page => {
    const titleLower = (page.title || '').toLowerCase();
    const contentLower = (page.content || '').toLowerCase();
    let score = 0;
    
    // Exact phrase match in title (highest priority)
    if (titleLower.includes(normalizedQuery)) {
      score += 100;
    }
    
    // Exact phrase match in content
    if (contentLower.includes(normalizedQuery)) {
      score += 50;
    }
    
    // Individual word matches
    for (const word of queryWords) {
      if (titleLower.includes(word)) {
        score += 20;
      }
      if (contentLower.includes(word)) {
        score += 10;
      }
    }
    
    // Fuzzy matching: check for partial word matches (typo tolerance)
    for (const word of queryWords) {
      if (word.length >= 3) {
        // Check if any word in title/content starts with the query word
        const titleWords = titleLower.split(/\s+/);
        const contentWords = contentLower.split(/\s+/);
        
        for (const tw of titleWords) {
          if (tw.startsWith(word.substring(0, 3))) {
            score += 5;
          }
        }
        for (const cw of contentWords) {
          if (cw.startsWith(word.substring(0, 3))) {
            score += 2;
          }
        }
      }
    }
    
    return { ...page, score };
  });
  
  // Filter pages with score > 0 and sort by score descending
  return scoredPages
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...page }) => page);
}

// ============ PAGE VERSION FUNCTIONS ============

export async function createPageVersion(data: InsertPageVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pageVersions).values(data);
}

export async function getPageVersions(pageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: pageVersions.id,
    pageId: pageVersions.pageId,
    title: pageVersions.title,
    version: pageVersions.version,
    changeDescription: pageVersions.changeDescription,
    createdAt: pageVersions.createdAt,
    createdById: pageVersions.createdById,
    createdByName: users.name,
  })
    .from(pageVersions)
    .leftJoin(users, eq(pageVersions.createdById, users.id))
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.version));
}

export async function getPageVersion(pageId: number, version: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pageVersions)
    .where(and(eq(pageVersions.pageId, pageId), eq(pageVersions.version, version)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLatestVersionNumber(pageId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ maxVersion: sql<number>`MAX(${pageVersions.version})` })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId));
  return result[0]?.maxVersion || 0;
}

// ============ PAGE PERMISSION FUNCTIONS ============

export async function setPagePermission(data: InsertPagePermission) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pagePermissions).values(data);
}

export async function removePagePermission(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pagePermissions).where(eq(pagePermissions.id, id));
}

export async function getPagePermissions(pageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: pagePermissions.id,
    pageId: pagePermissions.pageId,
    groupId: pagePermissions.groupId,
    userId: pagePermissions.userId,
    permission: pagePermissions.permission,
    groupName: groups.name,
    userName: users.name,
  })
    .from(pagePermissions)
    .leftJoin(groups, eq(pagePermissions.groupId, groups.id))
    .leftJoin(users, eq(pagePermissions.userId, users.id))
    .where(eq(pagePermissions.pageId, pageId));
}

export async function getPagePermissionsWithDetails(pageId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const query = db.select({
    id: pagePermissions.id,
    pageId: pagePermissions.pageId,
    groupId: pagePermissions.groupId,
    userId: pagePermissions.userId,
    permission: pagePermissions.permission,
    pageTitle: pages.title,
    groupName: groups.name,
    userName: users.name,
  })
    .from(pagePermissions)
    .leftJoin(pages, eq(pagePermissions.pageId, pages.id))
    .leftJoin(groups, eq(pagePermissions.groupId, groups.id))
    .leftJoin(users, eq(pagePermissions.userId, users.id));
  
  if (pageId !== undefined) {
    return query.where(eq(pagePermissions.pageId, pageId));
  }
  
  return query;
}

export async function addPagePermission(data: {
  pageId: number | null;
  groupId: number | null;
  userId: number | null;
  permission: "read" | "edit" | "admin";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // pageId is required in schema, use 0 for global permissions
  const insertData: InsertPagePermission = {
    pageId: data.pageId ?? 0,
    permission: data.permission,
  };
  
  if (data.groupId !== null) insertData.groupId = data.groupId;
  if (data.userId !== null) insertData.userId = data.userId;
  
  const result = await db.insert(pagePermissions).values(insertData).returning({ id: pagePermissions.id });
  
  return result[0]?.id;
}

export async function checkUserPagePermission(
  userId: number,
  pageId: number
): Promise<"admin" | "edit" | "read" | null> {
  const db = await getDb();
  if (!db) return null;

  // Check direct user permission
  const userPerm = await db.select().from(pagePermissions)
    .where(and(eq(pagePermissions.pageId, pageId), eq(pagePermissions.userId, userId)))
    .limit(1);
  
  if (userPerm.length > 0) {
    return userPerm[0].permission;
  }

  // Check group permissions
  const userGroupIds = await db.select({ groupId: userGroups.groupId })
    .from(userGroups)
    .where(eq(userGroups.userId, userId));
  
  if (userGroupIds.length === 0) return null;

  const groupIds = userGroupIds.map(g => g.groupId);
  const groupPerms = await db.select().from(pagePermissions)
    .where(and(
      eq(pagePermissions.pageId, pageId),
      inArray(pagePermissions.groupId!, groupIds)
    ));

  if (groupPerms.length === 0) return null;

  // Return highest permission
  if (groupPerms.some(p => p.permission === "admin")) return "admin";
  if (groupPerms.some(p => p.permission === "edit")) return "edit";
  return "read";
}

/**
 * Batch check user permissions for multiple pages
 * Optimized to avoid N+1 queries
 */
export async function checkUserPagePermissionsBatch(
  userId: number,
  pageIds: number[]
): Promise<Map<number, "admin" | "edit" | "read" | null>> {
  const result = new Map<number, "admin" | "edit" | "read" | null>();
  
  if (pageIds.length === 0) return result;
  
  const db = await getDb();
  if (!db) {
    pageIds.forEach(id => result.set(id, null));
    return result;
  }

  // Get all direct user permissions for these pages in one query
  const userPerms = await db.select()
    .from(pagePermissions)
    .where(and(
      inArray(pagePermissions.pageId, pageIds),
      eq(pagePermissions.userId, userId)
    ));

  // Get user's group IDs
  const userGroupIds = await db.select({ groupId: userGroups.groupId })
    .from(userGroups)
    .where(eq(userGroups.userId, userId));

  const groupIds = userGroupIds.map(g => g.groupId);

  // Get all group permissions for these pages in one query
  let groupPerms: typeof userPerms = [];
  if (groupIds.length > 0) {
    groupPerms = await db.select()
      .from(pagePermissions)
      .where(and(
        inArray(pagePermissions.pageId, pageIds),
        inArray(pagePermissions.groupId!, groupIds)
      ));
  }

  // Build permission map
  for (const pageId of pageIds) {
    // Check direct user permission first
    const directPerm = userPerms.find(p => p.pageId === pageId);
    if (directPerm) {
      result.set(pageId, directPerm.permission);
      continue;
    }

    // Check group permissions
    const pageGroupPerms = groupPerms.filter(p => p.pageId === pageId);
    if (pageGroupPerms.length === 0) {
      result.set(pageId, null);
      continue;
    }

    // Return highest permission
    if (pageGroupPerms.some(p => p.permission === "admin")) {
      result.set(pageId, "admin");
    } else if (pageGroupPerms.some(p => p.permission === "edit")) {
      result.set(pageId, "edit");
    } else {
      result.set(pageId, "read");
    }
  }

  return result;
}

// ============ EMBEDDING FUNCTIONS ============

export async function savePageEmbeddings(pageId: number, chunks: { text: string; embedding: number[] }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete existing embeddings
  await db.delete(pageEmbeddings).where(eq(pageEmbeddings.pageId, pageId));
  
  // Insert new embeddings
  for (let i = 0; i < chunks.length; i++) {
    await db.insert(pageEmbeddings).values({
      pageId,
      chunkIndex: i,
      chunkText: chunks[i].text,
      embedding: chunks[i].embedding,
    });
  }
}

export async function getAllEmbeddings() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: pageEmbeddings.id,
    pageId: pageEmbeddings.pageId,
    chunkIndex: pageEmbeddings.chunkIndex,
    chunkText: pageEmbeddings.chunkText,
    embedding: pageEmbeddings.embedding,
    pageTitle: pages.title,
    pageSlug: pages.slug,
  })
    .from(pageEmbeddings)
    .innerJoin(pages, eq(pageEmbeddings.pageId, pages.id));
}

// ============ MEDIA FILE FUNCTIONS ============

export async function createMediaFile(data: InsertMediaFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mediaFiles).values(data).returning({ id: mediaFiles.id });
  return result[0]?.id;
}

export async function getMediaFiles(pageId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (pageId) {
    return db.select().from(mediaFiles).where(eq(mediaFiles.pageId, pageId));
  }
  return db.select().from(mediaFiles).orderBy(desc(mediaFiles.createdAt));
}

export async function deleteMediaFile(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
}

// ============ ACTIVITY LOG FUNCTIONS ============

export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: activityLogs.id,
    action: activityLogs.action,
    entityType: activityLogs.entityType,
    entityId: activityLogs.entityId,
    details: activityLogs.details,
    createdAt: activityLogs.createdAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// ============ SYSTEM SETTINGS FUNCTIONS ============

export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return result.length > 0 ? result[0].value : undefined;
}

export async function setSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemSettings).values({ key, value, description })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, description } });
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings);
}

// ============ AUTHENTIK SETTINGS FUNCTIONS ============

interface AuthentikSettings {
  enabled: boolean;
  url: string;
  clientId: string;
  clientSecret: string;
  apiToken: string;
  syncInterval: number;
}

export async function getAuthentikSettings(): Promise<AuthentikSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'authentik_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  
  return {
    enabled: settingsMap.get('authentik_enabled') === 'true',
    url: settingsMap.get('authentik_url') || '',
    clientId: settingsMap.get('authentik_client_id') || '',
    clientSecret: settingsMap.get('authentik_client_secret') || '',
    apiToken: settingsMap.get('authentik_api_token') || '',
    syncInterval: parseInt(settingsMap.get('authentik_sync_interval') || '60', 10),
  };
}

export async function saveAuthentikSettings(settings: AuthentikSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const settingsToSave = [
    { key: 'authentik_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable Authentik integration' },
    { key: 'authentik_url', value: settings.url, description: 'Authentik server URL' },
    { key: 'authentik_client_id', value: settings.clientId, description: 'OAuth2 Client ID' },
    { key: 'authentik_sync_interval', value: settings.syncInterval.toString(), description: 'Sync interval in minutes' },
  ];
  
  // Only update secrets if they are not masked
  if (settings.clientSecret && !settings.clientSecret.includes('•')) {
    settingsToSave.push({ key: 'authentik_client_secret', value: settings.clientSecret, description: 'OAuth2 Client Secret' });
  }
  if (settings.apiToken && !settings.apiToken.includes('•')) {
    settingsToSave.push({ key: 'authentik_api_token', value: settings.apiToken, description: 'API Token for sync' });
  }
  
  for (const setting of settingsToSave) {
    await db.insert(systemSettings).values(setting)
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: setting.value, description: setting.description } });
  }
}

// ============ OLLAMA SETTINGS ============

export interface OllamaSettings {
  enabled: boolean;
  url: string;
  embeddingModel: string;
  chatModel: string;
  healthCheckInterval: number;
  notifyOnFailure: boolean;
}

export async function getOllamaSettings(): Promise<OllamaSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'ollama_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap = new Map(settings.map(s => [s.key, s.value]));
  
  return {
    enabled: settingsMap.get('ollama_enabled') !== 'false',
    url: settingsMap.get('ollama_url') || 'http://localhost:11434',
    embeddingModel: settingsMap.get('ollama_embedding_model') || 'nomic-embed-text',
    chatModel: settingsMap.get('ollama_chat_model') || 'llama3.2',
    healthCheckInterval: parseInt(settingsMap.get('ollama_health_check_interval') || '60', 10),
    notifyOnFailure: settingsMap.get('ollama_notify_on_failure') !== 'false',
  };
}

export async function saveOllamaSettings(settings: OllamaSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const settingsToSave = [
    { key: 'ollama_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable Ollama AI features' },
    { key: 'ollama_url', value: settings.url, description: 'Ollama server URL' },
    { key: 'ollama_embedding_model', value: settings.embeddingModel, description: 'Model for embeddings' },
    { key: 'ollama_chat_model', value: settings.chatModel, description: 'Model for text generation' },
    { key: 'ollama_health_check_interval', value: settings.healthCheckInterval.toString(), description: 'Health check interval in seconds' },
    { key: 'ollama_notify_on_failure', value: settings.notifyOnFailure ? 'true' : 'false', description: 'Notify admin on Ollama failure' },
  ];
  
  for (const setting of settingsToSave) {
    await db.insert(systemSettings).values(setting)
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: setting.value, description: setting.description } });
  }
}

// ============ ACCESS REQUEST FUNCTIONS ============

export async function createAccessRequest(data: InsertAccessRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accessRequests).values(data).returning({ id: accessRequests.id });
  return result[0]?.id;
}

export async function getPendingAccessRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: accessRequests.id,
    userId: accessRequests.userId,
    pageId: accessRequests.pageId,
    groupId: accessRequests.groupId,
    requestedPermission: accessRequests.requestedPermission,
    message: accessRequests.message,
    createdAt: accessRequests.createdAt,
    userName: users.name,
    userEmail: users.email,
    pageName: pages.title,
    groupName: groups.name,
  })
    .from(accessRequests)
    .innerJoin(users, eq(accessRequests.userId, users.id))
    .leftJoin(pages, eq(accessRequests.pageId, pages.id))
    .leftJoin(groups, eq(accessRequests.groupId, groups.id))
    .where(eq(accessRequests.status, "pending"))
    .orderBy(desc(accessRequests.createdAt));
}

export async function updateAccessRequest(
  id: number,
  status: "approved" | "rejected",
  reviewedById: number
) {
  const db = await getDb();
  if (!db) return;
  await db.update(accessRequests).set({
    status,
    reviewedById,
    reviewedAt: new Date(),
  }).where(eq(accessRequests.id, id));
}

// ============ PAGE TEMPLATE FUNCTIONS ============

export async function createPageTemplate(data: InsertPageTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pageTemplates).values(data).returning({ id: pageTemplates.id });
  return result[0]?.id;
}

export async function updatePageTemplate(id: number, data: Partial<InsertPageTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(pageTemplates).set(data).where(eq(pageTemplates.id, id));
}

export async function deletePageTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pageTemplates).where(eq(pageTemplates.id, id));
}

export async function getPageTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPageTemplates(category?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    id: pageTemplates.id,
    name: pageTemplates.name,
    description: pageTemplates.description,
    category: pageTemplates.category,
    icon: pageTemplates.icon,
    isPublic: pageTemplates.isPublic,
    createdAt: pageTemplates.createdAt,
    createdByName: users.name,
  })
    .from(pageTemplates)
    .leftJoin(users, eq(pageTemplates.createdById, users.id));
  
  if (category) {
    query = query.where(eq(pageTemplates.category, category)) as any;
  }
  
  return query.orderBy(asc(pageTemplates.name));
}

export async function getPublicPageTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: pageTemplates.id,
    name: pageTemplates.name,
    description: pageTemplates.description,
    category: pageTemplates.category,
    icon: pageTemplates.icon,
    createdAt: pageTemplates.createdAt,
    createdByName: users.name,
  })
    .from(pageTemplates)
    .leftJoin(users, eq(pageTemplates.createdById, users.id))
    .where(eq(pageTemplates.isPublic, true))
    .orderBy(asc(pageTemplates.category), asc(pageTemplates.name));
}

export async function getTemplateCategories() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ category: pageTemplates.category })
    .from(pageTemplates)
    .where(eq(pageTemplates.isPublic, true))
    .orderBy(asc(pageTemplates.category));
  return result.map(r => r.category).filter(c => c !== null);
}


// ============ NOTIFICATION FUNCTIONS ============

export async function createNotification(data: InsertNotification): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check user preferences before creating notification
  const prefs = await getNotificationPreferences(data.userId);
  if (prefs) {
    // Check if this type of notification is enabled
    if (data.type === "page_updated" && !prefs.pageUpdates) return null;
    if (data.type === "page_commented" && !prefs.pageComments) return null;
    if (data.type === "mention" && !prefs.mentions) return null;
    if (data.type === "access_requested" && !prefs.accessRequests) return null;
    if (data.type === "system" && !prefs.systemNotifications) return null;
  }
  
  const result = await db.insert(notifications).values(data).returning({ id: notifications.id });
  return result[0]?.id || null;
}

export async function getUserNotifications(userId: number, options?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { limit = 50, offset = 0, unreadOnly = false } = options || {};
  
  let query = db.select({
    id: notifications.id,
    type: notifications.type,
    title: notifications.title,
    message: notifications.message,
    pageId: notifications.pageId,
    actorId: notifications.actorId,
    isRead: notifications.isRead,
    readAt: notifications.readAt,
    metadata: notifications.metadata,
    createdAt: notifications.createdAt,
    actorName: users.name,
    actorAvatar: users.avatar,
  })
  .from(notifications)
  .leftJoin(users, eq(notifications.actorId, users.id))
  .where(
    unreadOnly 
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId)
  )
  .orderBy(desc(notifications.createdAt))
  .limit(limit)
  .offset(offset);
  
  return query;
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  
  return result[0]?.count || 0;
}

export async function markNotificationAsRead(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  
  return true;
}

export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  
  return true;
}

export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(notifications)
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  
  return true;
}

export async function deleteOldNotifications(daysOld: number = 30): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await db.delete(notifications)
    .where(sql`${notifications.createdAt} < ${cutoffDate}`);
  
  return 0; // PostgreSQL delete doesn't return affected rows in drizzle
}

// ============ NOTIFICATION PREFERENCES FUNCTIONS ============

export async function getNotificationPreferences(userId: number): Promise<NotificationPreference | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertNotificationPreferences(
  userId: number, 
  prefs: Partial<Omit<InsertNotificationPreference, "userId">>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const existing = await getNotificationPreferences(userId);
  
  if (existing) {
    await db.update(notificationPreferences)
      .set(prefs)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }
  
  return true;
}

// ============ NOTIFICATION HELPER FUNCTIONS ============

export async function notifyPageAuthor(
  pageId: number,
  actorId: number,
  type: "page_updated" | "page_commented",
  title: string,
  message?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get the page to find the author
  const page = await getPageById(pageId);
  if (!page || !page.createdById) return;
  
  // Don't notify if the actor is the author
  if (page.createdById === actorId) return;
  
  await createNotification({
    userId: page.createdById,
    type,
    title,
    message,
    pageId,
    actorId,
    metadata,
  });
}

export async function notifyUsersWithPageAccess(
  pageId: number,
  actorId: number,
  type: "page_updated" | "page_commented" | "page_shared",
  title: string,
  message?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Get all users with access to this page
  const permissions = await db.select({ userId: pagePermissions.userId })
    .from(pagePermissions)
    .where(eq(pagePermissions.pageId, pageId));
  
  // Also get the page author
  const page = await getPageById(pageId);
  const authorId = page?.createdById;
  
  // Collect unique user IDs (excluding the actor)
  const userIds = new Set<number>();
  if (authorId && authorId !== actorId) {
    userIds.add(authorId);
  }
  for (const perm of permissions) {
    if (perm.userId && perm.userId !== actorId) {
      userIds.add(perm.userId);
    }
  }
  
  // Create notifications for all users
  for (const userId of Array.from(userIds)) {
    await createNotification({
      userId,
      type,
      title,
      message,
      pageId,
      actorId,
      metadata,
    });
  }
}


// ==================== FAVORITES ====================

/**
 * Add a page to user's favorites
 */
export async function addToFavorites(userId: number, pageId: number): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check if already favorited
  const existing = await db.select()
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.pageId, pageId)))
    .limit(1);
  
  if (existing.length > 0) {
    return { id: existing[0].id };
  }
  
  const result = await db.insert(favorites).values({
    userId,
    pageId,
  }).returning({ id: favorites.id });
  
  return { id: result[0]?.id };
}

/**
 * Remove a page from user's favorites
 */
export async function removeFromFavorites(userId: number, pageId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.pageId, pageId)));
  
  return true;
}

/**
 * Check if a page is in user's favorites
 */
export async function isPageFavorited(userId: number, pageId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.pageId, pageId)))
    .limit(1);
  
  return result.length > 0;
}

/**
 * Get user's favorite pages with page details
 */
export async function getUserFavorites(userId: number): Promise<Array<{
  id: number;
  pageId: number;
  pageTitle: string;
  pageIcon: string | null;
  pageSlug: string;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: favorites.id,
    pageId: favorites.pageId,
    pageTitle: pages.title,
    pageIcon: pages.icon,
    pageSlug: pages.slug,
    createdAt: favorites.createdAt,
  })
    .from(favorites)
    .innerJoin(pages, eq(favorites.pageId, pages.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  
  return result;
}

/**
 * Get favorite page IDs for a user (for batch checking)
 */
export async function getUserFavoritePageIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({ pageId: favorites.pageId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  
  return result.map(r => r.pageId);
}


// ============ TAG FUNCTIONS ============

export async function createTag(data: InsertTag): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tags).values(data).returning({ id: tags.id });
  return result[0]?.id;
}

export async function updateTag(id: number, data: Partial<InsertTag>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tags).set(data).where(eq(tags.id, id));
}

export async function deleteTag(id: number) {
  const db = await getDb();
  if (!db) return;
  // First delete all page-tag associations
  await db.delete(pageTags).where(eq(pageTags.tagId, id));
  // Then delete the tag
  await db.delete(tags).where(eq(tags.id, id));
}

export async function getTagById(id: number): Promise<Tag | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return result[0];
}

export async function getTagBySlug(slug: string): Promise<Tag | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return result[0];
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(tags.name);
}

export async function searchTags(query: string): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).where(like(tags.name, `%${query}%`)).orderBy(tags.name).limit(20);
}

// ============ PAGE-TAG FUNCTIONS ============

export async function addTagToPage(pageId: number, tagId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Check if already exists
  const existing = await db.select()
    .from(pageTags)
    .where(and(eq(pageTags.pageId, pageId), eq(pageTags.tagId, tagId)))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(pageTags).values({
      pageId,
      tagId,
      createdById: userId,
    });
  }
}

export async function removeTagFromPage(pageId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pageTags).where(
    and(eq(pageTags.pageId, pageId), eq(pageTags.tagId, tagId))
  );
}

export async function getPageTags(pageId: number): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: tags.id,
    name: tags.name,
    slug: tags.slug,
    color: tags.color,
    description: tags.description,
    createdAt: tags.createdAt,
    createdById: tags.createdById,
  })
    .from(pageTags)
    .innerJoin(tags, eq(pageTags.tagId, tags.id))
    .where(eq(pageTags.pageId, pageId))
    .orderBy(tags.name);
  
  return result;
}

export async function getPagesByTag(tagId: number): Promise<Page[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: pages.id,
    title: pages.title,
    slug: pages.slug,
    icon: pages.icon,
    content: pages.content,
    contentJson: pages.contentJson,
    parentId: pages.parentId,
    order: pages.order,
    isPublic: pages.isPublic,
    isArchived: pages.isArchived,
    createdAt: pages.createdAt,
    updatedAt: pages.updatedAt,
    createdById: pages.createdById,
    lastEditedById: pages.lastEditedById,
    coverImage: pages.coverImage,
  })
    .from(pageTags)
    .innerJoin(pages, eq(pageTags.pageId, pages.id))
    .where(eq(pageTags.tagId, tagId))
    .orderBy(pages.title);
  
  return result;
}

export async function setPageTags(pageId: number, tagIds: number[], userId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Remove all existing tags
  await db.delete(pageTags).where(eq(pageTags.pageId, pageId));
  
  // Add new tags
  if (tagIds.length > 0) {
    await db.insert(pageTags).values(
      tagIds.map(tagId => ({
        pageId,
        tagId,
        createdById: userId,
      }))
    );
  }
}

export async function getTagsWithPageCount(): Promise<Array<Tag & { pageCount: number }>> {
  const db = await getDb();
  if (!db) return [];
  
  const allTags = await getAllTags();
  const result: Array<Tag & { pageCount: number }> = [];
  
  for (const tag of allTags) {
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(pageTags)
      .where(eq(pageTags.tagId, tag.id));
    
    result.push({
      ...tag,
      pageCount: countResult[0]?.count || 0,
    });
  }
  
  return result;
}


// ============ AI AGENT SETTINGS ============

export interface AIAgentSettings {
  enabled: boolean;
  analysisModel: string;
  monitoringInterval: number; // seconds
  autoFixEnabled: boolean;
  maxAutoFixAttempts: number;
  escalationThreshold: number;
  loadBalancerEnabled: boolean;
  loadBalancerType: 'traefik' | 'nginx' | 'haproxy';
  selfLearningEnabled: boolean;
  logRetentionDays: number;
}

export async function getAIAgentSettings(): Promise<AIAgentSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'ai_agent_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value || '';
  }
  
  return {
    enabled: settingsMap['ai_agent_enabled'] === 'true',
    analysisModel: settingsMap['ai_agent_analysis_model'] || 'llama3.2',
    monitoringInterval: parseInt(settingsMap['ai_agent_monitoring_interval'] || '60'),
    autoFixEnabled: settingsMap['ai_agent_auto_fix_enabled'] === 'true',
    maxAutoFixAttempts: parseInt(settingsMap['ai_agent_max_auto_fix_attempts'] || '3'),
    escalationThreshold: parseInt(settingsMap['ai_agent_escalation_threshold'] || '5'),
    loadBalancerEnabled: settingsMap['ai_agent_load_balancer_enabled'] === 'true',
    loadBalancerType: (settingsMap['ai_agent_load_balancer_type'] as 'traefik' | 'nginx' | 'haproxy') || 'traefik',
    selfLearningEnabled: settingsMap['ai_agent_self_learning_enabled'] === 'true',
    logRetentionDays: parseInt(settingsMap['ai_agent_log_retention_days'] || '30'),
  };
}

export async function saveAIAgentSettings(settings: AIAgentSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const settingsToSave = [
    { key: 'ai_agent_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable AI Agent' },
    { key: 'ai_agent_analysis_model', value: settings.analysisModel, description: 'Model for error analysis' },
    { key: 'ai_agent_monitoring_interval', value: settings.monitoringInterval.toString(), description: 'Monitoring interval in seconds' },
    { key: 'ai_agent_auto_fix_enabled', value: settings.autoFixEnabled ? 'true' : 'false', description: 'Enable automatic error fixing' },
    { key: 'ai_agent_max_auto_fix_attempts', value: settings.maxAutoFixAttempts.toString(), description: 'Max auto-fix attempts' },
    { key: 'ai_agent_escalation_threshold', value: settings.escalationThreshold.toString(), description: 'Errors before escalation' },
    { key: 'ai_agent_load_balancer_enabled', value: settings.loadBalancerEnabled ? 'true' : 'false', description: 'Enable load balancer integration' },
    { key: 'ai_agent_load_balancer_type', value: settings.loadBalancerType, description: 'Load balancer type' },
    { key: 'ai_agent_self_learning_enabled', value: settings.selfLearningEnabled ? 'true' : 'false', description: 'Enable self-learning' },
    { key: 'ai_agent_log_retention_days', value: settings.logRetentionDays.toString(), description: 'Log retention in days' },
  ];
  
  for (const setting of settingsToSave) {
    await db.insert(systemSettings).values(setting)
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: setting.value, description: setting.description } });
  }
}

// ============ TRAEFIK SETTINGS ============

export interface TraefikSettings {
  enabled: boolean;
  connectionType?: string;
  apiUrl: string;
  remoteHost?: string;
  remotePort?: string;
  useSSL?: boolean;
  authType?: string;
  apiUser: string;
  apiPassword: string;
  entryPoint: string;
  dashboardUrl: string;
  timeout?: number;
  retryCount?: number;
}

export async function getTraefikSettings(): Promise<TraefikSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'traefik_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value || '';
  }
  
  return {
    enabled: settingsMap['traefik_enabled'] === 'true',
    connectionType: settingsMap['traefik_connection_type'] || 'local',
    apiUrl: settingsMap['traefik_api_url'] || '',
    remoteHost: settingsMap['traefik_remote_host'] || '',
    remotePort: settingsMap['traefik_remote_port'] || '8080',
    useSSL: settingsMap['traefik_use_ssl'] === 'true',
    authType: settingsMap['traefik_auth_type'] || 'none',
    apiUser: settingsMap['traefik_api_user'] || '',
    apiPassword: settingsMap['traefik_api_password'] || '',
    entryPoint: settingsMap['traefik_entry_point'] || 'websecure',
    dashboardUrl: settingsMap['traefik_dashboard_url'] || '',
    timeout: parseInt(settingsMap['traefik_timeout'] || '10', 10),
    retryCount: parseInt(settingsMap['traefik_retry_count'] || '3', 10),
  };
}

export async function saveTraefikSettings(settings: TraefikSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const settingsToSave = [
    { key: 'traefik_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable Traefik integration' },
    { key: 'traefik_connection_type', value: settings.connectionType || 'local', description: 'Connection type (local/remote)' },
    { key: 'traefik_api_url', value: settings.apiUrl, description: 'Traefik API URL' },
    { key: 'traefik_remote_host', value: settings.remoteHost || '', description: 'Remote Traefik host' },
    { key: 'traefik_remote_port', value: settings.remotePort || '8080', description: 'Remote Traefik port' },
    { key: 'traefik_use_ssl', value: settings.useSSL ? 'true' : 'false', description: 'Use SSL for connection' },
    { key: 'traefik_auth_type', value: settings.authType || 'none', description: 'Auth type (none/basic/digest)' },
    { key: 'traefik_api_user', value: settings.apiUser, description: 'Traefik API username' },
    { key: 'traefik_api_password', value: settings.apiPassword, description: 'Traefik API password' },
    { key: 'traefik_entry_point', value: settings.entryPoint, description: 'Traefik entry point' },
    { key: 'traefik_dashboard_url', value: settings.dashboardUrl, description: 'Traefik dashboard URL' },
    { key: 'traefik_timeout', value: String(settings.timeout || 10), description: 'Connection timeout' },
    { key: 'traefik_retry_count', value: String(settings.retryCount || 3), description: 'Retry count' },
  ];
  
  for (const setting of settingsToSave) {
    await db.insert(systemSettings).values(setting)
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: setting.value, description: setting.description } });
  }
}

// ============ MINIO S3 SETTINGS ============

export interface MinioSettings {
  enabled: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicUrl: string;
}

export async function getMinioSettings(): Promise<MinioSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'minio_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value || '';
  }
  
  return {
    enabled: settingsMap['minio_enabled'] === 'true',
    endpoint: settingsMap['minio_endpoint'] || '',
    port: parseInt(settingsMap['minio_port'] || '9000'),
    useSSL: settingsMap['minio_use_ssl'] === 'true',
    accessKey: settingsMap['minio_access_key'] || '',
    secretKey: settingsMap['minio_secret_key'] || '',
    bucket: settingsMap['minio_bucket'] || 'wiki-files',
    region: settingsMap['minio_region'] || 'us-east-1',
    publicUrl: settingsMap['minio_public_url'] || '',
  };
}

export async function saveMinioSettings(settings: MinioSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const settingsToSave = [
    { key: 'minio_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable MinIO S3 storage' },
    { key: 'minio_endpoint', value: settings.endpoint, description: 'MinIO server endpoint' },
    { key: 'minio_port', value: settings.port.toString(), description: 'MinIO server port' },
    { key: 'minio_use_ssl', value: settings.useSSL ? 'true' : 'false', description: 'Use SSL for MinIO' },
    { key: 'minio_access_key', value: settings.accessKey, description: 'MinIO access key' },
    { key: 'minio_secret_key', value: settings.secretKey, description: 'MinIO secret key' },
    { key: 'minio_bucket', value: settings.bucket, description: 'MinIO bucket name' },
    { key: 'minio_region', value: settings.region, description: 'MinIO region' },
    { key: 'minio_public_url', value: settings.publicUrl, description: 'Public URL for MinIO files' },
  ];
  
  for (const setting of settingsToSave) {
    await db.insert(systemSettings).values(setting)
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: setting.value, description: setting.description } });
  }
}

// ============ METRICS STORAGE ============

export interface MetricEntry {
  timestamp: Date;
  type: 'response_time' | 'error_count' | 'request_count' | 'memory_usage' | 'cpu_usage';
  value: number;
  metadata?: Record<string, unknown>;
}

export async function saveMetric(metric: MetricEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(systemSettings).values({
    key: `metric_${metric.type}_${Date.now()}`,
    value: JSON.stringify({
      timestamp: metric.timestamp.toISOString(),
      value: metric.value,
      metadata: metric.metadata,
    }),
    description: `Metric: ${metric.type}`,
  });
}

export async function getMetrics(type: string, hours: number = 24): Promise<MetricEntry[]> {
  const db = await getDb();
  if (!db) return [];
  
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE ${'metric_' + type + '_%'}`);
  
  const metrics: MetricEntry[] = [];
  for (const s of settings) {
    try {
      const data = JSON.parse(s.value || '{}');
      const timestamp = new Date(data.timestamp);
      if (timestamp >= cutoff) {
        metrics.push({
          timestamp,
          type: type as MetricEntry['type'],
          value: data.value,
          metadata: data.metadata,
        });
      }
    } catch (e) {
      // Skip invalid entries
    }
  }
  
  return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export async function cleanupOldMetrics(daysOld: number = 7): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  // Get all metric keys
  const settings = await db.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'metric_%'`);
  
  let deleted = 0;
  for (const s of settings) {
    try {
      const data = JSON.parse(s.value || '{}');
      const timestamp = new Date(data.timestamp);
      if (timestamp < cutoff) {
        await db.delete(systemSettings).where(eq(systemSettings.key, s.key));
        deleted++;
      }
    } catch (e) {
      // Skip invalid entries
    }
  }
  
  return deleted;
}
