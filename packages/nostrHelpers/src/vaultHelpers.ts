import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { finalizeEvent, getPublicKey as nostrGetPublicKey } from 'nostr-tools/pure';
import { getEnvironment, getNamespace } from './config';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';


// Updated VaultData interface for new auth flow
export interface VaultData {
  // Core fields
  username: string;
  publicKey: string; // Storage public key for vault identification
  xprivEncrypted: string; // PIN-encrypted xpriv (encrypted with PIN, not password)
  salt: string; // Salt for PIN encryption

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
  lastUnlocked?: number; // Last time vault was unlocked
  derivationPath?: string; // BIP32 derivation path used for the vault
  sessionExpiry?: number; // Session expiry timestamp

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
  relays: string[],
  environment: string // Add environment parameter to match getLoginObj
): Promise<string[]> {
  try {
    const loginContent = JSON.stringify(loginObj);

    // Derive public key from the provided private key to ensure consistency
    const privateKeyBytes = hexToBytes(randomPrivateKey);
    const derivedPublicKey = nostrGetPublicKey(privateKeyBytes);
    const pubkeyToUse = derivedPublicKey || randomPublicKey;

    // Create login event with random key for privacy
    const namespace = getNamespace();
    const loginEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${namespace}_login_${hash(username)}_${environment}`], // Use passed environment
        ['client', namespace],
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
    const namespace = getNamespace();

    // Create filter for login event
    const filter: Filter = {
      kinds: [30078],
      '#d': [`${namespace}_login_${hash(username)}_${environment}`],
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

    const namespace = getNamespace();
    // Create vault event with storage key as author
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${namespace}_vault_${storagePublicKey}_${getEnvironment()}`],
        ['client', namespace],
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
  _vaultData: VaultData,
  _userPrivateKey: string,
  _userPublicKey: string,
  _relays: string[],
  _passwordKey: string  // Password key for encryption
): Promise<string[]> {
  console.warn('[saveVaultToNostr] Deprecated under PRE model. Returning empty list.');
  return [];
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
    const namespace = getNamespace();
    const expectedDTag = `${namespace}_vault_${userPublicKey}_${env}`;
    const filter: Filter = { kinds: [30078], authors: [userPublicKey], '#d': [expectedDTag], limit: 10 };
    const events = await pool.querySync(relays, filter);
    pool.close(relays);
    if (events.length === 0) return null;
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
    const { decrypt } = await import('nostr-tools/nip04');
    for (const event of sortedEvents) {
      try {
        const decryptedContent = await decrypt(passwordKey, userPublicKey, event.content);
        const vaultData = JSON.parse(decryptedContent) as VaultData;
        return vaultData;
      } catch {
        continue;
      }
    }
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
  _userPublicKey: string,
  _relays: string[],
  _storagePrivateKey: string
): Promise<VaultData | null> {
  console.warn('[getVaultFromNostrWithStorageKey] Deprecated under PRE model. Returning null.');
  return null;
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
    const namespace = getNamespace();

    const filter: Filter = {
      kinds: [30078],
      authors: [userPublicKey],
      '#d': [`${namespace}_vault_${userPublicKey}_${getEnvironment()}`],
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
    const namespace = getNamespace();
    // Create deletion event (NIP-09)
    const deletionEvent: Partial<NostrEvent> = {
      kind: 5, // Deletion
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', `${namespace}_vault_${getEnvironment()}_${userPublicKey}`],
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