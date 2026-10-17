import { describe, it, expect } from 'vitest';
import { CspParser } from '../src/core/CspParser';

describe('CspParser', () => {
  const parser = new CspParser();

  it('should parse a simple CSP string', () => {
    const result = parser.parse("default-src 'self'; script-src 'self' https://google.com;");
    expect(result).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://google.com'],
    });
  });

  it('should handle CSP with no trailing semicolon', () => {
    const result = parser.parse("default-src 'self'");
    expect(result).toEqual({
      'default-src': ["'self'"],
    });
  });

  it('should handle directives with no values', () => {
    const result = parser.parse('upgrade-insecure-requests; block-all-mixed-content;');
    expect(result).toEqual({
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': [],
    });
  });

  it('should strip HTTP header prefix', () => {
    const result = parser.parse("Content-Security-Policy: default-src 'self';");
    expect(result).toEqual({
      'default-src': ["'self'"],
    });
  });

  it('should strip report-only header prefix', () => {
    const result = parser.parse("Content-Security-Policy-Report-Only: default-src 'none';");
    expect(result).toEqual({
      'default-src': ["'none'"],
    });
  });

  it('should normalize directive names to lowercase', () => {
    const result = parser.parse("DEFAULT-SRC 'self'; Script-Src https://cdn.example.com;");
    expect(result).toEqual({
      'default-src': ["'self'"],
      'script-src': ['https://cdn.example.com'],
    });
  });

  it('should handle extra whitespace', () => {
    const result = parser.parse("  default-src   'self'  ;   script-src   https://a.com   https://b.com  ;  ");
    expect(result).toEqual({
      'default-src': ["'self'"],
      'script-src': ['https://a.com', 'https://b.com'],
    });
  });

  it('should return empty object for empty string', () => {
    const result = parser.parse('');
    expect(result).toEqual({});
  });

  it('should handle complex real-world CSP', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;";
    const result = parser.parse(csp);

    expect(Object.keys(result)).toHaveLength(10);
    expect(result['script-src']).toContain("'unsafe-inline'");
    expect(result['img-src']).toContain('data:');
    expect(result['upgrade-insecure-requests']).toEqual([]);
  });

  describe('duplicate directives', () => {
    it('keeps the first occurrence, like browsers do', () => {
      const result = parser.parse("script-src 'self'; img-src *; script-src *");
      expect(result['script-src']).toEqual(["'self'"]);
    });

    it('matches duplicates case-insensitively', () => {
      const result = parser.parse("script-src 'self'; SCRIPT-SRC *");
      expect(result).toEqual({ 'script-src': ["'self'"] });
    });

    it('warns about each duplicated directive once', () => {
      const warnings = parser.diagnose("script-src 'self'; script-src *; script-src 'none'; img-src *");
      expect(warnings).toEqual([
        'Directive "script-src" appears more than once; browsers ignore every occurrence after the first.',
      ]);
    });
  });

  describe('comma-separated policies', () => {
    it('parses only the first policy', () => {
      const result = parser.parse("default-src 'self', script-src 'none'");
      expect(result).toEqual({ 'default-src': ["'self'"] });
    });

    it('strips the header prefix before splitting', () => {
      const result = parser.parse("Content-Security-Policy: img-src *, script-src 'none'");
      expect(result).toEqual({ 'img-src': ['*'] });
    });

    it('warns that the other policies were not loaded', () => {
      const warnings = parser.diagnose("default-src 'self', script-src 'none', img-src *");
      expect(warnings).toEqual([
        'Found 3 comma-separated policies; only the first was loaded. Browsers enforce all of them.',
      ]);
    });
  });

  it('returns no warnings for a clean policy', () => {
    expect(parser.diagnose("default-src 'self'; script-src https://cdn.com")).toEqual([]);
  });
});
