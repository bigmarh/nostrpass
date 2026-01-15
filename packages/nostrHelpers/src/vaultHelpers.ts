import { SimplePool, Event as NostrEvent, Filter } from 'nostr-tools';
import { finalizeEvent, getPublicKey as nostrGetPublicKey } from 'nostr-tools/pure';
import { getEnvironment, getNamespace } from './config';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';


import type { VaultData, LoginObj, VaultObj, IdentifierType } from '@nostrpass/types';

// Alias for backward compatibility
export type NostrVaultData = VaultData;

// New helper functions for the updated auth flow

/**
 * Build the d-tag for LoginObj lookup
 * Supports both username and Google UID identifiers
 *
 * For username auth:
 *   Format: ${namespace}_login_${hash(identifier)}_${identifierType}_${environment}
 *   Legacy format: ${namespace}_login_${hash(username)}_${environment}
 *
 * For Google auth (multi-vault support):
 *   Format: ${namespace}_login_${hash(googleUid)}_google_${hash(storagePublicKey)}_${environment}
 *   This allows multiple vaults per Google account, keyed by storagePublicKey
 *
 * @param identifier - Username or Google UID
 * @param identifierType - 'username' or 'google'
 * @param environment - Environment name
 * @param namespace - Namespace for the d-tag
 * @param storagePublicKey - For Google auth: the vault's storagePublicKey (enables multi-vault)
 */
function buildLoginDTag(
  identifier: string,
  identifierType: IdentifierType,
  environment: string,
  namespace: string,
  storagePublicKey?: string // Required for Google auth to support multi-vault
): string {
  if (identifierType === 'google' && storagePublicKey) {
    // Multi-vault format for Google: includes storagePublicKey hash
    return `${namespace}_login_${hash(identifier)}_google_${hash(storagePublicKey)}_${environment}`;
  }
  // Standard format for username auth (or Google without storagePublicKey for backward compat)
  return `${namespace}_login_${hash(identifier)}_${identifierType}_${environment}`;
}

/**
 * Save LoginObj to Nostr - PASSWORD ENCRYPTED for security (using NIP-44)
 * LoginObj contains PIN-encrypted storage keypair, so needs password protection
 *
 * @param identifier - Username or Google UID
 * @param identifierType - 'username' or 'google'
 * @param storagePublicKey - For Google auth: the vault's storagePublicKey (enables multi-vault)
 * @param displayName - For Google auth: human-readable display name for vault picker
 */
