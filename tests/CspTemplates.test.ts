import { describe, it, expect } from 'vitest';
import { CspTemplateService, CSP_TEMPLATES } from '../src/core/CspTemplates';

describe('CspTemplateService', () => {
  const service = new CspTemplateService();

  it('should return all templates', () => {
    const templates = service.getTemplates();
    expect(templates).toBeDefined();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates).toEqual(CSP_TEMPLATES);
  });

  it('should return template by id', () => {
    const template = service.getTemplateById('strict');
    expect(template).toBeDefined();
    expect(template?.id).toBe('strict');
    expect(template?.name).toBe('Strict CSP');
    expect(template?.policy).toBeDefined();
  });

  it('should return undefined for non-existent template', () => {
    const template = service.getTemplateById('non-existent');
    expect(template).toBeUndefined();
  });

  it('should apply template and return policy', () => {
    const policy = service.applyTemplate('strict');
    expect(policy).toBeDefined();
    expect(policy).toHaveProperty('default-src');
    expect(policy!['default-src']).toContain("'none'");
  });

  it('should return null for non-existent template on apply', () => {
    const policy = service.applyTemplate('non-existent');
    expect(policy).toBeNull();
  });

  it('should deep clone policy to prevent mutations', () => {
    const policy1 = service.applyTemplate('strict');
    const policy2 = service.applyTemplate('strict');
    
    expect(policy1).not.toBe(policy2); // Different objects
    expect(policy1).toEqual(policy2); // Same content
    
    // Mutate one and ensure other is not affected
    policy1!['default-src'].push('test');
    expect(policy2!['default-src']).not.toContain('test');
  });

  describe('Template Content', () => {
    it('should have strict template with maximum security', () => {
      const template = service.getTemplateById('strict');
      expect(template?.policy['default-src']).toEqual(["'none'"]);
      expect(template?.policy['frame-ancestors']).toEqual(["'none'"]);
      expect(template?.policy).toHaveProperty('upgrade-insecure-requests');
    });

    it('should have basic template with balanced settings', () => {
      const template = service.getTemplateById('basic');
      expect(template?.policy['default-src']).toEqual(["'self'"]);
      expect(template?.policy['object-src']).toEqual(["'none'"]);
    });

    it('should have SPA template with CDN support', () => {
      const template = service.getTemplateById('spa');
      expect(template?.policy['script-src']).toContain('https://cdn.jsdelivr.net');
      expect(template?.policy['style-src']).toContain('https://fonts.googleapis.com');
    });

    it('should have API template with minimal directives', () => {
      const template = service.getTemplateById('api');
      expect(template?.policy['default-src']).toEqual(["'none'"]);
      expect(template?.policy['frame-ancestors']).toEqual(["'none'"]);
      expect(Object.keys(template?.policy || {}).length).toBeLessThan(5);
    });

    it('should have development template with permissive settings', () => {
      const template = service.getTemplateById('development');
      expect(template?.policy['script-src']).toContain("'unsafe-eval'");
      expect(template?.policy['script-src']).toContain('http://localhost:*');
    });

    it('should have legacy template with backward compatibility', () => {
      const template = service.getTemplateById('legacy');
      expect(template?.policy['script-src']).toContain("'unsafe-inline'");
      expect(template?.policy['script-src']).toContain("'unsafe-eval'");
    });
  });

  it('should have all templates with required properties', () => {
    const templates = service.getTemplates();
    templates.forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('policy');
      expect(typeof template.id).toBe('string');
      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.policy).toBe('object');
    });
  });
});
