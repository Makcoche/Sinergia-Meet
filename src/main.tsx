import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Centralized API interceptor to facilitate seamless hosting on Vercel or local development
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as any).url || '';
  }

  if (url.startsWith('/api/')) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isCloudRun = window.location.hostname.includes('.run.app');
    
    // Automatically retrieve custom Vercel env var if defined, or fallback to standard Cloud Run environment
    let apiBase = ((import.meta as any).env?.VITE_API_URL as string) || '';
    if (!apiBase && !isLocalhost && !isCloudRun) {
      apiBase = 'https://ais-pre-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';
    }

    if (apiBase) {
      const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      const targetUrl = `${cleanBase}${cleanUrl}`;
      
      if (typeof input === 'string') {
        input = targetUrl;
      } else if (input instanceof URL) {
        input = new URL(targetUrl);
      } else if (input && typeof input === 'object') {
        const headers = new Headers(init?.headers || (input as Request).headers);
        const requestInit: RequestInit = {
          ...init,
          method: init?.method || (input as Request).method,
          headers,
          body: init?.body || (input as any).body,
          mode: 'cors',
          credentials: init?.credentials || 'include',
        };
        input = new Request(targetUrl, requestInit);
      }
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
