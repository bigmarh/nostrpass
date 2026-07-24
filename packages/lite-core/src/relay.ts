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
      // Query every relay (bounded by maxWait per relay) and pick the NEWEST
      // event across all of them. Racing to the first responder is
      // nondeterministic when relays hold different generations of a
      // replaceable record — the fastest relay wins, not the newest record —
      // which surfaces as auth flapping (e.g. "Invalid PIN" on stale vaults).
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

      const results = await Promise.all(perRelay);
      const result = results
        .filter((e): e is NostrEvent => e !== null)
        .sort((a, b) => b.created_at - a.created_at)[0];

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

  /**
   * Publish, then read the event back from each relay that ACKed the write.
   * Returns only relays where the event is verifiably stored. Public relays
   * routinely ACK kinds they silently drop (kind 30078 app data especially),
   * which let "durable" enrollments vanish from the network.
   */
  async publishVerified(event: NostrEvent): Promise<string[]> {
    const acked = await this.publish(event);
    if (acked.length === 0) return [];

    const pool = new SimplePool();
    try {
      const verified = await Promise.all(
        acked.map((relay) =>
          pool
            .querySync([relay], { ids: [event.id] }, { maxWait: 2000 })
            .then((events) => (events.some((e) => e.id === event.id) ? relay : null))
            .catch(() => null)
        )
      );
      return verified.filter((r): r is string => r !== null);
    } finally {
      pool.close(acked);
    }
  }
}