export async function saveLoginObj(
  identifier: string,
  identifierType: IdentifierType,
  loginObj: LoginObj,
  randomPublicKey: string,
  randomPrivateKey: string,
  relays: string[],
  environment: string,
  passwordKey: string,  // Password key for encrypting LoginObj content
  storagePublicKey?: string, // For Google auth: storagePublicKey for multi-vault d-tag
  displayName?: string // For Google auth: display name for vault picker UI
): Promise<string[]> {
  try {
    // Validate required fields before attempting to create event
    if (!loginObj.passwordSalt) {
      throw new Error('loginObj.passwordSalt is required but undefined - cannot create Nostr event');
    }
    if (!identifier) {
      throw new Error('identifier is required but undefined');
    }
    if (!randomPublicKey || !randomPrivateKey) {
      throw new Error('randomPublicKey and randomPrivateKey are required');
    }

    const loginContent = JSON.stringify(loginObj);

    // CRITICAL: Encrypt LoginObj content with password key using NIP-44
    // This protects the PIN-encrypted storage keypair from public exposure
    const { encrypt, getConversationKey } = await import('nostr-tools/nip44');
    const privateKeyBytes = hexToBytes(randomPrivateKey);
    const derivedPublicKey = nostrGetPublicKey(privateKeyBytes);
    const pubkeyToUse = derivedPublicKey || randomPublicKey;

    // NIP-44 requires deriving a conversation key first
    const passwordKeyBytes = hexToBytes(passwordKey);
    const conversationKey = getConversationKey(passwordKeyBytes, pubkeyToUse);
    const encryptedContent = encrypt(loginContent, conversationKey);
    console.log('🔐 [saveLoginObj] LoginObj encrypted with password key (NIP-44)');

    // Create login event with random key for privacy
    const namespace = getNamespace();
    const dTag = buildLoginDTag(identifier, identifierType, environment, namespace, storagePublicKey);

    console.log('📤 [saveLoginObj] Publishing LoginObj:', {
      identifier: identifier.substring(0, 8) + '...',
      identifierType,
      environment,
      namespace,
      storagePublicKey: storagePublicKey?.slice(0, 12) + '...',
      displayName,
      dTag,
      relays
    });

    // Build tags array
    const tags: string[][] = [
      ['d', dTag],
      ['client', namespace],
      ['subject', 'login-lookup'],
      ['encryption', 'password-nip44'], // Mark as password-encrypted with NIP-44
      ['password-salt', loginObj.passwordSalt], // CRITICAL: Store salt in plaintext for password key derivation
      ['auth-provider', identifierType], // Track auth method for future lookups
    ];

    // Add Google-specific tags for reliable relay lookups
    if (identifierType === 'google') {
      // Use standard 't' (hashtag) tag for reliable relay indexing
      // The 't' tag is a standard NIP tag that's indexed by most relays (unlike custom tags)
      // Format: gvault_{hash(googleUid)} - enables finding all vaults linked to a Google account
      tags.push(['t', `gvault_${hash(identifier)}`]);

      // Also keep the custom tag for backwards compatibility
      tags.push(['google-uid-hash', hash(identifier)]);

      // Add display-name tag for vault picker UI (human-readable)
      console.log('🏷️ [saveLoginObj] Adding display-name tag:', { displayName, hasDisplayName: !!displayName });
      if (displayName) {
        tags.push(['display-name', displayName]);
        console.log('🏷️ [saveLoginObj] ✅ Added display-name tag:', displayName);
      } else {
        console.warn('🏷️ [saveLoginObj] ⚠️ NO displayName provided - vault picker will show "Unknown Vault"');
      }

      // Add storage-public-key tag for direct lookup
      if (storagePublicKey) {
        tags.push(['storage-public-key', storagePublicKey]);
        // Also add a 't' tag for reliable relay indexing (custom tags often aren't indexed)
        // Format: svault_{hash(storagePublicKey)} - enables finding all Google logins for a vault
        tags.push(['t', `svault_${hash(storagePublicKey)}`]);
      }

      // Version tag to distinguish new format from old legacy LoginObjs
      tags.push(['version', '2']);

      // Log all tags being published for debugging
      console.log('📋 [saveLoginObj] FINAL TAGS for Google LoginObj:', JSON.stringify(tags, null, 2));
    }

    const loginEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags,
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
        console.log(`✅ Published password-encrypted LoginObj (NIP-44) to ${relay} [${identifierType}]`);
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
 * Tombstone a Google LoginObj - marks it as unlinked
 * Publishes a replacement event with the same d-tag but with a 't: tombstone' tag.
 * This effectively "deletes" the link without actually deleting the event.
 * The query in getAllGoogleLoginObjs will skip tombstoned entries.
 *
 * @param googleUid - Google UID
 * @param storagePublicKey - The vault's storage public key
 * @param environment - Environment name
 * @param relays - Relay URLs to publish to
 */
export async function tombstoneGoogleLoginObj(
  googleUid: string,
  storagePublicKey: string,
  storagePrivateKey: string,
  environment: string,
  relays: string[]
): Promise<string[]> {
  try {
    const namespace = getNamespace();
    const dTag = buildLoginDTag(googleUid, 'google', environment, namespace, storagePublicKey);

    console.log('🪦 [tombstoneGoogleLoginObj] Tombstoning Google LoginObj:', {
      googleUid: googleUid.substring(0, 8) + '...',
      storagePublicKey: storagePublicKey.slice(0, 12) + '...',
      environment,
      namespace,
      dTag
    });

    // Use the STORAGE keypair to sign the tombstone
    // This must match the keypair used to create the original LoginObj
    // so that relays accept it as a valid replacement (NIP-78 addressable events)
    const privateKeyBytes = hexToBytes(storagePrivateKey);
    const publicKey = nostrGetPublicKey(privateKeyBytes);

    // Build tags - include tombstone marker
    const tags: string[][] = [
      ['d', dTag],
      ['client', namespace],
      ['subject', 'login-lookup'],
      ['t', 'tombstone'], // Mark as tombstoned/unlinked
      ['t', `gvault_${hash(googleUid)}`], // Keep the gvault tag so queries still find it (to skip)
    ];

    // Content can be empty or a simple marker
    const content = JSON.stringify({ tombstoned: true, at: Date.now() });

    const event: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey: publicKey,
    };

    const signedEvent = finalizeEvent(event as any, privateKeyBytes);

    const pool = new SimplePool();
    const successfulPublishes: string[] = [];

    for (const relay of relays) {
      try {
        await pool.publish([relay], signedEvent);
        console.log(`✅ [tombstoneGoogleLoginObj] Published tombstone to ${relay}`);
        successfulPublishes.push(relay);
      } catch (error: any) {
        console.error(`❌ [tombstoneGoogleLoginObj] Failed to publish to ${relay}:`, error.message);
      }
    }

    pool.close(relays);

    if (successfulPublishes.length === 0) {
      throw new Error('Failed to publish tombstone to any relay');
    }

    console.log(`🪦 [tombstoneGoogleLoginObj] Tombstone published to ${successfulPublishes.length} relay(s)`);
    return successfulPublishes;
  } catch (error) {
    console.error('[tombstoneGoogleLoginObj] Failed:', error);
    throw error;
  }
}

/**
 * Get LoginObj from Nostr by identifier - PASSWORD ENCRYPTED
 * First retrieves passwordSalt from event tags, then decrypts content
 * Supports both NIP-44 (preferred) and NIP-04 (fallback for legacy data)
 *
 * @param identifier - Username or Google UID
 * @param identifierType - 'username' or 'google'
 * @param environment - Environment name (e.g., 'production')
 * @param relays - Relay URLs to query
 * @param password - Password for deriving decryption key
 */
export async function getLoginObj(
  identifier: string,
  identifierType: IdentifierType,
  environment: string,
  relays: string[],
  password: string  // Password for deriving decryption key
): Promise<{ loginObj: LoginObj; passwordSalt: string } | null> {
  try {
    const pool = new SimplePool();
    const namespace = getNamespace();

    // Build d-tag with identifier type
    const dTag = buildLoginDTag(identifier, identifierType, environment, namespace);

    // Create filter for login event
    const filter: Filter = {
      kinds: [30078],
      '#d': [dTag],
      limit: 1
    };

    console.log('📥 [getLoginObj] Querying for LoginObj:', { identifier, identifierType, environment, dTag });

    // Get the latest login event
    let event = await pool.get(relays, filter);

    // Backward compatibility: if username type and not found, try legacy d-tag format
    if (!event && identifierType === 'username') {
      const legacyDTag = `${namespace}_login_${hash(identifier)}_${environment}`;
      console.log('📥 [getLoginObj] Trying legacy d-tag format:', legacyDTag);
      const legacyFilter: Filter = {
        kinds: [30078],
        '#d': [legacyDTag],
        limit: 1
      };
      event = await pool.get(relays, legacyFilter);
    }

    // Migration fallback: if not found and environment is not 'development',
    // try 'development' as fallback. This handles accounts created during a bug
    // where the EnvironmentProvider URL param was read in onMount instead of synchronously,
    // causing accounts to be saved with 'development' instead of the URL-specified environment.
    if (!event && environment !== 'development') {
      const fallbackDTag = buildLoginDTag(identifier, identifierType, 'development', namespace);
      console.log('📥 [getLoginObj] Trying development fallback (migration):', fallbackDTag);
      const fallbackFilter: Filter = {
        kinds: [30078],
        '#d': [fallbackDTag],
        limit: 1
      };
      event = await pool.get(relays, fallbackFilter);

      if (event) {
        console.log('⚠️ [getLoginObj] Found account in development environment (migration case)');
      }
    }

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

    // Check encryption type from tags
    const encryptionTag = event.tags.find(t => t[0] === 'encryption');
    const encryptionType = encryptionTag?.[1] || 'password-nip04'; // Default to nip04 for legacy

    // Try NIP-44 first (for new data), then fall back to NIP-04 (for legacy data)
    if (encryptionType === 'password-nip44') {
      try {
        const { decrypt, getConversationKey } = await import('nostr-tools/nip44');
        // NIP-44 requires deriving a conversation key first
        const passwordKeyBytes = hexToBytes(passwordKey);
        const conversationKey = getConversationKey(passwordKeyBytes, event.pubkey);
        const decryptedContent = decrypt(event.content, conversationKey);
        const loginObj = JSON.parse(decryptedContent) as LoginObj;
        console.log('✅ [getLoginObj] LoginObj decrypted successfully (NIP-44)');
        return { loginObj, passwordSalt };
      } catch (nip44Error) {
        console.warn('⚠️ [getLoginObj] NIP-44 decryption failed, trying NIP-04 fallback...', nip44Error);
      }
    }

    // Fallback to NIP-04 for legacy data or if NIP-44 fails
    try {
      const { decrypt } = await import('nostr-tools/nip04');
      const decryptedContent = await decrypt(passwordKey, event.pubkey, event.content);
      const loginObj = JSON.parse(decryptedContent) as LoginObj;
      console.log('✅ [getLoginObj] LoginObj decrypted successfully (NIP-04 legacy)');
      return { loginObj, passwordSalt };
    } catch (decryptError) {
      console.error('❌ [getLoginObj] Failed to decrypt LoginObj with both NIP-44 and NIP-04 - wrong password?', decryptError);
      return null;
    }
  } catch (error) {
    console.error('Failed to get LoginObj:', error);
    return null;
  }
}

/**
 * Get LoginObj by d-tag directly (for multi-vault Google auth)
 * Used after getAllGoogleLoginObjs() when user selects a vault
 *
 * @param dTag - The exact d-tag from GoogleVaultInfo
 * @param passwordSalt - The password salt from GoogleVaultInfo
 * @param relays - Relay URLs to query
 * @param password - Password for decryption
 */
export async function getLoginObjByDTag(
  dTag: string,
  passwordSalt: string,
  relays: string[],
  password: string
): Promise<{ loginObj: LoginObj; passwordSalt: string } | null> {
  try {
    const pool = new SimplePool();

    const filter: Filter = {
      kinds: [30078],
      '#d': [dTag],
      limit: 1
    };

    console.log('📥 [getLoginObjByDTag] Querying for LoginObj by d-tag:', dTag);

    const event = await pool.get(relays, filter);
    pool.close(relays);

    if (!event) {
      console.log('❌ [getLoginObjByDTag] No LoginObj found');
      return null;
    }

    // Derive password key from password + salt using PBKDF2
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = hexToBytes(passwordSalt);

    const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
    const derivedKey = pbkdf2(sha256, passwordData, saltData, { c: 100000, dkLen: 32 });
    const passwordKey = bytesToHex(derivedKey);
    console.log('🔑 [getLoginObjByDTag] Derived password key from password + salt');

    // Check encryption type from tags
    const encryptionTag = event.tags.find(t => t[0] === 'encryption');
    const encryptionType = encryptionTag?.[1] || 'password-nip04';

    // Try NIP-44 first
    if (encryptionType === 'password-nip44') {
      try {
        const { decrypt, getConversationKey } = await import('nostr-tools/nip44');
        const passwordKeyBytes = hexToBytes(passwordKey);
        const conversationKey = getConversationKey(passwordKeyBytes, event.pubkey);
        const decryptedContent = decrypt(event.content, conversationKey);
        const loginObj = JSON.parse(decryptedContent) as LoginObj;
        console.log('✅ [getLoginObjByDTag] LoginObj decrypted successfully (NIP-44)');
        return { loginObj, passwordSalt };
      } catch (nip44Error) {
        console.warn('⚠️ [getLoginObjByDTag] NIP-44 decryption failed, trying NIP-04 fallback...', nip44Error);
      }
    }

    // Fallback to NIP-04
    try {
      const { decrypt } = await import('nostr-tools/nip04');
      const decryptedContent = await decrypt(passwordKey, event.pubkey, event.content);
      const loginObj = JSON.parse(decryptedContent) as LoginObj;
      console.log('✅ [getLoginObjByDTag] LoginObj decrypted successfully (NIP-04)');
      return { loginObj, passwordSalt };
    } catch (decryptError) {
      console.error('❌ [getLoginObjByDTag] Failed to decrypt LoginObj - wrong password?', decryptError);
      return null;
    }
  } catch (error) {
    console.error('Failed to get LoginObj by d-tag:', error);
    return null;
  }
}

/**
 * Vault info extracted from a Google LoginObj without decrypting
 * Used for vault picker when multiple vaults are linked to same Google account
 */
export interface GoogleVaultInfo {
  dTag: string;
  storagePublicKey: string; // The vault's unique identifier
  displayName: string; // Human-readable name for UI
  passwordSalt: string;
  createdAt: number;
  pubkey: string; // Event author pubkey (needed for getLoginObj)
}
/**
 * Get all LoginObjs for a Google UID without decrypting.
 * Used to check if multiple vaults are linked to the same Google account.
 * Returns vault info extracted from event tags (no password needed).
 *
 * Queries using the standard #t tag with format: gvault_{hash(googleUid)}
 * The 't' tag is a standard NIP tag reliably indexed by relays.
 *
 * @param googleUid - Google UID
 * @param environment - Environment name (e.g., 'production')
 * @param relays - Relay URLs to query
 * @returns Array of vault info objects (empty if none found)
 */
export async function getAllGoogleLoginObjs(
  googleUid: string,
  environment: string,
  relays: string[]
): Promise<GoogleVaultInfo[]> {
  try {
    const pool = new SimplePool();
    const namespace = getNamespace();

    // Build d-tag prefix for Google auth
    // Format: ${namespace}_login_${hash(googleUid)}_google_
    const hashedGoogleUid = hash(googleUid);
    const dTagPrefix = `${namespace}_login_${hashedGoogleUid}_google_`;

    console.log('🔍 [getAllGoogleLoginObjs] Querying for all Google LoginObjs:', {
      googleUid: googleUid.substring(0, 8) + '...',
      environment,
      namespace,
      dTagPrefix,
      hashedGoogleUid,
      relays: relays
    });

    // Query by #t tag with hashed Google UID
    // The 't' tag is a standard NIP tag that's reliably indexed by relays
    const tTagValue = `gvault_${hashedGoogleUid}`;
    console.log('🔍 [getAllGoogleLoginObjs] Querying by #t tag:', tTagValue);

    const filter: Filter = {
      kinds: [30078],
      '#t': [tTagValue],
      limit: 100
    };

    let allEvents: NostrEvent[] = [];
    try {
      allEvents = await pool.querySync(relays, filter);
      console.log(`🔍 [getAllGoogleLoginObjs] Query returned ${allEvents.length} event(s)`);
    } catch (e) {
      console.warn('🔍 [getAllGoogleLoginObjs] Query failed:', e);
    }

    // Log all d-tags for debugging
    if (allEvents.length > 0) {
      console.log('🔍 [getAllGoogleLoginObjs] D-tags found:', allEvents.map(e => e.tags.find(t => t[0] === 'd')?.[1]));
    }

    // Filter events by d-tag prefix and environment suffix
    let matchingEvents = allEvents.filter(event => {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const matches = dTag && dTag.startsWith(dTagPrefix) && dTag.endsWith(`_${environment}`);
      if (dTag && !matches) {
        console.log(`🔍 [getAllGoogleLoginObjs] D-tag ${dTag} does not match prefix ${dTagPrefix} or suffix _${environment}`);
      }
      return matches;
    });

    console.log(`🔍 [getAllGoogleLoginObjs] Found ${matchingEvents.length} LoginObj events for this Google UID after filtering`);

    pool.close(relays);

    if (matchingEvents.length === 0) {
      return [];
    }

    // Extract vault info from each event
    const vaults: GoogleVaultInfo[] = [];

    for (const event of matchingEvents) {
      // Skip tombstoned (unlinked) entries - they have a 't: tombstone' tag
      const isTombstone = event.tags.some(t => t[0] === 't' && t[1] === 'tombstone');
      if (isTombstone) {
        console.log('🔍 [getAllGoogleLoginObjs] Skipping tombstoned entry');
        continue;
      }

      // Only include version 2 (new format) entries - orphan old legacy ones
      const versionTag = event.tags.find(t => t[0] === 'version');
      if (versionTag?.[1] !== '2') {
        console.log('🔍 [getAllGoogleLoginObjs] Skipping legacy entry (no version tag or version != 2)');
        continue;
      }

      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const passwordSaltTag = event.tags.find(t => t[0] === 'password-salt');
      const storagePublicKeyTag = event.tags.find(t => t[0] === 'storage-public-key');
      const displayNameTag = event.tags.find(t => t[0] === 'display-name');
      // Fallback to old vault-username tag for backwards compatibility
      const vaultUsernameTag = event.tags.find(t => t[0] === 'vault-username');

      if (!dTag || !passwordSaltTag?.[1]) {
        console.warn('🔍 [getAllGoogleLoginObjs] Skipping event without d-tag or password-salt');
        continue;
      }

      // storagePublicKey is required for multi-vault, but fall back to empty for old events
      const storagePublicKey = storagePublicKeyTag?.[1] || '';
      // displayName for UI, fall back to vault-username for backwards compat
      const displayName = displayNameTag?.[1] || vaultUsernameTag?.[1] || 'Unknown Vault';

      vaults.push({
        dTag,
        storagePublicKey,
        displayName,
        passwordSalt: passwordSaltTag[1],
        createdAt: event.created_at,
        pubkey: event.pubkey
      });
    }

    // Sort by creation date (newest first)
    vaults.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`🔍 [getAllGoogleLoginObjs] Returning ${vaults.length} vault(s)`);

    return vaults;
  } catch (error) {
    console.error('[getAllGoogleLoginObjs] Failed to query:', error);
    return [];
  }
}

