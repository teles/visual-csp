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
  /** Human-readable warnings about parts of the input that parse() ignores. */
  diagnose(raw: string): string[];
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
 * Result of a CSP validation check.
 */
export interface ValidationResult {
  /** Whether the value meets basic structural requirements. */
  valid: boolean;
  /** Optional warning message (value is still accepted). */
  warning?: string;
}

/**
 * Contract for validating CSP directive names and values.
 * Single Responsibility: only handles validation logic.
 */
export interface ICspValidator {
  validateDirective(name: string): ValidationResult;
  validateValue(value: string, directive: string): ValidationResult;
}

/**
 * Data structure for CSP report exports.
 */
export interface ReportData {
  projectName: string;
  projectUrl: string;
  generatedAt: string;
  directives: CspDirectives;
  findings: EvaluationFinding[];
  rawCsp: string;
}

/**
 * Contract for exporting CSP reports as Markdown or JSON.
 * Single Responsibility: handles report formatting and file downloads.
 */
export interface ICspReportExporter {
  exportAsMarkdown(data: ReportData): string;
  exportAsJson(data: ReportData): string;
  downloadMarkdown(data: ReportData): void;
  downloadJson(data: ReportData): void;
}

/**
 * Export format for CSP server configurations.
 */
export type ExportFormat = 'html' | 'nginx' | 'apache' | 'cloudflare' | 'express';

/**
 * Contract for exporting CSP in different server configuration formats.
 * Single Responsibility: handles CSP formatting for various server environments.
 */
export interface ICspExporter {
  exportAsHtml(csp: string): string;
  exportAsNginx(csp: string): string;
  exportAsApache(csp: string): string;
  exportAsCloudflare(csp: string): string;
  exportAsExpress(csp: string): string;
  export(csp: string, format: ExportFormat): string;
  downloadAsExpress(csp: string): void;
  downloadAsCloudflare(csp: string): void;
  downloadAsNginx(csp: string): void;
  downloadAsApache(csp: string): void;
  downloadAsHtml(csp: string): void;
}

/**
 * Template definition for CSP policies
 */
export interface CspTemplate {
  id: string;
  name: string;
  description: string;
  policy: CspDirectives;
}

/**
 * Contract for managing CSP templates.
 * Single Responsibility: provides predefined policy templates.
 */
export interface ICspTemplateService {
  getTemplates(): CspTemplate[];
  getTemplateById(id: string): CspTemplate | undefined;
  applyTemplate(id: string): CspDirectives | null;
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
 * A run of text in the syntax-highlighted policy, rendered with x-text.
 */
export interface ColoredToken {
  text: string;
  classes: string;
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

/** Question types: single-choice or multi-select. */
export type QuestionType = 'single' | 'multi';

/**
 * A declarative CSP mutation applied by a quiz option.
 * Exactly one of add | override | remove should be provided.
 */
export interface CspEffect {
  directive: string;
  /** Values to merge into the directive (deduped). */
  add?: string[];
  /** Replace the directive entirely ([] = boolean directive with no values). */
  override?: string[];
  /** Remove the directive from the policy. */
  remove?: boolean;
}

/**
 * A single option in a quiz question, co-located with its CSP effects.
 */
export interface QuizOption {
  value: string;
  label: string;
  description: string;
  /** Effects applied when this option is selected. Receives full answers for cross-question logic. */
  effects?: (answers: QuizAnswers) => CspEffect[];
}

/**
 * A quiz question. Supports single-choice and multi-select types.
 */
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  /** Supplementary hint shown below the question (useful for multi). */
  hint?: string;
  options: QuizOption[];
  /** Skip this question (and its effects) based on previous answers. */
  skipIf?: (answers: QuizAnswers) => boolean;
}

/**
 * User's answers to the quiz.
 * Single questions store a string; multi questions store a string[].
 */
export type QuizAnswers = Record<string, string | string[]>;

/**
 * Contract for the CSP quiz feature.
 * Single Responsibility: generates CSP policies from quiz answers.
 */
export interface ICspQuiz {
  getQuestions(): QuizQuestion[];
  generatePolicy(answers: QuizAnswers): CspDirectives;
}

/**
 * Kinds of requests that can be tested against a policy.
 * Each maps to the CSP directive that governs it.
 */
export type ResourceType =
  | 'script'
  | 'style'
  | 'img'
  | 'font'
  | 'connect'
  | 'media'
  | 'object'
  | 'frame'
  | 'worker'
  | 'manifest'
  | 'form-action'
  | 'frame-ancestors'
  | 'base-uri';

/**
 * Outcome of testing a URL against a policy.
 */
export interface UrlMatchResult {
  allowed: boolean;
  /** The URL actually tested (resolved and possibly upgraded to https). */
  testedUrl: string;
  resourceType: ResourceType;
  /** Directive the browser looks for first (e.g. script-src-elem). */
  effectiveDirective: string;
  /** Directive that decided the outcome after fallback, or null if none applies. */
  appliedDirective: string | null;
  /** Source expression that allowed the request, if any. */
  matchedSource: string | null;
  /** Human-readable explanation of the outcome. */
  reason: string;
  /** Extra caveats (strict-dynamic, mixed content, 'self' without page URL...). */
  notes: string[];
}

/**
 * Contract for testing URLs against a policy.
 * Single Responsibility: implements the CSP3 URL matching algorithm.
 */
export interface ICspUrlMatcher {
  /**
   * @param directives - The policy to test against.
   * @param url - The resource URL (relative URLs resolve against pageUrl).
   * @param type - What kind of request loads the URL.
   * @param pageUrl - URL of the page applying the policy, used for 'self'.
   * @throws Error when the URL cannot be parsed.
   */
  match(directives: CspDirectives, url: string, type: ResourceType, pageUrl?: string): UrlMatchResult;
}

/**
 * Resource types offered by the URL tester, in display order.
 */
export const RESOURCE_TYPE_OPTIONS: ReadonlyArray<{ value: ResourceType; label: string }> = [
  { value: 'script', label: 'Script (<script src>)' },
  { value: 'style', label: 'Stylesheet (<link rel=stylesheet>)' },
  { value: 'img', label: 'Image' },
  { value: 'font', label: 'Font' },
  { value: 'connect', label: 'fetch / XHR / WebSocket' },
  { value: 'frame', label: 'Iframe' },
  { value: 'media', label: 'Audio / video' },
  { value: 'worker', label: 'Worker' },
  { value: 'object', label: 'Plugin (<object>/<embed>)' },
  { value: 'manifest', label: 'Web app manifest' },
  { value: 'form-action', label: 'Form submission' },
  { value: 'frame-ancestors', label: 'Page embedding this site' },
  { value: 'base-uri', label: '<base href>' },
];
