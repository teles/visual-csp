import { describe, it, expect } from 'vitest';
import { CspUrlMatcher } from '../src/core/CspUrlMatcher';
import { CspParser } from '../src/core/CspParser';

describe('CspUrlMatcher', () => {
  const matcher = new CspUrlMatcher();
  const parser = new CspParser();
  const PAGE = 'https://example.com/app/';

  const test = (csp: string, url: string, type: Parameters<CspUrlMatcher['match']>[2] = 'script', page: string | undefined = PAGE) =>
    matcher.match(parser.parse(csp), url, type, page);

  describe('directive fallback', () => {
    it('allows everything when no directive applies', () => {
      const result = test("img-src 'self'", 'https://cdn.com/app.js');
      expect(result.allowed).toBe(true);
      expect(result.appliedDirective).toBeNull();
      expect(result.reason).toContain('script-src-elem, script-src, default-src');
    });

    it('uses script-src-elem before script-src', () => {
      const result = test("script-src 'none'; script-src-elem https://cdn.com", 'https://cdn.com/app.js');
      expect(result.allowed).toBe(true);
      expect(result.appliedDirective).toBe('script-src-elem');
    });

    it('falls back from script-src-elem to script-src to default-src', () => {
      const result = test('default-src https://cdn.com', 'https://cdn.com/app.js');
      expect(result.allowed).toBe(true);
      expect(result.effectiveDirective).toBe('script-src-elem');
      expect(result.appliedDirective).toBe('default-src');
      expect(result.reason).toContain('falls back to default-src');
    });

    it('falls back from worker-src through child-src and script-src', () => {
      expect(test("child-src 'none'; script-src *", 'https://a.com/w.js', 'worker').appliedDirective).toBe('child-src');
      expect(test("script-src https://a.com; default-src 'none'", 'https://a.com/w.js', 'worker').allowed).toBe(true);
    });

    it('falls back from frame-src to child-src', () => {
      const result = test("child-src https://embed.com; default-src 'none'", 'https://embed.com/v', 'frame');
      expect(result.allowed).toBe(true);
      expect(result.appliedDirective).toBe('child-src');
    });

    it('does not fall back to default-src for form-action, frame-ancestors or base-uri', () => {
      const csp = "default-src 'none'";
      expect(test(csp, 'https://other.com/submit', 'form-action').allowed).toBe(true);
      expect(test(csp, 'https://other.com', 'frame-ancestors').allowed).toBe(true);
      expect(test(csp, 'https://other.com/', 'base-uri').allowed).toBe(true);
    });
  });

  describe('none and empty source lists', () => {
    it("blocks everything with 'none'", () => {
      const result = test("script-src 'none'", 'https://example.com/app.js');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('allows no sources');
    });

    it('treats a directive without values as blocking everything', () => {
      expect(test('script-src', 'https://example.com/app.js').allowed).toBe(false);
    });

    it("ignores 'none' when other sources are present", () => {
      expect(test("script-src 'none' https://cdn.com", 'https://cdn.com/a.js').allowed).toBe(true);
    });
  });

  describe("'self'", () => {
    it('matches the page origin', () => {
      const result = test("script-src 'self'", '/static/app.js');
      expect(result.allowed).toBe(true);
      expect(result.matchedSource).toBe("'self'");
      expect(result.testedUrl).toBe('https://example.com/static/app.js');
    });

    it('does not match other origins', () => {
      expect(test("script-src 'self'", 'https://cdn.example.com/app.js').allowed).toBe(false);
    });

    it('matches an https upgrade of an http page', () => {
      expect(test("script-src 'self'", 'https://example.com/a.js', 'script', 'http://example.com').allowed).toBe(true);
    });

    it('matches wss: on an https page', () => {
      expect(test("connect-src 'self'", 'wss://example.com/socket', 'connect').allowed).toBe(true);
    });

    it('explains a near miss on the same host with another port', () => {
      const result = test("connect-src 'self'", 'https://example.com:8443/api', 'connect');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("'self' means https://example.com");
    });

    it('adds a note when no page URL is set', () => {
      const result = test("script-src 'self'", 'https://example.com/app.js', 'script', '');
      expect(result.allowed).toBe(false);
      expect(result.notes.join(' ')).toContain("'self' was not evaluated");
    });
  });

  describe('wildcard', () => {
    it('matches http, https, ws and wss', () => {
      expect(test('connect-src *', 'https://any.com', 'connect').allowed).toBe(true);
      expect(test('connect-src *', 'http://any.com', 'connect').allowed).toBe(true);
      expect(test('connect-src *', 'wss://any.com', 'connect').allowed).toBe(true);
    });

    it('does not match data: or blob: URLs', () => {
      const result = test('img-src *', 'data:image/png;base64,AAAA', 'img');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('add data: explicitly');
    });
  });

  describe('scheme sources', () => {
    it('matches data: URLs', () => {
      expect(test('img-src data:', 'data:image/png;base64,AAAA', 'img').allowed).toBe(true);
    });

    it('lets http: also match https:', () => {
      expect(test('img-src http:', 'https://a.com/x.png', 'img').allowed).toBe(true);
    });

    it('does not let https: match http:', () => {
      expect(test('img-src https:', 'http://a.com/x.png', 'img').allowed).toBe(false);
    });

    it('lets ws: match wss:', () => {
      expect(test('connect-src ws:', 'wss://a.com/s', 'connect').allowed).toBe(true);
    });
  });

  describe('host sources', () => {
    it('matches an exact host with scheme', () => {
      expect(test('script-src https://cdn.com', 'https://cdn.com/lib.js').allowed).toBe(true);
    });

    it('is case-insensitive on the host', () => {
      expect(test('script-src https://CDN.com', 'https://cdn.COM/lib.js').allowed).toBe(true);
    });

    it('matches subdomains with *.', () => {
      expect(test('script-src *.cdn.com', 'https://a.b.cdn.com/lib.js').allowed).toBe(true);
    });

    it('explains that *.domain does not cover the domain itself', () => {
      const result = test('script-src *.cdn.com', 'https://cdn.com/lib.js');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('only covers subdomains of cdn.com');
    });

    it('inherits the page scheme when the source has none', () => {
      expect(test('img-src cdn.com', 'https://cdn.com/x.png', 'img').allowed).toBe(true);
      const result = test('img-src cdn.com', 'http://cdn.com/x.png', 'img');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("only allows https: (the page's scheme)");
    });

    it('lets an http:// source match https://', () => {
      expect(test('img-src http://cdn.com', 'https://cdn.com/x.png', 'img').allowed).toBe(true);
    });

    it('requires the default port when the source has none', () => {
      const result = test('connect-src https://api.com', 'https://api.com:8443/v1', 'connect');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('add :8443 or :* to the source');
    });

    it('matches explicit and wildcard ports', () => {
      expect(test('connect-src https://api.com:8443', 'https://api.com:8443/v1', 'connect').allowed).toBe(true);
      expect(test('connect-src https://api.com:*', 'https://api.com:9000/v1', 'connect').allowed).toBe(true);
      expect(test('connect-src https://api.com:443', 'https://api.com/v1', 'connect').allowed).toBe(true);
    });

    it('matches a directory path with a trailing slash', () => {
      const csp = 'script-src https://cdn.com/js/';
      expect(test(csp, 'https://cdn.com/js/app.js').allowed).toBe(true);
      expect(test(csp, 'https://cdn.com/js/vendor/lib.js').allowed).toBe(true);
      expect(test(csp, 'https://cdn.com/css/app.css').allowed).toBe(false);
    });

    it('matches a file path exactly', () => {
      const csp = 'script-src https://cdn.com/js/app.js';
      expect(test(csp, 'https://cdn.com/js/app.js').allowed).toBe(true);
      const result = test(csp, 'https://cdn.com/js/other.js');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('outside /js/app.js');
    });

    it('ignores query strings and fragments', () => {
      expect(test('script-src https://cdn.com/js/app.js', 'https://cdn.com/js/app.js?v=2#x').allowed).toBe(true);
    });

    it('notes that paths are ignored after redirects', () => {
      const result = test('script-src https://cdn.com/js/', 'https://cdn.com/js/app.js');
      expect(result.notes.join(' ')).toContain('ignored after a redirect');
    });

    it('does not match unrelated hosts', () => {
      const result = test('script-src https://cdn.com', 'https://evil.com/x.js');
      expect(result.allowed).toBe(false);
      expect(result.reason).not.toContain('Closest');
    });
  });

  describe('keywords that never match URLs', () => {
    it("does not allow URLs through 'unsafe-inline' or nonces", () => {
      expect(test("script-src 'unsafe-inline' 'nonce-abc'", 'https://cdn.com/a.js').allowed).toBe(false);
    });

    it('notes that nonced elements are allowed', () => {
      const result = test("script-src 'nonce-abc'", 'https://cdn.com/a.js');
      expect(result.notes.join(' ')).toContain('nonce');
    });
  });

  describe("'strict-dynamic'", () => {
    it('ignores host allowlists for scripts', () => {
      const result = test("script-src 'strict-dynamic' 'nonce-abc' https://cdn.com", 'https://cdn.com/a.js');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("'strict-dynamic'");
    });

    it('does not affect other resource types', () => {
      expect(test("default-src 'strict-dynamic' https://cdn.com", 'https://cdn.com/x.png', 'img').allowed).toBe(true);
    });
  });

  describe('upgrade-insecure-requests', () => {
    it('upgrades http: before matching', () => {
      const result = test('upgrade-insecure-requests; img-src https://cdn.com', 'http://cdn.com/x.png', 'img');
      expect(result.allowed).toBe(true);
      expect(result.testedUrl).toBe('https://cdn.com/x.png');
      expect(result.notes.join(' ')).toContain('upgrade-insecure-requests');
    });

    it('upgrades ws: to wss:', () => {
      const result = test('upgrade-insecure-requests; connect-src wss://a.com', 'ws://a.com/s', 'connect');
      expect(result.allowed).toBe(true);
      expect(result.testedUrl).toBe('wss://a.com/s');
    });
  });

  describe('mixed content', () => {
    it('warns about http: subresources on an https: page', () => {
      const result = test('img-src *', 'http://cdn.com/x.png', 'img');
      expect(result.allowed).toBe(true);
      expect(result.notes.join(' ')).toContain('mixed content');
    });
  });

  describe('input handling', () => {
    it('rejects empty URLs', () => {
      expect(() => test("script-src 'self'", '  ')).toThrow('Enter a URL');
    });

    it('rejects relative URLs without a page URL', () => {
      expect(() => test("script-src 'self'", '/app.js', 'script', '')).toThrow('Relative URLs need the Target URL');
    });

    it('ignores an invalid page URL with a note', () => {
      const result = test('script-src https://cdn.com', 'https://cdn.com/a.js', 'script', 'not a url');
      expect(result.allowed).toBe(true);
      expect(result.notes.join(' ')).toContain('not a valid URL');
    });
  });
});