/**
 * Find all Google LoginObjs linked to a specific vault (by storagePublicKey).
 * Used to discover linked Google accounts for unlinking, even if linkedAuthProviders is missing.
 * Queries by the 't' tag: svault_{hash(storagePublicKey)}
 *
 * @param storagePublicKey - The vault's storage public key
 * @param environment - Environment name (e.g., 'production', 'demo')
 * @param relays - Relay URLs to query
 * @returns Array of linked Google account info
 */
export async function getLinkedGoogleLoginObjs(
  storagePublicKey: string,
  environment: string,
  relays: string[]
): Promise<Array<{
  displayName: string;
  googleUidHash: string;
  dTag: string;
  pubkey: string; // Event pubkey needed for tombstoning
  createdAt: number;
}>> {
  try {
    const pool = new SimplePool();
    const storageHash = hash(storagePublicKey);

    console.log('[getLinkedGoogleLoginObjs] Querying for linked Google accounts:', {
      storagePublicKey: storagePublicKey.slice(0, 12) + '...',
      storageHash: storageHash.slice(0, 12) + '...',
      environment,
      relays
    });

    // Query by 't' tag: svault_{hash(storagePublicKey)}
    const filter: Filter = {
      kinds: [30078],
      '#t': [`svault_${storageHash}`],
      limit: 20
    };

    let events: NostrEvent[] = [];
    try {
      events = await pool.querySync(relays, filter);
    } catch (e) {
      console.warn('[getLinkedGoogleLoginObjs] Query failed:', e);
    }

    pool.close(relays);

    console.log(`[getLinkedGoogleLoginObjs] Found ${events.length} event(s)`);

    if (events.length === 0) {
      return [];
    }

    const results: Array<{
      displayName: string;
      googleUidHash: string;
      dTag: string;
      pubkey: string;
      createdAt: number;
    }> = [];

    for (const event of events) {
      // Skip tombstoned (unlinked) entries
      const isTombstone = event.tags.some(t => t[0] === 't' && t[1] === 'tombstone');
      if (isTombstone) {
        console.log('[getLinkedGoogleLoginObjs] Skipping tombstoned entry');
        continue;
      }

      // Verify this is a Google auth LoginObj
      const authProviderTag = event.tags.find(t => t[0] === 'auth-provider');
      if (authProviderTag?.[1] !== 'google') {
        continue;
      }

      // Verify environment matches
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (!dTag || !dTag.endsWith(`_${environment}`)) {
        continue;
      }

      // Only include version 2 (new format) entries - orphan old legacy ones
      const versionTag = event.tags.find(t => t[0] === 'version');
      if (versionTag?.[1] !== '2') {
        console.log('[getLinkedGoogleLoginObjs] Skipping legacy entry (no version tag or version != 2)');
        continue;
      }

      // Extract display name and google UID hash
      const displayNameTag = event.tags.find(t => t[0] === 'display-name');
      const googleUidHashTag = event.tags.find(t => t[0] === 'google-uid-hash');

      results.push({
        displayName: displayNameTag?.[1] || 'Unknown Vault',
        googleUidHash: googleUidHashTag?.[1] || '',
        dTag,
        pubkey: event.pubkey,
        createdAt: event.created_at * 1000
      });
    }

    console.log(`[getLinkedGoogleLoginObjs] Returning ${results.length} linked account(s)`);
    return results;
  } catch (error) {
    console.error('[getLinkedGoogleLoginObjs] Failed:', error);
    return [];
  }
}

