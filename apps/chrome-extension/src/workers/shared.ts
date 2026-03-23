/**
 * Shared utilities used across multiple crypto handler modules
 */

/**
 * Worker initialization timestamp
 * Used to validate session age and prevent replay attacks
 */
export const workerInitTime = Date.now();

/**
 * Broadcast vault updates to all tabs and the current worker client
 *
 * @param username - The username whose vault was updated
 * @param type - The type of update (e.g., 'VAULT_UPDATED', 'IDENTITY_ADDED')
 * @param data - Additional data about the update
 */
export function broadcastVaultUpdate(username: string, type: string, data: any): void {
  try {
    console.log('[Worker] Broadcasting vault update:', { type, username, data });

    const message = {
      type: 'VAULT_BROADCAST',
      data: {
        broadcastType: type,
        username,
        timestamp: Date.now(),
        ...data
      }
    };

    // Broadcast to all tabs via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('nostrpass-vault');
        bc.postMessage(message);
        // Close promptly to avoid leaks
        try { bc.close(); } catch {}
      }
    } catch (e) {
      console.warn('[Worker] BroadcastChannel unavailable:', e);
    }

    // Also post to the current client (for dedicated worker consumers)
    try {
      if (typeof self !== 'undefined' && (self as any).postMessage) {
        (self as any).postMessage(message);
      }
    } catch {}
  } catch (error) {
    console.error('[Worker] Failed to broadcast vault update:', error);
  }
}
