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


// ============ PROMETHEUS METRICS ============

interface PrometheusMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

interface TraefikMetrics {
  requestsTotal: PrometheusMetric[];
  requestDuration: PrometheusMetric[];
  requestsInFlight: PrometheusMetric[];
  openConnections: PrometheusMetric[];
  tlsCertsExpiration: PrometheusMetric[];
}

/**
 * Parse Prometheus text format metrics
 */
function parsePrometheusMetrics(text: string): PrometheusMetric[] {
  const metrics: PrometheusMetric[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) continue;
    
    // Parse metric line: metric_name{label1="value1",label2="value2"} value timestamp
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([0-9.eE+-]+)(?:\s+(\d+))?$/);
    if (match) {
      const [, name, labelsStr, valueStr, timestampStr] = match;
      const labels: Record<string, string> = {};
      
      // Parse labels
      const labelRegex = /([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g;
      let labelMatch: RegExpExecArray | null;
      while ((labelMatch = labelRegex.exec(labelsStr)) !== null) {
        labels[labelMatch[1]] = labelMatch[2];
      }
      
      metrics.push({
        name,
        value: parseFloat(valueStr),
        labels,
        timestamp: timestampStr ? parseInt(timestampStr) : undefined,
      });
    } else {
      // Metric without labels: metric_name value timestamp
      const simpleMatch = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([0-9.eE+-]+)(?:\s+(\d+))?$/);
      if (simpleMatch) {
        const [, name, valueStr, timestampStr] = simpleMatch;
        metrics.push({
          name,
          value: parseFloat(valueStr),
          labels: {},
          timestamp: timestampStr ? parseInt(timestampStr) : undefined,
        });
      }
    }
  }
  
  return metrics;
}

/**
 * Get Prometheus metrics from Traefik
 */
