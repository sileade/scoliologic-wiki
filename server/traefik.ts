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


// ============ HISTORICAL METRICS ============

/**
 * Save current metrics to database for historical tracking
 */
export async function collectAndSaveMetrics(): Promise<{ saved: number; error?: string }> {
  const stats = await getServiceTrafficStats();
  if (!stats?.services || stats.services.length === 0) {
    return { saved: 0, error: 'No metrics available' };
  }
  
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    return { saved: 0, error: 'Database not available' };
  }
  
  const { traefikMetrics } = await import('../drizzle/schema');
  
  let saved = 0;
  for (const service of stats.services) {
    try {
      await dbInstance.insert(traefikMetrics).values({
        serviceName: service.name,
        requestsTotal: service.requestsTotal,
        requestsPerSecond: String(service.requestsPerSecond),
        avgLatencyMs: service.avgLatencyMs,
        errors4xx: service.errors4xx,
        errors5xx: service.errors5xx,
        openConnections: 0,
      });
      saved++;
    } catch (error) {
      console.error('[Traefik] Failed to save metrics for service:', service.name, error);
    }
  }
  
  return { saved };
}

/**
 * Get historical metrics for a service
 */
export async function getHistoricalMetrics(options: {
  serviceName?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}): Promise<any[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  
  const { traefikMetrics } = await import('../drizzle/schema');
  const { desc, and, gte, lte, eq } = await import('drizzle-orm');
  
  const conditions = [];
  
  if (options.serviceName) {
    conditions.push(eq(traefikMetrics.serviceName, options.serviceName));
  }
  
  if (options.startTime) {
    conditions.push(gte(traefikMetrics.collectedAt, options.startTime));
  }
  
  if (options.endTime) {
    conditions.push(lte(traefikMetrics.collectedAt, options.endTime));
  }
  
  const query = dbInstance.select().from(traefikMetrics);
  
  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(desc(traefikMetrics.collectedAt))
      .limit(options.limit || 100);
  }
  
  return query
    .orderBy(desc(traefikMetrics.collectedAt))
    .limit(options.limit || 100);
}

/**
 * Get aggregated metrics for trend analysis
 */
export async function getMetricsTrends(options: {
  serviceName?: string;
  period: 'hour' | 'day' | 'week';
}): Promise<{
  labels: string[];
  requestsTotal: number[];
  avgLatency: number[];
  errors4xx: number[];
  errors5xx: number[];
}> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    return { labels: [], requestsTotal: [], avgLatency: [], errors4xx: [], errors5xx: [] };
  }
  
  const { traefikMetrics } = await import('../drizzle/schema');
  const { desc, and, gte, eq } = await import('drizzle-orm');
  
  // Calculate start time based on period
  const now = new Date();
  let startTime: Date;
  let groupFormat: string;
  
  switch (options.period) {
    case 'hour':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      groupFormat = 'HH:mm';
      break;
    case 'day':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      groupFormat = 'HH:00';
      break;
    case 'week':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupFormat = 'ddd';
      break;
  }
  
  const conditions = [gte(traefikMetrics.collectedAt, startTime)];
  
  if (options.serviceName) {
    conditions.push(eq(traefikMetrics.serviceName, options.serviceName));
  }
  
  const metrics = await dbInstance.select()
    .from(traefikMetrics)
    .where(and(...conditions))
    .orderBy(desc(traefikMetrics.collectedAt));
  
  // Group metrics by time buckets
  const buckets = new Map<string, {
    requestsTotal: number;
    avgLatency: number;
    errors4xx: number;
    errors5xx: number;
    count: number;
  }>();
  
  for (const metric of metrics) {
    const date = new Date(metric.collectedAt);
    let key: string;
    
    switch (options.period) {
      case 'hour':
        key = `${date.getHours().toString().padStart(2, '0')}:${Math.floor(date.getMinutes() / 5) * 5}`;
        break;
      case 'day':
        key = `${date.getHours().toString().padStart(2, '0')}:00`;
        break;
      case 'week':
        key = date.toLocaleDateString('en-US', { weekday: 'short' });
        break;
    }
    
    if (!buckets.has(key)) {
      buckets.set(key, { requestsTotal: 0, avgLatency: 0, errors4xx: 0, errors5xx: 0, count: 0 });
    }
    
    const bucket = buckets.get(key)!;
    bucket.requestsTotal += metric.requestsTotal;
    bucket.avgLatency += metric.avgLatencyMs;
    bucket.errors4xx += metric.errors4xx;
    bucket.errors5xx += metric.errors5xx;
    bucket.count++;
  }
  
  const labels: string[] = [];
  const requestsTotal: number[] = [];
  const avgLatency: number[] = [];
  const errors4xx: number[] = [];
  const errors5xx: number[] = [];
  
  for (const [label, data] of Array.from(buckets.entries())) {
    labels.push(label);
    requestsTotal.push(data.requestsTotal);
    avgLatency.push(data.count > 0 ? Math.round(data.avgLatency / data.count) : 0);
    errors4xx.push(data.errors4xx);
    errors5xx.push(data.errors5xx);
  }
  
  return { labels, requestsTotal, avgLatency, errors4xx, errors5xx };
}

