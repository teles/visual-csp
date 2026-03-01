import { Severity } from 'csp_evaluator/dist/finding';

/**
 * Represents a parsed CSP as a record of directive names to their values.
 */
export type CspDirectives = Record<string, string[]>;

/**
 * Payload structure for URL state serialization.
 * Uses short keys to minimize compressed URL size.
 */
export interface StatePayload {
  /** Project name */
  n: string;
  /** Project URL */
  u: string;
  /** CSP text */
  c: string;
}

/**
 * Represents the full editor state.
 */
export interface EditorState {
  directives: CspDirectives;
  projectName: string;
  projectUrl: string;
  rawCsp: string;
}

/**
 * A CSP finding enriched with a severity label for display.
 */
export interface EvaluationFinding {
  directive: string;
  description: string;
  severity: Severity;
  severityLabel: string;
  value?: string;
}

/**
 * Contract for parsing CSP strings.
 * Single Responsibility: only handles string -> structured data.
 */
export interface ICspParser {
  parse(raw: string): CspDirectives;
}

/**
 * Contract for generating CSP strings from structured data.
 * Single Responsibility: only handles structured data -> string.
 */
export interface ICspGenerator {
  generate(directives: CspDirectives): string;
}

/**
 * Contract for evaluating CSP security.
 * Single Responsibility: only handles security analysis.
 */
export interface ICspEvaluator {
  evaluate(cspText: string): EvaluationFinding[];
}

/**
 * Contract for URL state management (compression/decompression).
 * Single Responsibility: handles serialization to/from URL hash.
 */
export interface IUrlStateManager {
  save(state: EditorState): void;
  load(): EditorState | null;
}

/**
 * Contract for clipboard operations.
 * Single Responsibility: handles clipboard interactions.
 */
export interface IClipboardService {
  copyText(text: string): Promise<boolean>;
}

/**
 * Contract for chip color classification.
 * Single Responsibility: determines visual classification of CSP values.
 */
export interface IChipColorizer {
  getColor(value: string): ChipColor;
}

/**
 * Chip color result with CSS classes.
 */
export interface ChipColor {
  classes: string;
  category: 'keyword' | 'nonce' | 'hash' | 'scheme' | 'domain' | 'wildcard';
}

/**
 * CSP keywords that should be auto-quoted when entered by the user.
 */
export const CSP_KEYWORDS = [
  'self',
  'unsafe-inline',
  'unsafe-eval',
  'none',
  'report-sample',
  'strict-dynamic',
  'unsafe-hashes',
  'wasm-eval',
  'wasm-unsafe-eval',
] as const;

/**
 * Standard CSP directives for the datalist autocomplete.
 */
export const CSP_DIRECTIVE_NAMES = [
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'connect-src',
  'img-src',
  'font-src',
  'media-src',
  'object-src',
  'frame-src',
  'frame-ancestors',
  'child-src',
  'worker-src',
  'base-uri',
  'form-action',
  'navigate-to',
  'report-uri',
  'report-to',
  'manifest-src',
  'prefetch-src',
  'upgrade-insecure-requests',
  'block-all-mixed-content',
  'sandbox',
] as const;
