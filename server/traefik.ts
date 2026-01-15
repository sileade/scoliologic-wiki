/**
 * Traefik API Integration Module
 * Provides functions for managing Traefik routers and services
 */

import * as db from "./db";

interface TraefikRouter {
  name: string;
  provider: string;
  status: string;
  rule: string;
  service: string;
  entryPoints: string[];
  tls?: { certResolver?: string };
  middlewares?: string[];
}

interface TraefikService {
  name: string;
  provider: string;
  status: string;
  type: string;
  serverStatus?: Record<string, string>;
  loadBalancer?: {
    servers?: Array<{ url: string }>;
    passHostHeader?: boolean;
  };
}

interface TraefikConfig {
  apiUrl: string;
  apiUser?: string;
  apiPassword?: string;
  timeout?: number;
}

/**
 * Get authentication headers for Traefik API
 */
function getAuthHeaders(config: TraefikConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (config.apiUser && config.apiPassword) {
    const auth = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  return headers;
}

/**
 * Get Traefik configuration from database
 */
export async function getTraefikConfig(): Promise<TraefikConfig | null> {
  const settings = await db.getTraefikSettings();
  if (!settings?.enabled || !settings?.apiUrl) {
    return null;
  }
  
  return {
    apiUrl: settings.apiUrl,
    apiUser: settings.apiUser,
    apiPassword: settings.apiPassword,
    timeout: settings.timeout,
  };
}

/**
 * Get all HTTP routers from Traefik
 */
export async function getRouters(): Promise<TraefikRouter[]> {
  const config = await getTraefikConfig();
  if (!config) return [];
  
  try {
    const response = await fetch(`${config.apiUrl}/api/http/routers`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('[Traefik] Failed to get routers:', error);
    return [];
  }
}

/**
 * Get all HTTP services from Traefik
 */
export async function getServices(): Promise<TraefikService[]> {
  const config = await getTraefikConfig();
  if (!config) return [];
  
  try {
    const response = await fetch(`${config.apiUrl}/api/http/services`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('[Traefik] Failed to get services:', error);
    return [];
  }
}

/**
 * Get Traefik version info
 */
export async function getVersion(): Promise<{ version: string; codename: string } | null> {
  const config = await getTraefikConfig();
  if (!config) return null;
  
  try {
    const response = await fetch(`${config.apiUrl}/api/version`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[Traefik] Failed to get version:', error);
    return null;
  }
}

/**
 * Get entrypoints from Traefik
 */
export async function getEntrypoints(): Promise<any[]> {
  const config = await getTraefikConfig();
  if (!config) return [];
  
  try {
    const response = await fetch(`${config.apiUrl}/api/entrypoints`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('[Traefik] Failed to get entrypoints:', error);
    return [];
  }
}

/**
 * Get overview statistics from Traefik
 */
export async function getOverview(): Promise<any | null> {
  const config = await getTraefikConfig();
  if (!config) return null;
  
  try {
    const response = await fetch(`${config.apiUrl}/api/overview`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[Traefik] Failed to get overview:', error);
    return null;
  }
}

/**
 * Check if Traefik is healthy
 */
export async function checkHealth(): Promise<{ healthy: boolean; version?: string; error?: string }> {
  const config = await getTraefikConfig();
  if (!config) {
    return { healthy: false, error: 'Traefik not configured' };
  }
  
  try {
    const response = await fetch(`${config.apiUrl}/api/version`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { healthy: true, version: data.Version };
    }
    return { healthy: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { healthy: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

/**
 * Generate router configuration for a wiki page
 * Note: Traefik doesn't support dynamic router creation via API
 * This generates the configuration that should be added to Traefik's file provider
 */
export function generateRouterConfig(pageSlug: string, options: {
  domain: string;
  entryPoint?: string;
  certResolver?: string;
  serviceUrl?: string;
}): {
  router: Record<string, any>;
  service: Record<string, any>;
} {
  const routerName = `wiki-${pageSlug}`;
  const serviceName = `wiki-${pageSlug}-service`;
  
  const router: Record<string, any> = {
    [routerName]: {
      rule: `Host(\`${pageSlug}.${options.domain}\`)`,
      entryPoints: [options.entryPoint || 'websecure'],
      service: serviceName,
    },
  };
  
  if (options.certResolver) {
    router[routerName].tls = {
      certResolver: options.certResolver,
    };
  }
  
  const service: Record<string, any> = {
    [serviceName]: {
      loadBalancer: {
        servers: [
          { url: options.serviceUrl || 'http://localhost:3000' },
        ],
        passHostHeader: true,
      },
    },
  };
  
  return { router, service };
}

/**
 * Get router by name
 */
export async function getRouterByName(name: string): Promise<TraefikRouter | null> {
  const config = await getTraefikConfig();
  if (!config) return null;
  
  try {
    const response = await fetch(`${config.apiUrl}/api/http/routers/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[Traefik] Failed to get router:', error);
    return null;
  }
}

/**
 * Get service by name
 */
export async function getServiceByName(name: string): Promise<TraefikService | null> {
  const config = await getTraefikConfig();
  if (!config) return null;
  
  try {
    const response = await fetch(`${config.apiUrl}/api/http/services/${encodeURIComponent(name)}`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[Traefik] Failed to get service:', error);
    return null;
  }
}

/**
 * Get middlewares from Traefik
 */
export async function getMiddlewares(): Promise<any[]> {
  const config = await getTraefikConfig();
  if (!config) return [];
  
  try {
    const response = await fetch(`${config.apiUrl}/api/http/middlewares`, {
      headers: getAuthHeaders(config),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('[Traefik] Failed to get middlewares:', error);
    return [];
  }
}
