import { describe, it, expect } from 'vitest';
import { ChipColorizer } from '../src/ui/ChipColorizer';

describe('ChipColorizer', () => {
  const colorizer = new ChipColorizer();

  describe('keywords (purple)', () => {
    it("should return keyword category for 'self'", () => {
      const result = colorizer.getColor("'self'");
      expect(result.category).toBe('keyword');
      expect(result.classes).toContain('purple');
      expect(result.classes).toContain('dark:');
    });

    it("should return keyword category for 'unsafe-inline'", () => {
      const result = colorizer.getColor("'unsafe-inline'");
      expect(result.category).toBe('keyword');
      expect(result.classes).toContain('purple');
    });

    it("should return keyword category for 'none'", () => {
      const result = colorizer.getColor("'none'");
      expect(result.category).toBe('keyword');
    });

    it("should return keyword category for 'strict-dynamic'", () => {
      const result = colorizer.getColor("'strict-dynamic'");
      expect(result.category).toBe('keyword');
    });
  });

  describe('nonce sources (teal)', () => {
    it("should return nonce category for 'nonce-abc123'", () => {
      const result = colorizer.getColor("'nonce-abc123def456'");
      expect(result.category).toBe('nonce');
      expect(result.classes).toContain('teal');
      expect(result.classes).toContain('dark:');
    });

    it("should return nonce category for 'nonce-rAnd0m'", () => {
      const result = colorizer.getColor("'nonce-rAnd0m'");
      expect(result.category).toBe('nonce');
    });
  });

  describe('hash sources (emerald)', () => {
    it("should return hash category for 'sha256-...'", () => {
      const result = colorizer.getColor("'sha256-abcdef1234567890'");
      expect(result.category).toBe('hash');
      expect(result.classes).toContain('emerald');
      expect(result.classes).toContain('dark:');
    });

    it("should return hash category for 'sha384-...'", () => {
      const result = colorizer.getColor("'sha384-xyz'");
      expect(result.category).toBe('hash');
    });

    it("should return hash category for 'sha512-...'", () => {
      const result = colorizer.getColor("'sha512-longHashValue'");
      expect(result.category).toBe('hash');
    });
  });

  describe('scheme sources (amber)', () => {
    it('should return scheme category for data:', () => {
      const result = colorizer.getColor('data:');
      expect(result.category).toBe('scheme');
      expect(result.classes).toContain('amber');
    });

    it('should return scheme category for blob:', () => {
      const result = colorizer.getColor('blob:');
      expect(result.category).toBe('scheme');
    });

    it('should return scheme category for https:', () => {
      const result = colorizer.getColor('https:');
      expect(result.category).toBe('scheme');
    });

    it('should return scheme category for wss:', () => {
      const result = colorizer.getColor('wss:');
      expect(result.category).toBe('scheme');
    });

    it('should return scheme category for mediastream:', () => {
      const result = colorizer.getColor('mediastream:');
      expect(result.category).toBe('scheme');
    });
  });

  describe('wildcard (red)', () => {
    it('should return wildcard category for standalone *', () => {
      const result = colorizer.getColor('*');
      expect(result.category).toBe('wildcard');
      expect(result.classes).toContain('red');
      expect(result.classes).toContain('dark:');
    });
  });

  describe('domains (blue)', () => {
    it('should return domain category for a URL', () => {
      const result = colorizer.getColor('https://google.com');
      expect(result.category).toBe('domain');
      expect(result.classes).toContain('blue');
    });

    it('should return domain category for a wildcard domain', () => {
      const result = colorizer.getColor('*.google.com');
      expect(result.category).toBe('domain');
    });

    it('should return domain category for a bare domain', () => {
      const result = colorizer.getColor('cdn.example.com');
      expect(result.category).toBe('domain');
    });

    it('should return domain for a URL with path', () => {
      const result = colorizer.getColor('https://cdn.example.com/js/');
      expect(result.category).toBe('domain');
    });
  });
});
