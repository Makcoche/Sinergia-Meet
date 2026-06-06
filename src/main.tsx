import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Centralized API interceptor to facilitate seamless hosting on Vercel or local development
try {
  const originalFetch = window.fetch.bind(window);
  
  // Attempt to define the custom fetch wrapper on window
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: async function (input: any, init: any) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isCloudRun = window.location.hostname.includes('.run.app');
        
        // Automatically retrieve custom Vercel env var if defined, or fallback to standard Cloud Run environment
        // @ts-ignore
        let apiBase = (import.meta.env.VITE_API_URL as string) || '';
        if (!apiBase && !isLocalhost && !isCloudRun) {
          apiBase = 'https://ais-pre-4wafxtrn3bmnou2273ujz2-574065866095.us-east1.run.app';
        }

        if (apiBase) {
          const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
          const cleanUrl = input.startsWith('/') ? input : `/${input}`;
          const targetUrl = `${cleanBase}${cleanUrl}`;
          
          const newInit: RequestInit = {
            ...init,
            mode: 'cors',
            credentials: init?.credentials || 'include',
          };
          
          return originalFetch(targetUrl, newInit);
        }
      }
      return originalFetch(input, init);
    }
  });
} catch (e) {
  console.warn("AI Studio Sandbox: Could not patch global window.fetch safely. Falling back to default fetch.", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
