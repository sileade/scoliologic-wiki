import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAuthentikOAuthRoutes } from "../authentikOAuth";
import { startAuthentikSyncSchedule } from "../authentik";
import { initMonitoring } from "../monitoring";
import { ENV } from "./env";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { generalLimiter, aiLimiter, authLimiter, searchLimiter } from "../middleware/rateLimit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Rate limiting
  app.use("/api/trpc", generalLimiter);
  app.use("/api/trpc/ai", aiLimiter);
  app.use("/api/trpc/pages.search", searchLimiter);
  app.use("/api/oauth", authLimiter);
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Authentik OAuth2/OIDC routes
  registerAuthentikOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start Authentik sync schedule if enabled
    if (ENV.authentikEnabled) {
      const syncIntervalMinutes = parseInt(process.env.AUTHENTIK_SYNC_INTERVAL || "60");
      startAuthentikSyncSchedule(syncIntervalMinutes);
      console.log(`[Authentik] Auto-sync enabled (every ${syncIntervalMinutes} minutes)`);
    }
    
    // Initialize monitoring system
    initMonitoring().catch(err => {
      console.error("[Monitoring] Failed to initialize:", err);
    });
  });
}

startServer().catch(console.error);
