import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { finalizeEvent } from 'nostr-tools/pure';
import { encrypt, decrypt } from 'nostr-tools/nip04';
import { getEnvironment } from './index';
import { hexToBytes } from '@noble/hashes/utils';

/**
 * Vault data stored on Nostr
 */
export interface NostrVaultData {
  version: number;
  encryptedXpriv: string;
  salt: string;
  pinSalt?: string;
  pinHash?: string;
  identities: any[];
  currentIdentityIndex: number;
  hasPin: boolean;
  updatedAt: number;
  deviceId?: string;
  username?: string;
  storagePublicKey?: string; // Public key used for vault storage (separate from user identities)
  // Password verification - a known string encrypted with password
  passwordVerifier?: string;
  // Recovery system for PIN
  recovery?: {
    questions: string[]; // The security questions
    xprivRecovery: string; // encrypted(xpriv, recoveryKey)
    salt: string; // Salt for answer derivation
    version: number; // For future compatibility
  };
}

/**
 * Save vault data to Nostr
 * @param vaultData - The vault data to save
 * @param userPrivateKey - User's private key for signing
 * @param userPublicKey - User's public key for encryption
 * @param relays - Relay URLs to publish to
 * @returns Event IDs from successful publishes
 */
export async function saveVaultToNostr(
  vaultData: NostrVaultData,
  userPrivateKey: string,
  userPublicKey: string,
  relays: string[]
): Promise<string[]> {
  console.log('Attempting to save vault to relays:', relays);
  try {
    // Store vault data as JSON
    const vaultContent = JSON.stringify(vaultData);

    // Create replaceable event (NIP-33)
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078, // NIP-78 arbitrary custom app data (replaceable)
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `nostrpass.com_vault_${getEnvironment()}_${userPublicKey}`], // Unique identifier
        ['client', 'nostrpass.com'],
        ['subject', 'encrypted-vault'],
      ],
      content: vaultContent,
      pubkey: userPublicKey,
    };

    // Sign the event
    const signedEvent = finalizeEvent(vaultEvent as any, userPrivateKey);

    // Publish to relays with individual error handling
    const pool = new SimplePool();
    const successfulPublishes: string[] = [];
    
    // Try each relay individually
    for (const relay of relays) {
      try {
        const result = await pool.publish([relay], signedEvent);
        console.log(`✅ Published to ${relay}`);
        successfulPublishes.push(result[0]);
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
    
    console.log(`✅ Vault published to ${successfulPublishes.length}/${relays.length} relays`);
    
    // Don't close the pool - let it be reused or garbage collected
    // Closing immediately causes WebSocket errors
    
    return successfulPublishes;
  } catch (error) {
    console.error('Error saving vault to Nostr:', error);
    throw error; // Throw the original error, not a generic one
  }
}

/**
 * Retrieve vault data from Nostr
 * @param userPublicKey - User's public key
 * @param userPrivateKey - User's private key (no longer needed, kept for compatibility)
 * @param relays - Relay URLs to query
 * @returns Vault data or null if not found
 */
export async function getVaultFromNostr(
  userPublicKey: string,
  userPrivateKey: string,
  relays: string[]
): Promise<NostrVaultData | null> {
  try {
    const pool = new SimplePool();
    
    // Query for vault events
    const filter: Filter = {
      kinds: [30078],
      authors: [userPublicKey],
      '#d': [`nostrpass.com_vault_${getEnvironment()}_${userPublicKey}`],
      limit: 1
    };

    const events = await pool.querySync(relays, filter);
    pool.close(relays);

    if (events.length === 0) {
      return null;
    }

    // Get the most recent event
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

    // The vault content is already password-encrypted, just parse it
    // No need for NIP-04 decryption
    return JSON.parse(latestEvent.content) as NostrVaultData;
  } catch (error) {
    console.error('Error retrieving vault from Nostr:', error);
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
      '#d': [`nostrpass.com_vault_${getEnvironment()}_${userPublicKey}`],
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