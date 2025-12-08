/**
 * Nostr Profile Worker
 *
 * Background worker that automatically fetches and updates Nostr profiles
 * for all identities in the vault. Runs independently without blocking the UI.
 */

import { SimplePool } from 'nostr-tools';
import type { VaultData } from './db';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://relay.snort.social'
];

interface NostrProfile {
  name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
  banner?: string;
  display_name?: string;
}

interface ProfileUpdate {
  publicKey: string;
  profile: NostrProfile;
}

class NostrProfileWorker {
  private pool: SimplePool;
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes
  private intervalId?: ReturnType<typeof setInterval>;
  private cache = new Map<string, { profile: NostrProfile; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Start auto-updating profiles for a vault
   */
  async start(vaultData: VaultData, onUpdate: (updates: ProfileUpdate[]) => void): Promise<void> {
    console.log('[NostrProfileWorker] Starting auto-update for', vaultData.identities.length, 'identities');

    // Initial fetch
    await this.fetchAndUpdate(vaultData, onUpdate);

    // Set up periodic refresh
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.fetchAndUpdate(vaultData, onUpdate);
    }, this.updateInterval);
  }

  /**
   * Stop auto-updating
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.pool.close(DEFAULT_RELAYS);
    console.log('[NostrProfileWorker] Stopped');
  }

  /**
   * Fetch profiles for all identities and notify of updates
   */
  private async fetchAndUpdate(
    vaultData: VaultData,
    onUpdate: (updates: ProfileUpdate[]) => void
  ): Promise<void> {
    try {
      const publicKeys = vaultData.identities.map(id => id.publicKey);
      const updates: ProfileUpdate[] = [];

      console.log('[NostrProfileWorker] Fetching profiles for', publicKeys.length, 'identities');

      // Fetch all profiles in parallel with timeout
      const fetchPromises = publicKeys.map(async (pubkey) => {
        try {
          const profile = await this.fetchProfile(pubkey);
          if (profile) {
            return { publicKey: pubkey, profile };
          }
        } catch (err) {
          console.error('[NostrProfileWorker] Failed to fetch profile for', pubkey.slice(0, 8), err);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);

      // Collect successful updates
      for (const result of results) {
        if (result) {
          updates.push(result);
        }
      }

      if (updates.length > 0) {
        console.log('[NostrProfileWorker] Fetched', updates.length, 'profiles, notifying...');
        onUpdate(updates);
      } else {
        console.log('[NostrProfileWorker] No new profiles found');
      }
    } catch (error) {
      console.error('[NostrProfileWorker] Failed to fetch profiles:', error);
    }
  }

  /**
   * Fetch a single profile from Nostr
   */
  private async fetchProfile(publicKey: string): Promise<NostrProfile | null> {
    try {
      // Check cache first
      const cached = this.cache.get(publicKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.profile;
      }

      // Fetch with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const fetchPromise = this.pool.querySync(DEFAULT_RELAYS, {
        kinds: [0],
        authors: [publicKey]
      });

      const events = await Promise.race([fetchPromise, timeoutPromise]);

      if (!events || events.length === 0) {
        return null;
      }

      // Get the most recent event
      const latestEvent = events.reduce((latest, current) =>
        current.created_at > latest.created_at ? current : latest
      );

      const profile: NostrProfile = JSON.parse(latestEvent.content);

      // Cache it
      this.cache.set(publicKey, {
        profile,
        timestamp: Date.now()
      });

      return profile;
    } catch (error) {
      // Silent fail for individual profiles
      return null;
    }
  }

  /**
   * Update check interval
   */
  setUpdateInterval(intervalMs: number): void {
    this.updateInterval = intervalMs;

    // Restart if currently running
    if (this.intervalId) {
      clearInterval(this.intervalId);
      // Will be restarted on next start() call
    }
  }
}

// Singleton instance
export const nostrProfileWorker = new NostrProfileWorker();
