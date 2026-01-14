/**
 * Authentik OAuth2/OIDC integration for authentication
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

interface AuthentikTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

interface AuthentikUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  picture?: string;
}

/**
 * Generate Authentik OAuth2 authorization URL
 */
export function getAuthentikAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.authentikClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email groups",
    state: state,
  });
  
  return `${ENV.authentikUrl}/application/o/authorize/?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForToken(code: string, redirectUri: string): Promise<AuthentikTokenResponse> {
  const response = await fetch(`${ENV.authentikUrl}/application/o/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ENV.authentikClientId,
      client_secret: ENV.authentikClientSecret,
      code: code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Authentik OAuth] Token exchange failed:", error);
    throw new Error("Failed to exchange code for token");
  }

  return response.json();
}

/**
 * Get user info from Authentik
 */
async function getUserInfo(accessToken: string): Promise<AuthentikUserInfo> {
  const response = await fetch(`${ENV.authentikUrl}/application/o/userinfo/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Authentik OAuth] User info fetch failed:", error);
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}

/**
 * Sync user groups from Authentik to local database
 */
async function syncUserGroups(userId: number, authentikGroups: string[]): Promise<void> {
  if (!authentikGroups || authentikGroups.length === 0) return;

  // Get all local groups
  const localGroups = await db.getAllGroups();
  
  // Get current user group memberships
  const currentMemberships = await db.getUserGroups(userId);
  const currentGroupIds = new Set(currentMemberships.map(m => m.id));

  for (const groupName of authentikGroups) {
    // Find or create local group
    let localGroup = localGroups.find(g => g.name === groupName);
    
    if (!localGroup) {
      // Create group if it doesn't exist
      const groupId = await db.createGroup({
        name: groupName,
        description: `Synced from Authentik`,
      });
      localGroup = { id: groupId, name: groupName, description: `Synced from Authentik`, color: "#3B82F6", createdAt: new Date(), updatedAt: new Date(), createdById: null };
      console.log(`[Authentik OAuth] Created group: ${groupName}`);
    }

    // Add user to group if not already a member
    if (localGroup && !currentGroupIds.has(localGroup.id)) {
      await db.addUserToGroup({ userId, groupId: localGroup.id, role: "member" });
      console.log(`[Authentik OAuth] Added user ${userId} to group ${groupName}`);
    }
  }
}

/**
 * Register Authentik OAuth routes
 */
export function registerAuthentikOAuthRoutes(app: Express) {
  // Only register if Authentik is enabled
  if (!ENV.authentikEnabled) {
    console.log("[Authentik OAuth] Disabled, skipping route registration");
    return;
  }

  if (!ENV.authentikUrl || !ENV.authentikClientId || !ENV.authentikClientSecret) {
    console.warn("[Authentik OAuth] Missing configuration, skipping route registration");
    return;
  }

  console.log("[Authentik OAuth] Registering routes");

  // Initiate Authentik OAuth flow
  app.get("/api/auth/authentik", (req: Request, res: Response) => {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/authentik/callback`;
    const state = Buffer.from(JSON.stringify({ 
      timestamp: Date.now(),
      returnUrl: req.query.returnUrl || "/"
    })).toString("base64");
    
    const authUrl = getAuthentikAuthUrl(redirectUri, state);
    res.redirect(authUrl);
  });

  // Authentik OAuth callback
  app.get("/api/auth/authentik/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      console.error("[Authentik OAuth] Authorization error:", error);
      res.redirect(`/?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/authentik/callback`;
      
      // Exchange code for token
      const tokenResponse = await exchangeCodeForToken(code, redirectUri);
      
      // Get user info
      const userInfo = await getUserInfo(tokenResponse.access_token);

      if (!userInfo.sub) {
        res.status(400).json({ error: "User ID (sub) missing from user info" });
        return;
      }

      // Create unique openId for Authentik users
      const openId = `authentik:${userInfo.sub}`;

      // Upsert user in database
      await db.upsertUser({
        openId: openId,
        name: userInfo.name || userInfo.preferred_username || null,
        email: userInfo.email ?? null,
        avatar: userInfo.picture ?? null,
        loginMethod: "authentik",
        lastSignedIn: new Date(),
      });

      // Get user from database
      const user = await db.getUserByOpenId(openId);
      
      if (user && userInfo.groups) {
        // Sync user groups from Authentik
        await syncUserGroups(user.id, userInfo.groups);
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: userInfo.name || userInfo.preferred_username || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Parse return URL from state
      let returnUrl = "/";
      try {
        if (state) {
          const stateData = JSON.parse(Buffer.from(state, "base64").toString());
          returnUrl = stateData.returnUrl || "/";
        }
      } catch {
        // Ignore state parsing errors
      }

      // Log activity
      if (user) {
        await db.logActivity({
          userId: user.id,
          action: "login",
          entityType: "user",
          entityId: user.id,
          details: { method: "authentik", email: userInfo.email },
        });
      }

      res.redirect(302, returnUrl);
    } catch (error) {
      console.error("[Authentik OAuth] Callback failed:", error);
      res.redirect(`/?error=${encodeURIComponent("Authentication failed")}`);
    }
  });

  console.log("[Authentik OAuth] Routes registered successfully");
}
