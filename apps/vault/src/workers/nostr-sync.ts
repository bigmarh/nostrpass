/**
 * Nostr Synchronization Module
 *
 * This module handles all Nostr relay interactions for the vault system.
 * It provides:
 * - Publishing vault data to Nostr relays (encrypted with storage or password keys)
 * - Fetching vault data from Nostr relays
 * - Real-time subscriptions to vault updates
 *
 * Architecture:
 * - All vault events are encrypted using NIP-04
 * - Initial vault creation uses password-based encryption
 * - Subsequent sync operations use storage key encryption
 * - Real-time subscriptions with polling fallback for reliability
 * - Version-based conflict resolution for concurrent updates
 */

import { SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';
import { vaultDB, type VaultData } from './db';
import { getEnvironment } from '@nostrpass/nostrHelpers';
import { STORAGE_INDEX } from '@nostrpass/types';
import { cryptoPrimitives, ensureCryptoReady } from './crypto-primitives';
import { getSessionStateManager } from './session-state-manager';
import { vaultOperations } from './vault-operations';
import { activeSessions } from './session-manager';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Track active Nostr subscriptions per username
 * Each subscription includes pool, relays, and unsub callback
 */
const nostrSubscriptions = new Map<
  string,
  { pool: SimplePool; relays: string[]; unsub: (() => void) | null }
>();

/**
 * Track polling timers for users who couldn't establish real-time subscriptions
 * Maps username to interval timer ID
 */
const nostrPollers = new Map<string, number>();

/**
 * Track vault version history subscriptions
 * Maps username to subscription details
 */
const vaultVersionSubscriptions = new Map<
  string,
  { pool: SimplePool; relays: string[]; sub: any }
>();

/**
 * Broadcast channel for vault version updates
 * Used to notify UI about new vault versions
 */
let vaultVersionBroadcast: BroadcastChannel | null = null;

function getVersionBroadcast(): BroadcastChannel {
  if (!vaultVersionBroadcast) {
    vaultVersionBroadcast = new BroadcastChannel('nostrpass-vault-versions');
  }
  return vaultVersionBroadcast;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Poll Nostr relays once for vault updates and apply if newer
 * Used as fallback when real-time subscriptions fail, and as periodic reconciliation
 *
 * @param params - Object containing username, relays, pubkey, storage keys, and environment
 */
async function pollOnceAndApply(params: {
  username: string;
  relays: string[];
  pubkey: string;
  storagePriv: string;
  storagePub: string;
  env: string;
}) {
  const { username, relays, pubkey, storagePriv, storagePub, env } = params;
  try {
    const pool = new SimplePool();
    const dTag = `nostrpass.com_vault_${pubkey}_${env}`;
    const filter: Filter = { kinds: [30078], authors: [pubkey], '#d': [dTag], limit: 10 };
    const events = await pool.querySync(relays, filter);
    pool.close(relays);
    if (!events || events.length === 0) return;
    // Sort newest first by created_at
    events.sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0));
    for (const ev of events) {
      try {
        let remote: VaultData | null = null;
        // Try to decrypt with storage key (for NIP-04 encrypted sync events)
        try {
          const plaintext = await nip04DecryptJS(storagePriv, storagePub, ev.content);
          remote = JSON.parse(plaintext) as VaultData;
          console.log('📥 [Worker Poll] Decrypted vault event with storage key:', {
            identitiesCount: remote.identities?.length,
            version: (remote as any).version,
          });
        } catch {
          // Fallback to plain JSON parse for legacy unencrypted events (should not exist anymore)
          try {
            remote = JSON.parse(ev.content) as VaultData;
          } catch {
            remote = null;
          }
        }
        if (!remote) continue;
        // Use storagePublicKey (storagePub) as primary key - it's the IndexedDB keyPath
        // Fall back to username only if storagePub is somehow unavailable
        console.log('🔑 [Worker Poll] Looking up vault by storagePublicKey:', storagePub?.slice(0, 12) + '...');
        const local = await vaultDB.getVault(storagePub || username);

        // Use timestamp-based comparison like DMs (simpler and more reliable)
        const remoteTimestamp = ev.created_at || 0; // Nostr event timestamp
        const localTimestamp = (local as any)?.updatedAt ? Math.floor((local as any).updatedAt / 1000) : 0; // Convert ms to seconds

        console.log('⏱️ [Worker Poll] Comparing timestamps:', {
          remoteTimestamp,
          localTimestamp,
          remoteDate: new Date(remoteTimestamp * 1000).toISOString(),
          localDate: local?.updatedAt ? new Date(local.updatedAt).toISOString() : 'never',
          remoteIdentities: remote.identities?.length,
          localIdentities: local?.identities?.length,
        });

        if (remoteTimestamp > localTimestamp) {
          console.log('📥 [Worker POLLING FALLBACK] Applying newer vault from Nostr:', {
            source: 'POLL',
            remoteTimestamp,
            localTimestamp,
            remoteIdentities: remote.identities?.length,
            localIdentities: local?.identities?.length,
          });
          await vaultOperations.updateVaultData({
            storagePublicKey: storagePub,  // Use storagePublicKey as primary key
            username,  // Keep for fallback and session lookup
            vaultData: remote,
            skipVersionIncrement: true,
            options: { syncToNostr: false } // Don't sync back - we just received this from Nostr!
          });

          // Update worker session cache with new vault data
          const sessionManager = getSessionStateManager();
          const session = sessionManager.getAuthState(username);
          if (session) {
            console.log('🔄 [Worker POLL] Updating session cache with new vault data');
            (session as any).vaultData = remote;
            (session as any).vaultVersion = remote.version || 0;
            (session as any).identityCount = remote.identities?.length || 0;
          }

          break;
        } else {
          console.log('⏭️ [Worker Poll] Skipping older/same vault (local is newer or equal)');
        }
      } catch {}
    }
  } catch (e) {
    console.warn('⚠️ [Worker] Poll once failed:', e);
  }
}

