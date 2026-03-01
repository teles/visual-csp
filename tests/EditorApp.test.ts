import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorApp } from '../src/ui/EditorApp';
import type {
  ICspParser,
  ICspGenerator,
  ICspEvaluator,
  IUrlStateManager,
  IClipboardService,
  IChipColorizer,
  ICspValidator,
  ICspTemplateService,
  CspDirectives,
  CspTemplate,
  EditorState,
  EvaluationFinding,
  ChipColor,
  ValidationResult,
} from '../src/core/types';

// --- Mock implementations ---
function createMockParser(): ICspParser {
  return {
    parse: vi.fn((raw: string): CspDirectives => {
      if (!raw) return {};
      const result: CspDirectives = {};
      raw.split(';').filter(Boolean).forEach((part) => {
        const tokens = part.trim().split(/\s+/);
        if (tokens.length > 0) {
          result[tokens[0]] = tokens.slice(1);
        }
      });
      return result;
    }),
  };
}

function createMockGenerator(): ICspGenerator {
  return {
    generate: vi.fn((directives: CspDirectives): string => {
      const entries = Object.entries(directives);
      if (entries.length === 0) return '';
      return entries.map(([k, v]) => (v.length > 0 ? `${k} ${v.join(' ')}` : k)).join('; ') + ';';
    }),
  };
}

function createMockEvaluator(): ICspEvaluator {
  return {
    evaluate: vi.fn((): EvaluationFinding[] => []),
  };
}

function createMockUrlState(): IUrlStateManager {
  return {
    save: vi.fn(),
    load: vi.fn((): EditorState | null => null),
  };
}

function createMockClipboard(): IClipboardService {
  return {
    copyText: vi.fn(async (): Promise<boolean> => true),
  };
}

function createMockColorizer(): IChipColorizer {
  return {
    getColor: vi.fn((): ChipColor => ({
      classes: 'bg-blue-100 text-blue-800 border-blue-200',
      category: 'domain',
    })),
  };
}

function createMockValidator(): ICspValidator {
  return {
    validateDirective: vi.fn((): ValidationResult => ({ valid: true })),
    validateValue: vi.fn((): ValidationResult => ({ valid: true })),
  };
}

function createMockTemplateService(): ICspTemplateService {
  const mockTemplates: CspTemplate[] = [
    {
      id: 'test',
      name: 'Test Template',
      description: 'A test template',
      policy: { 'default-src': ["'self'"] },
    },
  ];
  return {
    getTemplates: vi.fn(() => mockTemplates),
    getTemplateById: vi.fn((id: string) => mockTemplates.find(t => t.id === id)),
    applyTemplate: vi.fn((id: string) => {
      const template = mockTemplates.find(t => t.id === id);
      return template ? JSON.parse(JSON.stringify(template.policy)) : null;
    }),
  };
}

