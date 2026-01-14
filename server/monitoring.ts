import * as db from "./db";
import * as ollama from "./ollama";
import { notifyOwner } from "./_core/notification";

// Monitoring state
interface MonitoringState {
  ollamaHealthy: boolean;
  lastOllamaCheck: number;
  ollamaFailureCount: number;
  lastNotificationSent: number;
  errors: ErrorLog[];
  metrics: PerformanceMetrics;
}

interface ErrorLog {
  timestamp: number;
  source: string;
  message: string;
  stack?: string;
  resolved: boolean;
  autoFixAttempted: boolean;
  autoFixSuccess: boolean;
}

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  ollamaResponseTimes: number[];
  dbResponseTimes: number[];
}

// Global monitoring state
let monitoringState: MonitoringState = {
  ollamaHealthy: true,
  lastOllamaCheck: 0,
  ollamaFailureCount: 0,
  lastNotificationSent: 0,
  errors: [],
  metrics: {
    requestCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
    ollamaResponseTimes: [],
    dbResponseTimes: [],
  },
};

// Health check interval handle
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Initialize monitoring system
 */
export async function initMonitoring(): Promise<void> {
  console.log("[Monitoring] Initializing monitoring system...");
  
  // Load settings from database
  const settings = await db.getOllamaSettings();
  const checkInterval = (settings?.healthCheckInterval ?? 60) * 1000;
  
  // Start periodic health checks
  startHealthChecks(checkInterval);
  
  console.log(`[Monitoring] Started with ${checkInterval / 1000}s interval`);
}

/**
 * Start periodic health checks
 */
export function startHealthChecks(intervalMs: number): void {
  // Clear existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Run initial check
  performHealthCheck();
  
  // Schedule periodic checks
  healthCheckInterval = setInterval(performHealthCheck, intervalMs);
}

/**
 * Stop health checks
 */
export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Perform health check on all services
 */
