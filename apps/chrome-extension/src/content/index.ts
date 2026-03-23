/**
 * Content Script
 *
 * Runs in the content script context (isolated from page).
 * Injects window-nostr.ts into the page and bridges messages to the background.
 */

// Inject the window-nostr script into the page context
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('window-nostr.js');
  script.type = 'module';

  // Remove script tag after injection (cleanup)
  script.onload = () => {
    script.remove();
  };

  // Inject at document_start to run before page scripts
  (document.head || document.documentElement).appendChild(script);
}

// Bridge messages from page to background service worker
function setupMessageBridge() {
  // Listen for requests from injected script
  window.addEventListener('nostrpass-request', async (event) => {
    const customEvent = event as CustomEvent<{
      id: string;
      method: string;
      params: Record<string, unknown>;
    }>;

    const { id, method, params } = customEvent.detail;

    try {
      // Forward to background service worker
      const response = await chrome.runtime.sendMessage({
        type: method,
        data: params,
        origin: window.location.origin,
        requestId: id,
      });

      // Send response back to page
      window.dispatchEvent(
        new CustomEvent('nostrpass-response', {
          detail: {
            id,
            result: response?.success ? response.data : undefined,
            error: response?.success ? undefined : response?.error,
          },
        })
      );
    } catch (error) {
      // Handle extension disconnection or other errors
      window.dispatchEvent(
        new CustomEvent('nostrpass-response', {
          detail: {
            id,
            error:
              error instanceof Error
                ? error.message
                : 'Extension communication error',
          },
        })
      );
    }
  });
}

// Initialize
injectScript();
setupMessageBridge();

console.log('[NostrPass] Content script initialized');
