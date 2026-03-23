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

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let requestCounter = 0;
const pending = new Map<string, PendingResolver>();

function nextRequestId() {
  requestCounter += 1;
  return `np-lite-${Date.now()}-${requestCounter}`;
}

window.addEventListener('nostrpass-lite-response', ((event: CustomEvent) => {
  const details = event.detail as {
    id: string;
    result?: unknown;
    error?: string;
    errorCode?: string;
  };

  const resolver = pending.get(details.id);
  if (!resolver) {
    return;
  }

  pending.delete(details.id);

  if (details.error) {
    const error = new Error(details.error) as Error & { code?: string };
    if (details.errorCode) {
      error.code = details.errorCode;
    }
    resolver.reject(error);
    return;
  }

  resolver.resolve(details.result);
}) as EventListener);

function sendRequest<T>(method: string, params: Record<string, unknown>) {
  return new Promise<T>((resolve, reject) => {
    const id = nextRequestId();
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('NostrPass Lite request timeout'));
    }, 60000);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    window.dispatchEvent(
      new CustomEvent('nostrpass-lite-request', {
        detail: { id, method, params },
      })
    );
  });
}

const nostrProvider = {
  async getPublicKey(): Promise<string> {
    return sendRequest('getPublicKey', {});
  },

  async signEvent(event: UnsignedEvent): Promise<SignedEvent> {
    return sendRequest('signEvent', { event });
  },

  nip04: {
    async encrypt(pubkey: string, plaintext: string): Promise<string> {
      return sendRequest('nip04.encrypt', { pubkey, plaintext });
    },
    async decrypt(pubkey: string, ciphertext: string): Promise<string> {
      return sendRequest('nip04.decrypt', { pubkey, ciphertext });
    },
  },

  nip44: {
    async encrypt(pubkey: string, plaintext: string): Promise<string> {
      return sendRequest('nip44.encrypt', { pubkey, plaintext });
    },
    async decrypt(pubkey: string, ciphertext: string): Promise<string> {
      return sendRequest('nip44.decrypt', { pubkey, ciphertext });
    },
  },
};

declare global {
  interface Window {
    nostr?: typeof nostrProvider;
  }
}

if (!window.nostr) {
  window.nostr = nostrProvider;
  window.dispatchEvent(new Event('nostr-ready'));
}

export {};
