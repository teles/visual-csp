import type { CspDirectives, ICspUrlMatcher, ResourceType, UrlMatchResult } from './types';

/**
 * Directive the browser checks first for each kind of request
 * (the CSP3 "effective directive").
 */
const EFFECTIVE_DIRECTIVE: Record<ResourceType, string> = {
  script: 'script-src-elem',
  style: 'style-src-elem',
  img: 'img-src',
  font: 'font-src',
  connect: 'connect-src',
  media: 'media-src',
  object: 'object-src',
  frame: 'frame-src',
  worker: 'worker-src',
  manifest: 'manifest-src',
  'form-action': 'form-action',
  'frame-ancestors': 'frame-ancestors',
  'base-uri': 'base-uri',
};

/**
 * CSP3 directive fallback lists. Directives not listed here
 * (form-action, frame-ancestors, base-uri) never fall back.
 */
const FALLBACKS: Record<string, string[]> = {
  'script-src-elem': ['script-src-elem', 'script-src', 'default-src'],
  'style-src-elem': ['style-src-elem', 'style-src', 'default-src'],
  'worker-src': ['worker-src', 'child-src', 'script-src', 'default-src'],
  'frame-src': ['frame-src', 'child-src', 'default-src'],
  'img-src': ['img-src', 'default-src'],
  'font-src': ['font-src', 'default-src'],
  'connect-src': ['connect-src', 'default-src'],
  'media-src': ['media-src', 'default-src'],
  'object-src': ['object-src', 'default-src'],
  'manifest-src': ['manifest-src', 'default-src'],
};

const DEFAULT_PORTS: Record<string, number> = {
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
  ftp: 21,
};

/** Request types that are subject to mixed-content blocking. */
const SUBRESOURCE_TYPES: ReadonlySet<ResourceType> = new Set([
  'script', 'style', 'img', 'font', 'connect', 'media', 'object', 'frame', 'worker', 'manifest',
]);

