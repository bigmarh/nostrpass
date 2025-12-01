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
import { npubEncode } from 'nostr-tools/nip19';
import { getEnvironment } from './config';

// Export configuration system
export * from './config';

// Export user data helpers
export * from './userDataHelpers';

// Export vault helpers
export * from './vaultHelpers';

export function hello() {
  return 'Hello from @nostrpass/nostr';
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
  let events: NostrEvent[] = [];
  
  try {
    events = await pool.querySync(relays, filter);
  } catch (error: any) {
    console.warn('Error during event query:', error);
    // Try each relay individually to identify issues
    for (const relay of relays) {
      try {
        const relayEvents = await pool.querySync([relay], filter);
        events = [...events, ...relayEvents];
        console.log(`✅ Queried ${relay} successfully`);
      } catch (relayError: any) {
        if (relayError.message?.includes('pow:')) {
          const powMatch = relayError.message.match(/pow:\s*(\d+)\s*bits/);
          const bits = powMatch ? powMatch[1] : 'unknown';
          console.warn(`⚠️ Relay ${relay} requires Proof of Work (${bits} bits) for queries`);
        } else {
          console.error(`❌ Failed to query ${relay}:`, relayError.message);
        }
      }
    }
  }
  
  if (events.length == 0) return null;
  const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
  return latestEvent;
}

/**
 * Publish an event to Nostr relays
 * Note: PoW support is temporarily disabled - relays requiring PoW will be skipped
 * @param signedEvent - The signed event
 * @param relays - The relays to use
 * @returns Array of successful relay URLs
 */
export async function publishEvent(
  signedEvent: NostrEvent, 
  relays: string[]
): Promise<string[]> {
  const pool = new SimplePool();
  const successfulPublishes: string[] = [];
  const powRelays: Map<string, number> = new Map(); // relay -> required bits
  const failedRelays: string[] = [];
  
  // First pass: try publishing without PoW
  console.log('📡 Publishing to relays (first attempt without PoW)...');
  for (const relay of relays) {
    try {
      // pool.publish returns Promise<string>[] (array of promises)
      const publishPromises = pool.publish([relay], signedEvent);
      const publishPromise = Promise.all(publishPromises).then(() => {});
      
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Publish timeout')), 10000)
      );
      
      await Promise.race([publishPromise, timeoutPromise]);
      console.log(`✅ Published to ${relay}`);
      successfulPublishes.push(relay);
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      
      if (errorMsg.includes('pow:') || errorMsg.toLowerCase().includes('proof') || errorMsg.includes('bits needed')) {
        // Extract required difficulty
        const powMatch = errorMsg.match(/pow:\s*(\d+)\s*bits/i) || errorMsg.match(/(\d+)\s*bits\s*needed/i);
        const bits = powMatch ? parseInt(powMatch[1]) : 20; // Default to 20 if we can't parse
        console.log(`⛏️ Relay ${relay} requires PoW: ${bits} bits`);
        powRelays.set(relay, bits);
      } else if (errorMsg.includes('timeout')) {
        console.warn(`⏱️ Publish to ${relay} timed out`);
        failedRelays.push(relay);
      } else {
        console.error(`❌ Failed to publish to ${relay}:`, errorMsg);
        failedRelays.push(relay);
      }
    }
  }
  
  // PoW support temporarily disabled for development
  // Just skip relays that require PoW for now
  if (powRelays.size > 0) {
    console.warn(`⚠️ Skipping ${powRelays.size} relay(s) that require PoW (temporarily disabled):`, 
      Array.from(powRelays.entries()).map(([r, b]) => `${r} (${b} bits)`).join(', ')
    );
    powRelays.forEach((_, relay) => failedRelays.push(relay));
  }
  
  if (successfulPublishes.length === 0) {
    let errorMessage = 'Failed to publish to any relay';
    if (powRelays.size > 0) {
      const powList = Array.from(powRelays.entries()).map(([r, b]) => `${r} (${b} bits)`).join(', ');
      errorMessage += `. Relays requiring PoW: ${powList}`;
    }
    if (failedRelays.length > 0) {
      errorMessage += `. Other failed relays: ${failedRelays.join(', ')}`;
    }
    throw new Error(errorMessage);
  }
  
  console.log(`✅ Event published to ${successfulPublishes.length}/${relays.length} relays`);
  if (failedRelays.length > 0) {
    console.log(`⚠️ ${failedRelays.length} relay(s) failed: ${failedRelays.join(', ')}`);
  }
  
  return successfulPublishes;
}

