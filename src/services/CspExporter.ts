import type { ICspExporter, ExportFormat } from '../core/types';

/**
 * Exports CSP strings in multiple formats for different environments.
 *
 * Single Responsibility: only handles formatting CSP for different platforms.
 */
export class CspExporter implements ICspExporter {
  /**
   * Export CSP as an HTML meta tag.
   */
  exportAsHtml(csp: string): string {
    return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  }

  /**
   * Export CSP as an Nginx configuration directive.
   */
  exportAsNginx(csp: string): string {
    return `add_header Content-Security-Policy "${csp}" always;`;
  }

  /**
   * Export CSP as an Apache .htaccess directive.
   */
  exportAsApache(csp: string): string {
    return `Header set Content-Security-Policy "${csp}"`;
  }

  /**
   * Export CSP for Cloudflare _headers file.
   */
  exportAsCloudflare(csp: string): string {
    return `/*\n  Content-Security-Policy: ${csp}`;
  }

  /**
   * Export CSP as Express.js middleware.
   */
  exportAsExpress(csp: string): string {
    return `app.use((req, res, next) => {\n  res.setHeader("Content-Security-Policy", "${csp}");\n  next();\n});`;
  }

  /**
   * Export CSP in the specified format.
   */
  export(csp: string, format: ExportFormat): string {
    switch (format) {
      case 'html':
        return this.exportAsHtml(csp);
      case 'nginx':
        return this.exportAsNginx(csp);
      case 'apache':
        return this.exportAsApache(csp);
      case 'cloudflare':
        return this.exportAsCloudflare(csp);
      case 'express':
        return this.exportAsExpress(csp);
      default:
        return csp;
    }
  }

  /**
   * Download CSP as Express.js middleware file.
   */
  downloadAsExpress(csp: string): void {
    const content = this.exportAsExpress(csp);
    this.triggerDownload(content, 'express-csp-middleware.js', 'text/javascript');
  }

  /**
   * Download CSP as Cloudflare _headers file.
   */
  downloadAsCloudflare(csp: string): void {
    const content = this.exportAsCloudflare(csp);
    this.triggerDownload(content, '_headers', 'text/plain');
  }

  /**
   * Download CSP as Nginx configuration.
   */
  downloadAsNginx(csp: string): void {
    const content = this.exportAsNginx(csp);
    this.triggerDownload(content, 'csp-nginx.conf', 'text/plain');
  }

  /**
   * Download CSP as Apache .htaccess file.
   */
  downloadAsApache(csp: string): void {
    const content = this.exportAsApache(csp);
    this.triggerDownload(content, '.htaccess', 'text/plain');
  }

  /**
   * Download CSP as HTML meta tag.
   */
  downloadAsHtml(csp: string): void {
    const content = this.exportAsHtml(csp);
    this.triggerDownload(content, 'csp-meta-tag.html', 'text/html');
  }

  /**
   * Triggers a file download using Blob and URL.createObjectURL.
   */
  private triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
