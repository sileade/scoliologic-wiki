/**
 * WebSocket Server Module
 * 
 * Provides real-time notifications for wiki page updates,
 * user presence, and collaborative editing features.
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

// Types
interface PagePresence {
  pageId: number;
  userId: number;
  userName: string;
  joinedAt: Date;
}

interface PageUpdate {
  pageId: number;
  userId: number;
  userName: string;
  action: "created" | "updated" | "deleted" | "moved";
  title?: string;
  timestamp: Date;
}

interface UserTyping {
  pageId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
}

// State
let io: Server | null = null;
const pagePresence = new Map<number, Map<number, PagePresence>>(); // pageId -> userId -> presence
const userSockets = new Map<number, Set<string>>(); // userId -> socketIds

/**
 * Initialize WebSocket server
 */
export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? process.env.WIKI_DOMAIN 
        : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/ws",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Handle authentication
    socket.on("authenticate", (data: { userId: number; userName: string }) => {
      handleAuthenticate(socket, data);
    });

    // Handle joining a page room
    socket.on("join:page", (data: { pageId: number }) => {
      handleJoinPage(socket, data);
    });

    // Handle leaving a page room
    socket.on("leave:page", (data: { pageId: number }) => {
      handleLeavePage(socket, data);
    });

    // Handle typing indicator
    socket.on("typing", (data: { pageId: number; isTyping: boolean }) => {
      handleTyping(socket, data);
    });

    // Handle cursor position (for collaborative editing)
    socket.on("cursor:move", (data: { pageId: number; position: { x: number; y: number } }) => {
      handleCursorMove(socket, data);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      handleDisconnect(socket);
    });
  });

  console.log("[WebSocket] Server initialized");
  return io;
}

/**
 * Get WebSocket server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Check if WebSocket is initialized
 */
export function isWebSocketInitialized(): boolean {
  return io !== null;
}

/**
 * Handle user authentication
 */
function handleAuthenticate(socket: Socket, data: { userId: number; userName: string }) {
  const { userId, userName } = data;
  
  // Store user data on socket
  socket.data.userId = userId;
  socket.data.userName = userName;
  
  // Track socket for user
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socket.id);
  
  // Join user-specific room for direct notifications
  socket.join(`user:${userId}`);
  
  socket.emit("authenticated", { success: true });
  console.log(`[WebSocket] User authenticated: ${userName} (${userId})`);
}

/**
 * Handle joining a page room
 */
function handleJoinPage(socket: Socket, data: { pageId: number }) {
  const { pageId } = data;
  const userId = socket.data.userId;
  const userName = socket.data.userName;
  
  if (!userId) {
    socket.emit("error", { message: "Not authenticated" });
    return;
  }
  
  // Join page room
  socket.join(`page:${pageId}`);
  
  // Track presence
  if (!pagePresence.has(pageId)) {
    pagePresence.set(pageId, new Map());
  }
  
  const presence: PagePresence = {
    pageId,
    userId,
    userName,
    joinedAt: new Date(),
  };
  
  pagePresence.get(pageId)!.set(userId, presence);
  
  // Notify others on the page
  socket.to(`page:${pageId}`).emit("user:joined", presence);
  
  // Send current presence list to the joining user
  const currentPresence = Array.from(pagePresence.get(pageId)!.values());
  socket.emit("presence:list", { pageId, users: currentPresence });
  
  console.log(`[WebSocket] User ${userName} joined page ${pageId}`);
}

/**
 * Handle leaving a page room
 */
function handleLeavePage(socket: Socket, data: { pageId: number }) {
  const { pageId } = data;
  const userId = socket.data.userId;
  const userName = socket.data.userName;
  
  if (!userId) return;
  
  // Leave page room
  socket.leave(`page:${pageId}`);
  
  // Remove from presence
  if (pagePresence.has(pageId)) {
    pagePresence.get(pageId)!.delete(userId);
    
    // Clean up empty page presence
    if (pagePresence.get(pageId)!.size === 0) {
      pagePresence.delete(pageId);
    }
  }
  
  // Notify others
  socket.to(`page:${pageId}`).emit("user:left", { pageId, userId, userName });
  
  console.log(`[WebSocket] User ${userName} left page ${pageId}`);
}

/**
 * Handle typing indicator
 */
