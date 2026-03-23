/**
 * Nostr Profile Service
 *
 * Fetches profile metadata (kind 0 events) from Nostr relays
 */

import { SimplePool, Event } from 'nostr-tools';

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

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net'
];

class NostrProfileService {
  private pool: SimplePool;
  private cache = new Map<string, { profile: NostrProfile; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Fetch profile metadata for a public key from Nostr relays
   */
  async fetchProfile(publicKey: string, relays: string[] = DEFAULT_RELAYS): Promise<NostrProfile | null> {
    try {
      // Check cache first
      const cached = this.cache.get(publicKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log('[NostrProfile] Returning cached profile for', publicKey.slice(0, 8));
        return cached.profile;
      }

      console.log('[NostrProfile] Fetching profile for', publicKey.slice(0, 8), 'from relays');

      // Fetch kind 0 events (metadata) for this pubkey
      const events = await this.pool.querySync(relays, {
        kinds: [0],
        authors: [publicKey]
      });

      if (!events || events.length === 0) {
        console.log('[NostrProfile] No profile found for', publicKey.slice(0, 8));
        return null;
      }

      // Get the most recent event
      const latestEvent = events.reduce((latest, current) =>
        current.created_at > latest.created_at ? current : latest
      );

      console.log('[NostrProfile] Found profile event:', latestEvent.created_at);

      // Parse the profile content
      const profile: NostrProfile = JSON.parse(latestEvent.content);

      // Cache it
      this.cache.set(publicKey, {
        profile,
        timestamp: Date.now()
      });

      return profile;
    } catch (error) {
      console.error('[NostrProfile] Failed to fetch profile for', publicKey.slice(0, 8), error);
      return null;
    }
  }

  /**
   * Fetch profiles for multiple public keys in parallel
   */
  async fetchProfiles(publicKeys: string[], relays: string[] = DEFAULT_RELAYS): Promise<Map<string, NostrProfile>> {
    const results = new Map<string, NostrProfile>();

    // Fetch all profiles in parallel
    const promises = publicKeys.map(async (pubkey) => {
      const profile = await this.fetchProfile(pubkey, relays);
      if (profile) {
        results.set(pubkey, profile);
      }
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Close relay connections
   */
  close() {
    this.pool.close(DEFAULT_RELAYS);
  }
}

// Singleton instance
export const nostrProfileService = new NostrProfileService();
