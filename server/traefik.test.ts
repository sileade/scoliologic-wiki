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
});