export async function getPrometheusMetrics(): Promise<TraefikMetrics | null> {
  const settings = await db.getTraefikSettings();
  if (!settings?.enabled || !settings?.apiUrl) {
    return null;
  }
  
  // Prometheus metrics are typically on /metrics endpoint
  const metricsUrl = settings.apiUrl.replace(/\/api\/?$/, '') + '/metrics';
  
  try {
    const headers: Record<string, string> = {};
    if (settings.apiUser && settings.apiPassword) {
      const auth = Buffer.from(`${settings.apiUser}:${settings.apiPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    const response = await fetch(metricsUrl, { headers });
    
    if (!response.ok) {
      console.error('[Traefik] Failed to get Prometheus metrics:', response.status);
      return null;
    }
    
    const text = await response.text();
    const allMetrics = parsePrometheusMetrics(text);
    
    return {
      requestsTotal: allMetrics.filter(m => m.name === 'traefik_service_requests_total' || m.name === 'traefik_entrypoint_requests_total'),
      requestDuration: allMetrics.filter(m => m.name.includes('request_duration') || m.name.includes('requests_seconds')),
      requestsInFlight: allMetrics.filter(m => m.name.includes('requests_in_flight') || m.name.includes('open_connections')),
      openConnections: allMetrics.filter(m => m.name.includes('open_connections')),
      tlsCertsExpiration: allMetrics.filter(m => m.name.includes('tls_certs')),
    };
  } catch (error) {
    console.error('[Traefik] Failed to get Prometheus metrics:', error);
    return null;
  }
}

/**
 * Get traffic statistics by service
 */
export async function getServiceTrafficStats(): Promise<{
  services: Array<{
    name: string;
    requestsTotal: number;
    requestsPerSecond: number;
    avgLatencyMs: number;
    errors4xx: number;
    errors5xx: number;
  }>;
} | null> {
  const metrics = await getPrometheusMetrics();
  if (!metrics) return null;
  
  const serviceStats = new Map<string, {
    requestsTotal: number;
    errors4xx: number;
    errors5xx: number;
    latencySum: number;
    latencyCount: number;
  }>();
  
  // Process requests total
  for (const metric of metrics.requestsTotal) {
    const serviceName = metric.labels.service || metric.labels.entrypoint || 'unknown';
    const code = metric.labels.code || '';
    
    if (!serviceStats.has(serviceName)) {
      serviceStats.set(serviceName, {
        requestsTotal: 0,
        errors4xx: 0,
        errors5xx: 0,
        latencySum: 0,
        latencyCount: 0,
      });
    }
    
    const stats = serviceStats.get(serviceName)!;
    stats.requestsTotal += metric.value;
    
    if (code.startsWith('4')) {
      stats.errors4xx += metric.value;
    } else if (code.startsWith('5')) {
      stats.errors5xx += metric.value;
    }
  }
  
  // Process latency metrics
  for (const metric of metrics.requestDuration) {
    const serviceName = metric.labels.service || metric.labels.entrypoint || 'unknown';
    
    if (serviceStats.has(serviceName)) {
      const stats = serviceStats.get(serviceName)!;
      if (metric.name.includes('_sum')) {
        stats.latencySum += metric.value * 1000; // Convert to ms
      } else if (metric.name.includes('_count')) {
        stats.latencyCount += metric.value;
      }
    }
  }
  
  const services = Array.from(serviceStats.entries()).map(([name, stats]) => ({
    name,
    requestsTotal: Math.round(stats.requestsTotal),
    requestsPerSecond: 0, // Would need time-series data to calculate
    avgLatencyMs: stats.latencyCount > 0 ? Math.round(stats.latencySum / stats.latencyCount) : 0,
    errors4xx: Math.round(stats.errors4xx),
    errors5xx: Math.round(stats.errors5xx),
  }));
  
  return { services };
}

// ============ DOCKER API INTEGRATION ============

interface DockerSettings {
  enabled: boolean;
  socketPath?: string;
  host?: string;
  port?: number;
  useTLS?: boolean;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
}

/**
 * Get Docker settings from database
 */
export async function getDockerSettings(): Promise<DockerSettings | null> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;
  
  const { systemSettings } = await import('../drizzle/schema');
  const { sql } = await import('drizzle-orm');
  
  const settings = await dbInstance.select().from(systemSettings)
    .where(sql`${systemSettings.key} LIKE 'docker_%'`);
  
  if (settings.length === 0) return null;
  
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value || '';
  }
  
  return {
    enabled: settingsMap['docker_enabled'] === 'true',
    socketPath: settingsMap['docker_socket_path'] || '/var/run/docker.sock',
    host: settingsMap['docker_host'] || '',
    port: parseInt(settingsMap['docker_port'] || '2375'),
    useTLS: settingsMap['docker_use_tls'] === 'true',
    certPath: settingsMap['docker_cert_path'] || '',
    keyPath: settingsMap['docker_key_path'] || '',
    caPath: settingsMap['docker_ca_path'] || '',
  };
}

/**
 * Save Docker settings to database
 */
export async function saveDockerSettings(settings: DockerSettings): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  
  const { systemSettings } = await import('../drizzle/schema');
  
  const settingsToSave = [
    { key: 'docker_enabled', value: settings.enabled ? 'true' : 'false', description: 'Enable Docker integration' },
    { key: 'docker_socket_path', value: settings.socketPath || '/var/run/docker.sock', description: 'Docker socket path' },
    { key: 'docker_host', value: settings.host || '', description: 'Docker host (for remote)' },
    { key: 'docker_port', value: String(settings.port || 2375), description: 'Docker port' },
    { key: 'docker_use_tls', value: settings.useTLS ? 'true' : 'false', description: 'Use TLS for Docker' },
    { key: 'docker_cert_path', value: settings.certPath || '', description: 'Docker TLS cert path' },
    { key: 'docker_key_path', value: settings.keyPath || '', description: 'Docker TLS key path' },
    { key: 'docker_ca_path', value: settings.caPath || '', description: 'Docker TLS CA path' },
  ];
  
  for (const setting of settingsToSave) {
    await dbInstance.insert(systemSettings).values(setting)
      .onDuplicateKeyUpdate({ set: { value: setting.value, description: setting.description } });
  }
}

/**
 * Execute Docker API request
 */
async function dockerApiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const settings = await getDockerSettings();
  if (!settings?.enabled) {
    throw new Error('Docker integration not enabled');
  }
  
  let baseUrl: string;
  
  if (settings.host) {
    const protocol = settings.useTLS ? 'https' : 'http';
    baseUrl = `${protocol}://${settings.host}:${settings.port}`;
  } else {
    // For Unix socket, we need to use a special approach
    // In Node.js, we can use http module with socketPath
    throw new Error('Unix socket Docker connection not implemented in fetch API');
  }
  
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Docker API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get Docker containers
 */
export async function getDockerContainers(): Promise<any[]> {
  try {
    return await dockerApiRequest('/containers/json?all=true');
  } catch (error) {
    console.error('[Docker] Failed to get containers:', error);
    return [];
  }
}

/**
 * Restart a Docker container
 */
export async function restartDockerContainer(containerId: string): Promise<boolean> {
  try {
    await dockerApiRequest(`/containers/${containerId}/restart`, { method: 'POST' });
    return true;
  } catch (error) {
    console.error('[Docker] Failed to restart container:', error);
    return false;
  }
}

/**
 * Get Traefik container ID
 */
export async function getTraefikContainerId(): Promise<string | null> {
  const containers = await getDockerContainers();
  const traefikContainer = containers.find(c => 
    c.Image?.includes('traefik') || 
    c.Names?.some((n: string) => n.includes('traefik'))
  );
  return traefikContainer?.Id || null;
}

/**
 * Reload Traefik configuration by restarting the container
 */
export async function reloadTraefikConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const containerId = await getTraefikContainerId();
    if (!containerId) {
      return { success: false, error: 'Traefik container not found' };
    }
    
    const success = await restartDockerContainer(containerId);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Failed to restart Traefik container' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ YAML EXPORT ============

/**
 * Generate complete Traefik dynamic configuration YAML
 */
export function generateFullYamlConfig(configs: Array<{
  pageSlug: string;
  domain: string;
  entryPoint?: string;
  certResolver?: string;
  serviceUrl?: string;
}>): string {
  const yaml: string[] = ['http:'];
  
  // Routers section
  yaml.push('  routers:');
  for (const config of configs) {
    const routerConfig = generateRouterConfig(config.pageSlug, config);
    for (const [name, router] of Object.entries(routerConfig.router)) {
      yaml.push(`    ${name}:`);
      yaml.push(`      rule: "${router.rule}"`);
      yaml.push(`      entryPoints:`);
      for (const ep of router.entryPoints) {
        yaml.push(`        - ${ep}`);
      }
      yaml.push(`      service: ${router.service}`);
      if (router.tls) {
        yaml.push(`      tls:`);
        if (router.tls.certResolver) {
          yaml.push(`        certResolver: ${router.tls.certResolver}`);
        }
      }
    }
  }
  
  // Services section
  yaml.push('  services:');
  for (const config of configs) {
    const routerConfig = generateRouterConfig(config.pageSlug, config);
    for (const [name, service] of Object.entries(routerConfig.service)) {
      yaml.push(`    ${name}:`);
      yaml.push(`      loadBalancer:`);
      yaml.push(`        servers:`);
      for (const server of service.loadBalancer.servers) {
        yaml.push(`          - url: "${server.url}"`);
      }
      if (service.loadBalancer.passHostHeader !== undefined) {
        yaml.push(`        passHostHeader: ${service.loadBalancer.passHostHeader}`);
      }
    }
  }
  
  return yaml.join('\n');
}

/**
 * Generate TOML configuration (alternative format)
 */
export function generateTomlConfig(pageSlug: string, options: {
  domain: string;
  entryPoint?: string;
  certResolver?: string;
  serviceUrl?: string;
}): string {
  const routerName = `wiki-${pageSlug}`;
  const serviceName = `wiki-${pageSlug}-service`;
  
  const toml: string[] = [];
  
  // Router
  toml.push(`[http.routers.${routerName}]`);
  toml.push(`  rule = "Host(\`${pageSlug}.${options.domain}\`)"`);
  toml.push(`  entryPoints = ["${options.entryPoint || 'websecure'}"]`);
  toml.push(`  service = "${serviceName}"`);
  
  if (options.certResolver) {
    toml.push(`  [http.routers.${routerName}.tls]`);
    toml.push(`    certResolver = "${options.certResolver}"`);
  }
  
  toml.push('');
  
  // Service
  toml.push(`[http.services.${serviceName}.loadBalancer]`);
  toml.push(`  passHostHeader = true`);
  toml.push(`  [[http.services.${serviceName}.loadBalancer.servers]]`);
  toml.push(`    url = "${options.serviceUrl || 'http://localhost:3000'}"`);
  
  return toml.join('\n');
}
