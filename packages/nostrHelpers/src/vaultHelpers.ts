import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { finalizeEvent, getPublicKey as nostrGetPublicKey } from 'nostr-tools/pure';
import { getEnvironment } from './index';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';


// Updated VaultData interface for new auth flow
export interface VaultData {
  // Core fields
  username: string;
  publicKey: string; // Storage public key for vault identification
  xprivEncrypted: string; // PIN-encrypted only (single encryption)
  salt: string; // For PIN encryption (embedded in xprivEncrypted)
  
  // Identity management
  identities: any[];
  storagePublicKey?: string; // Explicit storage public key (same as publicKey)
  currentIdentityIndex?: number; // Currently selected identity index
  // Active identity per app (persistent selection separate from authorization)
  activeIdentityByApp?: Record<string, number | null>;
  
  // Recovery system
  recovery?: {
    questions: string[]; // The security questions
    xprivRecovery: string; // xpriv encrypted with recovery key
    salt: string; // Salt for answer derivation
    version: number; // Recovery system version
  };
  
  // User preferences
  customRelays?: string[]; // User's preferred relays (overrides default if set)
  
  // Metadata
  updatedAt: number;
  version: number; // Increments on every save for sync conflict resolution
  createdAt?: number; // Account creation timestamp
  lastSyncedAt?: number; // Last sync with Nostr
  
  // Security
  passwordSalt?: string; // Salt for password key derivation
  passwordVerifier?: string; // Encrypted known string to verify password
}

// Alias for backward compatibility
export type NostrVaultData = VaultData;

// New helper functions for the updated auth flow
import type { LoginObj, VaultObj } from '@nostrpass/types';

/**
 * Save LoginObj to Nostr using random key for privacy
 */
export async function saveLoginObj(
  username: string,
  loginObj: LoginObj,
  randomPublicKey: string,
  randomPrivateKey: string,
  relays: string[]
): Promise<string[]> {
  try {
    const loginContent = JSON.stringify(loginObj);
    
    // Derive public key from the provided private key to ensure consistency
    const privateKeyBytes = hexToBytes(randomPrivateKey);
    const derivedPublicKey = nostrGetPublicKey(privateKeyBytes);
    const pubkeyToUse = derivedPublicKey || randomPublicKey;

    // Create login event with random key for privacy
    const loginEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `nostrpass.com_login_${hash(username)}_${getEnvironment()}`],
        ['client', 'nostrpass.com'],
        ['subject', 'login-lookup'],
      ],
      content: loginContent,
      pubkey: pubkeyToUse, // Random public key for privacy
    };

    // Sign the event with random private key
    const signedEvent = finalizeEvent(loginEvent as any, privateKeyBytes);

    // Publish to relays
    const pool = new SimplePool();
    const successfulPublishes: string[] = [];
    
    for (const relay of relays) {
      try {
        await pool.publish([relay], signedEvent);
        console.log(`✅ Published LoginObj to ${relay}`);
        successfulPublishes.push(relay);
      } catch (error: any) {
        console.error(`❌ Failed to publish LoginObj to ${relay}:`, error.message);
      }
    }
    
    if (successfulPublishes.length === 0) {
      throw new Error('Failed to publish LoginObj to any relay');
    }
    
    return successfulPublishes;
  } catch (error) {
    console.error('Failed to save LoginObj:', error);
    throw error;
  }
}

/**
 * Get LoginObj from Nostr by username
 */
export async function getLoginObj(
  username: string,
  environment: string,
  relays: string[]
): Promise<LoginObj | null> {
  try {
    const pool = new SimplePool();
    
    // Create filter for login event
    const filter: Filter = {
      kinds: [30078],
      '#d': [`nostrpass.com_login_${hash(username)}_${environment}`],
      limit: 1
    };

    // Get the latest login event
    const events = await pool.get(relays, filter);
    if (!events) {
      return null;
    }

    // Parse the login object
    const loginObj = JSON.parse(events.content) as LoginObj;
    return loginObj;
  } catch (error) {
    console.error('Failed to get LoginObj:', error);
    return null;
  }
}

/**
 * Save VaultObj to Nostr using storage key (PASSWORD-ENCRYPTED)
 * This implements double encryption: PIN-encrypted xpriv → Password-encrypted VaultObj
 */
