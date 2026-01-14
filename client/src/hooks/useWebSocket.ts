/**
 * WebSocket Hook
 * 
 * Provides real-time connection for wiki page updates and presence.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";

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

interface CursorPosition {
  pageId: number;
  userId: number;
  userName: string;
  position: { x: number; y: number };
}

interface UseWebSocketReturn {
  isConnected: boolean;
  presence: PagePresence[];
  typingUsers: UserTyping[];
  cursors: Map<number, CursorPosition>;
  joinPage: (pageId: number) => void;
  leavePage: (pageId: number) => void;
  setTyping: (pageId: number, isTyping: boolean) => void;
  updateCursor: (pageId: number, position: { x: number; y: number }) => void;
  onPageUpdate: (callback: (update: PageUpdate) => void) => void;
  onPageCreated: (callback: (data: { pageId: number; title: string }) => void) => void;
  onPageDeleted: (callback: (data: { pageId: number; title: string }) => void) => void;
}

// Singleton socket instance
let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

/**
 * Get or create socket connection
 */
function getSocket(): Promise<Socket> {
  if (socket?.connected) {
    return Promise.resolve(socket);
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    const wsUrl = window.location.origin;
    
    socket = io(wsUrl, {
      path: "/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      connectionPromise = null;
      resolve(socket!);
    });

    socket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error);
      connectionPromise = null;
      reject(error);
    });

    socket.on("disconnect", (reason) => {
      console.log("[WebSocket] Disconnected:", reason);
    });
  });

  return connectionPromise;
}

/**
 * WebSocket hook for real-time features
 */
export function useWebSocket(): UseWebSocketReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<PagePresence[]>([]);
  const [typingUsers, setTypingUsers] = useState<UserTyping[]>([]);
  const [cursors, setCursors] = useState<Map<number, CursorPosition>>(new Map());
  
  const pageUpdateCallbackRef = useRef<((update: PageUpdate) => void) | null>(null);
  const pageCreatedCallbackRef = useRef<((data: { pageId: number; title: string }) => void) | null>(null);
  const pageDeletedCallbackRef = useRef<((data: { pageId: number; title: string }) => void) | null>(null);
  const currentPageRef = useRef<number | null>(null);

  // Initialize connection
  useEffect(() => {
    if (!user) return;

    let mounted = true;

    getSocket()
      .then((s) => {
        if (!mounted) return;

        setIsConnected(s.connected);

        // Authenticate
        s.emit("authenticate", {
          userId: user.id,
          userName: user.name || user.email,
        });

        // Set up event listeners
        s.on("authenticated", () => {
          console.log("[WebSocket] Authenticated");
        });

        s.on("presence:list", (data: { pageId: number; users: PagePresence[] }) => {
          setPresence(data.users);
        });

        s.on("user:joined", (data: PagePresence) => {
          setPresence((prev) => [...prev.filter((p) => p.userId !== data.userId), data]);
        });

        s.on("user:left", (data: { pageId: number; userId: number }) => {
          setPresence((prev) => prev.filter((p) => p.userId !== data.userId));
        });

        s.on("user:typing", (data: UserTyping) => {
          setTypingUsers((prev) => {
            const filtered = prev.filter((t) => t.userId !== data.userId);
            if (data.isTyping) {
              return [...filtered, data];
            }
            return filtered;
          });
        });

        s.on("cursor:update", (data: CursorPosition) => {
          setCursors((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.userId, data);
            return newMap;
          });
        });

        s.on("page:updated", (update: PageUpdate) => {
          if (pageUpdateCallbackRef.current) {
            pageUpdateCallbackRef.current(update);
          }
        });

        s.on("page:created", (data: { pageId: number; title: string }) => {
          if (pageCreatedCallbackRef.current) {
            pageCreatedCallbackRef.current(data);
          }
        });

        s.on("page:deleted", (data: { pageId: number; title: string }) => {
          if (pageDeletedCallbackRef.current) {
            pageDeletedCallbackRef.current(data);
          }
        });

        s.on("connect", () => setIsConnected(true));
        s.on("disconnect", () => setIsConnected(false));
      })
      .catch((error) => {
        console.error("[WebSocket] Failed to connect:", error);
      });

    return () => {
      mounted = false;
      // Leave current page on unmount
      if (currentPageRef.current && socket) {
        socket.emit("leave:page", { pageId: currentPageRef.current });
      }
    };
  }, [user]);

  // Join page room
  const joinPage = useCallback((pageId: number) => {
    if (!socket?.connected) return;

    // Leave previous page
    if (currentPageRef.current && currentPageRef.current !== pageId) {
      socket.emit("leave:page", { pageId: currentPageRef.current });
    }

    currentPageRef.current = pageId;
    socket.emit("join:page", { pageId });
  }, []);

  // Leave page room
  const leavePage = useCallback((pageId: number) => {
    if (!socket?.connected) return;

    socket.emit("leave:page", { pageId });
    if (currentPageRef.current === pageId) {
      currentPageRef.current = null;
    }
    setPresence([]);
    setTypingUsers([]);
    setCursors(new Map());
  }, []);

  // Set typing indicator
  const setTyping = useCallback((pageId: number, isTyping: boolean) => {
    if (!socket?.connected) return;
    socket.emit("typing", { pageId, isTyping });
  }, []);

  // Update cursor position
  const updateCursor = useCallback((pageId: number, position: { x: number; y: number }) => {
    if (!socket?.connected) return;
    socket.emit("cursor:move", { pageId, position });
  }, []);

  // Register page update callback
  const onPageUpdate = useCallback((callback: (update: PageUpdate) => void) => {
    pageUpdateCallbackRef.current = callback;
  }, []);

  // Register page created callback
  const onPageCreated = useCallback((callback: (data: { pageId: number; title: string }) => void) => {
    pageCreatedCallbackRef.current = callback;
  }, []);

  // Register page deleted callback
  const onPageDeleted = useCallback((callback: (data: { pageId: number; title: string }) => void) => {
    pageDeletedCallbackRef.current = callback;
  }, []);

  return {
    isConnected,
    presence,
    typingUsers,
    cursors,
    joinPage,
    leavePage,
    setTyping,
    updateCursor,
    onPageUpdate,
    onPageCreated,
    onPageDeleted,
  };
}

/**
 * Hook for displaying presence indicators
 */
export function usePagePresence(pageId: number | null) {
  const { joinPage, leavePage, presence, typingUsers } = useWebSocket();

  useEffect(() => {
    if (pageId) {
      joinPage(pageId);
      return () => leavePage(pageId);
    }
  }, [pageId, joinPage, leavePage]);

  return {
    viewers: presence,
    typingUsers: typingUsers.filter((t) => t.pageId === pageId),
  };
}
