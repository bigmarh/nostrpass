/**
 * Transport Abstraction Layer
 *
 * Provides a unified interface for communicating with the vault across different platforms.
 *
 * IMPORTANT: Cross-origin SharedWorker is NOT possible. The embassy runs on third-party
 * sites (e.g., primal.net) and cannot directly connect to vault.nostrpass.com's SharedWorker.
 *
 * Available transport modes:
 * - service-worker: Mobile devices use ServiceWorker bridge (iframe → SW → vault tab)
 * - iframe-fallback: Desktop uses existing iframe + postMessage (default, most compatible)
 *
 * The 'shared-worker' mode is only valid when embassy and vault are SAME ORIGIN,
 * which only happens in development or special deployment scenarios.
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
 * Check if embassy and vault are on the same origin.
 * Only when same-origin can we use SharedWorker directly.
 */
function isSameOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.location.origin === VAULT_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Detect the appropriate transport mode based on platform and browser capabilities.
 *
 * Priority:
 * 1. Same-origin + SharedWorker available → 'shared-worker' (dev only typically)
 * 2. Mobile + ServiceWorker available → 'service-worker'
 * 3. Otherwise → 'iframe-fallback' (existing embassy behavior)
 */
export function detectTransportMode(): TransportMode {
  // Check if running in browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'iframe-fallback';
  }

  // Same-origin check: only use SharedWorker if vault is on same origin
  // (e.g., development on localhost, or first-party vault deployment)
  if (isSameOrigin() && typeof SharedWorker !== 'undefined') {
    return 'shared-worker';
  }

  // Mobile detection - use ServiceWorker bridge
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && 'serviceWorker' in navigator) {
    return 'service-worker';
  }

  // Desktop cross-origin: use existing iframe + postMessage
  return 'iframe-fallback';
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
