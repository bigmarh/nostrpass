import type { VaultData, LoginObj } from '@nostrpass/types';
import { getCryptoWorker } from './cryptoWorkerSingleton';

interface NostrSyncStatus {
  needsSync: boolean;
  lastAttempt?: number;
  attemptCount: number;
  lastError?: string;
}

interface PendingSync {
  username: string;
  loginObj: LoginObj;
  randomPublicKey: string;
  randomPrivateKey: string;
  passwordKey: string;
  environment: string;
  relays: string[];
}

class NostrSyncService {
  private static instance: NostrSyncService;
  private syncStatusMap = new Map<string, NostrSyncStatus>();
  private pendingSyncs = new Map<string, PendingSync>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  private constructor() {}

  static getInstance(): NostrSyncService {
    if (!NostrSyncService.instance) {
      NostrSyncService.instance = new NostrSyncService();
    }
    return NostrSyncService.instance;
  }

  /**
   * Queue a vault for Nostr sync (non-blocking)
   */
  async queueSync(params: {
    username: string;
    loginObj: LoginObj;
    randomPublicKey: string;
    randomPrivateKey: string;
    passwordKey: string;
    environment: string;
    relays: string[];
  }): Promise<void> {
    console.log('📋 [NostrSync] Queuing sync for', params.username);

    // Store sync status
    this.syncStatusMap.set(params.username, {
      needsSync: true,
      attemptCount: 0
    });

    // Store pending sync data
    this.pendingSyncs.set(params.username, {
      username: params.username,
      loginObj: params.loginObj,
      randomPublicKey: params.randomPublicKey,
      randomPrivateKey: params.randomPrivateKey,
      passwordKey: params.passwordKey,
      environment: params.environment,
      relays: params.relays
    });

    // Mark vault as needing sync in IndexedDB
    await this.markVaultNeedsSync(params.username, true);

    // Start sync process (non-blocking)
    this.startSync(params.username);
  }

  /**
   * Check if a vault needs sync
   */
  needsSync(username: string): boolean {
    const status = this.syncStatusMap.get(username);
    return status?.needsSync ?? false;
  }

  /**
   * Get sync status for a user
   */
  getSyncStatus(username: string): NostrSyncStatus | null {
    return this.syncStatusMap.get(username) || null;
  }

  /**
   * Retry sync for a user (called on login)
   */
  async retrySync(username: string, relays: string[], environment: string): Promise<void> {
    console.log('🔄 [NostrSync] Checking if retry needed for', username);

    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) {
      console.error('❌ [NostrSync] Crypto worker not available');
      return;
    }

    // Check if vault needs sync
    const vaultData = await cryptoWorker.getVaultData({ username, includeEncryptedVault: true });
    const needsSync = (vaultData as any)?.needsNostrSync;

    if (!needsSync) {
      console.log('✅ [NostrSync] No sync needed for', username);
      return;
    }

    console.log('🔄 [NostrSync] Vault needs sync, attempting...');

    // We need the password key to publish to Nostr
    // If we don't have it cached, we can't sync until next password login
    const session = await cryptoWorker.getSession({ username });
    const passwordKey = (session as any)?.passwordKey;

    if (!passwordKey) {
      console.warn('⚠️ [NostrSync] Cannot sync without password key (need password login first)');
      return;
    }

    // Reconstruct LoginObj from vault data
    const loginObj: LoginObj = {
      storagePublicKey: (vaultData as any).storagePublicKey || (vaultData as any).publicKey,
      storageKeypairEncrypted: (vaultData as any).storageKeypairEncrypted || '',
      username,
      createdAt: (vaultData as any).createdAt || Date.now(),
      version: 1,
      passwordSalt: (vaultData as any).passwordSalt || '',
      pinSalt: (vaultData as any).salt || ''
    };

    // Generate new random keypair for LoginObj
    const randomKey = await cryptoWorker.generateKeypair();
    let randomPrivateKey: string;
    let randomPublicKey: string;
    if (randomKey instanceof Map) {
      randomPrivateKey = randomKey.get('privateKey');
      randomPublicKey = randomKey.get('publicKey');
    } else {
      randomPrivateKey = (randomKey as any).privateKey;
      randomPublicKey = (randomKey as any).publicKey;
    }