/**
 * Clean up old metrics (retention policy)
 */
export async function cleanupOldMetrics(retentionDays: number = 30): Promise<number> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return 0;
  
  const { traefikMetrics } = await import('../drizzle/schema');
  const { lt } = await import('drizzle-orm');
  
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const result = await dbInstance.delete(traefikMetrics)
    .where(lt(traefikMetrics.collectedAt, cutoffDate));
  
  return (result as any)[0]?.affectedRows || 0;
}

// ============ ALERT MANAGEMENT ============

interface AlertThreshold {
  id: number;
  name: string;
  serviceName: string | null;
  metricType: string;
  operator: string;
  threshold: string;
  windowMinutes: number;
  isEnabled: boolean;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  webhookUrl: string | null;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
}

/**
 * Get all alert thresholds
 */
export async function getAlertThresholds(): Promise<AlertThreshold[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  
  const { traefikAlertThresholds } = await import('../drizzle/schema');
  
  return dbInstance.select().from(traefikAlertThresholds);
}

/**
 * Create a new alert threshold
 */
export async function createAlertThreshold(threshold: {
  name: string;
  serviceName?: string;
  metricType: 'errors_4xx_rate' | 'errors_5xx_rate' | 'latency_avg' | 'latency_p95' | 'requests_per_second' | 'error_total_rate';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  windowMinutes?: number;
  notifyEmail?: boolean;
  notifyWebhook?: boolean;
  webhookUrl?: string;
  cooldownMinutes?: number;
  createdById?: number;
}): Promise<number> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikAlertThresholds } = await import('../drizzle/schema');
  
  const result = await dbInstance.insert(traefikAlertThresholds).values({
    name: threshold.name,
    serviceName: threshold.serviceName || null,
    metricType: threshold.metricType,
    operator: threshold.operator,
    threshold: String(threshold.threshold),
    windowMinutes: threshold.windowMinutes || 5,
    isEnabled: true,
    notifyEmail: threshold.notifyEmail ?? true,
    notifyWebhook: threshold.notifyWebhook ?? false,
    webhookUrl: threshold.webhookUrl || null,
    cooldownMinutes: threshold.cooldownMinutes || 15,
    createdById: threshold.createdById || null,
  });
  
  return (result as any)[0]?.insertId || 0;
}

/**
 * Update an alert threshold
 */
export async function updateAlertThreshold(id: number, updates: Partial<{
  name: string;
  serviceName: string | null;
  metricType: string;
  operator: string;
  threshold: number;
  windowMinutes: number;
  isEnabled: boolean;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  webhookUrl: string | null;
  cooldownMinutes: number;
}>): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikAlertThresholds } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  const updateData: any = { ...updates };
  if (updates.threshold !== undefined) {
    updateData.threshold = String(updates.threshold);
  }
  
  await dbInstance.update(traefikAlertThresholds)
    .set(updateData)
    .where(eq(traefikAlertThresholds.id, id));
}

/**
 * Delete an alert threshold
 */
export async function deleteAlertThreshold(id: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikAlertThresholds } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  await dbInstance.delete(traefikAlertThresholds)
    .where(eq(traefikAlertThresholds.id, id));
}

/**
 * Check thresholds and create alerts if needed
 */