/**
 * Get a registration keypair for the NostrPass username service
 * Each instance can have its own key - we query by d-tag only
 * @returns Promise<KeyPair> - A registration service keypair
 */
export async function getRegistrationKeypair(): Promise<KeyPair> {
  try {
    // Generate a random keypair for this instance
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    
    return {
      privateKey,
      publicKey
    };

  } catch (error) {
    console.error('Error generating registration keypair:', error);
    throw new Error('Failed to generate registration keypair');
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
  pubkey: string;
  registeredBy?: string; // The registration service pubkey that created the event
  relays?: string[]; // User's preferred relays for vault storage
}

export class UsernameRegistry {
  private pool: SimplePool;
  private registrationKeys: KeyPair;
  private relays: string[];
  private static sharedPool: SimplePool | null = null;

  constructor(registrationKeys: KeyPair, relays: string[]) {
    // Use a shared pool instance to avoid connection churn
    if (!UsernameRegistry.sharedPool) {
      UsernameRegistry.sharedPool = new SimplePool();
    }
    this.pool = UsernameRegistry.sharedPool;
    this.registrationKeys = registrationKeys;
    this.relays = relays;
    console.log('UsernameRegistry initialized with relays:', relays);
    console.log('Registration service pubkey:', registrationKeys.publicKey);
  }

  // Create hash from username for privacy
  private hashUsername(username: string): string {
    const encoder = new TextEncoder();
    // Normalize username: lowercase and trim whitespace
    const normalizedUsername = username.toLowerCase().trim();
    console.log('Hashing username:', username, '-> normalized:', normalizedUsername);
    const data = encoder.encode(normalizedUsername);
    const hash = sha256(data);
    const hashHex = bytesToHex(hash);
    console.log('Username hash result:', hashHex);
    return hashHex;
  }

  // Check if username is available (efficient lookup)
  async isUsernameAvailable(username: string): Promise<boolean> {
    const hash = this.hashUsername(username);
    console.log('Checking availability for username:', username);
    console.log('Username hash:', hash);
    
    try {
      // Query for replaceable registration events using 'd' tag ONLY
      // We don't filter by author because different instances might use different keys
      const filter: Filter = {
        kinds: [30078], // NIP-78 arbitrary custom app data (replaceable)
        '#d': [`nostrpass.com_login_${hash}_${getEnvironment()}`], // Use LoginObj pattern for consistency
        // Remove limit to get ALL events with this d-tag
      };
      
      console.log('Query filter:', JSON.stringify(filter, null, 2));
      console.log('Querying relays:', this.relays);
      console.log('Environment:', getEnvironment());
      console.log('Registration service pubkey:', this.registrationKeys.publicKey);

      let events: NostrEvent[] = [];

      // For availability check, we don't need retries - finding zero events is the expected result
      // Only query once since an empty result is what we want for "available"
      try {
        events = await this.pool.querySync(this.relays, filter);
        console.log(`Found ${events.length} events for username "${username}"`);
        if (events.length > 0) {
          console.log('Event authors:', events.map(e => e.pubkey));
          console.log('Event d-tags:', events.map(e => e.tags.find(t => t[0] === 'd')?.[1]));
        }
      } catch (error: any) {
        console.warn('Error during username availability check:', error);
        // Try querying each relay individually to identify PoW requirements
        for (const relay of this.relays) {
          try {
            const relayEvents = await this.pool.querySync([relay], filter);
            events = [...events, ...relayEvents];
            console.log(`✅ Queried ${relay} successfully`);
          } catch (relayError: any) {
            if (relayError.message?.includes('pow:')) {
              const powMatch = relayError.message.match(/pow:\s*(\d+)\s*bits/);
              const bits = powMatch ? powMatch[1] : 'unknown';
              console.warn(`⚠️ Relay ${relay} requires Proof of Work (${bits} bits) for queries`);
            } else {
              console.error(`❌ Failed to query ${relay}:`, relayError.message);
            }
          }
        }
      }
      console.log('Found events:', events.length);
      
      // Debug: Let's see all events to understand what's happening
      if (events.length > 0) {
        events.forEach((event, index) => {
          console.log(`Event ${index}:`, {
            id: event.id,
            pubkey: event.pubkey,
            created_at: new Date(event.created_at * 1000).toISOString(),
            d_tag: event.tags.find(t => t[0] === 'd')?.[1]
          });
        });
      }
      
      // If ANY event exists with this d-tag, username is taken
      if (events.length > 0) {
        console.log('Username is taken. First registration:', events[0]);
        console.log('Event d-tag:', events[0].tags.find(t => t[0] === 'd')?.[1]);
        console.log('Event created_at:', new Date(events[0].created_at * 1000).toISOString());
        return false;
      }
      
      // No events found, username is available
      return true;
    } catch (error) {
      console.error('Error checking username availability:', error);
      throw new Error('Failed to check username availability');
    }
  }

  // Get registration info for a username (returns the FIRST/OLDEST registration)
  async getRegistrationInfo(username: string): Promise<UsernameRegistration | null> {
    const hash = this.hashUsername(username);
    console.log('Getting registration info for username:', username);
    console.log('Username hash:', hash);
    
    try {
      const filter: Filter = {
        kinds: [30078],
        '#d': [`nostrpass.com_login_${hash}_${getEnvironment()}`]
      };
      
      console.log('Query filter:', JSON.stringify(filter, null, 2));
      
      let events: NostrEvent[] = [];
      let retryCount = 0;
      const maxRetries = 2;
      
      // Retry logic to handle relay timing issues
      while (retryCount <= maxRetries) {
        try {
          events = await this.pool.querySync(this.relays, filter);
          console.log(`Attempt ${retryCount + 1}: Found ${events.length} events for username "${username}"`);
          
          // If we found events, no need to retry
          if (events.length > 0) {
            break;
          }
          
          // If no events found and not on last retry, wait a bit
          if (retryCount < maxRetries && events.length === 0) {
            console.log(`No registration found, retrying in 500ms...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            retryCount++;
          } else {
            break; // Last attempt or found events
          }
        } catch (error: any) {
          console.warn('Error during registration info query:', error);
          // Try querying each relay individually
          for (const relay of this.relays) {
            try {
              const relayEvents = await this.pool.querySync([relay], filter);
              events = [...events, ...relayEvents];
              console.log(`✅ Queried ${relay} successfully`);
            } catch (relayError: any) {
              if (relayError.message?.includes('pow:')) {
                const powMatch = relayError.message.match(/pow:\s*(\d+)\s*bits/);
                const bits = powMatch ? powMatch[1] : 'unknown';
                console.warn(`⚠️ Relay ${relay} requires Proof of Work (${bits} bits) for queries`);
              } else {
                console.error(`❌ Failed to query ${relay}:`, relayError.message);
              }
            }
          }
          break; // Exit retry loop after individual relay attempts
        }
      }
      
      if (events.length === 0) {
        console.log('No registration found after retries');
        return null;
      }
      
      // Get the oldest (first) registration - this is the owner
      const sortedEvents = events.sort((a, b) => a.created_at - b.created_at);
      const firstRegistration = sortedEvents[0];
      const content = JSON.parse(firstRegistration.content);
      
      console.log(`Found ${events.length} registration(s) for username. First registered at:`, 
        new Date(firstRegistration.created_at * 1000).toISOString());
      
      // Extract the user's public key from the 'p' tag
      const pTag = firstRegistration.tags.find(tag => tag[0] === 'p');
      const userPubkey = pTag ? pTag[1] : '';
      
      // Extract relay hints from 'r' tags
      const relayTags = firstRegistration.tags.filter(tag => tag[0] === 'r');
      const relays = relayTags.map(tag => tag[1]);
      
      // Also check content for relays (fallback/redundancy)
      const contentRelays = content.relays || [];
      const allRelays = [...new Set([...relays, ...contentRelays])]; // Deduplicate
      
      return {
        username,
        hash,
        timestamp: firstRegistration.created_at * 1000,
        npub: content.npub || '',
        pubkey: userPubkey,
        registeredBy: firstRegistration.pubkey, // The registration service that registered it
        relays: allRelays
      };
      
    } catch (error) {
      console.error('Error getting registration info:', error);
      return null;
    }
  }

  // Register a username (create registration event)
  async registerUsername(username: string, userPubkey: string, originatedBy: string, userRelays?: string[]): Promise<boolean> {
    const hash = this.hashUsername(username);
    console.log('Registering username:', username);
    console.log('Username hash for registration:', hash);
    
    // Check availability first
    const isAvailable = await this.isUsernameAvailable(username);
    if (!isAvailable) {
      throw new Error('Username already taken');
    }

    try {
      console.log('Creating registration event with userPubkey:', userPubkey);
      
      // Generate npub from public key
      const npub = npubEncode(userPubkey);
      console.log('User npub:', npub);
      
      // Add relay tags if user relays are provided
      const tags: string[][] = [
        ['d', `nostrpass.com_login_${hash}_${getEnvironment()}`], // Use LoginObj pattern for consistency
        ['p', userPubkey, ''], // Reference to user's public key using standard 'p' tag
      ];
      
      // Add relay hints for where the user's vault data might be stored
      if (userRelays && userRelays.length > 0) {
        userRelays.forEach(relay => {
          tags.push(['r', relay]); // 'r' tag for relay hints
        });
      }
      
      const registrationEvent: NostrEvent = {
        kind: 30078, // NIP-78 arbitrary custom app data (replaceable)
        pubkey: this.registrationKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: JSON.stringify({
          app: 'nostrpass.com',
          env: getEnvironment(),
          status: 'registered',
          origin: originatedBy,
          timestamp: Date.now(),
          username_length: username.length, // Store length for analytics
          username_hash: hash,
          npub: npub, // Store npub for convenience
          pubkey: userPubkey, // Store pubkey in content too for easy access
          relays: userRelays || [] // Store relays in content as well for redundancy
        }),
        id: '',
        sig: ''
      };

      // Sign the event using finalizeEvent
      const signedEvent = finalizeEvent(registrationEvent, this.registrationKeys.privateKey);
      console.log('Signed registration event:', signedEvent);
      
      // Publish to all relays
      console.log('Publishing to relays:', this.relays);
      try {
        const publishResults = await publishEvent(signedEvent, this.relays);
        console.log('Publish results:', publishResults);
        console.log(`Successfully published to ${publishResults.length} relays`);

        // No need to wait for propagation or verify - publish confirmations are enough
        // The registration will be available immediately when needed for login
      } catch (error: any) {
        console.error('Error during username registration publish:', error);
        // Check if all relays require PoW
        if (error.message === 'Failed to publish to any relay') {
          throw new Error('Unable to register username: All relays are rejecting the registration. Some may require Proof of Work. Check the console for details.');
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error registering username:', error);
      throw new Error('Failed to register username');
    }
  }

  // Get all registered usernames (for admin purposes)
  async getAllRegistrations(): Promise<UsernameRegistration[]> {
    try {
      // We can't easily query all registrations without custom tags
      // Instead, we'll need to query by kind and author, then filter
      const filter: Filter = {
        kinds: [30078], // Replaceable events
        authors: [this.registrationKeys.publicKey],
        limit: 1000 // Get recent registrations
      };

      const events = await this.pool.querySync(this.relays, filter);
      
      // Filter for our app's registrations
      const nostrpassEvents = events.filter(event => {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1] || '';
        return dTag.startsWith(`nostrpass.com_login_`);
      });
      
      return nostrpassEvents.map(event => {
        const content = JSON.parse(event.content);
        const pTag = event.tags.find(tag => tag[0] === 'p');
        const userPubkey = pTag ? pTag[1] : '';
        
        return {
          username: '[hashed]', // We don't store plaintext usernames
          hash: content.username_hash || '',
          timestamp: content.timestamp || event.created_at * 1000,
          npub: content.npub || '',
          pubkey: userPubkey,
          registeredBy: event.pubkey
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
        kinds: [30078],
        '#d': [`nostrpass.com_login_${hash}_${getEnvironment()}`], // Use LoginObj pattern for consistency
      };

      return await this.pool.querySync(this.relays, filter);
    } catch (error) {
      console.error('Error getting registration history:', error);
      return [];
    }
  }

  // Cleanup
  close() {
    // Don't close the shared pool - let it be reused
    // this.pool.close(this.relays);
  }
}