/**
 * Check if a LoginObj exists on Nostr without decrypting
 * Used to determine if an account exists before prompting for password
 *
 * @param identifier - Username or Google UID
 * @param identifierType - 'username' or 'google'
 * @param environment - Environment name (production, development, etc.)
 * @param relays - Relay URLs to query
 * @returns true if LoginObj exists, false otherwise
 */
export async function loginObjExists(
  identifier: string,
  identifierType: IdentifierType,
  environment: string,
  relays: string[]
): Promise<boolean> {
  try {
    const pool = new SimplePool();
    const namespace = getNamespace();

    // Build d-tag with identifier type
    const dTag = buildLoginDTag(identifier, identifierType, environment, namespace);

    // Create filter for login event
    const filter: Filter = {
      kinds: [30078],
      '#d': [dTag],
      limit: 1
    };

    console.log('🔍 [loginObjExists] Checking for LoginObj:', { identifier: identifier.substring(0, 8) + '...', identifierType, environment, dTag });

    // Get the latest login event
    let event = await pool.get(relays, filter);

    // Backward compatibility: if username type and not found, try legacy d-tag format
    if (!event && identifierType === 'username') {
      const legacyDTag = `${namespace}_login_${hash(identifier)}_${environment}`;
      console.log('🔍 [loginObjExists] Trying legacy d-tag format:', legacyDTag);
      const legacyFilter: Filter = {
        kinds: [30078],
        '#d': [legacyDTag],
        limit: 1
      };
      event = await pool.get(relays, legacyFilter);
    }

    pool.close(relays);

    if (event) {
      console.log('✅ [loginObjExists] LoginObj found');
      return true;
    }

    console.log('❌ [loginObjExists] No LoginObj found');
    return false;
  } catch (error) {
    console.error('Failed to check LoginObj existence:', error);
    return false;
  }
}

