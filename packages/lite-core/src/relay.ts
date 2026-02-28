import { SimplePool, type Filter, type Event as NostrEvent } from 'nostr-tools';
import type { RelayClient } from './types';

export class NostrRelayClient implements RelayClient {
  constructor(private readonly relays: string[]) {}

  async getLatest(filterInput: {
    kinds?: number[];
    authors?: string[];
    dTags?: string[];
    limit?: number;
  }): Promise<{ content: string; createdAt: number; pubkey: string } | null> {
    const pool = new SimplePool();
    const filter: Filter = {
      kinds: filterInput.kinds,
      authors: filterInput.authors,
      '#d': filterInput.dTags,
      limit: filterInput.limit ?? 10,
    };

    try {
      const events = await pool.querySync(this.relays, filter);
      if (!events.length) {
        return null;
      }
      const latest = [...events].sort((a, b) => b.created_at - a.created_at)[0];
      return {
        content: latest.content,
        createdAt: latest.created_at * 1000,
        pubkey: latest.pubkey,
      };
    } finally {
      pool.close(this.relays);
    }
  }

  async publish(event: NostrEvent): Promise<string[]> {
    const pool = new SimplePool();
    const successes: string[] = [];

    try {
      await Promise.all(
        this.relays.map(async (relay) => {
          try {
            const publications = pool.publish([relay], event);
            await Promise.all(publications);
            successes.push(relay);
          } catch {
            // Keep trying other relays.
          }
        })
      );
      return successes;
    } finally {
      pool.close(this.relays);
    }
  }
}
