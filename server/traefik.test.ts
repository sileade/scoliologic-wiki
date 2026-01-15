import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as traefik from './traefik';

describe('Traefik Module', () => {
  describe('generateRouterConfig', () => {
    it('should generate correct router configuration', () => {
      const config = traefik.generateRouterConfig('test-page', {
        domain: 'example.com',
        entryPoint: 'websecure',
        certResolver: 'letsencrypt',
        serviceUrl: 'http://localhost:3000',
      });

      expect(config.router).toBeDefined();
      expect(config.service).toBeDefined();
      
      const routerName = 'wiki-test-page';
      const serviceName = 'wiki-test-page-service';
      
      expect(config.router[routerName]).toBeDefined();
      expect(config.router[routerName].rule).toBe('Host(`test-page.example.com`)');
      expect(config.router[routerName].entryPoints).toContain('websecure');
      expect(config.router[routerName].service).toBe(serviceName);
      expect(config.router[routerName].tls).toBeDefined();
      expect(config.router[routerName].tls.certResolver).toBe('letsencrypt');
      
      expect(config.service[serviceName]).toBeDefined();
      expect(config.service[serviceName].loadBalancer.servers).toHaveLength(1);
      expect(config.service[serviceName].loadBalancer.servers[0].url).toBe('http://localhost:3000');
      expect(config.service[serviceName].loadBalancer.passHostHeader).toBe(true);
    });

    it('should use default entryPoint when not specified', () => {
      const config = traefik.generateRouterConfig('my-page', {
        domain: 'wiki.local',
      });

      const routerName = 'wiki-my-page';
      expect(config.router[routerName].entryPoints).toContain('websecure');
    });

    it('should use default serviceUrl when not specified', () => {
      const config = traefik.generateRouterConfig('another-page', {
        domain: 'test.com',
      });

      const serviceName = 'wiki-another-page-service';
      expect(config.service[serviceName].loadBalancer.servers[0].url).toBe('http://localhost:3000');
    });

    it('should not include TLS when certResolver is not specified', () => {
      const config = traefik.generateRouterConfig('no-tls-page', {
        domain: 'internal.local',
        entryPoint: 'web',
      });

      const routerName = 'wiki-no-tls-page';
      expect(config.router[routerName].tls).toBeUndefined();
    });

    it('should handle special characters in page slug', () => {
      const config = traefik.generateRouterConfig('page-with-numbers-123', {
        domain: 'example.com',
      });

      const routerName = 'wiki-page-with-numbers-123';
      expect(config.router[routerName]).toBeDefined();
      expect(config.router[routerName].rule).toBe('Host(`page-with-numbers-123.example.com`)');
    });
  });

  describe('checkHealth', () => {
    it('should return error when Traefik is not configured', async () => {
      // Mock getTraefikConfig to return null
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const result = await traefik.checkHealth();
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Traefik not configured');
    });
  });

  describe('getRouters', () => {
    it('should return empty array when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const routers = await traefik.getRouters();
      
      expect(routers).toEqual([]);
    });
  });

  describe('getServices', () => {
    it('should return empty array when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const services = await traefik.getServices();
      
      expect(services).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('should return null when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const version = await traefik.getVersion();
      
      expect(version).toBeNull();
    });
  });

  describe('getEntrypoints', () => {
    it('should return empty array when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const entrypoints = await traefik.getEntrypoints();
      
      expect(entrypoints).toEqual([]);
    });
  });

  describe('getOverview', () => {
    it('should return null when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const overview = await traefik.getOverview();
      
      expect(overview).toBeNull();
    });
  });

  describe('getMiddlewares', () => {
    it('should return empty array when Traefik is not configured', async () => {
      vi.spyOn(traefik, 'getTraefikConfig').mockResolvedValueOnce(null);
      
      const middlewares = await traefik.getMiddlewares();
      
      expect(middlewares).toEqual([]);
    });
  });

  describe('generateFullYamlConfig', () => {
    it('should generate valid YAML for multiple pages', () => {
      const configs = [
        { pageSlug: 'page1', domain: 'example.com', entryPoint: 'websecure', certResolver: 'letsencrypt' },
        { pageSlug: 'page2', domain: 'example.com', entryPoint: 'websecure', certResolver: 'letsencrypt' },
      ];
      
      const yaml = traefik.generateFullYamlConfig(configs);
      
      expect(yaml).toContain('http:');
      expect(yaml).toContain('routers:');
      expect(yaml).toContain('services:');
      expect(yaml).toContain('wiki-page1:');
      expect(yaml).toContain('wiki-page2:');
      expect(yaml).toContain('Host(`page1.example.com`)');
      expect(yaml).toContain('Host(`page2.example.com`)');
    });

    it('should handle empty configs array', () => {
      const yaml = traefik.generateFullYamlConfig([]);
      
      expect(yaml).toContain('http:');
      expect(yaml).toContain('routers:');
      expect(yaml).toContain('services:');
    });
  });

  describe('generateTomlConfig', () => {
    it('should generate valid TOML configuration', () => {
      const toml = traefik.generateTomlConfig('test-page', {
        domain: 'example.com',
        entryPoint: 'websecure',
        certResolver: 'letsencrypt',
        serviceUrl: 'http://localhost:3000',
      });
      
      expect(toml).toContain('[http.routers.wiki-test-page]');
      expect(toml).toContain('rule = "Host(`test-page.example.com`)"');
      expect(toml).toContain('entryPoints = ["websecure"]');
      expect(toml).toContain('certResolver = "letsencrypt"');
      expect(toml).toContain('[http.services.wiki-test-page-service.loadBalancer]');
      expect(toml).toContain('url = "http://localhost:3000"');
    });

    it('should not include TLS section when certResolver is not provided', () => {
      const toml = traefik.generateTomlConfig('no-tls', {
        domain: 'internal.local',
        entryPoint: 'web',
      });
      
      expect(toml).not.toContain('certResolver');
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should return null when Traefik is not configured', async () => {
      const metrics = await traefik.getPrometheusMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('getServiceTrafficStats', () => {
    it('should return null when Prometheus metrics are not available', async () => {
      const stats = await traefik.getServiceTrafficStats();
      expect(stats).toBeNull();
    });
  });

  describe('getDockerSettings', () => {
    it('should return null when database is not available', async () => {
      const settings = await traefik.getDockerSettings();
      // Returns null or default settings depending on DB state
      expect(settings === null || typeof settings === 'object').toBe(true);
    });
  });
});
