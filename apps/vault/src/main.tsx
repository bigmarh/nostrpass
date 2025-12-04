/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './index.css';
import { getCryptoWorker } from './services/cryptoWorkerSingleton';
import { setupServiceWorkerBridge } from './services/serviceWorkerBridge';

// Ensure backgrounds follow Tailwind dark/light classes (no forced transparency)

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// Register service worker and setup bridge
async function initializeServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[Vault] ServiceWorker not supported');
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    console.log('[Vault] ServiceWorker registered:', registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('[Vault] ServiceWorker ready');

    // Setup bridge with crypto worker
    const cryptoWorker = getCryptoWorker();
    setupServiceWorkerBridge(cryptoWorker);
    console.log('[Vault] ServiceWorker bridge setup complete');
  } catch (error) {
    console.error('[Vault] Failed to register ServiceWorker:', error);
  }
}

// Initialize service worker (non-blocking)
initializeServiceWorker().catch(console.error);

// No manual background overrides — CSS controls backgrounds now

render(() => <App />, root!);