function handleTyping(socket: Socket, data: { pageId: number; isTyping: boolean }) {
  const { pageId, isTyping } = data;
  const userId = socket.data.userId;
  const userName = socket.data.userName;
  
  if (!userId) return;
  
  const typingData: UserTyping = {
    pageId,
    userId,
    userName,
    isTyping,
  };
  
  socket.to(`page:${pageId}`).emit("user:typing", typingData);
}

/**
 * Handle cursor movement
 */
function handleCursorMove(socket: Socket, data: { pageId: number; position: { x: number; y: number } }) {
  const { pageId, position } = data;
  const userId = socket.data.userId;
  const userName = socket.data.userName;
  
  if (!userId) return;
  
  socket.to(`page:${pageId}`).emit("cursor:update", {
    pageId,
    userId,
    userName,
    position,
  });
}

/**
 * Handle socket disconnection
 */
function handleDisconnect(socket: Socket) {
  const userId = socket.data.userId;
  const userName = socket.data.userName;
  
  if (userId) {
    // Remove socket from user's socket set
    if (userSockets.has(userId)) {
      userSockets.get(userId)!.delete(socket.id);
      
      // If no more sockets for user, clean up presence
      if (userSockets.get(userId)!.size === 0) {
        userSockets.delete(userId);
        
        // Remove from all page presences
        pagePresence.forEach((presenceMap, pageId) => {
          if (presenceMap.has(userId)) {
            presenceMap.delete(userId);
            
            // Notify others on the page
            io?.to(`page:${pageId}`).emit("user:left", { pageId, userId, userName });
            
            // Clean up empty page presence
            if (presenceMap.size === 0) {
              pagePresence.delete(pageId);
            }
          }
        });
      }
    }
  }
  
  console.log(`[WebSocket] Client disconnected: ${socket.id}`);
}

// ============================================
// Public API for broadcasting from server
// ============================================

/**
 * Broadcast page update to all users viewing the page
 */
export function broadcastPageUpdate(update: PageUpdate): void {
  if (!io) return;
  
  io.to(`page:${update.pageId}`).emit("page:updated", update);
  console.log(`[WebSocket] Broadcast page update: ${update.action} on page ${update.pageId}`);
}

/**
 * Broadcast page creation to all connected users
 */
export function broadcastPageCreated(data: {
  pageId: number;
  title: string;
  parentId?: number;
  userId: number;
  userName: string;
}): void {
  if (!io) return;
  
  io.emit("page:created", {
    ...data,
    timestamp: new Date(),
  });
}

/**
 * Broadcast page deletion to all connected users
 */
export function broadcastPageDeleted(data: {
  pageId: number;
  title: string;
  userId: number;
  userName: string;
}): void {
  if (!io) return;
  
  io.emit("page:deleted", {
    ...data,
    timestamp: new Date(),
  });
}

/**
 * Send notification to specific user
 */
export function notifyUser(userId: number, event: string, data: unknown): void {
  if (!io) return;
  
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Get users currently viewing a page
 */
export function getPageViewers(pageId: number): PagePresence[] {
  if (!pagePresence.has(pageId)) return [];
  return Array.from(pagePresence.get(pageId)!.values());
}

/**
 * Get count of online users
 */
export function getOnlineUsersCount(): number {
  return userSockets.size;
}

/**
 * Broadcast to all connected users
 */
export function broadcastToAll(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}


/**
 * Send notification to a specific user
 */
export function sendNotificationToUser(userId: number, notification: {
  id: number;
  type: string;
  title: string;
  message?: string;
  pageId?: number;
  actorName?: string;
  createdAt: Date;
}): void {
  if (!io) return;
  
  const socketIds = userSockets.get(userId);
  if (!socketIds || socketIds.size === 0) return;
  
  // Send to all sockets of this user
  for (const socketId of Array.from(socketIds)) {
    io.to(socketId).emit("notification", notification);
  }
}

/**
 * Send notification to multiple users
 */
export function sendNotificationToUsers(userIds: number[], notification: {
  id: number;
  type: string;
  title: string;
  message?: string;
  pageId?: number;
  actorName?: string;
  createdAt: Date;
}): void {
  for (const userId of userIds) {
    sendNotificationToUser(userId, notification);
  }
}
