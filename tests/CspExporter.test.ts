import { describe, it, expect } from 'vitest';
import { CspExporter } from '../src/services/CspExporter';

describe('CspExporter', () => {
  const exporter = new CspExporter();
  const testCsp = "default-src 'self'; script-src 'self' 'unsafe-inline';";

  describe('exportAsHtml', () => {
    it('should format CSP as HTML meta tag', () => {
      const result = exporter.exportAsHtml(testCsp);
      expect(result).toBe(
        `<meta http-equiv="Content-Security-Policy" content="${testCsp}">`
      );
    });

    it('should handle empty CSP', () => {
      const result = exporter.exportAsHtml('');
      expect(result).toBe('<meta http-equiv="Content-Security-Policy" content="">');
    });
  });

  describe('exportAsNginx', () => {
    it('should format CSP for Nginx', () => {
      const result = exporter.exportAsNginx(testCsp);
      expect(result).toBe(`add_header Content-Security-Policy "${testCsp}" always;`);
    });

    it('should include "always" directive', () => {
      const result = exporter.exportAsNginx(testCsp);
      expect(result).toContain('always');
    });
  });

  describe('exportAsApache', () => {
    it('should format CSP for Apache', () => {
      const result = exporter.exportAsApache(testCsp);
      expect(result).toBe(`Header set Content-Security-Policy "${testCsp}"`);
    });

    it('should use Header set directive', () => {
      const result = exporter.exportAsApache(testCsp);
      expect(result).toContain('Header set');
    });
  });

  describe('exportAsCloudflare', () => {
    it('should format CSP for Cloudflare _headers file', () => {
      const result = exporter.exportAsCloudflare(testCsp);
      expect(result).toBe(`/*\n  Content-Security-Policy: ${testCsp}`);
    });

    it('should start with path matcher', () => {
      const result = exporter.exportAsCloudflare(testCsp);
      expect(result).toMatch(/^\/\*/);
    });

    it('should have proper indentation', () => {
      const result = exporter.exportAsCloudflare(testCsp);
      expect(result).toContain('  Content-Security-Policy:');
    });
  });

  describe('exportAsExpress', () => {
    it('should format CSP as Express.js middleware', () => {
      const result = exporter.exportAsExpress(testCsp);
      expect(result).toBe(
        `app.use((req, res, next) => {\n  res.setHeader("Content-Security-Policy", "${testCsp}");\n  next();\n});`
      );
    });

    it('should be valid JavaScript structure', () => {
      const result = exporter.exportAsExpress(testCsp);
      expect(result).toContain('app.use');
      expect(result).toContain('req, res, next');
      expect(result).toContain('res.setHeader');
      expect(result).toContain('next()');
    });
  });

  describe('export', () => {
    it('should export as HTML when format is html', () => {
      const result = exporter.export(testCsp, 'html');
      expect(result).toBe(exporter.exportAsHtml(testCsp));
    });

    it('should export as Nginx when format is nginx', () => {
      const result = exporter.export(testCsp, 'nginx');
      expect(result).toBe(exporter.exportAsNginx(testCsp));
    });

    it('should export as Apache when format is apache', () => {
      const result = exporter.export(testCsp, 'apache');
      expect(result).toBe(exporter.exportAsApache(testCsp));
    });

    it('should export as Cloudflare when format is cloudflare', () => {
      const result = exporter.export(testCsp, 'cloudflare');
      expect(result).toBe(exporter.exportAsCloudflare(testCsp));
    });

    it('should export as Express when format is express', () => {
      const result = exporter.export(testCsp, 'express');
      expect(result).toBe(exporter.exportAsExpress(testCsp));
    });

    it('should return raw CSP for unknown format', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = exporter.export(testCsp, 'unknown' as any);
      expect(result).toBe(testCsp);
    });
  });

  describe('real-world CSP examples', () => {
    it('should handle complex CSP with multiple directives', () => {
      const complexCsp =
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;";

      const htmlResult = exporter.exportAsHtml(complexCsp);
      expect(htmlResult).toContain(complexCsp);

      const nginxResult = exporter.exportAsNginx(complexCsp);
      expect(nginxResult).toContain(complexCsp);

      const apacheResult = exporter.exportAsApache(complexCsp);
      expect(apacheResult).toContain(complexCsp);

      const cloudflareResult = exporter.exportAsCloudflare(complexCsp);
      expect(cloudflareResult).toContain(complexCsp);

      const expressResult = exporter.exportAsExpress(complexCsp);
      expect(expressResult).toContain(complexCsp);
    });

    it('should handle CSP with nonces', () => {
      const nonceCSP = "script-src 'nonce-r4nd0m' 'self';";
      const result = exporter.exportAsHtml(nonceCSP);
      expect(result).toContain(nonceCSP);
    });

    it('should handle CSP with hashes', () => {
      const hashCSP = "script-src 'sha256-abc123...' 'self';";
      const result = exporter.exportAsNginx(hashCSP);
      expect(result).toContain(hashCSP);
    });
  });
});
