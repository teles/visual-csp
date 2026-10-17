const CSP_CLIPPER_URL = 'https://csp-clipper.josetelesmaciel.workers.dev';

/** One policy delivered by a site, from either CSP header. */
export interface FetchedPolicy {
  policy: string;
  /** True when it came from Content-Security-Policy-Report-Only (monitored, not enforced). */
  reportOnly: boolean;
}

export interface CspClipperResponse {
  url: string;
  csp: string | null;
  title: string | null;
  /** Whether `csp` came from the report-only header. Absent in older clipper versions. */
  reportOnly?: boolean;
  /** Every policy the site sends, enforced first. Absent in older clipper versions. */
  policies?: FetchedPolicy[];
  message?: string;
  error?: string;
}

export interface ICspClipperService {
  fetchCsp(url: string): Promise<CspClipperResponse>;
}

export class CspClipperService implements ICspClipperService {
  async fetchCsp(url: string): Promise<CspClipperResponse> {
    const response = await fetch(
      `${CSP_CLIPPER_URL}/csp?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      const body = await response.json() as CspClipperResponse;
      throw new Error(body.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<CspClipperResponse>;
  }
}