describe('EditorApp', () => {
  let mockParser: ICspParser;
  let mockGenerator: ICspGenerator;
  let mockEvaluator: ICspEvaluator;
  let mockUrlState: IUrlStateManager;
  let mockClipboard: IClipboardService;
  let mockColorizer: IChipColorizer;
  let mockValidator: ICspValidator;
  let mockTemplateService: ICspTemplateService;
  let app: EditorApp;

  beforeEach(() => {
    mockParser = createMockParser();
    mockGenerator = createMockGenerator();
    mockEvaluator = createMockEvaluator();
    mockUrlState = createMockUrlState();
    mockClipboard = createMockClipboard();
    mockColorizer = createMockColorizer();
    mockValidator = createMockValidator();
    mockTemplateService = createMockTemplateService();
    app = new EditorApp(mockParser, mockGenerator, mockEvaluator, mockUrlState, mockClipboard, mockColorizer, mockValidator, mockTemplateService);

    // Mock matchMedia for dark mode tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should create Alpine data object with required properties', () => {
    const data = app.createAlpineData();
    expect(data).toHaveProperty('rawCsp');
    expect(data).toHaveProperty('directives');
    expect(data).toHaveProperty('newDirectiveName');
    expect(data).toHaveProperty('copyText');
    expect(data).toHaveProperty('shareText');
    expect(data).toHaveProperty('projectName');
    expect(data).toHaveProperty('projectUrl');
    expect(data).toHaveProperty('findings');
  });

  it('should initialize with default values', () => {
    const data = app.createAlpineData();
    expect(data.rawCsp).toBe('');
    expect(data.directives).toEqual({});
    expect(data.projectName).toBe('');
    expect(data.projectUrl).toBe('');
    expect(data.findings).toEqual([]);
    expect(data.copyText).toBe('Copy CSP Text');
    expect(data.shareText).toBe('Copy Shareable Link');
    expect(data.darkMode).toBe(false);
  });

  it('should load state from URL on init', () => {
    const savedState: EditorState = {
      directives: {},
      projectName: 'Test Project',
      projectUrl: 'https://test.com',
      rawCsp: "default-src 'self'",
    };
    vi.mocked(mockUrlState.load).mockReturnValue(savedState);

    const data = app.createAlpineData();
    data.init();

    expect(mockUrlState.load).toHaveBeenCalled();
    expect(data.projectName).toBe('Test Project');
    expect(data.projectUrl).toBe('https://test.com');
  });

  it('should parse CSP via the parser', () => {
    const data = app.createAlpineData();
    data.rawCsp = "default-src 'self'; script-src https://cdn.com";
    data.parseCsp();

    expect(mockParser.parse).toHaveBeenCalledWith("default-src 'self'; script-src https://cdn.com");
    expect(Object.keys(data.directives).length).toBeGreaterThan(0);
  });

  it('should generate CSP via the generator', () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    data.generateCsp();

    expect(mockGenerator.generate).toHaveBeenCalledWith({ 'default-src': ["'self'"] });
  });

  it('should add a new directive', () => {
    const data = app.createAlpineData();
    data.newDirectiveName = 'img-src';
    data.addDirective();

    expect(data.directives['img-src']).toEqual([]);
    expect(data.newDirectiveName).toBe('');
  });

  it('should not add duplicate directives', () => {
    const data = app.createAlpineData();
    data.directives = { 'img-src': ["'self'"] };
    data.newDirectiveName = 'img-src';
    data.addDirective();

    expect(data.directives['img-src']).toEqual(["'self'"]);
  });

  it('should remove a directive', () => {
    const data = app.createAlpineData();
    data.directives = {
      'default-src': ["'self'"],
      'script-src': ['https://cdn.com'],
    };
    data.removeDirective('script-src');

    expect(data.directives['script-src']).toBeUndefined();
    expect(data.directives['default-src']).toBeDefined();
  });

  it('should add a value to a directive', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': ["'self'"] };

    const mockEvent = {
      preventDefault: vi.fn(),
      target: { value: 'https://cdn.com' },
    } as unknown as KeyboardEvent;

    data.addValue('script-src', mockEvent);

    expect(data.directives['script-src']).toContain('https://cdn.com');
    expect((mockEvent.target as HTMLInputElement).value).toBe('');
  });

  it('should auto-quote known CSP keywords', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': [] };

    const mockEvent = {
      preventDefault: vi.fn(),
      target: { value: 'self' },
    } as unknown as KeyboardEvent;

    data.addValue('script-src', mockEvent);
    expect(data.directives['script-src']).toContain("'self'");
  });

  it('should not add duplicate values', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': ["'self'"] };

    const mockEvent = {
      preventDefault: vi.fn(),
      target: { value: "'self'" },
    } as unknown as KeyboardEvent;

    data.addValue('script-src', mockEvent);
    expect(data.directives['script-src']).toEqual(["'self'"]);
  });

  it('should remove a value from a directive', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': ["'self'", 'https://cdn.com', 'https://api.com'] };

    data.removeValue('script-src', 1);
    expect(data.directives['script-src']).toEqual(["'self'", 'https://api.com']);
  });

  it('should reset the editor', () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    data.projectName = 'Test';
    data.projectUrl = 'https://test.com';
    data.rawCsp = "default-src 'self'";

    data.resetEditor();

    expect(data.directives).toEqual({});
    expect(data.rawCsp).toBe('');
    expect(data.projectName).toBe('');
    expect(data.projectUrl).toBe('');
    expect(data.findings).toEqual([]);
  });

  it('should get chip color via colorizer', () => {
    const data = app.createAlpineData();
    data.getChipColor("'self'");
    expect(mockColorizer.getColor).toHaveBeenCalledWith("'self'");
  });

  it('should copy CSP to clipboard', async () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    await data.copyToClipboard();
    expect(mockClipboard.copyText).toHaveBeenCalled();
  });

  it('should save state to URL on update', () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    data.projectName = 'Test';
    data.updateUrl();

    expect(mockUrlState.save).toHaveBeenCalledWith({
      directives: { 'default-src': ["'self'"] },
      projectName: 'Test',
      projectUrl: '',
      rawCsp: '',
    });
  });

  it('should return correct severity colors', () => {
    const data = app.createAlpineData();

    expect(data.getSeverityColor({ severityLabel: 'High' } as EvaluationFinding)).toContain('red');
    expect(data.getSeverityColor({ severityLabel: 'Medium' } as EvaluationFinding)).toContain('orange');
    expect(data.getSeverityColor({ severityLabel: 'Info' } as EvaluationFinding)).toContain('blue');
    expect(data.getSeverityColor({ severityLabel: 'Syntax' } as EvaluationFinding)).toContain('yellow');
  });

  it('should toggle dark mode', () => {
    const data = app.createAlpineData();
    expect(data.darkMode).toBe(false);

    data.toggleDarkMode();
    expect(data.darkMode).toBe(true);
    expect(localStorage.getItem('darkMode')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    data.toggleDarkMode();
    expect(data.darkMode).toBe(false);
    expect(localStorage.getItem('darkMode')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should load dark mode preference from localStorage on init', () => {
    localStorage.setItem('darkMode', 'true');
    const data = app.createAlpineData();
    data.init();
    expect(data.darkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    localStorage.removeItem('darkMode');
    document.documentElement.classList.remove('dark');
  });

  it('should toggle collapse state for directive', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': ["'self'"] };

    expect(data.isCollapsed('script-src')).toBe(false);

    data.toggleCollapse('script-src');
    expect(data.isCollapsed('script-src')).toBe(true);

    data.toggleCollapse('script-src');
    expect(data.isCollapsed('script-src')).toBe(false);
  });

  it('should return false for non-existent directive collapse state', () => {
    const data = app.createAlpineData();
    expect(data.isCollapsed('non-existent')).toBe(false);
  });

  it('should clean collapse state when directive is removed', () => {
    const data = app.createAlpineData();
    data.directives = { 'script-src': ["'self'"] };
    data.toggleCollapse('script-src');
    expect(data.isCollapsed('script-src')).toBe(true);

    data.removeDirective('script-src');
    expect(data.directives['script-src']).toBeUndefined();
    expect(data.isCollapsed('script-src')).toBe(false);
  });

  it('should load templates from template service', () => {
    const data = app.createAlpineData();
    expect(data.templates).toBeDefined();
    expect(data.templates.length).toBeGreaterThan(0);
    expect(data.templates[0]).toHaveProperty('id');
    expect(data.templates[0]).toHaveProperty('name');
    expect(data.templates[0]).toHaveProperty('description');
  });

  it('should apply template to directives', () => {
    const data = app.createAlpineData();
    expect(Object.keys(data.directives).length).toBe(0);

    data.applyTemplate('test');
    
    expect(Object.keys(data.directives).length).toBeGreaterThan(0);
    expect(data.directives['default-src']).toEqual(["'self'"]);
    expect(data.showTemplates).toBe(false);
  });

  it('should clear rawCsp when applying template', () => {
    const data = app.createAlpineData();
    data.rawCsp = 'some csp';
    
    data.applyTemplate('test');
    
    expect(data.rawCsp).toBe('');
  });

  it('should calculate CSP length correctly', () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    
    const length = data.getCspLength();
    const generatedCsp = data.generateCsp();
    
    expect(length).toBe(generatedCsp.length);
    expect(length).toBeGreaterThan(0);
  });

  it('should return green color for short CSP (< 2048 chars)', () => {
    const data = app.createAlpineData();
    data.directives = { 'default-src': ["'self'"] };
    
    const color = data.getCspLengthColor();
    
    expect(color).toBe('text-emerald-400');
  });

  it('should return yellow color for medium CSP (2048-4096 chars)', () => {
    const data = app.createAlpineData();
    // Mock generator to return a string with 3000 characters
    vi.mocked(mockGenerator.generate).mockReturnValue('x'.repeat(3000));
    
    const color = data.getCspLengthColor();
    
    expect(color).toBe('text-amber-400');
  });

  it('should return red color for long CSP (> 4096 chars)', () => {
    const data = app.createAlpineData();
    // Mock generator to return a string with 5000 characters
    vi.mocked(mockGenerator.generate).mockReturnValue('x'.repeat(5000));
    
    const color = data.getCspLengthColor();
    
    expect(color).toBe('text-red-400');
  });
});