export async function saveVaultObj(
  vaultObj: VaultObj,
  storagePublicKey: string,
  storagePrivateKey: string,
  relays: string[],
  passwordKey: string  // Password key for encrypting the entire VaultObj
): Promise<string[]> {
  try {
    const vaultJson = JSON.stringify(vaultObj);
    
    // CRITICAL: Encrypt entire VaultObj with password
    // This protects sensitive data (identities, permissions, recovery) from public relays
    // Uses AES-256-GCM encryption with password-derived key
    const { encrypt } = await import('nostr-tools/nip04');
    const encryptedContent = await encrypt(passwordKey, storagePublicKey, vaultJson);
    
    console.log('🔐 [saveVaultObj] VaultObj encrypted with password key');
    
    // Create vault event with storage key as author
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `nostrpass.com_vault_${storagePublicKey}_${getEnvironment()}`],
        ['client', 'nostrpass.com'],
        ['subject', 'encrypted-vault'],
        ['encryption', 'password-aes'], // Mark as password-encrypted
      ],
      content: encryptedContent, // Use password-encrypted content
      pubkey: storagePublicKey, // Storage key as author
    };

    // Sign the event with storage key
    const signedEvent = finalizeEvent(vaultEvent as any, hexToBytes(storagePrivateKey));

    // Publish to relays
    const pool = new SimplePool();
    const successfulPublishes: string[] = [];
    
    for (const relay of relays) {
      try {
        await pool.publish([relay], signedEvent);
        console.log(`✅ Published password-encrypted VaultObj to ${relay}`);
        successfulPublishes.push(relay);
      } catch (error: any) {
        console.error(`❌ Failed to publish VaultObj to ${relay}:`, error.message);
      }
    }
    
    return successfulPublishes;
  } catch (error) {
    console.error('Failed to save VaultObj:', error);
    throw error;
  }
}

/**
 * Hash username using SHA-256 hex, matching UsernameRegistry
 */
function hash(input: string): string {
  const data = new TextEncoder().encode(input);
  const digest = sha256(data);
  return bytesToHex(digest);
}

/**
 * Save vault data to Nostr (PASSWORD-ENCRYPTED)
 * NOTE: This is DEPRECATED - use saveVaultObj instead for new code
 * @param vaultData - The vault data to save
 * @param userPrivateKey - User's storage private key for signing
 * @param userPublicKey - User's storage public key
 * @param relays - Relay URLs to publish to
 * @param passwordKey - Password-derived key for encryption
 * @returns Event IDs from successful publishes
 */
export async function saveVaultToNostr(
  vaultData: VaultData,
  userPrivateKey: string,
  userPublicKey: string,
  relays: string[],
  passwordKey: string  // Password key for encryption
): Promise<string[]> {
  try {
    // Serialize vault data as JSON
    const vaultJson = JSON.stringify(vaultData);
    
    // CRITICAL: Encrypt vault data with PASSWORD before storing to Nostr
    // This protects sensitive data (identities, permissions, recovery) from public relays
    // No circular dependency - password key is derived from user input
    const { encrypt } = await import('nostr-tools/nip04');
    const encryptedContent = await encrypt(passwordKey, userPublicKey, vaultJson);
    
    console.log('🔐 [saveVaultToNostr] Vault data encrypted with password key');

    // Create replaceable event (NIP-33)
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078, // NIP-78 arbitrary custom app data (replaceable)
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `nostrpass.com_vault_${userPublicKey}_${getEnvironment()}`],
        ['client', 'nostrpass.com'],
        ['subject', 'encrypted-vault'],
        ['encryption', 'password-aes'], // Mark as password-encrypted
      ],
      content: encryptedContent, // Use password-encrypted content
      pubkey: userPublicKey,
    };

    // Sign the event
    const signedEvent = finalizeEvent(vaultEvent as any, hexToBytes(userPrivateKey));

    // Publish to relays with individual error handling
    const pool = new SimplePool();
    const successfulPublishes: string[] = [];
    
    // Try each relay individually
    for (const relay of relays) {
      try {
        await pool.publish([relay], signedEvent);
        console.log(`✅ Published password-encrypted vault to ${relay}`);
        successfulPublishes.push(relay);
      } catch (error: any) {
        if (error.message?.includes('pow:')) {
          const powMatch = error.message.match(/pow:\s*(\d+)\s*bits/);
          const bits = powMatch ? powMatch[1] : 'unknown';
          console.warn(`⚠️ Relay ${relay} requires Proof of Work (${bits} bits):`, error.message);
        } else {
          console.error(`❌ Failed to publish to ${relay}:`, error.message);
        }
        // Continue to next relay
      }
    }
    
    if (successfulPublishes.length === 0) {
      throw new Error('Failed to publish to any relay');
    }
    
    
    // Don't close the pool - let it be reused or garbage collected
    // Closing immediately causes WebSocket errors
    
    return successfulPublishes;
  } catch (error) {
    console.error('Error saving vault to Nostr:', error);
    throw error; // Throw the original error, not a generic one
  }
}

