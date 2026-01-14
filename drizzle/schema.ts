import { integer, pgEnum, pgTable, text, timestamp, varchar, json, index, boolean, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// PostgreSQL enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "guest"]);
export const groupRoleEnum = pgEnum("group_role", ["member", "editor", "admin"]);
export const permissionEnum = pgEnum("permission", ["read", "edit", "admin"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "page_updated",
  "page_commented",
  "page_shared",
  "mention",
  "access_granted",
  "access_requested",
  "system"
]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User groups for access control
 */
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdById: integer("createdById"),
});

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

/**
 * User-to-group membership with role
 */
export const userGroups = pgTable("user_groups", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  groupId: integer("groupId").notNull(),
  role: groupRoleEnum("role").default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_group_idx").on(table.userId, table.groupId),
]);

export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = typeof userGroups.$inferInsert;

/**
 * Wiki pages with hierarchical structure
 */
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull(),
  content: text("content"),
  contentJson: json("contentJson"),
  icon: varchar("icon", { length: 100 }),
  coverImage: text("coverImage"),
  parentId: integer("parentId"),
  order: integer("order").default(0),
  isPublic: boolean("isPublic").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdById: integer("createdById").notNull(),
  lastEditedById: integer("lastEditedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("parent_idx").on(table.parentId),
  index("slug_idx").on(table.slug),
  index("public_idx").on(table.isPublic),
]);

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;

/**
 * Page version history for rollback
 */
export const pageVersions = pgTable("page_versions", {
  id: serial("id").primaryKey(),
  pageId: integer("pageId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  contentJson: json("contentJson"),
  version: integer("version").notNull(),
  changeDescription: text("changeDescription"),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("page_version_idx").on(table.pageId, table.version),
]);

export type PageVersion = typeof pageVersions.$inferSelect;
export type InsertPageVersion = typeof pageVersions.$inferInsert;

/**
 * Page-level access permissions
 */
export const pagePermissions = pgTable("page_permissions", {
  id: serial("id").primaryKey(),
  pageId: integer("pageId").notNull(),
  groupId: integer("groupId"),
  userId: integer("userId"),
  permission: permissionEnum("permission").default("read").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("page_perm_idx").on(table.pageId),
  index("group_perm_idx").on(table.groupId),
  index("user_perm_idx").on(table.userId),
]);

export type PagePermission = typeof pagePermissions.$inferSelect;
export type InsertPagePermission = typeof pagePermissions.$inferInsert;

/**
 * Vector embeddings for AI search
 */
export const pageEmbeddings = pgTable("page_embeddings", {
  id: serial("id").primaryKey(),
  pageId: integer("pageId").notNull(),
  chunkIndex: integer("chunkIndex").default(0).notNull(),
  chunkText: text("chunkText").notNull(),
  embedding: json("embedding"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("embedding_page_idx").on(table.pageId),
]);

export type PageEmbedding = typeof pageEmbeddings.$inferSelect;
export type InsertPageEmbedding = typeof pageEmbeddings.$inferInsert;

/**
 * Media files uploaded to S3
 */
export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 500 }).notNull(),
  originalName: varchar("originalName", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  uploadedById: integer("uploadedById").notNull(),
  pageId: integer("pageId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("media_page_idx").on(table.pageId),
  index("media_user_idx").on(table.uploadedById),
]);

export type MediaFile = typeof mediaFiles.$inferSelect;
export type InsertMediaFile = typeof mediaFiles.$inferInsert;

/**
 * Activity log for audit trail
 */
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: integer("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("activity_user_idx").on(table.userId),
  index("activity_entity_idx").on(table.entityType, table.entityId),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * System settings
 */
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/**
 * Access requests for approval workflow
 */
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  pageId: integer("pageId"),
  groupId: integer("groupId"),
  requestedPermission: permissionEnum("requestedPermission").default("read").notNull(),
  status: requestStatusEnum("status").default("pending").notNull(),
  message: text("message"),
  reviewedById: integer("reviewedById"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("access_req_user_idx").on(table.userId),
  index("access_req_status_idx").on(table.status),
]);

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

/**
 * Page templates for quick page creation
 */
export const pageTemplates = pgTable("page_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).default("general"),
  content: json("content").notNull(),
  icon: varchar("icon", { length: 100 }).default("file-text"),
  isPublic: boolean("isPublic").default(true),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("template_category_idx").on(table.category),
  index("template_creator_idx").on(table.createdById),
]);

export type PageTemplate = typeof pageTemplates.$inferSelect;
export type InsertPageTemplate = typeof pageTemplates.$inferInsert;

