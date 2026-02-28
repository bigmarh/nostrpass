function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('window-nostr.js');
  script.type = 'module';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function setupBridge() {
  window.addEventListener('nostrpass-lite-request', async (event) => {
    const customEvent = event as CustomEvent<{
      id: string;
      method: string;
      params: Record<string, unknown>;
    }>;

    const { id, method, params } = customEvent.detail;

    try {
      const response = await chrome.runtime.sendMessage({
        type: method,
        data: params,
        origin: window.location.origin,
        requestId: id,
      });

      window.dispatchEvent(
        new CustomEvent('nostrpass-lite-response', {
          detail: {
            id,
            result: response?.success ? response.data : undefined,
            error: response?.success ? undefined : response?.error,
            errorCode: response?.errorCode,
            requestId: response?.requestId,
          },
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('nostrpass-lite-response', {
          detail: {
            id,
            error: error instanceof Error ? error.message : 'Extension communication error',
          },
        })
      );
    }
  });
}

injectScript();
setupBridge();
