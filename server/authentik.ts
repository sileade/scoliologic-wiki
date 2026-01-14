/**
 * Authentik API integration for user and group synchronization
 */

import { ENV } from "./_core/env";
import * as db from "./db";

interface AuthentikGroup {
  pk: string;
  name: string;
  is_superuser: boolean;
  parent?: string | null;
  parent_name?: string | null;
  users: number[];
  users_obj?: AuthentikUserBasic[];
  attributes?: Record<string, unknown>;
}

interface AuthentikUserBasic {
  pk: number;
  username: string;
  name: string;
  is_active: boolean;
  email: string;
}

interface AuthentikUser {
  pk: number;
  username: string;
  email: string;
  name: string;
  is_active: boolean;
  is_superuser: boolean;
  groups: string[];
  groups_obj?: AuthentikGroup[];
  avatar?: string;
  attributes?: Record<string, unknown>;
}

interface AuthentikPaginatedResponse<T> {
  pagination: {
    next: number;
    previous: number;
    count: number;
    current: number;
    total_pages: number;
    start_index: number;
    end_index: number;
  };
  results: T[];
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  details: string[];
}

/**
 * Get Authentik API configuration
 */
function getAuthentikConfig() {
  const apiUrl = ENV.authentikUrl ? `${ENV.authentikUrl}/api/v3` : "";
  const token = ENV.authentikApiToken;
  return { apiUrl, token };
}

/**
 * Make authenticated request to Authentik API
 */
async function authentikFetch<T>(endpoint: string): Promise<T | null> {
  const { apiUrl, token } = getAuthentikConfig();
  
  if (!apiUrl || !token) {
    console.warn("[Authentik] API URL or token not configured");
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Authentik] API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("[Authentik] API request error:", error);
    return null;
  }
}

/**
 * Fetch all groups from Authentik with pagination
 */
export async function fetchAuthentikGroups(): Promise<AuthentikGroup[]> {
  const allGroups: AuthentikGroup[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await authentikFetch<AuthentikPaginatedResponse<AuthentikGroup>>(
      `/core/groups/?page=${page}&page_size=100`
    );

    if (!response) {
      break;
    }

    allGroups.push(...response.results);
    hasMore = response.pagination.current < response.pagination.total_pages;
    page++;
  }

  console.log(`[Authentik] Fetched ${allGroups.length} groups`);
  return allGroups;
}

/**
 * Fetch all users from Authentik with pagination
 */
export async function fetchAuthentikUsers(): Promise<AuthentikUser[]> {
  const allUsers: AuthentikUser[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await authentikFetch<AuthentikPaginatedResponse<AuthentikUser>>(
      `/core/users/?page=${page}&page_size=100`
    );

    if (!response) {
      break;
    }

    allUsers.push(...response.results);
    hasMore = response.pagination.current < response.pagination.total_pages;
    page++;
  }

  console.log(`[Authentik] Fetched ${allUsers.length} users`);
  return allUsers;
}

/**
 * Synchronize groups from Authentik to local database
 */
export async function syncGroupsFromAuthentik(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, details: [] };
  
  const authentikGroups = await fetchAuthentikGroups();
  if (authentikGroups.length === 0) {
    result.details.push("No groups fetched from Authentik");
    return result;
  }

  const localGroups = await db.getAllGroups();
  const localGroupMap = new Map(localGroups.map(g => [g.name, g]));

  for (const group of authentikGroups) {
    try {
      const existingGroup = localGroupMap.get(group.name);
      
      if (!existingGroup) {
        // Create new group
        await db.createGroup({
          name: group.name,
          description: `Synced from Authentik (ID: ${group.pk})`,
          color: group.is_superuser ? "#EF4444" : "#3B82F6",
        });
        result.created++;
        result.details.push(`Created group: ${group.name}`);
      } else {
        // Update existing group description if needed
        const expectedDesc = `Synced from Authentik (ID: ${group.pk})`;
        if (existingGroup.description !== expectedDesc) {
          await db.updateGroup(existingGroup.id, { description: expectedDesc });
          result.updated++;
          result.details.push(`Updated group: ${group.name}`);
        }
      }
      result.synced++;
    } catch (error) {
      console.error(`[Authentik] Error syncing group ${group.name}:`, error);
      result.errors++;
      result.details.push(`Error syncing group ${group.name}: ${error}`);
    }
  }

  console.log(`[Authentik] Groups sync complete: ${result.created} created, ${result.updated} updated, ${result.errors} errors`);
  return result;
}

/**
 * Synchronize users from Authentik to local database
 */
