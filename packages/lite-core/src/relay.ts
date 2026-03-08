import { SimplePool, type Filter, type Event as NostrEvent } from 'nostr-tools';
import type { RelayClient } from './types';

const PUBLISH_TIMEOUT_MS = 8000;

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
      // Query each relay individually and race — return as soon as any relay responds.
      // maxWait tells querySync to resolve after the first EOSE + up to maxWait ms.
      const perRelay = this.relays.map((relay) =>
        pool
          .querySync([relay], filter, { maxWait: 1500 })
          .then((events) =>
            events.length > 0
              ? events.sort((a, b) => b.created_at - a.created_at)[0]
              : null
          )
          .catch(() => null)
      );

      // Resolve on first non-null result; fall back to null if all relays fail.
      const result = await new Promise<NostrEvent | null>((resolve) => {
        let settled = 0;
        let resolved = false;
        for (const p of perRelay) {
          p.then((event) => {
            if (event && !resolved) {
              resolved = true;
              resolve(event);
            }
            if (++settled === perRelay.length && !resolved) {
              resolve(null);
            }
          });
        }
      });

      if (!result) return null;
      return {
        content: result.content,
        createdAt: result.created_at * 1000,
        pubkey: result.pubkey,
      };
    } finally {
      pool.close(this.relays);
    }
  }

  async publish(event: NostrEvent): Promise<string[]> {
    const pool = new SimplePool();
    const successes: string[] = [];

    try {
      // Publish to all relays concurrently. Use allSettled so one failure doesn't
      // block others, and add a per-relay timeout.
      await Promise.allSettled(
        this.relays.map(async (relay) => {
          try {
            const publications = pool.publish([relay], event);
            await Promise.race([
              Promise.all(publications),
              new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('publish timeout')), PUBLISH_TIMEOUT_MS)
              ),
            ]);
            successes.push(relay);
          } catch {
            // Continue with other relays.
          }
        })
      );
      return successes;
    } finally {
      pool.close(this.relays);
    }
  }
}