/**
 * Save VaultObj to Nostr using storage key (STORAGE-KEY-ENCRYPTED via NIP-44)
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

    // CRITICAL: Encrypt entire VaultObj with STORAGE KEY (NIP-44)
    // This allows realtime updates without password (storage keys already in memory)
    // Uses NIP-44 encryption with conversation key
    const { encrypt, getConversationKey } = await import('nostr-tools/nip44');
    const storagePrivateKeyBytes = hexToBytes(storagePrivateKey);
    const conversationKey = getConversationKey(storagePrivateKeyBytes, storagePublicKey);
    const encryptedContent = encrypt(vaultJson, conversationKey);

    console.log('🔐 [saveVaultObj] VaultObj encrypted with storage key (NIP-44)');

    const namespace = getNamespace();
    // Create vault event with storage key as author
    const vaultEvent: Partial<NostrEvent> = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${namespace}_vault_${storagePublicKey}_${getEnvironment()}`],
        ['client', namespace],
        ['subject', 'encrypted-vault'],
        ['encryption', 'nip44-storage'], // Mark as storage-key-encrypted (NIP-44)
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
        console.log(`✅ Published storage-key-encrypted VaultObj (NIP-44) to ${relay}`);
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
 * Supports both NIP-44 (preferred) and NIP-04 (fallback for legacy data)
 * @param userPublicKey - User's storage public key
 * @param relays - Relay URLs to query
 * @param storagePrivateKey - Storage private key for decrypting VaultObj
 * @returns Vault data or null if not found
 */
