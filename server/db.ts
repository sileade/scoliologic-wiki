import { eq, and, or, like, desc, asc, isNull, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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
  const result = await db.insert(groups).values(data);
  return result[0].insertId;
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
  await db.insert(userGroups).values(data).onDuplicateKeyUpdate({
    set: { role: data.role }
  });
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
  const result = await db.insert(pages).values(data);
  return result[0].insertId;
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
  const result = await db.insert(mediaFiles).values(data);
  return result[0].insertId;
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
    .onDuplicateKeyUpdate({ set: { value, description } });
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings);
}

// ============ ACCESS REQUEST FUNCTIONS ============

export async function createAccessRequest(data: InsertAccessRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accessRequests).values(data);
  return result[0].insertId;
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
  const result = await db.insert(pageTemplates).values(data);
  return result[0].insertId;
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
  
  const result = await db.insert(notifications).values(data);
  return result[0]?.insertId || null;
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
  
  return result[0]?.affectedRows || 0;
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
  });
  
  return { id: Number(result[0].insertId) };
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
  const result = await db.insert(tags).values(data);
  return result[0].insertId;
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