/**
 * Retrieve vault data from Nostr (PASSWORD-ENCRYPTED)
 * @param userPublicKey - User's storage public key
 * @param relays - Relay URLs to query
 * @param passwordKey - Password-derived key for decrypting VaultObj
 * @returns Vault data or null if not found
 */
export async function getVaultFromNostr(
  userPublicKey: string,
  relays: string[],
  passwordKey: string  // Password key for initial vault decryption
): Promise<VaultData | null> {
  try {
    const pool = new SimplePool();
    
    const env = getEnvironment();
    const expectedDTag = `nostrpass.com_vault_${userPublicKey}_${env}`;
    
    console.log('🔍 [getVaultFromNostr] Searching for vault:', {
      userPublicKey,
      expectedDTag,
      env,
      hasPasswordKey: !!passwordKey
    });
    
    // Query for vault events - get multiple to find the right encryption type
    const filter: Filter = {
      kinds: [30078],
      authors: [userPublicKey],
      '#d': [expectedDTag],
      limit: 10 // Get multiple versions
    };

    const events = await pool.querySync(relays, filter);
    pool.close(relays);
    
    console.log('🔍 [getVaultFromNostr] Found events:', {
      count: events.length,
      eventIds: events.map(e => e.id.slice(0, 8)),
      eventAuthors: events.map(e => e.pubkey.slice(0, 16)),
      eventDTags: events.map(e => e.tags.find(t => t[0] === 'd')?.[1]?.slice(0, 40)),
      encryptionTags: events.map(e => e.tags.find(t => t[0] === 'encryption')?.[1])
    });

    if (events.length === 0) {
      return null;
    }

    // Sort by created_at to get most recent first
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
    
    // Try to decrypt with password key (for initial vault)
    const { decrypt } = await import('nostr-tools/nip04');
    
    for (const event of sortedEvents) {
      try {
        const decryptedContent = await decrypt(passwordKey, userPublicKey, event.content);
        const vaultData = JSON.parse(decryptedContent) as VaultData;
        
        console.log('✅ [getVaultFromNostr] Retrieved password-encrypted vault from Nostr:', {
          username: vaultData.username,
          identitiesCount: vaultData.identities?.length || 0,
          hasXprivEncrypted: !!vaultData.xprivEncrypted,
          updatedAt: vaultData.updatedAt ? new Date(vaultData.updatedAt).toISOString() : 'N/A',
          eventCreatedAt: new Date(event.created_at * 1000).toISOString(),
          encryption: 'password-aes',
          eventId: event.id.slice(0, 8)
        });
        return vaultData;
      } catch (decryptError) {
        console.log('⚠️ [getVaultFromNostr] Failed to decrypt with password key, trying next event...');
        continue;
      }
    }
    
    console.error('❌ [getVaultFromNostr] Failed to decrypt any vault events with password key');
    return null;
  } catch (error) {
    console.error('Error retrieving vault from Nostr:', error);
    return null;
  }
}

/**
 * Get VaultObj from Nostr using storage private key (for sync operations)
 * @param userPublicKey - User's storage public key
 * @param relays - Relay URLs to query
 * @param storagePrivateKey - Storage private key for decrypting sync vaults
 * @returns Vault data or null if not found
 */
