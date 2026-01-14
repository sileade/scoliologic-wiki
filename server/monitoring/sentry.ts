/**
 * Sentry Monitoring Module
 * 
 * Provides error tracking and performance monitoring for production.
 * Falls back gracefully when Sentry DSN is not configured.
 */

import * as Sentry from "@sentry/node";
import type { Express, Request, Response, NextFunction } from "express";

let isInitialized = false;

/**
 * Initialize Sentry for error tracking
 */
export function initSentry(app?: Express): boolean {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";

  if (!dsn) {
    console.log("[Sentry] No SENTRY_DSN configured, monitoring disabled");
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: environment === "production" ? 0.1 : 1.0,
      profilesSampleRate: environment === "production" ? 0.1 : 1.0,
      integrations: [
        // HTTP integration for tracking requests
        Sentry.httpIntegration(),
        // Express integration
        ...(app ? [Sentry.expressIntegration()] : []),
      ],
      // Filter sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
          delete event.request.headers["x-api-key"];
        }
        // Remove sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
            if (breadcrumb.data?.password) {
              breadcrumb.data.password = "[REDACTED]";
            }
            return breadcrumb;
          });
        }
        return event;
      },
      // Ignore certain errors
      ignoreErrors: [
        // Network errors
        "Network request failed",
        "Failed to fetch",
        // User-caused errors
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        // Rate limiting
        "TOO_MANY_REQUESTS",
      ],
    });

    isInitialized = true;
    console.log(`[Sentry] Initialized for ${environment} environment`);
    return true;
  } catch (error) {
    console.error("[Sentry] Initialization error:", error);
    return false;
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) {
    console.error("[Error]", error);
    return undefined;
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) {
    console.log(`[${level.toUpperCase()}]`, message);
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string | number;
  email?: string;
  username?: string;
  role?: string;
} | null): void {
  if (!isInitialized) return;

  if (user) {
    Sentry.setUser({
      id: String(user.id),
      email: user.email,
      username: user.username,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info"
): void {
  if (!isInitialized) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Span | undefined {
  if (!isInitialized) return undefined;

  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

/**
 * Express error handler middleware
 */
export function sentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

/**
 * Express request handler middleware (should be first middleware)
 */
export function sentryRequestHandler() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isInitialized) {
      return next();
    }
    
    // Set transaction name based on route
    const transaction = Sentry.startInactiveSpan({
      name: `${req.method} ${req.path}`,
      op: "http.server",
    });
    
    res.on("finish", () => {
      if (transaction) {
        transaction.end();
      }
    });
    
    next();
  };
}

/**
 * Wrap async handler with error capture
 */
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      captureException(error);
      throw error;
    }
  }) as T;
}

/**
 * Create a scoped context for grouping errors
 */
export function withScope<T>(
  callback: (scope: Sentry.Scope) => T
): T {
  if (!isInitialized) {
    return callback({} as Sentry.Scope);
  }
  
  return Sentry.withScope(callback);
}

/**
 * Flush pending events before shutdown
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isInitialized) return true;

  try {
    return await Sentry.flush(timeout);
  } catch (error) {
    console.error("[Sentry] Flush error:", error);
    return false;
  }
}

/**
 * Close Sentry client
 */
export async function closeSentry(): Promise<void> {
  if (!isInitialized) return;

  try {
    await Sentry.close(2000);
    isInitialized = false;
    console.log("[Sentry] Client closed");
  } catch (error) {
    console.error("[Sentry] Close error:", error);
  }
}

// Export Sentry for direct access if needed
export { Sentry };