    // Queue for sync
    await this.queueSync({
      username,
      loginObj,
      randomPublicKey,
      randomPrivateKey,
      passwordKey,
      environment,
      relays
    });
  }

  /**
   * Start sync process (with retries)
   */
  private async startSync(username: string): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ [NostrSync] Already running, will queue...');
      return;
    }

    this.isRunning = true;

    try {
      await this.performSync(username);
    } catch (error) {
      console.error('❌ [NostrSync] Sync failed:', error);
      this.handleSyncError(username, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform the actual sync to Nostr
   */
  private async performSync(username: string): Promise<void> {
    const pending = this.pendingSyncs.get(username);
    if (!pending) {
      console.log('ℹ️ [NostrSync] No pending sync data for', username);
      return;
    }

    const status = this.syncStatusMap.get(username)!;
    status.attemptCount++;
    status.lastAttempt = Date.now();

    console.log(`🌐 [NostrSync] Attempt ${status.attemptCount}: Publishing to Nostr for ${username}...`);

    try {
      const cryptoWorker = getCryptoWorker();
      if (!cryptoWorker) {
        throw new Error('Crypto worker not available');
      }

      // Step 1: Save LoginObj
      console.log('📤 [NostrSync] Publishing LoginObj...');
      const { saveLoginObj } = await import('@nostrpass/nostrHelpers');
      await saveLoginObj(
        pending.username,
        pending.loginObj,
        pending.randomPublicKey,
        pending.randomPrivateKey,
        pending.relays,
        pending.environment,
        pending.passwordKey
      );
      console.log('✅ [NostrSync] LoginObj published');

      // Step 2: Create and publish VaultObj
      console.log('📤 [NostrSync] Publishing VaultObj...');
      const vaultEvent = await cryptoWorker.createInitialVaultForNostr({
        username: pending.username,
        passwordKey: pending.passwordKey
      });

      const { publishEvent } = await import('@nostrpass/nostrHelpers');
      const publishedRelays = await publishEvent(vaultEvent.event, pending.relays);
      console.log('✅ [NostrSync] VaultObj published to relays:', publishedRelays);

      // Success - clear sync flag
      status.needsSync = false;
      status.lastError = undefined;
      this.pendingSyncs.delete(username);
      await this.markVaultNeedsSync(username, false);

      // Dispatch success event
      window.dispatchEvent(new CustomEvent('nostr-sync-complete', {
        detail: { username, success: true }
      }));

      console.log('🎉 [NostrSync] Sync complete for', username);

    } catch (error) {
      console.error('❌ [NostrSync] Sync attempt failed:', error);
      throw error;
    }
  }

  /**
   * Handle sync error with retry logic
   */
  private handleSyncError(username: string, error: any): void {
    const status = this.syncStatusMap.get(username);
    if (!status) return;

    status.lastError = error instanceof Error ? error.message : String(error);

    // Check if this is first sync (more aggressive retry schedule)
    const isFirstSync = status.attemptCount <= 6;

    // Aggressive retry for first sync: 2s, 5s, 10s, 20s, 40s, 60s
    // Then fall back to: 5s, 15s, 45s, 2m, 5m, 15m
    const firstSyncDelays = [2000, 5000, 10000, 20000, 40000, 60000];
    const regularDelays = [5000, 15000, 45000, 120000, 300000, 900000];

    const delays = isFirstSync ? firstSyncDelays : regularDelays;
    const delayIndex = isFirstSync
      ? Math.min(status.attemptCount - 1, firstSyncDelays.length - 1)
      : Math.min(status.attemptCount - firstSyncDelays.length - 1, regularDelays.length - 1);
    const delay = delays[delayIndex];

    console.log(`⏰ [NostrSync] Retrying in ${delay / 1000}s (attempt ${status.attemptCount}, ${isFirstSync ? 'first sync' : 'regular sync'})`);

    // Max attempts check
    const MAX_ATTEMPTS = 10;
    if (status.attemptCount >= MAX_ATTEMPTS) {
      console.error(`❌ [NostrSync] Max sync attempts (${MAX_ATTEMPTS}) reached for ${username}`);
      status.lastError = 'Max sync attempts exceeded';

      window.dispatchEvent(new CustomEvent('nostr-sync-failed', {
        detail: {
          username,
          error: 'Max sync attempts exceeded. Please try manually from settings.',
          attemptCount: status.attemptCount,
          requiresManualRetry: true
        }
      }));
      return;
    }

    // Clear existing timeout
    const existing = this.retryTimeouts.get(username);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule retry
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(username);
      this.startSync(username);
    }, delay);

    this.retryTimeouts.set(username, timeout);

    // Dispatch error event
    window.dispatchEvent(new CustomEvent('nostr-sync-error', {
      detail: { username, error: status.lastError, attemptCount: status.attemptCount }
    }));
  }

  /**
   * Mark vault as needing sync in IndexedDB
   */
  private async markVaultNeedsSync(username: string, needsSync: boolean): Promise<void> {
    try {
      const cryptoWorker = getCryptoWorker();
      if (!cryptoWorker) return;

      const vaultData = await cryptoWorker.getVaultData({ username, includeEncryptedVault: true });
      if (vaultData) {
        await cryptoWorker.updateVaultData({
          username,
          vaultData: {
            ...(vaultData as any),
            needsNostrSync: needsSync
          },
          skipVersionIncrement: true
        });
      }
    } catch (error) {
      console.error('❌ [NostrSync] Failed to mark vault sync status:', error);
    }
  }

  /**
   * Cancel pending sync for a user
   */
  cancelSync(username: string): void {
    const timeout = this.retryTimeouts.get(username);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(username);
    }

    this.pendingSyncs.delete(username);
    this.syncStatusMap.delete(username);
  }

  /**
   * Clear all pending syncs (for cleanup)
   */
  clearAll(): void {
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.pendingSyncs.clear();
    this.syncStatusMap.clear();
  }
}

export default NostrSyncService;