export async function performHealthCheck(): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Check Ollama health
    const settings = await db.getOllamaSettings();
    const ollamaUrl = settings?.url ?? "http://localhost:11434";
    
    const ollamaHealth = await ollama.getHealthStatus(ollamaUrl);
    const wasHealthy = monitoringState.ollamaHealthy;
    monitoringState.ollamaHealthy = ollamaHealth.connected;
    monitoringState.lastOllamaCheck = Date.now();
    
    if (ollamaHealth.responseTime) {
      monitoringState.metrics.ollamaResponseTimes.push(ollamaHealth.responseTime);
      // Keep only last 100 measurements
      if (monitoringState.metrics.ollamaResponseTimes.length > 100) {
        monitoringState.metrics.ollamaResponseTimes.shift();
      }
    }
    
    // Handle Ollama failure
    if (!ollamaHealth.connected) {
      monitoringState.ollamaFailureCount++;
      
      // Log error
      logError({
        source: "ollama",
        message: `Ollama health check failed: ${ollamaHealth.error || "Unknown error"}`,
        resolved: false,
        autoFixAttempted: false,
        autoFixSuccess: false,
      });
      
      // Attempt auto-fix if multiple failures
      if (monitoringState.ollamaFailureCount >= 3) {
        await attemptAutoFix("ollama");
      }
      
      // Send notification if configured
      if (settings?.notifyOnFailure && wasHealthy) {
        await sendFailureNotification("Ollama", ollamaHealth.error || "Service unavailable");
      }
    } else {
      // Reset failure count on success
      if (monitoringState.ollamaFailureCount > 0) {
        console.log("[Monitoring] Ollama recovered after", monitoringState.ollamaFailureCount, "failures");
        
        // Mark related errors as resolved
        monitoringState.errors
          .filter(e => e.source === "ollama" && !e.resolved)
          .forEach(e => e.resolved = true);
      }
      monitoringState.ollamaFailureCount = 0;
    }
    
    const checkDuration = Date.now() - startTime;
    console.log(`[Monitoring] Health check completed in ${checkDuration}ms - Ollama: ${ollamaHealth.connected ? "OK" : "FAIL"}`);
    
  } catch (error) {
    console.error("[Monitoring] Health check error:", error);
    logError({
      source: "monitoring",
      message: `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      stack: error instanceof Error ? error.stack : undefined,
      resolved: false,
      autoFixAttempted: false,
      autoFixSuccess: false,
    });
  }
}

/**
 * Log an error to the monitoring system
 */
export function logError(error: Omit<ErrorLog, "timestamp">): void {
  const errorLog: ErrorLog = {
    ...error,
    timestamp: Date.now(),
  };
  
  monitoringState.errors.push(errorLog);
  
  // Keep only last 1000 errors
  if (monitoringState.errors.length > 1000) {
    monitoringState.errors.shift();
  }
  
  // Update error rate
  const recentErrors = monitoringState.errors.filter(
    e => e.timestamp > Date.now() - 3600000 // Last hour
  );
  monitoringState.metrics.errorRate = recentErrors.length;
}

/**
 * Attempt automatic fix for known issues
 */
async function attemptAutoFix(service: string): Promise<boolean> {
  console.log(`[Monitoring] Attempting auto-fix for ${service}...`);
  
  const error = monitoringState.errors.find(
    e => e.source === service && !e.resolved && !e.autoFixAttempted
  );
  
  if (error) {
    error.autoFixAttempted = true;
  }
  
  switch (service) {
    case "ollama":
      // For Ollama, we can try switching to fallback text search
      // This is handled automatically by the search system
      console.log("[Monitoring] Ollama auto-fix: Fallback to text search enabled");
      if (error) {
        error.autoFixSuccess = true;
      }
      return true;
      
    default:
      console.log(`[Monitoring] No auto-fix available for ${service}`);
      return false;
  }
}

/**
 * Send failure notification to admin
 */
async function sendFailureNotification(service: string, error: string): Promise<void> {
  // Rate limit notifications (max 1 per 5 minutes)
  const now = Date.now();
  if (now - monitoringState.lastNotificationSent < 300000) {
    console.log("[Monitoring] Notification rate limited");
    return;
  }
  
  try {
    await notifyOwner({
      title: `⚠️ ${service} Service Alert`,
      content: `The ${service} service is experiencing issues:\n\n${error}\n\nThe system has automatically switched to fallback mode. Please check the service status.`,
    });
    
    monitoringState.lastNotificationSent = now;
    console.log(`[Monitoring] Notification sent for ${service} failure`);
  } catch (notifyError) {
    console.error("[Monitoring] Failed to send notification:", notifyError);
  }
}

/**
 * Record a request metric
 */
export function recordRequest(responseTimeMs: number, isError: boolean = false): void {
  monitoringState.metrics.requestCount++;
  
  // Update average response time (exponential moving average)
  const alpha = 0.1;
  monitoringState.metrics.averageResponseTime = 
    alpha * responseTimeMs + (1 - alpha) * monitoringState.metrics.averageResponseTime;
  
  if (isError) {
    monitoringState.metrics.errorRate++;
  }
}

/**
 * Get current monitoring status
 */
export function getMonitoringStatus(): {
  ollamaHealthy: boolean;
  lastOllamaCheck: number;
  ollamaFailureCount: number;
  recentErrors: ErrorLog[];
  metrics: PerformanceMetrics;
} {
  return {
    ollamaHealthy: monitoringState.ollamaHealthy,
    lastOllamaCheck: monitoringState.lastOllamaCheck,
    ollamaFailureCount: monitoringState.ollamaFailureCount,
    recentErrors: monitoringState.errors.slice(-20),
    metrics: {
      ...monitoringState.metrics,
      ollamaResponseTimes: monitoringState.metrics.ollamaResponseTimes.slice(-10),
      dbResponseTimes: monitoringState.metrics.dbResponseTimes.slice(-10),
    },
  };
}

/**
 * Get average Ollama response time
 */
export function getAverageOllamaResponseTime(): number {
  const times = monitoringState.metrics.ollamaResponseTimes;
  if (times.length === 0) return 0;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

/**
 * Check if Ollama is currently healthy
 */
export function isOllamaHealthy(): boolean {
  return monitoringState.ollamaHealthy;
}

/**
 * Get error statistics
 */
export function getErrorStats(): {
  total: number;
  resolved: number;
  autoFixed: number;
  bySource: Record<string, number>;
} {
  const errors = monitoringState.errors;
  const bySource: Record<string, number> = {};
  
  errors.forEach(e => {
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  });
  
  return {
    total: errors.length,
    resolved: errors.filter(e => e.resolved).length,
    autoFixed: errors.filter(e => e.autoFixSuccess).length,
    bySource,
  };
}
