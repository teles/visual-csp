import { deflate, inflate } from 'pako';
import type { EditorState, IUrlStateManager, StatePayload } from '../core/types';

/**
 * Manages editor state persistence via URL hash using compression.
 * Uses pako (zlib) for compression and URL-safe Base64 encoding.
 *
 * Single Responsibility: serialization/deserialization of state to URL.
 * Dependency Inversion: depends on the IUrlStateManager abstraction.
 */
export class UrlStateManager implements IUrlStateManager {
  /**
   * Compress and save the current editor state to the URL hash.
   */
  save(state: EditorState): void {
    const cspText = this.buildCspText(state);

    if (!cspText && !state.projectName && !state.projectUrl) {
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    const payload: StatePayload = {
      n: state.projectName,
      u: state.projectUrl,
      c: cspText,
    };

    // Only include 'r' if true to minimize URL size
    if (state.isReportOnly) {
      payload.r = true;
    }

    const json = JSON.stringify(payload);
    const utf8Arr = new TextEncoder().encode(json);
    const compressed = deflate(utf8Arr);

    let binary = '';
    compressed.forEach((b) => (binary += String.fromCharCode(b)));

    const base64 = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    window.history.replaceState(null, '', '#' + base64);
  }

  /**
   * Load editor state from the URL hash, decompressing and parsing it.
   * Returns null if no valid state is found.
   */
  load(): EditorState | null {
    const hash = window.location.hash.substring(1);
    if (!hash) return null;

    try {
      let str = hash.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';

      const binary = atob(str);
      const compressed = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        compressed[i] = binary.charCodeAt(i);
      }

      const utf8Arr = inflate(compressed);
      const decodedText = new TextDecoder().decode(utf8Arr);

      let rawCsp = '';
      let projectName = '';
      let projectUrl = '';
      let isReportOnly = false;

      try {
        // JSON format (v4+)
        const data: StatePayload = JSON.parse(decodedText);
        projectName = data.n || '';
        projectUrl = data.u || '';
        rawCsp = data.c || '';
        isReportOnly = data.r === true;
      } catch {
        // Fallback: raw CSP string (v3 format)
        rawCsp = decodedText;
      }

      return {
        directives: {},
        projectName,
        projectUrl,
        rawCsp,
        isReportOnly,
      };
    } catch (e) {
      console.error('Invalid compressed URL state.', e);
      window.history.replaceState(null, '', window.location.pathname);
      return null;
    }
  }

  /**
   * Build CSP text from state directives.
   * This is a simple helper to avoid circular deps.
   */
  private buildCspText(state: EditorState): string {
    const entries = Object.entries(state.directives);
    if (entries.length === 0) return '';

    const generated = entries
      .map(([name, values]) =>
        values.length > 0 ? `${name} ${values.join(' ')}` : name
      )
      .join('; ');

    return generated + ';';
  }
}