const SCHEME_SOURCE = /^([a-z][a-z0-9+.-]*):$/i;
const HOST_SOURCE =
  /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\*|\d+))?(\/[^?#]*)?$/i;

/** Result of comparing one source expression against a URL. */
interface ExpressionCheck {
  matches: boolean;
  /** Explanation when the expression almost matched (e.g. right host, wrong port). */
  nearMiss?: string;
  /** True when the match depended on the source's path. */
  pathRestricted?: boolean;
}

/**
 * Tests whether a URL would be allowed by a policy, following the
 * CSP Level 3 matching algorithm (https://www.w3.org/TR/CSP3/#match-url-to-source-list).
 *
 * Single Responsibility: only decides allow/block for a URL and explains why.
 */
export class CspUrlMatcher implements ICspUrlMatcher {
  match(directives: CspDirectives, url: string, type: ResourceType, pageUrl?: string): UrlMatchResult {
    const notes: string[] = [];
    const page = this.parsePageUrl(pageUrl, notes);
    let target = this.parseTargetUrl(url, page);

    if ('upgrade-insecure-requests' in directives && type !== 'frame-ancestors') {
      const upgraded = this.upgrade(target);
      if (upgraded) {
        notes.push(`upgrade-insecure-requests rewrites ${target.protocol} to ${upgraded.protocol} before matching.`);
        target = upgraded;
      }
    }

    const effectiveDirective = EFFECTIVE_DIRECTIVE[type];
    const candidates = FALLBACKS[effectiveDirective] ?? [effectiveDirective];
    const appliedDirective = candidates.find((name) => name in directives) ?? null;

    const base = {
      testedUrl: target.href,
      resourceType: type,
      effectiveDirective,
      appliedDirective,
      notes,
    };

    this.addMixedContentNote(target, page, type, notes);

    if (!appliedDirective) {
      return {
        ...base,
        allowed: true,
        matchedSource: null,
        reason: `No directive restricts this request (none of ${candidates.join(', ')} is set).`,
      };
    }

    const sources = directives[appliedDirective].map((s) => s.trim()).filter(Boolean);
    const fallback = appliedDirective !== effectiveDirective
      ? ` (${effectiveDirective} is not set, so the browser falls back to ${appliedDirective})`
      : '';

    if (sources.length === 0 || (sources.length === 1 && sources[0].toLowerCase() === "'none'")) {
      return {
        ...base,
        allowed: false,
        matchedSource: null,
        reason: `Blocked by ${appliedDirective}${fallback}: it allows no sources at all.`,
      };
    }

    this.addNonceAndHashNotes(sources, type, notes);

    // 'strict-dynamic' makes the browser ignore URL allowlists for scripts written in the HTML.
    if (type === 'script' && sources.some((s) => s.toLowerCase() === "'strict-dynamic'")) {
      return {
        ...base,
        allowed: false,
        matchedSource: null,
        reason:
          `Blocked by ${appliedDirective}${fallback}: 'strict-dynamic' is present, so host and scheme ` +
          `sources are ignored. A <script src> in the HTML needs a nonce or hash; scripts injected ` +
          `by an already trusted script are allowed.`,
      };
    }

    const nearMisses: string[] = [];
    for (const source of sources) {
      const check = this.matchExpression(source, target, page);
      if (check.matches) {
        if (check.pathRestricted) {
          notes.push('Paths in sources are ignored after a redirect, so a redirect to another path on this host would also be allowed.');
        }
        return {
          ...base,
          allowed: true,
          matchedSource: source,
          reason: `Allowed by ${appliedDirective}${fallback}: matches ${source}.`,
        };
      }
      if (check.nearMiss) nearMisses.push(check.nearMiss);
    }

    if (!page && sources.some((s) => s.toLowerCase() === "'self'")) {
      notes.push("'self' was not evaluated because no page URL is set. Fill in the Target URL to include it.");
    }

    const closest = nearMisses.length > 0 ? ` Closest: ${nearMisses[0]}` : '';
    return {
      ...base,
      allowed: false,
      matchedSource: null,
      reason: `Blocked by ${appliedDirective}${fallback}: no source matches ${this.describe(target)}.${closest}`,
    };
  }

  private parsePageUrl(pageUrl: string | undefined, notes: string[]): URL | null {
    if (!pageUrl?.trim()) return null;
    try {
      return new URL(pageUrl.trim());
    } catch {
      notes.push(`The page URL "${pageUrl}" is not a valid URL, so it was ignored.`);
      return null;
    }
  }

  private parseTargetUrl(url: string, page: URL | null): URL {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error('Enter a URL to test.');
    }
    try {
      return page ? new URL(trimmed, page) : new URL(trimmed);
    } catch {
      throw new Error(
        page
          ? `"${trimmed}" is not a valid URL.`
          : `"${trimmed}" is not a valid absolute URL. Relative URLs need the Target URL to be set.`
      );
    }
  }

  /** Returns the https/wss version of an insecure URL, or null if it is already secure. */
  private upgrade(url: URL): URL | null {
    const scheme = this.scheme(url);
    if (scheme !== 'http' && scheme !== 'ws') return null;
    const upgraded = new URL(url.href);
    upgraded.protocol = scheme === 'http' ? 'https:' : 'wss:';
    if (url.port === '80') upgraded.port = '';
    return upgraded;
  }

  private matchExpression(source: string, url: URL, page: URL | null): ExpressionCheck {
    const expr = source.toLowerCase();
    const scheme = this.scheme(url);

    if (expr === '*') {
      // Chrome and Firefox also let '*' cover ws: and wss:; Safari may not.
      const matches = ['http', 'https', 'ws', 'wss'].includes(scheme) || (!!page && this.scheme(page) === scheme);
      return matches
        ? { matches }
        : { matches, nearMiss: `'*' does not cover ${scheme}: URLs; add ${scheme}: explicitly.` };
    }

    if (expr === "'self'") {
      return this.matchSelf(url, page);
    }

    // Other quoted values ('unsafe-inline', nonces, hashes...) never match a URL.
    if (expr.startsWith("'")) {
      return { matches: false };
    }

    const schemeSource = expr.match(SCHEME_SOURCE);
    if (schemeSource) {
      return { matches: this.schemeMatches(schemeSource[1], scheme) };
    }

    const hostSource = expr.match(HOST_SOURCE);
    if (hostSource) {
      return this.matchHostSource(source, hostSource, url, page);
    }

    return { matches: false };
  }

  private matchSelf(url: URL, page: URL | null): ExpressionCheck {
    if (!page) return { matches: false };
    if (url.origin === page.origin) return { matches: true };

    if (url.hostname === page.hostname && url.hostname !== '') {
      const samePort = this.port(url) === this.port(page) || (url.port === '' && page.port === '');
      const scheme = this.scheme(url);
      const pageScheme = this.scheme(page);
      const secureUpgrade = scheme === 'https' || scheme === 'wss';
      const insecurePage = pageScheme === 'http' && (scheme === 'http' || scheme === 'ws');
      if (samePort && (secureUpgrade || insecurePage)) return { matches: true };
    }

    return url.hostname === page.hostname
      ? { matches: false, nearMiss: `'self' means ${page.origin}, and ${url.origin} is a different origin (scheme or port differs).` }
      : { matches: false };
  }

  private matchHostSource(source: string, parts: RegExpMatchArray, url: URL, page: URL | null): ExpressionCheck {
    const [, exprScheme, exprHost, exprPort, exprPath] = parts;
    const host = url.hostname.toLowerCase();
    const hostPart = exprHost.toLowerCase();
    if (!host) return { matches: false };

    if (hostPart.startsWith('*.')) {
      if (!host.endsWith(hostPart.slice(1))) {
        return host === hostPart.slice(2)
          ? { matches: false, nearMiss: `${source} only covers subdomains of ${host}, not ${host} itself.` }
          : { matches: false };
      }
    } else if (hostPart !== '*' && hostPart !== host) {
      return { matches: false };
    }

    const scheme = this.scheme(url);
    if (exprScheme) {
      if (!this.schemeMatches(exprScheme.toLowerCase(), scheme)) {
        return { matches: false, nearMiss: `${source} has the right host but does not allow ${scheme}: URLs.` };
      }
    } else {
      // A source without a scheme inherits the page's scheme (https when unknown).
      const pageScheme = page ? this.scheme(page) : 'https';
      if (!this.schemeMatches(pageScheme, scheme)) {
        return {
          matches: false,
          nearMiss: `${source} has no scheme, so it only allows ${pageScheme}: (the page's scheme), not ${scheme}:.`,
        };
      }
    }

    if (exprPort !== '*') {
      const allowedPort = exprPort === undefined ? (DEFAULT_PORTS[scheme] ?? null) : Number(exprPort);
      if (allowedPort !== this.port(url)) {
        const actual = this.port(url) ?? 'default';
        return {
          matches: false,
          nearMiss: `${source} has the right host but not port ${actual}; add :${actual} or :* to the source.`,
        };
      }
    }

    if (exprPath && !this.pathMatches(exprPath, url.pathname)) {
      return { matches: false, nearMiss: `${source} has the right host but the path ${url.pathname} is outside ${exprPath}.` };
    }

    return { matches: true, pathRestricted: !!exprPath && exprPath !== '/' };
  }

  /** CSP3 scheme-part matching, which lets insecure schemes match their secure upgrades. */
  private schemeMatches(expected: string, actual: string): boolean {
    if (expected === actual) return true;
    if (expected === 'http') return actual === 'https';
    if (expected === 'ws') return actual === 'wss' || actual === 'http' || actual === 'https';
    if (expected === 'wss') return actual === 'https';
    return false;
  }

  /** CSP3 path-part matching: a trailing slash allows everything below that directory. */
  private pathMatches(exprPath: string, urlPath: string): boolean {
    const exact = !exprPath.endsWith('/');
    const exprSegments = exprPath.split('/');
    const urlSegments = urlPath.split('/');

    if (exprSegments.length > urlSegments.length) return false;
    if (exact && exprSegments.length !== urlSegments.length) return false;
    if (!exact) exprSegments.pop();

    return exprSegments.every((segment, i) => this.decode(segment) === this.decode(urlSegments[i]));
  }

  private addNonceAndHashNotes(sources: string[], type: ResourceType, notes: string[]): void {
    if (type !== 'script' && type !== 'style') return;
    const lower = sources.map((s) => s.toLowerCase());
    if (lower.some((s) => s.startsWith("'nonce-"))) {
      notes.push('Elements carrying the policy nonce are allowed whatever their URL.');
    }
    if (type === 'script' && lower.some((s) => /^'sha(256|384|512)-/.test(s))) {
      notes.push('External scripts whose integrity attribute matches a hash in the policy are also allowed.');
    }
  }

  private addMixedContentNote(url: URL, page: URL | null, type: ResourceType, notes: string[]): void {
    if (!page || !SUBRESOURCE_TYPES.has(type)) return;
    const scheme = this.scheme(url);
    if (this.scheme(page) === 'https' && (scheme === 'http' || scheme === 'ws')) {
      notes.push('This is an insecure request from an https: page: browsers block or upgrade it as mixed content, whatever the CSP says.');
    }
  }

  private describe(url: URL): string {
    return url.origin !== 'null' ? url.origin + url.pathname : `${this.scheme(url)}: URLs`;
  }

  private scheme(url: URL): string {
    return url.protocol.slice(0, -1).toLowerCase();
  }

  private port(url: URL): number | null {
    return url.port ? Number(url.port) : (DEFAULT_PORTS[this.scheme(url)] ?? null);
  }

  private decode(segment: string): string {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }
}