export async function checkThresholdsAndAlert(): Promise<{ checked: number; triggered: number }> {
  const thresholds = await getAlertThresholds();
  const enabledThresholds = thresholds.filter(t => t.isEnabled);
  
  if (enabledThresholds.length === 0) {
    return { checked: 0, triggered: 0 };
  }
  
  const stats = await getServiceTrafficStats();
  if (!stats?.services) {
    return { checked: 0, triggered: 0 };
  }
  
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    return { checked: 0, triggered: 0 };
  }
  
  const { traefikAlerts, traefikAlertThresholds } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  let triggered = 0;
  
  for (const threshold of enabledThresholds) {
    // Check cooldown
    if (threshold.lastTriggeredAt) {
      const cooldownMs = threshold.cooldownMinutes * 60 * 1000;
      if (Date.now() - new Date(threshold.lastTriggeredAt).getTime() < cooldownMs) {
        continue;
      }
    }
    
    // Get relevant services
    const services = threshold.serviceName 
      ? stats.services.filter(s => s.name === threshold.serviceName)
      : stats.services;
    
    for (const service of services) {
      let currentValue: number;
      
      switch (threshold.metricType) {
        case 'errors_4xx_rate':
          currentValue = service.requestsTotal > 0 
            ? (service.errors4xx / service.requestsTotal) * 100 
            : 0;
          break;
        case 'errors_5xx_rate':
          currentValue = service.requestsTotal > 0 
            ? (service.errors5xx / service.requestsTotal) * 100 
            : 0;
          break;
        case 'error_total_rate':
          currentValue = service.requestsTotal > 0 
            ? ((service.errors4xx + service.errors5xx) / service.requestsTotal) * 100 
            : 0;
          break;
        case 'latency_avg':
          currentValue = service.avgLatencyMs;
          break;
        case 'requests_per_second':
          currentValue = service.requestsPerSecond;
          break;
        default:
          continue;
      }
      
      const thresholdValue = parseFloat(threshold.threshold);
      let isTriggered = false;
      
      switch (threshold.operator) {
        case 'gt':
          isTriggered = currentValue > thresholdValue;
          break;
        case 'lt':
          isTriggered = currentValue < thresholdValue;
          break;
        case 'gte':
          isTriggered = currentValue >= thresholdValue;
          break;
        case 'lte':
          isTriggered = currentValue <= thresholdValue;
          break;
        case 'eq':
          isTriggered = currentValue === thresholdValue;
          break;
      }
      
      if (isTriggered) {
        // Create alert
        await dbInstance.insert(traefikAlerts).values({
          thresholdId: threshold.id,
          serviceName: service.name,
          metricType: threshold.metricType,
          currentValue: String(currentValue),
          thresholdValue: threshold.threshold,
          status: 'triggered',
          message: `${threshold.name}: ${threshold.metricType} is ${currentValue.toFixed(2)} (threshold: ${threshold.operator} ${thresholdValue})`,
        });
        
        // Update last triggered time
        await dbInstance.update(traefikAlertThresholds)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(traefikAlertThresholds.id, threshold.id));
        
        triggered++;
        
        // Send notifications
        if (threshold.notifyEmail) {
          await sendAlertNotification(threshold, service.name, currentValue, thresholdValue);
        }
        
        if (threshold.notifyWebhook && threshold.webhookUrl) {
          await sendWebhookNotification(threshold.webhookUrl, {
            threshold: threshold.name,
            service: service.name,
            metric: threshold.metricType,
            currentValue,
            thresholdValue,
            operator: threshold.operator,
          });
        }
      }
    }
  }
  
  return { checked: enabledThresholds.length, triggered };
}

/**
 * Send alert notification to owner and configured integrations (Telegram/Slack)
 */
