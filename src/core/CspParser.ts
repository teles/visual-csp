import type { CspDirectives, ICspParser } from './types';

/**
 * Parses raw CSP strings into structured directive data.
 * Handles common edge cases like HTTP header prefixes.
 *
 * Follows how browsers read a policy: a header value may hold several
 * comma-separated policies, and within a policy only the first occurrence
 * of each directive counts.
 *
 * Single Responsibility: only converts CSP text to CspDirectives.
 */
export class CspParser implements ICspParser {
  /**
   * Parse a raw CSP string into a record of directives and their values.
   * Only the first policy of a comma-separated list is returned.
   *
   * @param raw - The raw CSP string, possibly with HTTP header prefix.
   * @returns A record mapping directive names to arrays of values.
   */
  parse(raw: string): CspDirectives {
    const directives: CspDirectives = {};

    for (const [name, values] of this.tokenize(this.splitPolicies(raw)[0] ?? '')) {
      // Browsers ignore every occurrence of a directive after the first.
      if (!(name in directives)) {
        directives[name] = values;
      }
    }

    return directives;
  }

  /**
   * Describe the parts of the input that parse() ignores, so the UI can warn about them.
   */
  diagnose(raw: string): string[] {
    const warnings: string[] = [];
    const policies = this.splitPolicies(raw);

    if (policies.length > 1) {
      warnings.push(
        `Found ${policies.length} comma-separated policies; only the first was loaded. Browsers enforce all of them.`
      );
    }

    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const [name] of this.tokenize(policies[0] ?? '')) {
      if (seen.has(name)) duplicates.add(name);
      seen.add(name);
    }
    for (const name of duplicates) {
      warnings.push(`Directive "${name}" appears more than once; browsers ignore every occurrence after the first.`);
    }

    return warnings;
  }

  private splitPolicies(raw: string): string[] {
    // Strip HTTP header prefix if present (e.g., from curl/devtools copy)
    const cleaned = raw.replace(
      /^content-security-policy(-report-only)?:\s*/i,
      ''
    );

    // A header value is a comma-separated list of policies (commas in sources must be percent-encoded).
    return cleaned
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  private tokenize(policy: string): Array<[string, string[]]> {
    return policy
      .split(';')
      .map((p) => p.trim().split(/\s+/).filter((part) => part.length > 0))
      .filter((parts) => parts.length > 0)
      .map((parts) => [parts[0].toLowerCase(), parts.slice(1)]);
  }
}
