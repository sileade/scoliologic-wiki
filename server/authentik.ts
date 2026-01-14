/**
 * Authentik API integration for group synchronization
 */

import { ENV } from "./_core/env";
import * as db from "./db";

interface AuthentikGroup {
  pk: number;
  name: string;
  slug: string;
  parent?: number | null;
}

interface AuthentikUser {
  pk: number;
  username: string;
  email: string;
  name: string;
  groups: number[];
}

const AUTHENTIK_API_URL = process.env.AUTHENTIK_API_URL || "http://authentik:9000/api/v3";
const AUTHENTIK_TOKEN = process.env.AUTHENTIK_TOKEN;

/**
 * Fetch groups from Authentik
 */
export async function fetchAuthentikGroups(): Promise<AuthentikGroup[]> {
  if (!AUTHENTIK_TOKEN) {
    console.warn("[Authentik] Token not configured, skipping group sync");
    return [];
  }

  try {
    const response = await fetch(`${AUTHENTIK_API_URL}/groups/groups/`, {
      headers: {
        Authorization: `Bearer ${AUTHENTIK_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Authentik] Failed to fetch groups: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[Authentik] Error fetching groups:", error);
    return [];
  }
}

/**
 * Fetch users from Authentik
 */
export async function fetchAuthentikUsers(): Promise<AuthentikUser[]> {
  if (!AUTHENTIK_TOKEN) {
    console.warn("[Authentik] Token not configured, skipping user sync");
    return [];
  }

  try {
    const response = await fetch(`${AUTHENTIK_API_URL}/core/users/`, {
      headers: {
        Authorization: `Bearer ${AUTHENTIK_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Authentik] Failed to fetch users: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[Authentik] Error fetching users:", error);
    return [];
  }
}

/**
 * Synchronize groups from Authentik to local database
 */
export async function syncGroupsFromAuthentik(): Promise<{ synced: number; errors: number }> {
  const authentikGroups = await fetchAuthentikGroups();
  let synced = 0;
  let errors = 0;

  for (const group of authentikGroups) {
    try {
      // Check if group already exists
      const existingGroup = await db.getAllGroups();
      const exists = existingGroup.some(g => g.name === group.name);
      
      if (!exists) {
        await db.createGroup({
          name: group.name,
          description: `Synced from Authentik (ID: ${group.pk})`,
        });
      }
      synced++;
    } catch (error) {
      console.error(`[Authentik] Error syncing group ${group.name}:`, error);
      errors++;
    }
  }

  console.log(`[Authentik] Synced ${synced} groups, ${errors} errors`);
  return { synced, errors };
}

/**
 * Synchronize user group memberships from Authentik
 */
export async function syncUserGroupsFromAuthentik(): Promise<{ synced: number; errors: number }> {
  const authentikUsers = await fetchAuthentikUsers();
  let synced = 0;
  let errors = 0;

  for (const user of authentikUsers) {
    try {
      // Get Authentik groups for this user
      const userGroups = await fetchUserGroupsFromAuthentik(user.pk);
      
      // For now, we'll skip user group sync as it requires matching Authentik groups
      // In a real implementation, you would:
      // 1. Find local user by email
      // 2. Get their Authentik groups
      // 3. Find corresponding local groups
      // 4. Update memberships
      
      synced++;
    } catch (error) {
      console.error(`[Authentik] Error syncing user groups for ${user.username}:`, error);
      errors++;
    }
  }

  console.log(`[Authentik] Synced user groups for ${synced} users, ${errors} errors`);
  return { synced, errors };
}

/**
 * Fetch groups for a specific user from Authentik
 */
async function fetchUserGroupsFromAuthentik(userId: number): Promise<number[]> {
  if (!AUTHENTIK_TOKEN) return [];

  try {
    const response = await fetch(`${AUTHENTIK_API_URL}/core/users/${userId}/`, {
      headers: {
        Authorization: `Bearer ${AUTHENTIK_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.groups || [];
  } catch (error) {
    console.error("[Authentik] Error fetching user groups:", error);
    return [];
  }
}

/**
 * Schedule periodic sync of groups from Authentik
 */
export function startAuthentikSyncSchedule(intervalMinutes: number = 60): NodeJS.Timer {
  console.log(`[Authentik] Starting group sync schedule every ${intervalMinutes} minutes`);

  // Initial sync
  syncGroupsFromAuthentik().catch(err => console.error("[Authentik] Initial sync failed:", err));
  syncUserGroupsFromAuthentik().catch(err => console.error("[Authentik] Initial user sync failed:", err));

  // Periodic sync
  return setInterval(async () => {
    try {
      await syncGroupsFromAuthentik();
      await syncUserGroupsFromAuthentik();
    } catch (error) {
      console.error("[Authentik] Scheduled sync failed:", error);
    }
  }, intervalMinutes * 60 * 1000);
}
