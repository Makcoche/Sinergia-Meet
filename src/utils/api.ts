/**
 * Centralized API client wrapper to ensure CORS compatibility
 * both locally and when running inside external hosting providers like Vercel.
 */

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  let finalUrl = input;
  let finalInit: RequestInit = init || {};

  // Find if we are running in browser context
  let isRunApp = false;
  try {
    const hostname = window.location.hostname;
    isRunApp = hostname.endsWith('.run.app') || 
               hostname === 'localhost' || 
               hostname === '127.0.0.1' || 
               hostname === '0.0.0.0';
  } catch (e) {
    // SSR or Node context
  }

  // If we are in the main GCP container (Cloud Run) or local, relative path is ALWAYS 
  // 100% correct, secure, same-origin, and bypasses all CORS or environment misconfigurations.
  // @ts-ignore
  const apiBase = isRunApp ? '' : ((import.meta.env.VITE_API_URL as string) || '');

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
    } else {
      // Relative path is 100% robust and automatically same-origin.
      // This is the cleanest and most robust approach for unified full-stack containers.
      finalInit = {
        ...init,
        credentials: init?.credentials || 'include',
      };
    }
  }

  return window.fetch(finalUrl, finalInit);
}
