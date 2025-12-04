/**
 * Transport Abstraction Layer
 *
 * Provides a unified interface for communicating with the vault across different platforms:
 * - Desktop: SharedWorker (direct connection to vault worker)
 * - Mobile: ServiceWorker (via iframe bridge to vault tab)
 * - Fallback: iframe (existing behavior for unsupported environments)
 */

export const VAULT_ORIGIN = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : 'https://vault.nostrpass.com';

/**
 * Transport mode types
 */
export type TransportMode = 'shared-worker' | 'service-worker' | 'iframe-fallback';

/**
 * Base interface for vault transports
 */
export interface VaultTransport {
  /**
   * Connect to the vault
   */
  connect(): Promise<void>;

  /**
   * Send a request to the vault and wait for response
   */
  request<T = any>(method: string, params?: any): Promise<T>;

  /**
   * Disconnect from the vault
   */
  disconnect(): void;

  /**
   * Check if transport is connected
   */
  isConnected(): boolean;
}

/**
 * Detect the appropriate transport mode based on platform and browser capabilities
 */
export function detectTransportMode(): TransportMode {
  // Check if running in browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'iframe-fallback';
  }

  // Mobile detection
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Mobile devices use ServiceWorker
    if ('serviceWorker' in navigator) {
      return 'service-worker';
    }
    // Mobile without ServiceWorker support falls back to iframe
    return 'iframe-fallback';
  } else {
    // Desktop devices use SharedWorker if available
    if (typeof SharedWorker !== 'undefined') {
      return 'shared-worker';
    }
    // Desktop without SharedWorker support falls back to iframe
    return 'iframe-fallback';
  }
}

/**
 * Create a transport instance based on the detected mode
 */
export async function createTransport(mode?: TransportMode): Promise<VaultTransport> {
  const transportMode = mode || detectTransportMode();

  console.log(`[Transport] Creating transport with mode: ${transportMode}`);

  switch (transportMode) {
    case 'shared-worker': {
      const { SharedWorkerTransport } = await import('./shared-worker');
      return new SharedWorkerTransport();
    }
    case 'service-worker': {
      const { ServiceWorkerTransport } = await import('./service-worker');
      return new ServiceWorkerTransport();
    }
    case 'iframe-fallback':
    default: {
      // For iframe fallback, we'll return a stub that indicates the embassy
      // should use its existing iframe-based communication
      throw new Error('iframe-fallback mode should use existing Embassy implementation');
    }
  }
}

/**
 * Transport error types
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export class TransportTimeoutError extends TransportError {
  constructor(method: string, timeout: number) {
    super(`Request timeout after ${timeout}ms`, 'TIMEOUT', { method, timeout });
    this.name = 'TransportTimeoutError';
  }
}

export class VaultNotOpenError extends TransportError {
  constructor() {
    super('Vault is not open. Please open the vault in another tab.', 'VAULT_NOT_OPEN');
    this.name = 'VaultNotOpenError';
  }
}

export class TransportDisconnectedError extends TransportError {
  constructor() {
    super('Transport is disconnected', 'DISCONNECTED');
    this.name = 'TransportDisconnectedError';
  }
}