export async function syncUsersFromAuthentik(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, details: [] };
  
  const authentikUsers = await fetchAuthentikUsers();
  if (authentikUsers.length === 0) {
    result.details.push("No users fetched from Authentik");
    return result;
  }

  for (const user of authentikUsers) {
    if (!user.is_active) {
      result.details.push(`Skipped inactive user: ${user.username}`);
      continue;
    }

    try {
      const openId = `authentik:${user.pk}`;
      const existingUser = await db.getUserByOpenId(openId);
      
      if (!existingUser) {
        // Create new user
        await db.upsertUser({
          openId: openId,
          name: user.name || user.username,
          email: user.email || null,
          avatar: user.avatar || null,
          loginMethod: "authentik",
          role: user.is_superuser ? "admin" : "user",
          lastSignedIn: new Date(),
        });
        result.created++;
        result.details.push(`Created user: ${user.username}`);
      } else {
        // Update existing user
        await db.upsertUser({
          openId: openId,
          name: user.name || user.username,
          email: user.email || null,
          avatar: user.avatar || null,
          loginMethod: "authentik",
          role: user.is_superuser ? "admin" : existingUser.role,
          lastSignedIn: existingUser.lastSignedIn,
        });
        result.updated++;
      }
      result.synced++;
    } catch (error) {
      console.error(`[Authentik] Error syncing user ${user.username}:`, error);
      result.errors++;
      result.details.push(`Error syncing user ${user.username}: ${error}`);
    }
  }

  console.log(`[Authentik] Users sync complete: ${result.created} created, ${result.updated} updated, ${result.errors} errors`);
  return result;
}

/**
 * Synchronize user group memberships from Authentik
 */
export async function syncUserGroupMemberships(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, updated: 0, errors: 0, details: [] };
  
  const authentikUsers = await fetchAuthentikUsers();
  const localGroups = await db.getAllGroups();
  const groupNameToId = new Map(localGroups.map(g => [g.name, g.id]));

  for (const user of authentikUsers) {
    if (!user.is_active || !user.groups_obj) continue;

    try {
      const openId = `authentik:${user.pk}`;
      const localUser = await db.getUserByOpenId(openId);
      
      if (!localUser) {
        result.details.push(`User not found locally: ${user.username}`);
        continue;
      }

      // Get current memberships
      const currentMemberships = await db.getUserGroups(localUser.id);
      const currentGroupIds = new Set(currentMemberships.map(m => m.id));

      // Add user to Authentik groups
      for (const group of user.groups_obj) {
        const localGroupId = groupNameToId.get(group.name);
        if (localGroupId && !currentGroupIds.has(localGroupId)) {
          const role = group.is_superuser ? "admin" : "member";
          await db.addUserToGroup({ userId: localUser.id, groupId: localGroupId, role });
          result.created++;
          result.details.push(`Added ${user.username} to group ${group.name}`);
        }
      }

      result.synced++;
    } catch (error) {
      console.error(`[Authentik] Error syncing memberships for ${user.username}:`, error);
      result.errors++;
    }
  }

  console.log(`[Authentik] Memberships sync complete: ${result.created} added, ${result.errors} errors`);
  return result;
}

/**
 * Full synchronization: groups, users, and memberships
 */
export async function fullSyncFromAuthentik(): Promise<{
  groups: SyncResult;
  users: SyncResult;
  memberships: SyncResult;
}> {
  console.log("[Authentik] Starting full synchronization...");
  
  const groups = await syncGroupsFromAuthentik();
  const users = await syncUsersFromAuthentik();
  const memberships = await syncUserGroupMemberships();
  
  console.log("[Authentik] Full synchronization complete");
  
  return { groups, users, memberships };
}

/**
 * Check Authentik connection status
 */
export async function checkAuthentikConnection(): Promise<{
  connected: boolean;
  url: string;
  error?: string;
}> {
  const { apiUrl, token } = getAuthentikConfig();
  
  if (!apiUrl || !token) {
    return {
      connected: false,
      url: apiUrl || "Not configured",
      error: "API URL or token not configured",
    };
  }

  try {
    const response = await fetch(`${apiUrl}/core/users/me/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { connected: true, url: apiUrl };
    } else {
      return {
        connected: false,
        url: apiUrl,
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      connected: false,
      url: apiUrl,
      error: `Connection failed: ${error}`,
    };
  }
}

/**
 * Schedule periodic sync of users and groups from Authentik
 */
export async function testConnection(url: string, apiToken: string): Promise<{ connected: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/api/v3/core/users/?page_size=1`, {
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    
    if (response.ok) {
      return { connected: true };
    } else {
      const errorText = await response.text();
      return { connected: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function startAuthentikSyncSchedule(intervalMinutes: number = 60): NodeJS.Timeout {
  console.log(`[Authentik] Starting sync schedule every ${intervalMinutes} minutes`);

  // Initial sync after 10 seconds (allow server to fully start)
  setTimeout(async () => {
    try {
      await fullSyncFromAuthentik();
    } catch (err) {
      console.error("[Authentik] Initial sync failed:", err);
    }
  }, 10000);

  // Periodic sync
  return setInterval(async () => {
    try {
      await fullSyncFromAuthentik();
    } catch (error) {
      console.error("[Authentik] Scheduled sync failed:", error);
    }
  }, intervalMinutes * 60 * 1000);
}