async function sendAlertNotification(
  threshold: AlertThreshold,
  serviceName: string,
  currentValue: number,
  thresholdValue: number
): Promise<void> {
  // Send to owner via built-in notification
  try {
    const { notifyOwner } = await import('./_core/notification');
    await notifyOwner({
      title: `⚠️ Traefik Alert: ${threshold.name}`,
      content: `Service: ${serviceName}\nMetric: ${threshold.metricType}\nCurrent: ${currentValue.toFixed(2)}\nThreshold: ${threshold.operator} ${thresholdValue}`,
    });
  } catch (error) {
    console.error('[Traefik] Failed to send owner notification:', error);
  }
  
  // Send to Telegram/Slack integrations
  try {
    const notifications = await import('./notifications');
    await notifications.sendAlertNotification({
      title: `Traefik Alert: ${threshold.name}`,
      message: `Сервис ${serviceName} превысил порог ${threshold.metricType}.\nТекущее значение: ${currentValue.toFixed(2)}\nПорог: ${threshold.operator} ${thresholdValue}`,
      severity: currentValue > thresholdValue * 1.5 ? 'critical' : 'warning',
      serviceName,
      metricValue: currentValue.toFixed(2),
      thresholdValue: String(thresholdValue),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Traefik] Failed to send Telegram/Slack notification:', error);
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(url: string, data: any): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'traefik_alert',
        timestamp: new Date().toISOString(),
        ...data,
      }),
    });
  } catch (error) {
    console.error('[Traefik] Failed to send webhook notification:', error);
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(limit: number = 50): Promise<any[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  
  const { traefikAlerts } = await import('../drizzle/schema');
  const { desc } = await import('drizzle-orm');
  
  return dbInstance.select()
    .from(traefikAlerts)
    .orderBy(desc(traefikAlerts.createdAt))
    .limit(limit);
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: number, userId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikAlerts } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  await dbInstance.update(traefikAlerts)
    .set({
      status: 'acknowledged',
      acknowledgedById: userId,
      acknowledgedAt: new Date(),
    })
    .where(eq(traefikAlerts.id, alertId));
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikAlerts } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  await dbInstance.update(traefikAlerts)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
    })
    .where(eq(traefikAlerts.id, alertId));
}

// ============ CONFIG FILE MANAGEMENT ============

/**
 * Get all config files
 */
export async function getConfigFiles(): Promise<any[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];
  
  const { traefikConfigFiles } = await import('../drizzle/schema');
  
  return dbInstance.select().from(traefikConfigFiles);
}

/**
 * Create or update a config file
 */
export async function saveConfigFile(config: {
  id?: number;
  name: string;
  filePath: string;
  format: 'yaml' | 'toml';
  content: string;
  isAutoApply: boolean;
  createdById?: number;
}): Promise<number> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikConfigFiles } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  if (config.id) {
    await dbInstance.update(traefikConfigFiles)
      .set({
        name: config.name,
        filePath: config.filePath,
        format: config.format,
        content: config.content,
        isAutoApply: config.isAutoApply,
      })
      .where(eq(traefikConfigFiles.id, config.id));
    return config.id;
  }
  
  const result = await dbInstance.insert(traefikConfigFiles).values({
    name: config.name,
    filePath: config.filePath,
    format: config.format,
    content: config.content,
    isAutoApply: config.isAutoApply,
    createdById: config.createdById || null,
  });
  
  return (result as any)[0]?.insertId || 0;
}

/**
 * Apply config file to Traefik (write to file system)
 * Note: This requires the file path to be accessible from the server
 */
export async function applyConfigFile(configId: number): Promise<{ success: boolean; error?: string }> {
  const dbInstance = await db.getDb();
  if (!dbInstance) {
    return { success: false, error: 'Database not available' };
  }
  
  const { traefikConfigFiles } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const fs = await import('fs/promises');
  
  const configs = await dbInstance.select()
    .from(traefikConfigFiles)
    .where(eq(traefikConfigFiles.id, configId));
  
  if (configs.length === 0) {
    return { success: false, error: 'Config file not found' };
  }
  
  const config = configs[0];
  
  try {
    // Write content to file
    await fs.writeFile(config.filePath, config.content || '', 'utf-8');
    
    // Update last applied time
    await dbInstance.update(traefikConfigFiles)
      .set({ lastAppliedAt: new Date(), lastError: null })
      .where(eq(traefikConfigFiles.id, configId));
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Save error to database
    await dbInstance.update(traefikConfigFiles)
      .set({ lastError: errorMessage })
      .where(eq(traefikConfigFiles.id, configId));
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete a config file
 */
export async function deleteConfigFile(configId: number): Promise<void> {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error('Database not available');
  
  const { traefikConfigFiles } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  await dbInstance.delete(traefikConfigFiles)
    .where(eq(traefikConfigFiles.id, configId));
}
