import type { CspDirectives, CspEffect, ICspQuiz, QuizAnswers, QuizQuestion } from './types';

function applyEffect(directives: CspDirectives, effect: CspEffect): void {
  if (effect.remove) {
    delete directives[effect.directive];
    return;
  }
  if (effect.override !== undefined) {
    directives[effect.directive] = [...effect.override];
    return;
  }
  if (effect.add) {
    const existing = directives[effect.directive] ?? [];
    directives[effect.directive] = [
      ...existing,
      ...effect.add.filter(v => !existing.includes(v)),
    ];
  } else {
    // Boolean directive (no values): ensure it exists
    directives[effect.directive] ??= [];
  }
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'appType',
    type: 'single',
    question: 'What type of application are you building?',
    options: [
      { value: 'static', label: 'Static Website', description: 'HTML, CSS, JS served as static files' },
      { value: 'spa', label: 'Single Page Application', description: 'React, Vue, Angular, Svelte, etc.' },
      { value: 'ssr', label: 'Server-Rendered App', description: 'Next.js, Nuxt, Rails, Django, etc.' },
      {
        value: 'api',
        label: 'API / Backend Only',
        description: 'REST or GraphQL API without UI',
        effects: () => [
          { directive: 'default-src', override: ["'none'"] },
          { directive: 'script-src', remove: true },
          { directive: 'style-src', remove: true },
          { directive: 'img-src', remove: true },
          { directive: 'font-src', remove: true },
          { directive: 'connect-src', remove: true },
          { directive: 'frame-ancestors', override: ["'none'"] },
          { directive: 'base-uri', override: ["'none'"] },
          { directive: 'form-action', override: ["'none'"] },
        ],
      },
    ],
  },
  {
    id: 'securityLevel',
    type: 'single',
    question: 'What is your security priority?',
    skipIf: (a) => a.appType === 'api',
    options: [
      {
        value: 'strict',
        label: 'Maximum Security',
        description: 'Strictest policy, may need more tuning',
        effects: () => [
          { directive: 'default-src', override: ["'none'"] },
          { directive: 'frame-ancestors', override: ["'none'"] },
          { directive: 'upgrade-insecure-requests', override: [] },
        ],
      },
      {
        value: 'balanced',
        label: 'Balanced',
        description: 'Good security with practical flexibility',
        effects: () => [
          { directive: 'frame-ancestors', override: ["'none'"] },
          { directive: 'upgrade-insecure-requests', override: [] },
        ],
      },
      {
        value: 'permissive',
        label: 'Compatibility First',
        description: 'More permissive, easier to deploy',
        effects: () => [
          { directive: 'frame-ancestors', override: ["'self'"] },
        ],
      },
    ],
  },
  {
    id: 'inlineScripts',
    type: 'single',
    question: 'Does your app use inline scripts?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'no', label: 'No', description: 'All scripts are in external files' },
      {
        value: 'yes',
        label: 'Yes',
        description: 'Some scripts are written directly in HTML',
        effects: (a) => [{
          directive: 'script-src',
          add: [a.securityLevel === 'strict' ? "'strict-dynamic'" : "'unsafe-inline'"],
        }],
      },
    ],
  },
  {
    id: 'inlineStyles',
    type: 'single',
    question: 'Does your app use inline styles?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'no', label: 'No', description: 'All styles are in external CSS files' },
      {
        value: 'yes',
        label: 'Yes',
        description: 'Uses style attributes or <style> tags in HTML',
        effects: () => [{ directive: 'style-src', add: ["'unsafe-inline'"] }],
      },
    ],
  },
  {
    id: 'cdnScripts',
    type: 'multi',
    question: 'Do you load scripts from external sources?',
    hint: 'Select all that apply. Click "Next" when done (or skip if none).',
    skipIf: (a) => a.appType === 'api',
    options: [
      {
        value: 'jsdelivr',
        label: 'jsDelivr / unpkg',
        description: 'Open source CDNs (jsdelivr.net, unpkg.com)',
        effects: () => [
          { directive: 'script-src', add: ['https://cdn.jsdelivr.net', 'https://unpkg.com'] },
        ],
      },
      {
        value: 'cdnjs',
        label: 'cdnjs / Cloudflare CDN',
        description: 'Cloudflare-hosted open source CDN',
        effects: () => [
          { directive: 'script-src', add: ['https://cdnjs.cloudflare.com'] },
        ],
      },
      {
        value: 'analytics',
        label: 'Google Analytics / Tag Manager',
        description: 'Tracking and analytics scripts',
        effects: () => [
          { directive: 'script-src', add: ['https://www.googletagmanager.com', 'https://www.google-analytics.com'] },
          { directive: 'connect-src', add: ['https://www.google-analytics.com', 'https://analytics.google.com'] },
          { directive: 'img-src', add: ['https:'] },
        ],
      },
      {
        value: 'ads',
        label: 'Ad networks',
        description: 'Google Ads, Meta Pixel, etc.',
        effects: () => [
          { directive: 'script-src', add: ['https://www.googleadservices.com', 'https://connect.facebook.net'] },
          { directive: 'img-src', add: ['https:'] },
        ],
      },
    ],
  },
  {
    id: 'externalFonts',
    type: 'single',
    question: 'Do you use external web fonts?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'no', label: 'No', description: 'Using system fonts or self-hosted fonts' },
      {
        value: 'google',
        label: 'Google Fonts',
        description: 'Loading fonts from fonts.googleapis.com',
        effects: () => [
          { directive: 'style-src', add: ['https://fonts.googleapis.com'] },
          { directive: 'font-src', add: ['https://fonts.gstatic.com'] },
        ],
      },
      {
        value: 'other',
        label: 'Other Font Services',
        description: 'Adobe Fonts, Font Awesome, etc.',
        effects: () => [
          { directive: 'font-src', add: ['https:', 'data:'] },
        ],
      },
    ],
  },
  {
    id: 'externalImages',
    type: 'single',
    question: 'Where do your images come from?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'self', label: 'Self-hosted only', description: 'All images on your own domain' },
      {
        value: 'https',
        label: 'Any HTTPS source',
        description: 'Images from various HTTPS origins',
        effects: () => [{ directive: 'img-src', add: ['https:'] }],
      },
      {
        value: 'datauri',
        label: 'Also uses data URIs',
        description: 'Inline base64 images or SVGs',
        effects: () => [{ directive: 'img-src', add: ['https:', 'data:'] }],
      },
    ],
  },
  {
    id: 'externalApis',
    type: 'single',
    question: 'Does your app connect to external APIs?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'no', label: 'No', description: 'Only communicates with own backend' },
      { value: 'specific', label: 'Specific APIs', description: 'Known API domains (add manually after quiz)' },
      {
        value: 'any',
        label: 'Various HTTPS APIs',
        description: 'Multiple or dynamic API endpoints',
        effects: () => [{ directive: 'connect-src', add: ['https:'] }],
      },
    ],
  },
  {
    id: 'iframes',
    type: 'single',
    question: 'Does your app embed iframes?',
    skipIf: (a) => a.appType === 'api',
    options: [
      {
        value: 'no',
        label: 'No',
        description: 'No embedded content',
        effects: () => [{ directive: 'frame-src', override: ["'none'"] }],
      },
      {
        value: 'youtube',
        label: 'YouTube / Vimeo',
        description: 'Embedded video players',
        effects: () => [
          { directive: 'frame-src', add: ['https://www.youtube.com', 'https://player.vimeo.com'] },
        ],
      },
      {
        value: 'maps',
        label: 'Google Maps',
        description: 'Embedded maps',
        effects: () => [
          { directive: 'frame-src', add: ['https://www.google.com', 'https://maps.google.com'] },
        ],
      },
      {
        value: 'various',
        label: 'Various / Unknown sources',
        description: 'Multiple or dynamic iframe origins',
        effects: () => [{ directive: 'frame-src', add: ['https:'] }],
      },
    ],
  },
  {
    id: 'websockets',
    type: 'single',
    question: 'Does your app use WebSockets?',
    skipIf: (a) => a.appType === 'api',
    options: [
      { value: 'no', label: 'No', description: 'Standard HTTP only' },
      {
        value: 'self',
        label: 'Own server',
        description: 'WebSocket to your own domain',
        effects: () => [{ directive: 'connect-src', add: ['wss:'] }],
      },
      {
        value: 'external',
        label: 'External services',
        description: 'Third-party WebSocket services',
        effects: () => [{ directive: 'connect-src', add: ['wss:'] }],
      },
    ],
  },
];

export class CspQuiz implements ICspQuiz {
  getQuestions(): QuizQuestion[] {
    return QUIZ_QUESTIONS;
  }

  generatePolicy(answers: QuizAnswers): CspDirectives {
    const directives: CspDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    };

    for (const question of QUIZ_QUESTIONS) {
      if (question.skipIf?.(answers)) continue;

      const answer = answers[question.id];
      if (answer === undefined || answer === null) continue;

      const selectedValues = Array.isArray(answer) ? answer : [answer];
      for (const val of selectedValues) {
        const option = question.options.find(o => o.value === val);
        if (option?.effects) {
          for (const effect of option.effects(answers)) {
            applyEffect(directives, effect);
          }
        }
      }
    }

    return directives;
  }
}
