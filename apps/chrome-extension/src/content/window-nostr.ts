/**
 * Window Nostr Provider (NIP-07)
 *
 * This script is injected into the page context to provide window.nostr
 * It communicates with the content script via custom events
 */

interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
}

interface SignedEvent extends UnsignedEvent {
  id: string;
  pubkey: string;
  sig: string;
}

type RelayMap = Record<string, { read: boolean; write: boolean }>;

interface NostrOperationOptions {
  identityIndex?: number;
}

// Generate unique request IDs
let requestCounter = 0;
function generateRequestId(): string {
  return `nostrpass-${Date.now()}-${++requestCounter}`;
}

// Pending request resolvers
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();

// Listen for responses from content script
window.addEventListener('nostrpass-response', ((event: CustomEvent) => {
  const { id, result, error } = event.detail;
  const pending = pendingRequests.get(id);

  if (pending) {
    pendingRequests.delete(id);
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }
}) as EventListener);

// Send request to content script and wait for response
function sendToExtension<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = generateRequestId();

    // Set up timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 60000);

    // Store resolver
    pendingRequests.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    // Dispatch request to content script
    window.dispatchEvent(
      new CustomEvent('nostrpass-request', {
        detail: { id, method, params },
      })
    );
  });
}

// Create the window.nostr provider
const nostrProvider = {
  async getPublicKey(options?: NostrOperationOptions): Promise<string> {
    return sendToExtension<string>('getPublicKey', {
      identityIndex: options?.identityIndex,
    });
  },

  async signEvent(
    event: UnsignedEvent,
    options?: NostrOperationOptions
  ): Promise<SignedEvent> {
    return sendToExtension<SignedEvent>('signEvent', {
      event,
      identityIndex: options?.identityIndex,
    });
  },

  async signData(
    message: string,
    options?: NostrOperationOptions
  ): Promise<string> {
    return sendToExtension<string>('signData', {
      message,
      identityIndex: options?.identityIndex,
    });
  },

  async getRelays(options?: NostrOperationOptions): Promise<RelayMap> {
    return sendToExtension<RelayMap>('getRelays', {
      identityIndex: options?.identityIndex,
    });
  },

  nip04: {
    async encrypt(
      pubkey: string,
      plaintext: string,
      options?: NostrOperationOptions
    ): Promise<string> {
      return sendToExtension<string>('nip04.encrypt', {
        pubkey,
        plaintext,
        identityIndex: options?.identityIndex,
      });
    },

    async decrypt(
      pubkey: string,
      ciphertext: string,
      options?: NostrOperationOptions
    ): Promise<string> {
      return sendToExtension<string>('nip04.decrypt', {
        pubkey,
        ciphertext,
        identityIndex: options?.identityIndex,
      });
    },
  },

  nip44: {
    async encrypt(
      pubkey: string,
      plaintext: string,
      options?: NostrOperationOptions
    ): Promise<string> {
      return sendToExtension<string>('nip44.encrypt', {
        pubkey,
        plaintext,
        identityIndex: options?.identityIndex,
      });
    },

    async decrypt(
      pubkey: string,
      ciphertext: string,
      options?: NostrOperationOptions
    ): Promise<string> {
      return sendToExtension<string>('nip44.decrypt', {
        pubkey,
        ciphertext,
        identityIndex: options?.identityIndex,
      });
    },
  },
};

// Install window.nostr
declare global {
  interface Window {
    nostr?: typeof nostrProvider;
  }
}

// Only set if not already present (don't override other extensions)
if (!window.nostr) {
  window.nostr = nostrProvider;

  // Dispatch event to notify page that nostr is ready
  window.dispatchEvent(new Event('nostr-ready'));

  console.log('[NostrPass] NIP-07 provider installed');
}
