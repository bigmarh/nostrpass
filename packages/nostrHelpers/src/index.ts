/**
 * @nostrpass/nostr
 * Library for easy nostr functions
 */
import { encrypt, decrypt } from "nostr-tools/nip04";
import { finalizeEvent, NostrEvent } from "nostr-tools/pure";
import { KeyPair } from "@nostrpass/types";
import { SimplePool } from "nostr-tools/pool";
import { Filter } from "nostr-tools";

export function hello() {
  return 'Hello from @nostrpass/nostr';
}

/**
 * Save a record to Nostr
 * @param data - The data to save
 * @param app - The app identifier
 * @param keys - The keys to use
 * @param identifier - The identifier to use
 * @returns The event id
 */
export async function saveRecordToNostr(data: any,app:string,keys: KeyPair,identifier:string): Promise<string> {
  const encryptData = encrypt(keys.privateKey, keys.publicKey, JSON.stringify(data));
  const event = finalizeEvent({
    kind: 30078,
    content: encryptData,
     tags: [
      ['d', identifier], // app identifier
    ],
    created_at: Date.now(),
  }, keys.privateKey);
  return event.id;
}

/**
 * Get a record from Nostr
 * @param identifier - The identifier to use
 * @param relays - The relays to use
 * @param keys - The keys to use
 * @returns The decrypted content
 */
export async function getRecordFromNostr(identifier:string, relays: string[], keys: KeyPair): Promise<string | null> {
  const filter: Filter = {
    '#d': [identifier],
  };
  const event = await getEvent(relays, filter);
  if (!event) return null;
  const decryptedContent = decrypt(keys.privateKey, keys.publicKey, event.content);
  return decryptedContent;
}

/**
 * Get an event from Nostr
 * @param relays - The relays to use
 * @param filter - The filter to use
 * @returns The event
 */
export async function getEvent(relays: string[], filter: Filter): Promise<NostrEvent | null> {
  const pool = new SimplePool();
  const events = await pool.querySync(relays, filter);
  if (events.length == 0) return null;
  const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
  return latestEvent;
}

/**
 * Publish an event to Nostr
 * @param signedEvent - The signed event
 * @param relays - The relays to use
 * @returns The event
 */
export async function publishEvent(signedEvent: NostrEvent, relays: string[]): Promise<string[]> {
  const pool = new SimplePool();
  const event = await Promise.all(pool.publish(relays, signedEvent));
  return event;
}