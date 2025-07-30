/**
 * @nostrpass/nostr
 * Library for easy nostr functions
 */
import { encrypt, decrypt } from "nostr-tools/nip04";
import { finalizeEvent, NostrEvent, getPublicKey } from "nostr-tools/pure";
import { KeyPair } from "@nostrpass/types";
import { SimplePool } from "nostr-tools/pool";
import { Filter } from "nostr-tools";
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { generateSecretKey } from 'nostr-tools';

// Export user data helpers
export * from './userDataHelpers';

export function hello() {
  return 'Hello from @nostrpass/nostr';
}

/**
 * Get the current environment from NODE_ENV or default to development
 * @returns Environment string (development, staging, production)
 */
export function getEnvironment(): string {
  // In browser environments, we might need to detect differently
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  
  // For Vite/browser, check import.meta.env
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined') {
    // In browser, we'll default to development
    // You can customize this based on your deployment setup
    return 'development';
  }
  
  // Default to development
  return 'development';
}

/**
 * Generate a new keypair for a user
 * @returns KeyPair - A new random keypair
 */
export function generateKeyPair(): KeyPair {
  const secretKey = generateSecretKey();
  const privateKey = secretKey; // Keep as Uint8Array as expected by KeyPair type
  const publicKey = getPublicKey(secretKey);
  return {
    privateKey,
    publicKey
  };
}

/**
 * Save a record to Nostr
 * @param data - The data to save
 * @param app - The app identifier
 * @param keys - The keys to use
 * @param identifier - The identifier to use
 * @returns The event id
 */
export async function saveRecordToNostr(data: any, _app:string, keys: KeyPair, identifier:string): Promise<string> {
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

export const sanitizeDomain = (domain: string) => {
  return domain.replace(/\./g, '-').replace(/:/g, '-').replace(/_/g, '-');
};
export const desanitizeDomain = (domain: string) => {
  return domain.replace(/-/g, ':').replace(/-/g, '.').replace(/-/g, '_');
};

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

/**
 * Get the arbitrary   registration keypair  
 * @returns Promise<KeyPair> - The derived registration keypair
 */
export async function getRegistrationKeypair(): Promise<KeyPair> {
  try {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    return {
      privateKey,
      publicKey
    };

  } catch (error) {
    console.error('Error deriving registration keypair:', error);
    throw new Error('Failed to derive registration keypair');
  }
}


// Username registration system
// Registration keypair should be derived from the first post of:
// npub1k7cnst4fh4ajgg8w6ndcmqen4fnyc7ahhm3zpp255vdxqarrtekq5rrg96
export interface UsernameRegistration {
  username: string;
  hash: string;
  timestamp: number;
  npub: string;
}

export class UsernameRegistry {
  private pool: SimplePool;
  private registrationKeys: KeyPair;
  private relays: string[];

  constructor(registrationKeys: KeyPair, relays: string[]) {
    this.pool = new SimplePool();
    this.registrationKeys = registrationKeys;
    this.relays = relays;
  }

  // Create hash from username for privacy
  private hashUsername(username: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(username.toLowerCase());
    const hash = sha256(data);
    return bytesToHex(hash);
  }

  // Check if username is available (efficient lookup)
  async isUsernameAvailable(username: string): Promise<boolean> {
    const hash = this.hashUsername(username);
    
    try {
      // Query for non-replaceable registration events in current environment
      const filter: Filter = {
        kinds: [31000], // Custom kind for username registration (non-replaceable)
        authors: [this.registrationKeys.publicKey],
        '#uname_hash': [hash],
        '#app': [`nostrpass`], // Environment-specific lookup
        '#env': [`${getEnvironment()}`], // Environment-specific lookup
        limit: 1
      };

      const events = await this.pool.querySync(this.relays, filter);
      
      // If we found an event, username is taken
      return events.length === 0;
    } catch (error) {
      console.error('Error checking username availability:', error);
      throw new Error('Failed to check username availability');
    }
  }

  // Register a username (create registration event)
  async registerUsername(username: string, userPubkey: string, originatedBy: string): Promise<boolean> {
    const hash = this.hashUsername(username);
    
    // Check availability first
    const isAvailable = await this.isUsernameAvailable(username);
    if (!isAvailable) {
      throw new Error('Username already taken');
    }

    try {
      const registrationEvent: NostrEvent = {
        kind: 31000, // Custom kind for username registration (non-replaceable)
        pubkey: this.registrationKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['uname_hash', hash], // Hash of the username
          ['pubkey', userPubkey], // Users Public Key       
          ['app', 'nostrpass'], // Application identifier
          ['env', getEnvironment()], // Environment (dev/staging/prod)
          ['id', `${hash}_${Date.now()}`] // Unique registration ID
        ],
        content: JSON.stringify({
          status: 'registered',
          origin: originatedBy,
          timestamp: Date.now(),
          username_length: username.length // Store length for analytics
        }),
        id: '',
        sig: ''
      };

      // Sign the event using finalizeEvent
      const signedEvent = finalizeEvent(registrationEvent, this.registrationKeys.privateKey);
      
      // Publish to all relays
      await publishEvent(signedEvent, this.relays);

      return true;
    } catch (error) {
      console.error('Error registering username:', error);
      throw new Error('Failed to register username');
    }
  }

  // Get all registered usernames (for admin purposes)
  async getAllRegistrations(): Promise<UsernameRegistration[]> {
    try {
      const filter: Filter = {
        kinds: [31000], // Non-replaceable username registrations
        authors: [this.registrationKeys.publicKey],
        '#app': [`nostrpass`],
        '#env': [`${getEnvironment()}`] // Environment-specific
      };

      const events = await this.pool.querySync(this.relays, filter);
      
      return events.map(event => {
        const content = JSON.parse(event.content);
        const registeredBy = event.tags.find(tag => tag[0] === 'registered_by')?.[1] || '';
        const hash = event.tags.find(tag => tag[0] === 'username_hash')?.[1] || '';
        
        return {
          username: '[hashed]', // We don't store plaintext usernames
          hash,
          timestamp: content.timestamp,
          npub: registeredBy
        };
      });
    } catch (error) {
      console.error('Error getting registrations:', error);
      return [];
    }
  }

  // Get registration history for a specific username hash
  async getRegistrationHistory(username: string): Promise<NostrEvent[]> {
    const hash = this.hashUsername(username);
    
    try {
      const filter: Filter = {
        kinds: [31000],
        authors: [this.registrationKeys.publicKey],
        '#uname_hash': [hash],
        '#app': [`nostrpass`],
        '#env': [`${getEnvironment()}`] // Environment-specific
      };

      return await this.pool.querySync(this.relays, filter);
    } catch (error) {
      console.error('Error getting registration history:', error);
      return [];
    }
  }

  // Cleanup
  close() {
    this.pool.close(this.relays);
  }
}