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

  // NEW: Storage keypair from LoginObj (for new double-encryption architecture)
  storageKeypairEncrypted?: string; // PIN-encrypted storage keypair from LoginObj

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
 * Save LoginObj to Nostr - PASSWORD ENCRYPTED for security
 * LoginObj contains PIN-encrypted storage keypair, so needs password protection
 */
export async function saveLoginObj(
  username: string,
  loginObj: LoginObj,
  randomPublicKey: string,
  randomPrivateKey: string,
  relays: string[],
  environment: string,
  passwordKey: string  // Password key for encrypting LoginObj content
): Promise<string[]> {
  try {
    const loginContent = JSON.stringify(loginObj);

    // CRITICAL: Encrypt LoginObj content with password key
    // This protects the PIN-encrypted storage keypair from public exposure
    const { encrypt } = await import('nostr-tools/nip04');
    const privateKeyBytes = hexToBytes(randomPrivateKey);
    const derivedPublicKey = nostrGetPublicKey(privateKeyBytes);
    const pubkeyToUse = derivedPublicKey || randomPublicKey;

    const encryptedContent = await encrypt(passwordKey, pubkeyToUse, loginContent);
    console.log('🔐 [saveLoginObj] LoginObj encrypted with password key');

    // Create login event with random key for privacy
    const namespace = getNamespace();
    const loginEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${namespace}_login_${hash(username)}_${environment}`],
        ['client', namespace],
        ['subject', 'login-lookup'],
        ['encryption', 'password-nip04'], // Mark as password-encrypted
        ['password-salt', loginObj.passwordSalt], // CRITICAL: Store salt in plaintext for password key derivation
      ],
      content: encryptedContent, // Use encrypted content
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
        console.log(`✅ Published password-encrypted LoginObj to ${relay}`);
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
 * Get LoginObj from Nostr by username - PASSWORD ENCRYPTED
 * First retrieves passwordSalt from event tags, then decrypts content
 */
export async function getLoginObj(
  username: string,
  environment: string,
  relays: string[],
  password: string  // Password for deriving decryption key
): Promise<{ loginObj: LoginObj; passwordSalt: string } | null> {
  try {
    const pool = new SimplePool();
    const namespace = getNamespace();

    // Create filter for login event
    const filter: Filter = {
      kinds: [30078],
      '#d': [`${namespace}_login_${hash(username)}_${environment}`],
      limit: 1
    };

    console.log('📥 [getLoginObj] Querying for LoginObj:', { username, environment });

    // Get the latest login event
    const event = await pool.get(relays, filter);
    if (!event) {
      console.log('❌ [getLoginObj] No LoginObj found');
      return null;
    }

    // Extract passwordSalt from tags (stored in plaintext for bootstrapping)
    const passwordSaltTag = event.tags.find(t => t[0] === 'password-salt');
    if (!passwordSaltTag || !passwordSaltTag[1]) {
      console.error('❌ [getLoginObj] No password-salt tag found in LoginObj event');
      return null;
    }
    const passwordSalt = passwordSaltTag[1];
    console.log('✅ [getLoginObj] Found passwordSalt in event tags');

    // Derive password key from password + salt using PBKDF2
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = hexToBytes(passwordSalt);

    const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
    const derivedKey = pbkdf2(sha256, passwordData, saltData, { c: 100000, dkLen: 32 });
    const passwordKey = bytesToHex(derivedKey);
    console.log('🔑 [getLoginObj] Derived password key from password + salt');

    // Decrypt the login object with password key
    const { decrypt } = await import('nostr-tools/nip04');
    try {
      const decryptedContent = await decrypt(passwordKey, event.pubkey, event.content);
      const loginObj = JSON.parse(decryptedContent) as LoginObj;
      console.log('✅ [getLoginObj] LoginObj decrypted successfully');
      return { loginObj, passwordSalt };
    } catch (decryptError) {
      console.error('❌ [getLoginObj] Failed to decrypt LoginObj - wrong password?', decryptError);
      return null;
    }
  } catch (error) {
    console.error('Failed to get LoginObj:', error);
    return null;
  }
}

/**
 * Save VaultObj to Nostr using storage key (STORAGE-KEY-ENCRYPTED via NIP-04)
 * This implements layered encryption:
 * - LoginObj: password-encrypted (contains PIN-encrypted storage keys)
 * - VaultObj: storage-key-encrypted (contains PIN-encrypted xpriv)
 *
 * Benefits:
 * - Realtime updates without password (storage keys in memory after unlock)
 * - Password only needed for initial login (decrypt LoginObj → get storage keys)
 * - Checks and balances: PIN → xpriv → storage keys (verify correctness)
 */
export async function saveVaultObj(
  vaultObj: VaultObj,
  storagePublicKey: string,
  storagePrivateKey: string,
  relays: string[]
): Promise<string[]> {
  try {
    const vaultJson = JSON.stringify(vaultObj);

    // CRITICAL: Encrypt entire VaultObj with STORAGE KEY (NIP-04)
    // This allows realtime updates without password (storage keys already in memory)
    // Uses NIP-04 encryption: encrypt(storagePrivateKey, storagePublicKey, content)
    const { encrypt } = await import('nostr-tools/nip04');
    const encryptedContent = await encrypt(storagePrivateKey, storagePublicKey, vaultJson);

    console.log('🔐 [saveVaultObj] VaultObj encrypted with storage key (NIP-04)');

    const namespace = getNamespace();
    // Create vault event with storage key as author
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${namespace}_vault_${storagePublicKey}_${getEnvironment()}`],
        ['client', namespace],
        ['subject', 'encrypted-vault'],
        ['encryption', 'nip04-storage'], // Mark as storage-key-encrypted (NIP-04)
      ],
      content: encryptedContent, // Use storage-key-encrypted content
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
        console.log(`✅ Published storage-key-encrypted VaultObj to ${relay}`);
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
 * Retrieve vault data from Nostr (STORAGE-KEY-ENCRYPTED)
 * @param userPublicKey - User's storage public key
 * @param relays - Relay URLs to query
 * @param storagePrivateKey - Storage private key for decrypting VaultObj
 * @returns Vault data or null if not found
 */
