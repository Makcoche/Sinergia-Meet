/**
 * Centralized API client wrapper to ensure CORS compatibility
 * both locally and when running inside external hosting providers like Vercel.
 */

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  let hostname = '';
  try {
    hostname = window.location.hostname;
  } catch (e) {
    console.error('No se pudo leer window.location.hostname:', e);
  }

  const isLocalhost = hostname === 'localhost' || 
                      hostname === '127.0.0.1' || 
                      hostname === '0.0.0.0' || 
                      hostname.startsWith('192.168.');

  // Determine correct backend API base if running on sandboxed/outer hostnames
  // @ts-ignore
  let apiBase = (import.meta.env.VITE_API_URL as string) || '';
  if (!apiBase && !isLocalhost) {
    const isDirectDev = hostname === 'ais-dev-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';
    const isDirectPre = hostname === 'ais-pre-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';

    if (!isDirectDev && !isDirectPre) {
      if (hostname.includes('pre') || hostname.includes('shared')) {
        apiBase = 'https://ais-pre-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';
      } else {
        apiBase = 'https://ais-dev-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';
      }
    }
  }

  let finalUrl = input;
  let finalInit: RequestInit = init || {};

  if (input.startsWith('/api/')) {
    if (apiBase) {
      const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const cleanUrl = input.startsWith('/') ? input : `/${input}`;
      finalUrl = `${cleanBase}${cleanUrl}`;
      
      finalInit = {
        ...init,
        mode: 'cors',
        credentials: init?.credentials || 'include',
      };
    }
  }

  return window.fetch(finalUrl, finalInit);
}
