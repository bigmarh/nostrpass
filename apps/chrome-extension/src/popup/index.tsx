/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import '../styles/globals.css';

// Get the current tab's URL to use as the app identifier
async function getCurrentTabOrigin(): Promise<string> {
  try {
    // Query the active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      // Sanitize the hostname to match vault's format (replace dots with underscores)
      // e.g., "primal.net" -> "primal_net"
      return url.hostname.replace(/\./g, '_');
    }
  } catch (e) {
    console.error('[NostrPass] Failed to get current tab:', e);
  }
  // Fallback for extension pages or errors
  return 'extension';
}

// Initialize the app with the current site's origin
async function init() {
  const appOrigin = await getCurrentTabOrigin();
  console.log('[NostrPass] Current app origin:', appOrigin);

  // Set the app origin in the URL hash so the router can access it via useParams()
  // This mimics the vault's /:app route parameter
  // The hash will be like #/primal_net for primal.net
  if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
    window.location.hash = `#/${appOrigin}`;
  }

  const root = document.getElementById('root');
  if (root) {
    render(() => <App />, root);
  }
}

init();
