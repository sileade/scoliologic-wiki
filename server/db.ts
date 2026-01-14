import { eq, and, or, desc, asc, isNull, sql, like, inArray } from "drizzle-orm";
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
  User, Group, Page, PageVersion, PagePermission
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
  return db.select().from(pages)
    .where(and(
      or(
        like(pages.title, `%${query}%`),
        like(pages.content, `%${query}%`)
      ),
      eq(pages.isArchived, false)
    ))
    .limit(limit);
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