export async function getVaultFromNostr(
  userPublicKey: string,
  relays: string[],
  storagePrivateKey: string,  // Storage private key for vault decryption
  environment?: string  // Optional environment override (uses session environment for Google login)
): Promise<VaultData | null> {
  try {
    const pool = new SimplePool();
    const env = environment || getEnvironment();
    const namespace = getNamespace();
    const expectedDTag = `${namespace}_vault_${userPublicKey}_${env}`;
    console.log('📥 [getVaultFromNostr] Querying relays:', relays);
    console.log('📥 [getVaultFromNostr] Expected d-tag:', expectedDTag);
    console.log('📥 [getVaultFromNostr] Author pubkey:', userPublicKey);
    const filter: Filter = { kinds: [30078], authors: [userPublicKey], '#d': [expectedDTag], limit: 10 };
    let events = await pool.querySync(relays, filter);
    console.log(`📥 [getVaultFromNostr] Found ${events.length} events with current d-tag format`);

    // Fallback: Try legacy d-tag formats if not found
    if (events.length === 0) {
      // Legacy format 1: username as d-tag (very old accounts from DATA_STRUCTURES.md)
      // This was the original format where d-tag was just the username
      console.log('📥 [getVaultFromNostr] Primary d-tag not found, trying fallback: broad search for any vault events from this author');
      console.log('📥 [getVaultFromNostr] Looking for VaultObj with any d-tag from author:', userPublicKey.slice(0, 16) + '...');
      const fallbackFilter: Filter = {
        kinds: [30078],
        authors: [userPublicKey],
        limit: 20
      };
      const fallbackEvents = await pool.querySync(relays, fallbackFilter);
      console.log(`📥 [getVaultFromNostr] Fallback found ${fallbackEvents.length} events from this author`);

      // Log what we found
      fallbackEvents.forEach((e, i) => {
        const dTag = e.tags.find(t => t[0] === 'd')?.[1] || '';
        const subject = e.tags.find(t => t[0] === 'subject')?.[1] || '';
        const enc = e.tags.find(t => t[0] === 'encryption')?.[1] || '';
        console.log(`📥 [getVaultFromNostr] Fallback event ${i}: d-tag=${dTag.slice(0, 50)}... subject=${subject} encryption=${enc}`);
      });

      // Filter to vault events (subject = encrypted-vault or d-tag contains _vault_)
      events = fallbackEvents.filter(e => {
        const subject = e.tags.find(t => t[0] === 'subject')?.[1];
        const dTag = e.tags.find(t => t[0] === 'd')?.[1] || '';
        return subject === 'encrypted-vault' || dTag.includes('_vault_');
      });
      console.log(`📥 [getVaultFromNostr] Filtered to ${events.length} vault events (matching subject=encrypted-vault OR d-tag contains _vault_)`);

      if (events.length > 0) {
        events.forEach((e, i) => {
          const dTag = e.tags.find(t => t[0] === 'd')?.[1];
          console.log(`📥 [getVaultFromNostr] Fallback event ${i}: d-tag=${dTag}`);
        });
      }
    }

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

    for (const event of sortedEvents) {
      // Check encryption type from tags
      const encryptionTag = event.tags.find(t => t[0] === 'encryption');
      const encryptionType = encryptionTag?.[1] || 'nip04-storage'; // Default to nip04 for legacy

      // Try NIP-44 first (for new data)
      if (encryptionType === 'nip44-storage') {
        try {
          const { decrypt, getConversationKey } = await import('nostr-tools/nip44');
          const storagePrivateKeyBytes = hexToBytes(storagePrivateKey);
          const conversationKey = getConversationKey(storagePrivateKeyBytes, userPublicKey);
          const decryptedContent = decrypt(event.content, conversationKey);
          const vaultData = JSON.parse(decryptedContent) as VaultData;
          console.log(`✅ [getVaultFromNostr] Successfully decrypted vault (NIP-44) with ${vaultData.identities?.length || 0} identities`);
          return vaultData;
        } catch (nip44Error) {
          console.warn(`⚠️ [getVaultFromNostr] NIP-44 decryption failed, trying NIP-04 fallback...`, nip44Error);
        }
      }

      // Fallback to NIP-04 for legacy data or if NIP-44 fails
      try {
        const { decrypt } = await import('nostr-tools/nip04');
        const decryptedContent = await decrypt(storagePrivateKey, userPublicKey, event.content);
        const vaultData = JSON.parse(decryptedContent) as VaultData;
        console.log(`✅ [getVaultFromNostr] Successfully decrypted vault (NIP-04 legacy) with ${vaultData.identities?.length || 0} identities`);
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