/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling across the application.
 */

import { TRPCError } from "@trpc/server";

/**
 * Standard error codes with messages
 */
export const ErrorCodes = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a standardized TRPC error
 */
export function createError(
  code: ErrorCode,
  message: string,
  cause?: unknown
): TRPCError {
  return new TRPCError({
    code: code as any,
    message,
    cause,
  });
}

/**
 * Common error creators
 */
export const Errors = {
  notFound: (entity: string, id?: number | string) =>
    createError(
      ErrorCodes.NOT_FOUND,
      id ? `${entity} with ID ${id} not found` : `${entity} not found`
    ),

  forbidden: (action?: string) =>
    createError(
      ErrorCodes.FORBIDDEN,
      action ? `You don't have permission to ${action}` : "Access denied"
    ),

  unauthorized: () =>
    createError(ErrorCodes.UNAUTHORIZED, "Authentication required"),

  badRequest: (message: string) =>
    createError(ErrorCodes.BAD_REQUEST, message),

  conflict: (message: string) =>
    createError(ErrorCodes.CONFLICT, message),

  internal: (message?: string) =>
    createError(
      ErrorCodes.INTERNAL_ERROR,
      message || "An unexpected error occurred"
    ),

  rateLimited: () =>
    createError(ErrorCodes.RATE_LIMITED, "Too many requests. Please try again later."),
};

/**
 * Safe error wrapper for async operations
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("[SafeAsync Error]", error);
    if (error instanceof TRPCError) {
      throw error;
    }
    throw Errors.internal(errorMessage);
  }
}

/**
 * Log error with context
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error:`, {
    message: errorMessage,
    stack: errorStack,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Extract user-friendly message from error
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof TRPCError) {
    return error.message;
  }
  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (error.message.includes("ECONNREFUSED")) {
      return "Service temporarily unavailable. Please try again later.";
    }
    if (error.message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }
  }
  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if error is a specific type
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof TRPCError && error.code === code;
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors
      if (error instanceof TRPCError) {
        const code = error.code;
        if (["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(code)) {
          throw error;
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter(
    field => data[field] === undefined || data[field] === null || data[field] === ""
  );

  if (missing.length > 0) {
    throw Errors.badRequest(`Missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  message: string,
  code: ErrorCode = ErrorCodes.BAD_REQUEST
): asserts condition {
  if (!condition) {
    throw createError(code, message);
  }
}