export async function getVaultFromNostrWithStorageKey(
  userPublicKey: string,
  relays: string[],
  storagePrivateKey: string
): Promise<VaultData | null> {
  try {
    const pool = new SimplePool();
    
    const env = getEnvironment();
    const expectedDTag = `nostrpass.com_vault_${userPublicKey}_${env}`;
    
    console.log('🔍 [getVaultFromNostrWithStorageKey] Searching for sync vault:', {
      userPublicKey,
      expectedDTag,
      env,
      hasStoragePrivateKey: !!storagePrivateKey
    });
    
    // Query for vault events with NIP-04 encryption tag
    const filter: Filter = {
      kinds: [30078],
      authors: [userPublicKey],
      '#d': [expectedDTag],
      '#encryption': ['nip04'], // Only NIP-04 encrypted vaults (sync operations)
      limit: 10
    };

    const events = await pool.querySync(relays, filter);
    pool.close(relays);
    
    console.log('🔍 [getVaultFromNostrWithStorageKey] Found sync events:', {
      count: events.length,
      eventIds: events.map(e => e.id.slice(0, 8)),
      eventAuthors: events.map(e => e.pubkey.slice(0, 16)),
      eventDTags: events.map(e => e.tags.find(t => t[0] === 'd')?.[1]?.slice(0, 40))
    });

    if (events.length === 0) {
      return null;
    }

    // Sort by created_at to get most recent first
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
    
    // Try to decrypt with storage private key
    const { decrypt } = await import('nostr-tools/nip04');
    
    for (const event of sortedEvents) {
      try {
        const decryptedContent = await decrypt(storagePrivateKey, userPublicKey, event.content);
        const vaultData = JSON.parse(decryptedContent) as VaultData;
        
        console.log('✅ [getVaultFromNostrWithStorageKey] Retrieved NIP-04 encrypted vault from Nostr:', {
          username: vaultData.username,
          identitiesCount: vaultData.identities?.length || 0,
          hasXprivEncrypted: !!vaultData.xprivEncrypted,
          updatedAt: vaultData.updatedAt ? new Date(vaultData.updatedAt).toISOString() : 'N/A',
          eventCreatedAt: new Date(event.created_at * 1000).toISOString(),
          encryption: 'nip04',
          eventId: event.id.slice(0, 8)
        });
        return vaultData;
      } catch (decryptError) {
        console.log('⚠️ [getVaultFromNostrWithStorageKey] Failed to decrypt with storage key, trying next event...');
        continue;
      }
    }
    
    console.error('❌ [getVaultFromNostrWithStorageKey] Failed to decrypt any sync vault events with storage key');
    return null;
  } catch (error) {
    console.error('Error retrieving sync vault from Nostr:', error);
    return null;
  }
}

/**
 * Check if vault exists on Nostr (without decrypting)
 * @param userPublicKey - User's public key
 * @param relays - Relay URLs to query
 * @returns True if vault exists
 */
export async function vaultExistsOnNostr(
  userPublicKey: string,
  relays: string[]
): Promise<boolean> {
  try {
    const pool = new SimplePool();
    
    const filter: Filter = {
      kinds: [30078],
      authors: [userPublicKey],
      '#d': [`nostrpass.com_vault_${userPublicKey}_${getEnvironment()}`],
      limit: 1
    };

    const events = await pool.querySync(relays, filter);
    pool.close(relays);

    return events.length > 0;
  } catch (error) {
    console.error('Error checking vault existence:', error);
    return false;
  }
}

/**
 * Delete vault from Nostr (publish deletion event)
 * @param userPrivateKey - User's private key for signing
 * @param userPublicKey - User's public key
 * @param relays - Relay URLs to publish to
 */
export async function deleteVaultFromNostr(
  userPrivateKey: string,
  userPublicKey: string,
  relays: string[]
): Promise<void> {
  try {
    // Create deletion event (NIP-09)
    const deletionEvent: Partial<NostrEvent> = {
      kind: 5, // Deletion
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', `nostrpass.com_vault_${getEnvironment()}_${userPublicKey}`],
        ['k', '30078']
      ],
      content: 'Vault deleted',
      pubkey: userPublicKey,
    };

    // Convert hex private key to Uint8Array
    const privateKeyBytes = hexToBytes(userPrivateKey);
    
    // Sign and publish
    const signedEvent = finalizeEvent(deletionEvent as any, privateKeyBytes);
    
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, signedEvent));
    pool.close(relays);
  } catch (error) {
    console.error('Error deleting vault from Nostr:', error);
    throw new Error('Failed to delete vault from Nostr');
  }
}