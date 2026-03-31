import { describe, it, expect } from 'vitest';
import { CspQuiz, QUIZ_QUESTIONS } from '../src/core/CspQuiz';
import type { QuizAnswers } from '../src/core/types';

// Baseline answers for non-API apps (cdnScripts is multi → empty array)
const base = (overrides: QuizAnswers = {}): QuizAnswers => ({
  appType: 'static',
  securityLevel: 'balanced',
  inlineScripts: 'no',
  inlineStyles: 'no',
  cdnScripts: [],
  externalFonts: 'no',
  externalImages: 'self',
  externalApis: 'no',
  iframes: 'no',
  websockets: 'no',
  ...overrides,
});

describe('CspQuiz', () => {
  const quiz = new CspQuiz();

  describe('getQuestions', () => {
    it('should return all quiz questions', () => {
      const questions = quiz.getQuestions();
      expect(questions).toBeDefined();
      expect(questions.length).toBeGreaterThan(0);
      expect(questions).toEqual(QUIZ_QUESTIONS);
    });

    it('should have unique question IDs', () => {
      const ids = quiz.getQuestions().map(q => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each question should have type single or multi', () => {
      for (const q of quiz.getQuestions()) {
        expect(['single', 'multi']).toContain(q.type);
      }
    });

    it('cdnScripts question should be multi', () => {
      const q = quiz.getQuestions().find(q => q.id === 'cdnScripts');
      expect(q?.type).toBe('multi');
    });

    it('appType question should be single', () => {
      const q = quiz.getQuestions().find(q => q.id === 'appType');
      expect(q?.type).toBe('single');
    });

    it('multi questions should have a hint', () => {
      const multiQuestions = quiz.getQuestions().filter(q => q.type === 'multi');
      for (const q of multiQuestions) {
        expect(q.hint).toBeTruthy();
      }
    });

    it('should have at least 2 options per question', () => {
      for (const q of quiz.getQuestions()) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have unique option values within each question', () => {
      for (const q of quiz.getQuestions()) {
        const values = q.options.map(o => o.value);
        expect(new Set(values).size).toBe(values.length);
      }
    });

    it('each question should have id and question text', () => {
      for (const q of quiz.getQuestions()) {
        expect(q.id).toBeTruthy();
        expect(q.question).toBeTruthy();
      }
    });

    it('each option should have value, label and description', () => {
      for (const q of quiz.getQuestions()) {
        for (const o of q.options) {
          expect(o.value).toBeTruthy();
          expect(o.label).toBeTruthy();
          expect(o.description).toBeTruthy();
        }
      }
    });

    it('non-appType questions should have skipIf defined', () => {
      const others = quiz.getQuestions().filter(q => q.id !== 'appType');
      for (const q of others) {
        expect(q.skipIf).toBeDefined();
      }
    });

    it('skipIf skips all feature questions when appType is api', () => {
      const apiAnswers: QuizAnswers = { appType: 'api' };
      const skippable = quiz.getQuestions().filter(q => q.id !== 'appType');
      for (const q of skippable) {
        expect(q.skipIf!(apiAnswers)).toBe(true);
      }
    });
  });

  describe('generatePolicy', () => {
    it('should generate API-only policy', () => {
      const policy = quiz.generatePolicy({ appType: 'api' });

      expect(policy['default-src']).toEqual(["'none'"]);
      expect(policy['frame-ancestors']).toEqual(["'none'"]);
      expect(policy['base-uri']).toEqual(["'none'"]);
      expect(policy['form-action']).toEqual(["'none'"]);
      expect(policy['script-src']).toBeUndefined();
      expect(policy['style-src']).toBeUndefined();
      expect(policy['img-src']).toBeUndefined();
      expect(policy['font-src']).toBeUndefined();
      expect(policy['connect-src']).toBeUndefined();
    });

    it('should generate strict policy for static site', () => {
      const policy = quiz.generatePolicy(base({ securityLevel: 'strict' }));

      expect(policy['default-src']).toEqual(["'none'"]);
      expect(policy['script-src']).toEqual(["'self'"]);
      expect(policy['style-src']).toEqual(["'self'"]);
      expect(policy['img-src']).toEqual(["'self'"]);
      expect(policy['object-src']).toEqual(["'none'"]);
      expect(policy['frame-ancestors']).toEqual(["'none'"]);
      expect(policy['upgrade-insecure-requests']).toEqual([]);
    });

    it('should generate balanced policy for SPA with jsDelivr CDN', () => {
      const policy = quiz.generatePolicy(base({
        appType: 'spa',
        inlineScripts: 'yes',
        inlineStyles: 'yes',
        cdnScripts: ['jsdelivr'],
        externalFonts: 'google',
        externalImages: 'https',
        securityLevel: 'balanced',
      }));

      expect(policy['default-src']).toEqual(["'self'"]);
      expect(policy['script-src']).toContain("'self'");
      expect(policy['script-src']).toContain("'unsafe-inline'");
      expect(policy['script-src']).toContain('https://cdn.jsdelivr.net');
      expect(policy['script-src']).toContain('https://unpkg.com');
      expect(policy['style-src']).toContain("'unsafe-inline'");
      expect(policy['style-src']).toContain('https://fonts.googleapis.com');
      expect(policy['font-src']).toContain('https://fonts.gstatic.com');
      expect(policy['img-src']).toContain('https:');
      expect(policy['frame-src']).toEqual(["'none'"]);
    });

    it('should add strict-dynamic for inline scripts in strict mode', () => {
      const policy = quiz.generatePolicy(base({ inlineScripts: 'yes', securityLevel: 'strict' }));
      expect(policy['script-src']).toContain("'strict-dynamic'");
      expect(policy['script-src']).not.toContain("'unsafe-inline'");
    });

    it('cdnScripts analytics → adds GTM, GA and connect-src entries', () => {
      const policy = quiz.generatePolicy(base({ cdnScripts: ['analytics'] }));
      expect(policy['script-src']).toContain('https://www.googletagmanager.com');
      expect(policy['script-src']).toContain('https://www.google-analytics.com');
      expect(policy['connect-src']).toContain('https://www.google-analytics.com');
      expect(policy['img-src']).toContain('https:');
    });

    it('cdnScripts jsdelivr + analytics combines effects', () => {
      const policy = quiz.generatePolicy(base({ cdnScripts: ['jsdelivr', 'analytics'] }));
      expect(policy['script-src']).toContain('https://cdn.jsdelivr.net');
      expect(policy['script-src']).toContain('https://www.googletagmanager.com');
    });

    it('cdnScripts does not duplicate values from multiple selections', () => {
      const policy = quiz.generatePolicy(base({ cdnScripts: ['analytics', 'ads'] }));
      const httpsCount = policy['img-src'].filter(v => v === 'https:').length;
      expect(httpsCount).toBe(1);
    });

    it('should handle YouTube iframes', () => {
      const policy = quiz.generatePolicy(base({ iframes: 'youtube' }));
      expect(policy['frame-src']).toContain('https://www.youtube.com');
      expect(policy['frame-src']).toContain('https://player.vimeo.com');
    });

    it('should handle Google Maps iframes', () => {
      const policy = quiz.generatePolicy(base({ iframes: 'maps' }));
      expect(policy['frame-src']).toContain('https://www.google.com');
      expect(policy['frame-src']).toContain('https://maps.google.com');
    });

    it('should handle various iframes with https', () => {
      const policy = quiz.generatePolicy(base({ iframes: 'various' }));
      expect(policy['frame-src']).toContain('https:');
    });

    it('iframes: no → frame-src is none', () => {
      const policy = quiz.generatePolicy(base({ iframes: 'no' }));
      expect(policy['frame-src']).toEqual(["'none'"]);
    });

    it('should add WebSocket support (self)', () => {
      const policy = quiz.generatePolicy(base({ websockets: 'self' }));
      expect(policy['connect-src']).toContain('wss:');
    });

    it('should add WebSocket support (external)', () => {
      const policy = quiz.generatePolicy(base({ websockets: 'external' }));
      expect(policy['connect-src']).toContain('wss:');
    });

    it('should add data URIs for images', () => {
      const policy = quiz.generatePolicy(base({ externalImages: 'datauri' }));
      expect(policy['img-src']).toContain('data:');
      expect(policy['img-src']).toContain('https:');
    });

    it('should add https: to connect-src for any APIs', () => {
      const policy = quiz.generatePolicy(base({ externalApis: 'any' }));
      expect(policy['connect-src']).toContain('https:');
    });

    it('should handle other font services', () => {
      const policy = quiz.generatePolicy(base({ externalFonts: 'other' }));
      expect(policy['font-src']).toContain('https:');
      expect(policy['font-src']).toContain('data:');
    });

    it('should use permissive frame-ancestors for permissive mode', () => {
      const policy = quiz.generatePolicy(base({ securityLevel: 'permissive' }));
      expect(policy['frame-ancestors']).toEqual(["'self'"]);
      expect(policy['upgrade-insecure-requests']).toBeUndefined();
    });

    it('should always include object-src none, base-uri self, form-action self for non-API', () => {
      const policy = quiz.generatePolicy(base());
      expect(policy['object-src']).toEqual(["'none'"]);
      expect(policy['base-uri']).toEqual(["'self'"]);
      expect(policy['form-action']).toEqual(["'self'"]);
    });

    it('should handle empty answers gracefully', () => {
      const policy = quiz.generatePolicy({});
      expect(policy).toBeDefined();
      expect(policy['default-src']).toEqual(["'self'"]);
    });
  });
});