/**
 * User notifications for page changes and system events
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  pageId: integer("pageId"),
  actorId: integer("actorId"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notification_user_idx").on(table.userId),
  index("notification_read_idx").on(table.userId, table.isRead),
  index("notification_page_idx").on(table.pageId),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * User notification preferences
 */
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  emailEnabled: boolean("emailEnabled").default(true).notNull(),
  pageUpdates: boolean("pageUpdates").default(true).notNull(),
  pageComments: boolean("pageComments").default(true).notNull(),
  mentions: boolean("mentions").default(true).notNull(),
  accessRequests: boolean("accessRequests").default(true).notNull(),
  systemNotifications: boolean("systemNotifications").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * User favorites - bookmarked pages for quick access
 */
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  pageId: integer("pageId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("favorites_user_idx").on(table.userId),
  index("favorites_page_idx").on(table.pageId),
  index("favorites_user_page_idx").on(table.userId, table.pageId),
]);

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Tags for categorizing pages
 */
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 7 }).default("#6B7280"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: integer("createdById"),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Page-to-tag junction table
 */
export const pageTags = pgTable("page_tags", {
  id: serial("id").primaryKey(),
  pageId: integer("pageId").notNull(),
  tagId: integer("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: integer("createdById"),
}, (table) => [
  index("page_tag_idx").on(table.pageId, table.tagId),
]);

export type PageTag = typeof pageTags.$inferSelect;
export type InsertPageTag = typeof pageTags.$inferInsert;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userGroups: many(userGroups),
  createdPages: many(pages),
  mediaFiles: many(mediaFiles),
  activityLogs: many(activityLogs),
  pageTemplates: many(pageTemplates),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  userGroups: many(userGroups),
  pagePermissions: many(pagePermissions),
  createdBy: one(users, {
    fields: [groups.createdById],
    references: [users.id],
  }),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, {
    fields: [userGroups.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [userGroups.groupId],
    references: [groups.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  parent: one(pages, {
    fields: [pages.parentId],
    references: [pages.id],
    relationName: "pageHierarchy",
  }),
  children: many(pages, { relationName: "pageHierarchy" }),
  createdBy: one(users, {
    fields: [pages.createdById],
    references: [users.id],
  }),
  lastEditedBy: one(users, {
    fields: [pages.lastEditedById],
    references: [users.id],
  }),
  versions: many(pageVersions),
  permissions: many(pagePermissions),
  embeddings: many(pageEmbeddings),
  mediaFiles: many(mediaFiles),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, {
    fields: [pageVersions.pageId],
    references: [pages.id],
  }),
  createdBy: one(users, {
    fields: [pageVersions.createdById],
    references: [users.id],
  }),
}));

export const pagePermissionsRelations = relations(pagePermissions, ({ one }) => ({
  page: one(pages, {
    fields: [pagePermissions.pageId],
    references: [pages.id],
  }),
  group: one(groups, {
    fields: [pagePermissions.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [pagePermissions.userId],
    references: [users.id],
  }),
}));

export const pageEmbeddingsRelations = relations(pageEmbeddings, ({ one }) => ({
  page: one(pages, {
    fields: [pageEmbeddings.pageId],
    references: [pages.id],
  }),
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [mediaFiles.uploadedById],
    references: [users.id],
  }),
  page: one(pages, {
    fields: [mediaFiles.pageId],
    references: [pages.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const accessRequestsRelations = relations(accessRequests, ({ one }) => ({
  user: one(users, {
    fields: [accessRequests.userId],
    references: [users.id],
  }),
  page: one(pages, {
    fields: [accessRequests.pageId],
    references: [pages.id],
  }),
  group: one(groups, {
    fields: [accessRequests.groupId],
    references: [groups.id],
  }),
  reviewedBy: one(users, {
    fields: [accessRequests.reviewedById],
    references: [users.id],
  }),
}));

export const pageTemplatesRelations = relations(pageTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [pageTemplates.createdById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
  page: one(pages, {
    fields: [notifications.pageId],
    references: [pages.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  page: one(pages, {
    fields: [favorites.pageId],
    references: [pages.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tags.createdById],
    references: [users.id],
  }),
  pageTags: many(pageTags),
}));

export const pageTagsRelations = relations(pageTags, ({ one }) => ({
  page: one(pages, {
    fields: [pageTags.pageId],
    references: [pages.id],
  }),
  tag: one(tags, {
    fields: [pageTags.tagId],
    references: [tags.id],
  }),
  createdBy: one(users, {
    fields: [pageTags.createdById],
    references: [users.id],
  }),
}));
