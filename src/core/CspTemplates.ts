import type { CspDirectives, CspTemplate, ICspTemplateService } from './types';

/**
 * Predefined CSP templates for common use cases
 */
export const CSP_TEMPLATES: CspTemplate[] = [
  {
    id: 'strict',
    name: 'Strict CSP',
    description: 'Maximum security using nonces/hashes only. Best for new projects.',
    policy: {
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
  {
    id: 'basic',
    name: 'Basic Secure',
    description: 'Good balance of security and compatibility. Allows self and HTTPS resources.',
    policy: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https:'],
      'style-src': ["'self'", 'https:', "'unsafe-inline'"],
      'img-src': ["'self'", 'https:', 'data:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https:'],
      'frame-src': ["'self'", 'https:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
  {
    id: 'spa',
    name: 'Single Page App',
    description: 'For SPAs using CDNs and third-party services.',
    policy: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'connect-src': ["'self'", 'https://api.example.com'],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
  {
    id: 'api',
    name: 'API Only',
    description: 'Minimal CSP for backend APIs without UI rendering.',
    policy: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
    },
  },
  {
    id: 'development',
    name: 'Development Mode',
    description: 'Permissive policy for local development. DO NOT use in production!',
    policy: {
      'default-src': ["'self'", 'http://localhost:*', 'ws://localhost:*'],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http://localhost:*'],
      'style-src': ["'self'", "'unsafe-inline'", 'http://localhost:*'],
      'img-src': ["'self'", 'data:', 'http://localhost:*'],
      'font-src': ["'self'", 'data:', 'http://localhost:*'],
      'connect-src': ["'self'", 'http://localhost:*', 'ws://localhost:*'],
    },
  },
  {
    id: 'legacy',
    name: 'Legacy Support',
    description: 'More permissive for legacy applications. Migrate away from this over time.',
    policy: {
      'default-src': ["'self'", 'https:'],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https:'],
      'img-src': ["'self'", 'data:', 'https:', 'http:'],
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:', 'wss:'],
      'frame-src': ["'self'", 'https:'],
      'object-src': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
];

/**
 * Service for managing CSP templates
 */
export class CspTemplateService implements ICspTemplateService {
  /**
   * Get all available templates
   */
  getTemplates(): CspTemplate[] {
    return CSP_TEMPLATES;
  }

  /**
   * Get a specific template by ID
   */
  getTemplateById(id: string): CspTemplate | undefined {
    return CSP_TEMPLATES.find(t => t.id === id);
  }

  /**
   * Apply a template to get a policy
   */
  applyTemplate(id: string): CspDirectives | null {
    const template = this.getTemplateById(id);
    if (!template) return null;
    
    // Deep clone to avoid mutations
    return JSON.parse(JSON.stringify(template.policy)) as CspDirectives;
  }
}