// ============================================================================
// NOSTR SYNC HANDLERS
// ============================================================================

/**
 * Nostr synchronization handlers object
 * Contains all handlers for Nostr relay interactions
 */
export const nostrSync = {
  /**
   * Start realtime Nostr subscription for a user's vault
   * Subscribes to full vault events
   * Falls back to polling if real-time subscription fails
   *
   * @param params - Object containing username and relays
   * @returns Object with started boolean
   */
  startNostrSubscription: async (params: {
    username: string;
    relays: string[];
  }): Promise<{ started: boolean }> => {
    console.log('🚀 [Worker.startNostrSubscription] FUNCTION CALLED with params:', params);
    await ensureCryptoReady();
    console.log('🚀 [Worker.startNostrSubscription] Crypto ready');
    const { username, relays } = params;

    // Get session from SessionStateManager (atomic auth uses this)
    const sessionManager = getSessionStateManager();
    const session = sessionManager.getAuthState(username);
    const sessionKeys = session ? sessionManager.getSensitiveKeys(username) : {};

    // Use storagePublicKey from session as primary key (it's the IndexedDB keyPath)
    // Fall back to username only if session doesn't have storagePublicKey yet
    const sessionStoragePub = session?.storagePublicKey;
    console.log('🔑 [Worker.startNostrSubscription] Looking up vault by:', sessionStoragePub ? 'storagePublicKey' : 'username');
    const vault = await vaultDB.getVault(sessionStoragePub || username);
    if (!vault) throw new Error('Vault not found');

    // CRITICAL: Use storagePublicKey for vault events (not personal identity publicKey)
    const pubkey = vault.storagePublicKey || vault.publicKey;
    const env = getEnvironment();

    // Require unlocked storage key for decryption
    const storagePriv = sessionKeys.storagePrivateKey;
    const storagePub = session?.storagePublicKey || pubkey;
    if (!storagePriv) {
      throw new Error('Storage key not available. Unlock required.');
    }

    // Tear down existing sub if any
    const existing = nostrSubscriptions.get(username);
    if (existing) {
      try {
        existing.unsub?.();
      } catch {}
      try {
        existing.pool.close(existing.relays);
      } catch {}
      nostrSubscriptions.delete(username);
    }

    // Try realtime subscription first; fall back to polling on error
    try {
      const pool = new SimplePool();
      const filter: Filter = { kinds: [30078], authors: [pubkey] };

      console.log('📡 [Worker] Subscribing to Nostr (author PRE):', {
        username,
        pubkey: pubkey.slice(0, 16),
        relaysCount: relays.length,
      });

      console.log('🔍 [Worker] SimplePool API check:', {
        hasSubscribeMany: typeof (pool as any).subscribeMany,
        hasSub: typeof (pool as any).sub,
        hasSubscribeManyToOne: typeof (pool as any).subscribeManyToOne,
        poolKeys: Object.keys(pool).slice(0, 10)
      });

      // Simplified event handler - only handles full vault snapshots
      // PRE events removed in streamlined architecture for simplicity
      const onEvent = async (ev: NostrEvent) => {
        try {
          const d = ev.tags.find((t) => t[0] === 'd')?.[1] || '';
          console.log('📨 [Worker] Received Nostr vault event:', {
            kind: ev.kind,
            d: d ? d.slice(0, 50) : '(no d-tag)',
            created_at: new Date(ev.created_at * 1000).toISOString(),
            eventId: ev.id.slice(0, 12)
          });

          if (!d) {
            console.warn('⚠️ [Worker] Event missing d-tag, ignoring');
            return;
          }

          // Only handle full vault snapshots (streamlined approach)
          if (d.startsWith(`nostrpass.com_vault_`)) {
            console.log('📥 [Worker] Processing full vault snapshot:', {
              d: d.slice(0, 40),
              eventId: ev.id.slice(0, 12),
            });

            // Decrypt vault data
            let remote: VaultData | null = null;
            try {
              const plaintext = await nip04DecryptJS(
                storagePriv as string,
                storagePub as string,
                ev.content
              );
              remote = JSON.parse(plaintext) as VaultData;
              console.log('✅ [Worker] Decrypted vault successfully');
            } catch (decryptErr) {
              console.error('❌ [Worker] Failed to decrypt vault:', decryptErr);
              return;
            }

            if (!remote) return;

            // Use storagePublicKey as primary key for vault lookup
            console.log('🔑 [Worker Subscription] Looking up local vault by storagePublicKey:', storagePub?.slice(0, 12) + '...');
            const local = await vaultDB.getVault(storagePub || username);

            // Timestamp-based conflict resolution (simpler and more reliable)
            const remoteTimestamp = ev.created_at || 0; // Nostr event timestamp in seconds
            const localTimestamp = (local as any)?.updatedAt ? Math.floor((local as any).updatedAt / 1000) : 0; // Convert ms to seconds

            console.log('📊 [Worker] Vault timestamp comparison:', {
              remoteTimestamp,
              localTimestamp,
              remoteDate: new Date(remoteTimestamp * 1000).toISOString(),
              localDate: local?.updatedAt ? new Date(local.updatedAt).toISOString() : 'never',
              remoteIdentities: remote.identities?.length || 0,
              localIdentities: local?.identities?.length || 0,
              willApply: remoteTimestamp > localTimestamp
            });

            // Apply remote vault if it's newer
            if (remoteTimestamp > localTimestamp) {
              // Log permissions from first identity to debug cross-browser sync
              const firstIdentity = remote.identities?.[0];
              const appPerms = firstIdentity?.appPermissions || {};
              const appIds = Object.keys(appPerms);
              console.log('📥 [Worker REAL-TIME SUBSCRIPTION] Applying newer vault from Nostr:', {
                source: 'SUBSCRIPTION',
                remoteTimestamp,
                localTimestamp,
                remoteIdentities: remote.identities?.length || 0,
                localIdentities: local?.identities?.length || 0,
                firstIdentityApps: appIds,
                permissionsPreview: appIds.length > 0 ? appPerms[appIds[0]]?.permissions : null
              });
              await vaultOperations.updateVaultData({
                storagePublicKey: storagePub,  // Use storagePublicKey as primary key
                username,  // Keep for fallback and session lookup
                vaultData: remote,
                skipVersionIncrement: true, // Don't increment version for Nostr downloads
                options: { syncToNostr: false } // Don't sync back - we just received this from Nostr!
              });

              // Update worker session cache with new vault data
              const sessionManager = getSessionStateManager();
              const session = sessionManager.getAuthState(username);
              if (session) {
                console.log('🔄 [Worker SUBSCRIPTION] Updating session cache with new vault data');
                (session as any).vaultData = remote;
                (session as any).vaultVersion = remote.version || 0;
                (session as any).identityCount = remote.identities?.length || 0;
              }

              console.log('✅ [Worker SUBSCRIPTION] Vault synced successfully from Nostr and session cache updated');
            } else {
              console.log('ℹ️ [Worker] Local vault is newer or equal, skipping update');
            }
          } else {
            // Ignore PRE events and other event types
            console.log('ℹ️ [Worker] Ignoring non-vault event:', d.slice(0, 20));
          }
        } catch (e) {
          console.warn('⚠️ [Worker] Failed to process Nostr event:', e);
        }
      };

      // Create subscription with callbacks (nostr-tools v2 API)
      // Use subscribeMany with async iterator approach for better compatibility
      console.log('📡 [Worker] Creating subscription with callback-based API');
      console.log('📡 [Worker] Relays:', relays);
      console.log('📡 [Worker] Filter:', filter);

      // subscribeMany takes a single filter object, not an array
      const sub = pool.subscribeMany(relays, filter, {
        onevent(event: NostrEvent) {
          const receivedAt = Date.now();
          console.log('🔔 [Worker] onevent callback FIRED! Real-time event received:', {
            kind: event.kind,
            id: event.id.slice(0, 12),
            created_at: new Date(event.created_at * 1000).toISOString(),
            receivedAt: new Date(receivedAt).toISOString(),
            lagMs: receivedAt - (event.created_at * 1000)
          });
          // Call the handler asynchronously
          onEvent(event).catch((err) => {
            console.error('❌ [Worker] Error in onevent handler:', err);
          });
        },
        oneose() {
          console.log('📡 [Worker] EOSE callback FIRED for', username);
        },
        onclose(reasons: string[]) {
          console.log('📡 [Worker] onclose callback FIRED:', reasons);
        }
      });

      console.log('✅ [Worker] Subscription object created:', {
        hasClose: typeof sub?.close,
        subType: typeof sub,
        subConstructor: sub?.constructor?.name
      });

      nostrSubscriptions.set(username, {
        pool,
        relays,
        unsub: () => {
          try {
            console.log('🛑 [Worker] Closing subscription for', username);
            sub.close();
          } catch (e) {
            console.warn('⚠️ [Worker] Error closing subscription:', e);
          }
        },
      });

      // Polling as backup (every 60 seconds)
      // This ensures updates arrive eventually even if real-time subscription has issues
      const key = `${username}`;
      const reconcile = setInterval(() => {
        console.log('🔄 [Worker] Running periodic vault poll (backup) for', username);
        pollOnceAndApply({ username, relays, pubkey, storagePriv, storagePub, env });
      }, 60000) as unknown as number;
      nostrPollers.set(key, reconcile);
      console.log('🔄 [Worker] Backup polling configured (60s interval)');

      console.log('✅ [Worker] Realtime subscription active');
      return { started: true };
    } catch (subErr) {
      console.error('❌ [Worker] Realtime subscription FAILED - Error details:', {
        errorMessage: subErr instanceof Error ? subErr.message : String(subErr),
        errorStack: subErr instanceof Error ? subErr.stack : undefined,
        errorType: subErr?.constructor?.name
      });
      console.warn('⚠️ [Worker] Falling back to polling mode');
      const pool = new SimplePool();
      nostrSubscriptions.set(username, { pool, relays, unsub: null });
      await pollOnceAndApply({ username, relays, pubkey, storagePriv, storagePub, env });
      const key = `${username}`;
      const timer = setInterval(() => {
        pollOnceAndApply({ username, relays, pubkey, storagePriv, storagePub, env });
      }, 5000) as unknown as number;
      nostrPollers.set(key, timer);
      console.log('✅ [Worker] Vault sync polling started (5s interval)');
      return { started: true };
    }
  },

  /**
   * Stop realtime Nostr subscription for a user
   * Cleans up subscription, pool, and polling timers
   *
   * @param params - Object containing username
   * @returns Object with stopped boolean
   */
  stopNostrSubscription: async (params: {
    username: string;
  }): Promise<{ stopped: boolean }> => {
    const { username } = params;
    const existing = nostrSubscriptions.get(username);
    if (existing) {
      try {
        existing.unsub?.();
      } catch {}
      try {
        existing.pool.close(existing.relays);
      } catch {}
      nostrSubscriptions.delete(username);
    }
    const key = `${username}`;
    if (nostrPollers.has(key)) {
      clearInterval(nostrPollers.get(key)!);
      nostrPollers.delete(key);
    }
    return { stopped: true };
  },

  /**
   * Create initial vault event for Nostr (PASSWORD-ENCRYPTED for account creation)
   * Used when creating a new vault - encrypted with password for initial sync
   *
   * @param params - Object containing username and passwordKey
   * @returns Object with signed event
   */
  createInitialVaultForNostr: async (params: {
    username: string;
    passwordKey: string;
  }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();
    const vaultRaw = await vaultDB.getVault(params.username);
    if (!vaultRaw) throw new Error('No vault to save');

    // Map from IndexedDB field names to VaultData interface field names
    const vault = {
      ...vaultRaw,
      xprivEncrypted: (vaultRaw as any).encryptedVault || (vaultRaw as any).xprivEncrypted,
    };

    console.log('📤 [createInitialVaultForNostr] Vault from IndexedDB:', {
      username: vault.username,
      identitiesCount: vault.identities?.length || 0,
      hasXprivEncrypted: !!vault.xprivEncrypted,
      xprivEncryptedLength: vault.xprivEncrypted?.length,
      updatedAt: new Date(vault.updatedAt || Date.now()).toISOString(),
      allVaultKeys: Object.keys(vault)
    });

    const session = (activeSessions as any).get(params.username);
    const pub = vault.storagePublicKey || vault.publicKey;

    // Ensure we have a storage private key available for signing. Derive it if missing.
    let priv = session?.storagePrivateKey as string | undefined;
    if (!priv && session?.xpriv) {
      try {
        const derived = await cryptoPrimitives.deriveKeypairFromXpriv({
          xpriv: session.xpriv,
          index: STORAGE_INDEX,
        });
        priv = derived.privateKey;
        (session as any).storagePrivateKey = priv;
        (session as any).storagePublicKey = derived.publicKey;
        console.log(
          '🔑 [createInitialVaultForNostr] Derived storage keypair via STORAGE_INDEX for signing'
        );
      } catch (e) {
        console.error('❌ [createInitialVaultForNostr] Failed to derive storage keypair:', e);
      }
    }

    if (!pub) {
      throw new Error('No storage public key available for vault creation');
    }

    const payload = {
      username: vault.username,
      publicKey: vault.publicKey,
      xprivEncrypted: vault.xprivEncrypted,
      salt: vault.salt,
      passwordSalt: vault.passwordSalt,
      passwordVerifier: vault.passwordVerifier,
      identities: vault.identities || [],
      // activeIdentityByApp removed - now stored in localStorage per-browser
      recovery: vault.recovery || null,
      customRelays: vault.customRelays || [],
      appPermissions: (vault as any).appPermissions || {},
      updatedAt: Date.now(),
      version: 1,
    };

    console.log('✅ [createInitialVaultForNostr] Payload created:', {
      identitiesCount: payload.identities.length,
      identities: payload.identities,
      hasXprivEncrypted: !!payload.xprivEncrypted,
      xprivEncryptedLength: payload.xprivEncrypted?.length,
      allPayloadKeys: Object.keys(payload)
    });

    // CRITICAL: Encrypt the payload with PASSWORD KEY for initial vault creation
    // This implements double encryption: PIN-encrypted xpriv → Password-encrypted VaultObj
    const payloadJson = JSON.stringify(payload);
    let encryptedContent: string;

    console.log('🔐 [createInitialVaultForNostr] Starting password encryption...');
    console.log('🔐 [createInitialVaultForNostr] Using password key for initial vault');

    try {
      // Use PASSWORD encryption for initial vault creation
      const { encrypt } = await import('nostr-tools/nip04');
      encryptedContent = await encrypt(params.passwordKey, String(pub), payloadJson);
      console.log('✅ [createInitialVaultForNostr] Payload encrypted with password key!', {
        encryptedSize: encryptedContent.length,
        identities: payload.identities.length,
      });
    } catch (encErr) {
      console.error('❌ [createInitialVaultForNostr] Password encryption failed:', encErr);
      throw new Error('Failed to encrypt initial vault data with password');
    }

    // Get the actual environment
    const env = getEnvironment();
    console.log('🌍 [createInitialVaultForNostr] Using environment:', env);

    // Build the event with password encryption
    const dTag = String(`nostrpass.com_vault_${pub}_${env}`);

    console.log('🏷️ [createInitialVaultForNostr] Event metadata:', {
      dTag,
      pubkey: pub,
      vaultPublicKey: vault.publicKey,
      keysMatch: pub === vault.publicKey,
      env,
    });

    const event = {
      kind: 30078 as number,
      content: String(encryptedContent),
      tags: [
        [String('d'), dTag],
        [String('encryption'), String('password-aes')],
      ] as string[][],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: String(pub),
      id: '',
      sig: '',
    };

    // Resolve signing key with detailed diagnostics
    const signingKey = (priv || session?.storagePrivateKey || session?.privateKey) as
      | string
      | undefined;
    console.log('🧾 [createInitialVaultForNostr] Signing key check:', {
      hasPrivLocal: !!priv,
      hasSession: !!session,
      hasSessionStoragePriv: !!(session && (session as any).storagePrivateKey),
      hasSessionPrivKey: !!(session && (session as any).privateKey),
    });
    if (!signingKey) {
      console.error('❌ [createInitialVaultForNostr] Missing signing key', {
        username: params.username,
        haveLocalPriv: !!priv,
        haveSession: !!session,
        haveSessionStoragePrivateKey: !!(session && (session as any).storagePrivateKey),
        haveSessionPrivateKey: !!(session && (session as any).privateKey),
      });
      throw new Error('No signing key available for initial vault event');
    }
    const signed = await crypto.signEvent(event, signingKey);
    event.id = signed.id;
    event.sig = signed.sig;

    console.log('✅ [createInitialVaultForNostr] Initial vault event created:', {
      eventId: event.id.slice(0, 8),
      pubkey: event.pubkey.slice(0, 16),
      encryption: 'password-aes',
      identities: payload.identities.length,
    });

    return { event };
  },

  /**
   * Build a minimal vault event for Nostr publishing (STORAGE KEY-ENCRYPTED for sync operations)
   * Used for ongoing sync - encrypted with storage key for cross-tab sync without password
   *
   * @param params - Object containing storagePublicKey (preferred) or username (legacy)
   * @returns Object with signed event
   */
  saveVaultToNostr: async (params: { storagePublicKey?: string; username?: string }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();

    // Determine lookup key - prefer storagePublicKey
    const lookupKey = params.storagePublicKey || params.username;
    if (!lookupKey) {
      throw new Error('No storagePublicKey or username provided');
    }

    const vaultRaw = await vaultDB.getVault(lookupKey);
    if (!vaultRaw) throw new Error('No vault to save');

    // Map from IndexedDB field names to VaultData interface field names
    const vault = {
      ...vaultRaw,
      xprivEncrypted: (vaultRaw as any).encryptedVault || (vaultRaw as any).xprivEncrypted,
    };

    console.log('📤 [saveVaultToNostr] Preparing vault for Nostr sync:', {
      storagePublicKey: lookupKey.slice(0, 12) + '...',
      username: vault.username,
      identitiesCount: vault.identities?.length || 0,
      hasXprivEncrypted: !!vault.xprivEncrypted,
      hasEncryptedVaultInDB: !!(vaultRaw as any).encryptedVault,
      updatedAt: new Date(vault.updatedAt || Date.now()).toISOString(),
    });

    // Use SessionStateManager to get session (atomic auth uses this)
    const manager = getSessionStateManager();
    // Sessions are keyed by username (or Google UID), so try:
    // 1. lookupKey directly, 2. vault.username, 3. active sessions scan by storagePublicKey.
    let session = manager.getAuthState(lookupKey);
    console.log('🔍 [saveVaultToNostr] Session lookup by lookupKey:', lookupKey?.slice(0, 12) + '...', 'found:', !!session);

    if (!session && vault.username && vault.username !== lookupKey) {
      console.log('🔍 [saveVaultToNostr] Session not found by storagePublicKey, trying username:', vault.username);
      session = manager.getAuthState(vault.username);
      console.log('🔍 [saveVaultToNostr] Session lookup by username:', vault.username, 'found:', !!session);
    }

    if (!session) {
      console.log('🔍 [saveVaultToNostr] Searching active sessions for matching storagePublicKey...');
      for (const activeUsername of manager.getActiveSessions()) {
        const candidate = manager.getAuthState(activeUsername);
        if (candidate?.storagePublicKey === lookupKey || candidate?.storagePublicKey === vault.storagePublicKey) {
          session = candidate;
          console.log('🔍 [saveVaultToNostr] Found session by storagePublicKey match');
          break;
        }
      }
    }

    const sensitiveKeys = session ? manager.getSensitiveKeys(session.username) : {};

    if (session) {
      console.log('🔍 [saveVaultToNostr] Session state:', {
        isUnlocked: session.isUnlocked,
        hasStoragePrivateKey: !!sensitiveKeys.storagePrivateKey,
        hasXpriv: !!sensitiveKeys.xpriv,
      });
    }

    // CRITICAL: Always use the vault's storage public key
    // During account creation, storage keypair is derived at m/44'/1237'/0'/0/8907 (STORAGE_INDEX)
    const pub = vault.storagePublicKey || vault.publicKey; // Prefer storagePublicKey if available
    let priv = sensitiveKeys.storagePrivateKey;

    // If we don't have the storage private key in session, derive it from xpriv
    if (!priv && sensitiveKeys.xpriv) {
      console.log('🔑 [saveVaultToNostr] Deriving storage keypair from xpriv with STORAGE_INDEX...');
      // IMPORTANT: Use deriveKeypairFromXpriv with STORAGE_INDEX (8907), NOT deriveStorageKeypairFromXpriv!
      // deriveStorageKeypairFromXpriv uses m/44'/1237'/1'/0/0 (wrong path)
      // Account creation uses m/44'/1237'/0'/0/8907 (correct path)
      const derived = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv: sensitiveKeys.xpriv,
        index: STORAGE_INDEX,
      });
      priv = derived.privateKey;
      const derivedPub = derived.publicKey;

      // Verify it matches vault.storagePublicKey
      if (derivedPub !== pub) {
        console.error('❌ [saveVaultToNostr] Storage key mismatch!', {
          derivedPub,
          vaultStoragePublicKey: pub,
          usedStorageIndex: STORAGE_INDEX,
        });
        throw new Error('Storage keypair derivation mismatch');
      }
      console.log('✅ [saveVaultToNostr] Storage keypair derived and verified with STORAGE_INDEX');
    }

    if (!priv) {
      console.error('❌ [saveVaultToNostr] No storage private key available!', {
        sessionFound: !!session,
        sessionUsername: session?.username,
        sessionIsUnlocked: session?.isUnlocked,
        sessionHasXpriv: !!sensitiveKeys.xpriv,
        lookupKey: lookupKey?.slice(0, 12) + '...',
        vaultUsername: vault.username
      });
      throw new Error('No storage private key available for signing vault event');
    }

    // Basic hex sanity checks for pub and priv
    const isHex = (s: string) =>
      typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
    if (!isHex(String(pub))) {
      throw new Error('Invalid pubkey format for Nostr event');
    }
    if (!isHex(String(priv))) {
      throw new Error('Invalid private key format for signing');
    }

    const payload = {
      username: vault.username,
      publicKey: vault.publicKey,
      xprivEncrypted: vault.xprivEncrypted, // Already mapped from encryptedVault above
      salt: vault.salt,
      passwordVerifier: (vault as any).passwordVerifier, // CRITICAL: Include for password verification
      passwordSalt: (vault as any).passwordSalt, // CRITICAL: Include for password verification
      recovery: (vault as any).recovery, // Include recovery data
      identities: vault.identities || [],
      // activeIdentityByApp removed - now stored in localStorage per-browser
      appPermissions: (vault as any).appPermissions || {},
      linkedAuthProviders: (vault as any).linkedAuthProviders || [], // Include linked auth providers (e.g., Google accounts)
      updatedAt: Date.now(),
      version: 1,
    };

    console.log('✅ [saveVaultToNostr] Payload created:', {
      identitiesCount: payload.identities.length,
      hasXprivEncrypted: !!payload.xprivEncrypted,
      xprivEncryptedLength: payload.xprivEncrypted?.length,
      linkedAuthProvidersCount: payload.linkedAuthProviders.length,
    });

    // CRITICAL: Encrypt the payload with STORAGE PRIVATE KEY (NIP-04)
    // Architecture: LoginObj (password-encrypted) contains PIN-encrypted storage keypair
    // This allows vault access with PIN only (no password needed after login)
    const payloadJson = JSON.stringify(payload);
    let encryptedContent: string;

    console.log('🔐 [WORKER saveVaultToNostr] Starting NIP-04 encryption with STORAGE key...');
    console.log('🔐 [WORKER saveVaultToNostr] Using storage private key from session');

    try {
      // Use NIP-04 encryption with STORAGE key
      const { encrypt } = await import('nostr-tools/nip04');
      encryptedContent = await encrypt(priv, String(pub), payloadJson);
      console.log('✅ [WORKER saveVaultToNostr] Payload encrypted with STORAGE key!', {
        encryptedSize: encryptedContent.length,
        identities: payload.identities.length,
      });
    } catch (encErr) {
      console.error('❌ [WORKER saveVaultToNostr] Storage key encryption failed:', encErr);
      throw new Error('Failed to encrypt vault data with storage key');
    }

    // Get the actual environment (don't hardcode!)
    const env = getEnvironment();
    console.log('🌍 [WORKER saveVaultToNostr] Using environment:', env);

    // Build the event with strict string coercion for wasm expectations
    const dTag = String(`nostrpass.com_vault_${pub}_${env}`);

    console.log('🏷️ [WORKER saveVaultToNostr] Event metadata:', {
      dTag,
      pubkey: pub,
      vaultPublicKey: vault.publicKey,
      keysMatch: pub === vault.publicKey,
      env,
    });

    console.log('📤 [saveVaultToNostr] Publishing with d-tag:', dTag);
    console.log('📤 [saveVaultToNostr] Author pubkey:', pub);
    console.log('📤 [saveVaultToNostr] Environment:', env);

    const event = {
      kind: 30078 as number, // NIP-78 arbitrary custom app data (replaceable) - MUST match getVaultFromNostr
      content: String(encryptedContent), // Use NIP-04 encrypted content
      tags: [
        [String('d'), dTag],
        [String('encryption'), String('nip04')],
      ] as string[][], // Mark as NIP-04 encrypted
      created_at: Math.floor(Date.now() / 1000),
      pubkey: String(pub),
      id: '',
      sig: '',
    };

    // Calculate event ID
    const eventId = await crypto.calculateEventId({
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
    });
    event.id = eventId;

    // Sign the event - signEvent returns the full signed event object
    const signedEvent = crypto.signEvent(event, String(priv));

    // Handle if signedEvent is a Map (from serde_wasm_bindgen)
    if (signedEvent instanceof Map) {
      const eventObj = {
        id: signedEvent.get('id') || event.id,
        kind: signedEvent.get('kind') || event.kind,
        content: signedEvent.get('content') || event.content,
        tags: signedEvent.get('tags') || event.tags,
        created_at: signedEvent.get('created_at') || event.created_at,
        pubkey: signedEvent.get('pubkey') || event.pubkey,
        sig: signedEvent.get('sig') || '',
      };

      // Publish to relays
      console.log('📡 [saveVaultToNostr] Publishing vault event to relays...');
      const relays = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.primal.net',
        'wss://relay.nostr.band',
        'ws://localhost:8080',
      ];
      const pool = new SimplePool();
      await Promise.all(pool.publish(relays, eventObj));
      pool.close(relays);
      console.log('✅ [saveVaultToNostr] Vault event published to relays successfully');

      return { event: eventObj };
    }

    // If the WASM returned a plain object, ensure required fields exist
    const normalized = {
      id: (signedEvent as any).id,
      pubkey: (signedEvent as any).pubkey || String(pub),
      created_at: (signedEvent as any).created_at || event.created_at,
      kind: (signedEvent as any).kind || event.kind,
      tags: (signedEvent as any).tags || event.tags,
      content: (signedEvent as any).content || event.content,
      sig: (signedEvent as any).sig,
    };

    // Publish to relays
    console.log('📡 [saveVaultToNostr] Publishing vault event to relays...');
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, normalized));
    pool.close(relays);
    console.log('✅ [saveVaultToNostr] Vault event published to relays successfully');

    return { event: normalized };
  },

  /**
   * Get vault data from Nostr relays
   * Queries relays for the latest vault event and returns decrypted data
   *
   * @param params - Object containing username
   * @returns Object with vaultData, eventId, and timestamp, or null if not found
   */
  getVaultFromNostr: async (params: {
    username: string;
  }): Promise<{ vaultData: any; eventId: string; timestamp: number } | null> => {
    await ensureCryptoReady();

    // This method delegates to the nostrHelpers package
    // Import dynamically to avoid circular dependencies
    const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');

    // Get vault data from IndexedDB to find storage public key
    const localVault = await vaultDB.getVault(params.username);
    if (!localVault) {
      throw new Error('Local vault not found - cannot determine storage public key');
    }

    const storagePublicKey = localVault.publicKey;

    // Get relays from environment or use defaults
    const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'ws://localhost:8080'];

    // Query Nostr for vault data
    const vaultData = await getVaultFromNostr(storagePublicKey, relays);

    if (!vaultData) {
      return null;
    }

    return {
      vaultData,
      eventId: '', // Event ID would need to be returned from getVaultFromNostr
      timestamp: vaultData.updatedAt || Date.now(),
    };
  },

  /**
   * Get vault version history from Nostr relays
   * Returns the last N vault events with metadata
   *
   * @param params - Object containing username and optional limit (default 5)
   * @returns Array of vault versions with metadata
   */
  getVaultVersionHistory: async (params: {
    username: string;
    limit?: number;
  }): Promise<Array<{
    eventId: string;
    timestamp: number;
    version: number;
    identitiesCount: number;
    updatedAt: number;
    vaultData: any; // Full decrypted VaultData JSON
  }>> => {
    await ensureCryptoReady();
    const { username, limit = 5 } = params;

    // Get session for decryption
    const sessionManager = getSessionStateManager();
    const session = sessionManager.getAuthState(username);
    const sessionKeys = session ? sessionManager.getSensitiveKeys(username) : {};
    if (!sessionKeys.storagePrivateKey) {
      throw new Error('Storage key not available. Unlock required.');
    }

    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');

    const pubkey = vault.storagePublicKey || vault.publicKey;
    const storagePriv = sessionKeys.storagePrivateKey;
    const storagePub = session?.storagePublicKey || pubkey;
    const env = getEnvironment();

    // Query for vault events
    const pool = new SimplePool();
    const dTag = `nostrpass.com_vault_${pubkey}_${env}`;
    const filter: Filter = {
      kinds: [30078],
      authors: [pubkey],
      '#d': [dTag],
      limit: limit
    };

    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];

    console.log('📜 [getVaultVersionHistory] Querying relays for vault history...', {
      filter,
      relays: relays.length,
      pubkey: pubkey.substring(0, 16),
      dTag: dTag.substring(0, 50)
    });
    const events = await pool.querySync(relays, filter);
    pool.close(relays);

    console.log('📜 [getVaultVersionHistory] Query returned:', {
      eventsCount: events?.length || 0,
      events: events?.map(e => ({
        id: e.id.substring(0, 12),
        created_at: e.created_at,
        kind: e.kind
      }))
    });

    if (!events || events.length === 0) {
      console.log('📜 [getVaultVersionHistory] No vault versions found');
      return [];
    }

    // Sort newest first
    events.sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0));

    // Decrypt and extract metadata from each version
    const versions = [];
    for (const ev of events.slice(0, limit)) {
      try {
        const plaintext = await nip04DecryptJS(storagePriv, storagePub, ev.content);
        const vaultData = JSON.parse(plaintext);

        versions.push({
          eventId: ev.id,
          timestamp: ev.created_at * 1000, // Convert to milliseconds
          version: vaultData.version || 0,
          identitiesCount: vaultData.identities?.length || 0,
          updatedAt: vaultData.updatedAt || (ev.created_at * 1000),
          vaultData: vaultData, // Include full decrypted JSON
        });
      } catch (err) {
        console.warn('⚠️ [getVaultVersionHistory] Failed to decrypt vault event:', ev.id, err);
      }
    }

    console.log(`📜 [getVaultVersionHistory] Found ${versions.length} vault versions`);
    return versions;
  },

  /**
   * Start real-time subscription to vault version updates
   * Broadcasts new versions via BroadcastChannel to UI
   *
   * @param params - Object containing username and optional relays
   */
  startVaultVersionSubscription: async (params: {
    username: string;
    relays?: string[];
  }): Promise<{ started: boolean }> => {
    await ensureCryptoReady();
    const { username } = params;

    // Check if already subscribed
    if (vaultVersionSubscriptions.has(username)) {
      console.log('📡 [startVaultVersionSubscription] Already subscribed for:', username);
      return { started: true };
    }

    // Get session for decryption
    const sessionManager = getSessionStateManager();
    const session = sessionManager.getAuthState(username);
    const sessionKeys = session ? sessionManager.getSensitiveKeys(username) : {};
    if (!sessionKeys.storagePrivateKey) {
      throw new Error('Storage key not available. Unlock required.');
    }

    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');

    const pubkey = vault.storagePublicKey || vault.publicKey;
    const storagePriv = sessionKeys.storagePrivateKey;
    const storagePub = session?.storagePublicKey || pubkey;
    const env = getEnvironment();

    const relays = params.relays || [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];

    const pool = new SimplePool();
    const dTag = `nostrpass.com_vault_${pubkey}_${env}`;
    const filter: Filter = {
      kinds: [30078],
      authors: [pubkey],
      '#d': [dTag],
    };

    console.log('📡 [startVaultVersionSubscription] Starting subscription...', {
      username,
      pubkey: pubkey.substring(0, 16),
      dTag: dTag.substring(0, 50),
      relays: relays.length
    });

    const broadcast = getVersionBroadcast();

    // subscribeMany takes a single filter object, not an array
    const sub = pool.subscribeMany(relays, filter, {
      onevent: async (ev: any) => {
        try {
          console.log('📡 [startVaultVersionSubscription] New vault event:', ev.id.substring(0, 12));
          const plaintext = await nip04DecryptJS(storagePriv, storagePub, ev.content);
          const vaultData = JSON.parse(plaintext);

          const versionUpdate = {
            username,
            eventId: ev.id,
            timestamp: ev.created_at * 1000,
            version: vaultData.version || 0,
            identitiesCount: vaultData.identities?.length || 0,
            updatedAt: vaultData.updatedAt || (ev.created_at * 1000),
            vaultData: vaultData,
          };

          // Broadcast to UI
          broadcast.postMessage({
            type: 'NEW_VAULT_VERSION',
            data: versionUpdate
          });

          console.log('📡 [startVaultVersionSubscription] Broadcasted version:', vaultData.version);
        } catch (err) {
          console.warn('⚠️ [startVaultVersionSubscription] Failed to decrypt event:', ev.id, err);
        }
      },
      oneose: () => {
        console.log('📡 [startVaultVersionSubscription] Initial sync complete');
      },
    });

    vaultVersionSubscriptions.set(username, { pool, relays, sub });
    console.log('✅ [startVaultVersionSubscription] Subscription active for:', username);

    return { started: true };
  },

  /**
   * Stop vault version subscription for a user
   */
  stopVaultVersionSubscription: async (params: {
    username: string;
  }): Promise<{ stopped: boolean }> => {
    const { username } = params;
    const subscription = vaultVersionSubscriptions.get(username);

    if (!subscription) {
      return { stopped: false };
    }

    console.log('📡 [stopVaultVersionSubscription] Stopping subscription for:', username);
    subscription.sub.close();
    subscription.pool.close(subscription.relays);
    vaultVersionSubscriptions.delete(username);

    return { stopped: true };
  },
};