export async function getVaultFromNostr(
  userPublicKey: string,
  relays: string[],
  storagePrivateKey: string  // Storage private key for vault decryption
): Promise<VaultData | null> {
  try {
    const pool = new SimplePool();
    const env = getEnvironment();
    const namespace = getNamespace();
    const expectedDTag = `${namespace}_vault_${userPublicKey}_${env}`;
    console.log('📥 [getVaultFromNostr] Querying relays:', relays);
    console.log('📥 [getVaultFromNostr] Expected d-tag:', expectedDTag);
    console.log('📥 [getVaultFromNostr] Author pubkey:', userPublicKey);
    const filter: Filter = { kinds: [30078], authors: [userPublicKey], '#d': [expectedDTag], limit: 10 };
    const events = await pool.querySync(relays, filter);
    console.log(`📥 [getVaultFromNostr] Found ${events.length} events`);
    if (events.length > 0) {
      events.forEach((e, i) => {
        const dTag = e.tags.find(t => t[0] === 'd')?.[1];
        console.log(`📥 [getVaultFromNostr] Event ${i}: created_at=${new Date(e.created_at * 1000).toISOString()}, d-tag=${dTag}`);
      });
    }
    pool.close(relays);
    if (events.length === 0) return null;
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
    console.log(`📥 [getVaultFromNostr] Using newest event from ${new Date(sortedEvents[0].created_at * 1000).toISOString()}`);
    const { decrypt } = await import('nostr-tools/nip04');
    for (const event of sortedEvents) {
      try {
        // Decrypt with storage private key (NIP-04)
        const decryptedContent = await decrypt(storagePrivateKey, userPublicKey, event.content);
        const vaultData = JSON.parse(decryptedContent) as VaultData;
        console.log(`✅ [getVaultFromNostr] Successfully decrypted vault with ${vaultData.identities?.length || 0} identities`);
        return vaultData;
      } catch (err) {
        console.warn(`⚠️ [getVaultFromNostr] Failed to decrypt event from ${new Date(event.created_at * 1000).toISOString()}:`, err);
        continue;
      }
    }
    console.error('❌ [getVaultFromNostr] Failed to decrypt any events');
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