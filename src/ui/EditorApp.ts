import type {
  CspDirectives,
  EvaluationFinding,
  IChipColorizer,
  IClipboardService,
  ICspEvaluator,
  ICspGenerator,
  ICspParser,
  ICspTemplateService,
  ICspValidator,
  IUrlStateManager,
} from '../core/types';
import { CSP_KEYWORDS } from '../core/types';

/**
 * Main Alpine.js component for the Visual CSP Editor.
 *
 * Dependency Inversion: all dependencies are injected via constructor,
 * making this component testable and decoupled from implementations.
 *
 * Single Responsibility: orchestrates the UI state and user interactions.
 * All heavy logic is delegated to injected services.
 */
export class EditorApp {
  constructor(
    private parser: ICspParser,
    private generator: ICspGenerator,
    private evaluator: ICspEvaluator,
    private urlState: IUrlStateManager,
    private clipboard: IClipboardService,
    private colorizer: IChipColorizer,
    private validator: ICspValidator,
    private templateService: ICspTemplateService
  ) {}

  /**
   * Creates the Alpine.js data object for x-data binding.
   */
  createAlpineData() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const app = this;

    return {
      // State
      rawCsp: '',
      directives: {} as CspDirectives,
      newDirectiveName: '',
      copyText: 'Copy CSP Text',
      shareText: 'Copy Shareable Link',
      projectName: '',
      projectUrl: '',
      findings: [] as EvaluationFinding[],
      darkMode: false,
      directiveWarning: '' as string,
      valueWarnings: {} as Record<string, string>,
      rawCspWarning: '' as string,
      collapsedDirectives: {} as Record<string, boolean>,
      templates: app.templateService.getTemplates(),
      showTemplates: false,
      isReportOnly: false,

      // Alpine lifecycle
      init() {
        // Dark mode: check localStorage, then system preference
        const stored = localStorage.getItem('darkMode');
        if (stored !== null) {
          this.darkMode = stored === 'true';
        } else if (typeof window.matchMedia === 'function') {
          this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        this.applyDarkMode();

        const state = app.urlState.load();
        if (state) {
          this.projectName = state.projectName;
          this.projectUrl = state.projectUrl;
          this.rawCsp = state.rawCsp;
          this.isReportOnly = state.isReportOnly;
          if (this.rawCsp) {
            this.parseCsp();
          }
        }
      },

      toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', String(this.darkMode));
        this.applyDarkMode();
      },

      applyDarkMode() {
        document.documentElement.classList.toggle('dark', this.darkMode);
      },

      // --- URL State ---
      updateUrl() {
        app.urlState.save({
          directives: this.directives,
          projectName: this.projectName,
          projectUrl: this.projectUrl,
          rawCsp: this.rawCsp,
          isReportOnly: this.isReportOnly,
        });
        this.evaluateFindings();
      },

      // --- CSP Logic ---
      parseCsp() {
        const parsed = app.parser.parse(this.rawCsp);
        const cleanDirectives: CspDirectives = {};
        const warnings: string[] = [];
        
        for (const [directive, values] of Object.entries(parsed)) {
          // Validate directive name
          const dirResult = app.validator.validateDirective(directive);
          if (!dirResult.valid) {
            warnings.push(`Directive "${directive}": ${dirResult.warning}`);
            continue; // Skip invalid directive completely
          }
          if (dirResult.warning) {
            warnings.push(`Directive "${directive}": ${dirResult.warning}`);
          }
          
          // Validate and filter values
          const validValues: string[] = [];
          for (const value of values) {
            const valResult = app.validator.validateValue(value, directive);
            if (!valResult.valid) {
              warnings.push(`Value "${value}" in ${directive}: ${valResult.warning}`);
              // Don't add invalid value
            } else {
              validValues.push(value);
              if (valResult.warning) {
                warnings.push(`Value "${value}" in ${directive}: ${valResult.warning}`);
              }
            }
          }
          
          // Only add directive if it has valid values or is a boolean directive
          if (validValues.length > 0 || directive === 'upgrade-insecure-requests' || directive === 'block-all-mixed-content') {
            cleanDirectives[directive] = validValues;
          }
        }
        
        this.directives = cleanDirectives;
        
        // Show consolidated warning if there were issues
        if (warnings.length > 0) {
          const preview = warnings.slice(0, 3).join(' • ');
          const more = warnings.length > 3 ? ` (${warnings.length - 3} more issues)` : '';
          this.rawCspWarning = `Found ${warnings.length} issue(s): ${preview}${more}`;
        } else {
          this.rawCspWarning = '';
        }
        
        this.updateUrl();
      },

      validateRawCsp() {
        const raw = this.rawCsp.trim();
        if (!raw) {
          this.rawCspWarning = '';
          return;
        }

        // Check for obvious non-CSP content
        if (!/[a-z-]+/.test(raw)) {
          this.rawCspWarning = 'This doesn\'t look like a valid CSP. Expected format: "directive-name value1 value2; another-directive value"';
          return;
        }

        // Check if it looks like random text
        const parts = raw.split(/[;\s]+/).filter(Boolean);
        const validDirectivePattern = /^[a-z][a-z0-9-]*$/;
        const hasValidDirective = parts.some(part => validDirectivePattern.test(part));

        if (!hasValidDirective) {
          this.rawCspWarning = 'No valid CSP directive found. Directives should look like: default-src, script-src, style-src, etc.';
          return;
        }

        // Try to parse and see if we get empty result
        try {
          const parsed = app.parser.parse(raw);
          if (Object.keys(parsed).length === 0) {
            this.rawCspWarning = 'Could not parse any directives from this text. Check the format: "directive-name value1 value2"';
            return;
          }
        } catch {
          this.rawCspWarning = 'Error parsing CSP. Make sure the format is correct.';
          return;
        }

        this.rawCspWarning = '';
      },

      generateCsp(): string {
        return app.generator.generate(this.directives);
      },

      addValue(directive: string, event: KeyboardEvent) {
        event.preventDefault();
        const input = event.target as HTMLInputElement;
        let val = input.value.trim();

        if (!val) {
          input.value = '';
          return;
        }

        // Auto-quote known keywords
        if (CSP_KEYWORDS.includes(val.toLowerCase() as typeof CSP_KEYWORDS[number])) {
          val = `'${val.toLowerCase()}'`;
        }

        // Validate the value
        const result = app.validator.validateValue(val, directive);

        if (!result.valid) {
          // Force Alpine reactivity by creating new object
          const updated = { ...this.valueWarnings };
          updated[directive] = result.warning || 'Invalid value.';
          this.valueWarnings = updated;
          this.clearWarning('value', directive);
          input.value = '';
          return;
        }

        if (result.warning) {
          const updated = { ...this.valueWarnings };
          updated[directive] = result.warning;
          this.valueWarnings = updated;
          this.clearWarning('value', directive);
        } else {
          // Clear any existing warning
          const updated = { ...this.valueWarnings };
          delete updated[directive];
          this.valueWarnings = updated;
        }

        if (!this.directives[directive].includes(val)) {
          this.directives[directive].push(val);
          this.updateUrl();
        }
        input.value = '';
      },

      removeValue(directive: string, index: number) {
        this.directives[directive].splice(index, 1);
        this.updateUrl();
      },

      addDirective() {
        const name = this.newDirectiveName.trim().toLowerCase();
        if (!name) {
          this.newDirectiveName = '';
          return;
        }

        const result = app.validator.validateDirective(name);

        if (!result.valid) {
          this.directiveWarning = result.warning || 'Invalid directive name.';
          this.clearWarning('directive');
          this.newDirectiveName = '';
          return;
        }

        if (result.warning) {
          this.directiveWarning = result.warning;
          this.clearWarning('directive');
        }

        if (!this.directives[name]) {
          this.directives[name] = [];
          this.updateUrl();
        }
        this.newDirectiveName = '';
      },

      removeDirective(directive: string) {
        delete this.directives[directive];
        delete this.collapsedDirectives[directive];
        this.updateUrl();
      },

      toggleCollapse(directive: string) {
        this.collapsedDirectives[directive] = !this.collapsedDirectives[directive];
      },

      isCollapsed(directive: string): boolean {
        return !!this.collapsedDirectives[directive];
      },

      toggleReportOnly() {
        this.isReportOnly = !this.isReportOnly;
        this.updateUrl();
      },

      getHeaderName(): string {
        return this.isReportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';
      },

      hasReportingDirective(): boolean {
        return (
          this.directives['report-uri']?.length > 0 ||
          this.directives['report-to']?.length > 0
        );
      },

      resetEditor() {
        this.directives = {};
        this.rawCsp = '';
        this.projectName = '';
        this.projectUrl = '';
        this.findings = [];
        this.directiveWarning = '';
        this.valueWarnings = {};
        this.rawCspWarning = '';
        this.isReportOnly = false;
        this.updateUrl();
      },

      applyTemplate(templateId: string) {
        const policy = app.templateService.applyTemplate(templateId);
        if (policy) {
          this.directives = policy;
          this.rawCsp = '';
          this.showTemplates = false;
          this.updateUrl();
        }
      },

      clearWarning(type: 'directive' | 'value', directive?: string) {
        setTimeout(() => {
          if (type === 'directive') {
            this.directiveWarning = '';
          } else if (directive) {
            const updated = { ...this.valueWarnings };
            delete updated[directive];
            this.valueWarnings = updated;
          }
        }, 5000);
      },

      // --- Clipboard ---
      async copyToClipboard() {
        const success = await app.clipboard.copyText(this.generateCsp());
        if (success) {
          this.copyText = 'Copied! ✓';
          setTimeout(() => (this.copyText = 'Copy CSP Text'), 2000);
        }
      },

      async copyShareLink() {
        const success = await app.clipboard.copyText(window.location.href);
        if (success) {
          this.shareText = 'Link Copied! 🔗';
          setTimeout(() => (this.shareText = 'Copy Shareable Link'), 2000);
        }
      },

      // --- Visual ---
      getChipColor(val: string): string {
        return app.colorizer.getColor(val).classes;
      },

      // --- Security Evaluation ---
      evaluateFindings() {
        const csp = this.generateCsp();
        this.findings = app.evaluator.evaluate(csp);
      },

      getSeverityColor(finding: EvaluationFinding): string {
        switch (finding.severityLabel) {
          case 'High':
            return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
          case 'Medium':
            return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
          case 'High (Possible)':
            return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
          case 'Medium (Possible)':
            return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
          case 'Syntax':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
          case 'Info':
            return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
          default:
            return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
        }
      },
    };
  }
}
