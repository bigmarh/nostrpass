import type { CryptoDelegate, LitePermissionOperation } from '@nostrpass/lite-core';

type WorkerResponse = { id: string; result?: unknown; error?: string };

const CALL_TIMEOUT_MS = 30_000;

/**
 * Promise-based bridge to the crypto Web Worker.
 * Implements CryptoDelegate so it can be passed directly to LiteCore.
 */
export class WorkerBridge implements CryptoDelegate {
  private readonly worker: Worker;
  private readonly pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  isKeyLoaded = false;

  constructor() {
    this.worker = new Worker(new URL('./crypto.worker', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, result, error } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(id);
      if (error !== undefined) p.reject(new Error(error));
      else p.resolve(result);
    };
    this.worker.onerror = (e) => {
      const msg = e.message ?? 'Crypto worker failed to load';
      console.error('[WorkerBridge] Worker error:', msg, e);
      // Reject all pending calls so callers get an error instead of hanging forever
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`Worker error: ${msg}`));
        this.pending.delete(id);
      }
    };
    this.worker.onmessageerror = (e) => {
      console.error('[WorkerBridge] Message deserialisation error:', e);
    };
  }

  private call(type: string, payload?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Crypto worker timed out on: ${type}`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async loadKey(encryptedPrivateKey: string, pin: string): Promise<{ publicKey: string }> {
    const result = await this.call('LOAD_KEY', { encryptedKey: encryptedPrivateKey, pin });
    this.isKeyLoaded = true;
    return result as { publicKey: string };
  }

  async loadKeyDirect(privateKeyHex: string): Promise<void> {
    await this.call('LOAD_KEY_DIRECT', { privateKeyHex });
    this.isKeyLoaded = true;
  }

  async execute<T>(operation: LitePermissionOperation, payload?: Record<string, unknown>): Promise<T> {
    return this.call('EXECUTE', { operation, ...payload }) as Promise<T>;
  }

  async clearKey(): Promise<void> {
    await this.call('CLEAR_KEY');
    this.isKeyLoaded = false;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
