const CSP_CLIPPER_URL = 'https://csp-clipper.josetelesmaciel.workers.dev';

export interface CspClipperResponse {
  url: string;
  csp: string | null;
  title: string | null;
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

    if (!response.ok && response.status !== 200) {
      const body = await response.json() as CspClipperResponse;
      throw new Error(body.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<CspClipperResponse>;
  }
}
