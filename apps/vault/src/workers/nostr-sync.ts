/**
 * Nostr Synchronization Module
 *
 * This module handles all Nostr relay interactions for the vault system.
 * It provides:
 * - Publishing vault data to Nostr relays (encrypted with storage or password keys)
 * - Fetching vault data from Nostr relays
 * - Real-time subscriptions to vault updates
 * - Publishing and fetching identity metadata (Privacy-Respecting Encoding - PRE)
 * - Publishing and fetching app permissions (PRE)
 * - Assembling current state from PRE event streams
 *
 * Architecture:
 * - All vault events are encrypted using NIP-04
 * - Initial vault creation uses password-based encryption
 * - Subsequent sync operations use storage key encryption
 * - PRE events (identity metadata, permissions) use storage key signing/encryption
 * - Real-time subscriptions with polling fallback for reliability
 * - Version-based conflict resolution for concurrent updates
 *
 * Privacy-Respecting Encoding (PRE):
 * - Identity metadata is encrypted and published as separate events
 * - App permissions are encrypted and published as separate events
 * - All PRE events are signed by the deterministic storage keypair
 * - Opaque identifiers prevent correlation across apps
 */

import { SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';
import { vaultDB, type VaultData } from './db';
import { getEnvironment } from '@nostrpass/nostrHelpers';
import { STORAGE_INDEX } from '@nostrpass/types';
import {
  buildEnvelope,
  verifyEnvelope,
  identityStreamId,
  permStreamId,
  deriveIdentityId,
  deriveAppId,
} from './pre.helpers';
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
        const local = await vaultDB.getVault(username);

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
          console.log('📥 [Worker] Applying newer vault from Nostr (poll):', {
            remoteTimestamp,
            localTimestamp,
            remoteIdentities: remote.identities?.length,
            localIdentities: local?.identities?.length,
          });
          await vaultOperations.updateVaultData({
            username,
            vaultData: remote,
            skipVersionIncrement: true,
          });
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
   * Publish identity metadata as a PRE event
   * Encrypted with storage key and signed by storage keypair
   *
   * @param params - Object containing username, nickname, and path
   * @returns Object with event ID
   */
  publishIdentityMeta: async (params: {
    username: string;
    nickname: string;
    path: string;
  }): Promise<{ eventId: string }> => {
    await ensureCryptoReady();
    const { username, nickname, path } = params;
    const sessionManager = getSessionStateManager();
    const session = sessionManager.getSession(username);
    if (!session?.storagePrivateKey) throw new Error('Storage key not available');

    const storagePriv = session.storagePrivateKey;
    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');
    const storagePublicKey = (vault as any).storagePublicKey || (vault as any).publicKey;
    const env = getEnvironment();

    // Build envelope
    const data = { identityId: `npid:${path}`, nickname, path };
    const envelope = buildEnvelope({ data });
    const payloadJson = JSON.stringify(envelope);

    // Encrypt via NIP-04 with storage key (so only user can decrypt)
    const encryptedContent = await nip04EncryptJS(storagePriv, storagePublicKey, payloadJson);

    // Build PRE event SIGNED BY STORAGE KEY (deterministic, so all instances can query by same author)
    const dTag = `np/identity/${identityStreamId(storagePriv, data.identityId)}`;
    const event = {
      kind: 30078 as number,
      pubkey: storagePublicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', dTag]],
      content: encryptedContent,
      id: '',
      sig: '',
    };

    const crypto = await ensureCryptoReady();
    const signed = crypto.signEvent(event, storagePriv);

    // Publish
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, signed));
    pool.close(relays);
    return { eventId: signed.id };
  },

  /**
   * Publish permissions for identity+app as PRE event
   * Encrypted with storage key and signed by storage keypair
   *
   * @param params - Object containing username, path, appDomain, and permissions
   * @returns Object with event ID
   */
  publishPermissions: async (params: {
    username: string;
    path: string;
    appDomain: string;
    permissions: any;
  }): Promise<{ eventId: string }> => {
    await ensureCryptoReady();
    const { username, path, appDomain, permissions } = params;
    const sessionManager = getSessionStateManager();
    const session = sessionManager.getSession(username);
    if (!session?.storagePrivateKey) throw new Error('Storage key not available');
    const storagePriv = session.storagePrivateKey;
    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');
    const storagePublicKey = (vault as any).storagePublicKey || (vault as any).publicKey;

    // Derive opaque IDs
    const identityId = deriveIdentityId(storagePriv, path);
    const appId = deriveAppId(storagePriv, appDomain);
    const streamId = permStreamId(storagePriv, identityId, appId);

    // Build envelope
    const data = { identityId, appId, permissions };
    const envelope = buildEnvelope({ data });
    const payloadJson = JSON.stringify(envelope);

    // Encrypt and publish
    const encryptedContent = await nip04EncryptJS(storagePriv, storagePublicKey, payloadJson);
    const dTag = `np/perm/${streamId}`;
    const event = {
      kind: 30078 as number,
      pubkey: storagePublicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', dTag]],
      content: encryptedContent,
      id: '',
      sig: '',
    };
    const crypto = await ensureCryptoReady();
    const signed = crypto.signEvent(event, storagePriv);
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080',
    ];
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, signed));
    pool.close(relays);
    return { eventId: signed.id };
  },

  /**
   * Assemble current state from PRE streams
   * Fetches all PRE events authored by storage pubkey and reconstructs state
   *
   * @param params - Object containing username and relays
   * @returns Object with identities array and permissions map
   */
  assembleStateFromAuthor: async (params: {
    username: string;
    relays: string[];
  }): Promise<{ identities: any[]; perms: Record<string, string[]> }> => {
    await ensureCryptoReady();
    const { username, relays } = params;
    console.log('🔍 [assembleStateFromAuthor] Starting for username:', username);

    const session = activeSessions.get(username);
    console.log('🔍 [assembleStateFromAuthor] Session found:', !!session);
    console.log('🔍 [assembleStateFromAuthor] Has storagePrivateKey:', !!session?.storagePrivateKey);

    if (!session?.storagePrivateKey) throw new Error('Storage key not available');

    const storagePriv = session.storagePrivateKey;
    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');
    const storagePublicKey = (vault as any).storagePublicKey || (vault as any).publicKey;
    console.log('🔍 [assembleStateFromAuthor] Storage public key:', storagePublicKey);

    // All PRE events are signed by storage key (deterministic from xpriv)
    const pool = new SimplePool();
    const filter: Filter = { kinds: [30078], authors: [storagePublicKey], limit: 500 };
    console.log('🔍 [assembleStateFromAuthor] Querying relays with filter:', filter);
    const events = await pool.querySync(relays, filter);
    console.log('🔍 [assembleStateFromAuthor] Found events:', events.length);
    pool.close(relays);

    // Group latest by d-tag
    const latestByD = new Map<string, any>();
    for (const ev of events) {
      const d = ev.tags.find((t) => t[0] === 'd')?.[1] || '';
      if (!d) continue;
      const cur = latestByD.get(d);
      if (!cur || ev.created_at > cur.created_at) latestByD.set(d, ev);
    }

    const identities: any[] = [];
    const perms: Record<string, string[]> = {};

    for (const [d, ev] of latestByD.entries()) {
      try {
        const plaintext = await nip04DecryptJS(
          storagePriv as string,
          storagePublicKey as string,
          ev.content
        );
        const env = JSON.parse(plaintext);
        if (!verifyEnvelope(env)) continue;
        if (d.startsWith('np/identity/')) {
          const { identityId, nickname, path } = env.data || {};
          identities.push({ identityId, nickname, path });
        } else if (d.startsWith('np/perm/')) {
          const { identityId, appId, appPermissions } = env.data || {};
          const key = `${identityId}:${appId}`;
          perms[key] = Array.isArray(appPermissions) ? appPermissions : [];
        }
      } catch {}
    }

    return { identities, perms };
  },

  /**
   * Start realtime Nostr subscription for a user's vault
   * Subscribes to PRE events and full vault events
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
    const session = sessionManager.getSession(username);

    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');

    // CRITICAL: Use storagePublicKey for vault events (not personal identity publicKey)
    const pubkey = vault.storagePublicKey || vault.publicKey;
    const env = getEnvironment();

    // Require unlocked storage key for decryption
    const storagePriv = session?.storagePrivateKey;
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

      // Define event handler first
      const onEvent = async (ev: NostrEvent) => {
        try {
          const d = ev.tags.find((t) => t[0] === 'd')?.[1] || '';
          console.log('📨 [Worker] Received Nostr event:', {
            kind: ev.kind,
            d: d ? d.slice(0, 50) : '(no d-tag)',
            created_at: new Date(ev.created_at * 1000).toISOString(),
            eventId: ev.id.slice(0, 12)
          });

          if (!d) {
            console.warn('⚠️ [Worker] Event missing d-tag, ignoring');
            return;
          }

          // Identity PRE stream
          if (d.startsWith('np/identity/')) {
            console.log('📥 [Worker] Received identity PRE event:', {
              d: d.slice(0, 30),
              eventId: ev.id.slice(0, 8),
            });
            try {
              const plaintext = await nip04DecryptJS(
                storagePriv as string,
                storagePub as string,
                ev.content
              );
              const env = JSON.parse(plaintext);
              if (!verifyEnvelope(env)) {
                console.warn('⚠️ [Worker] Identity envelope verification failed');
                return;
              }
              const { identityId, nickname, path } = env.data || {};
              if (!path) {
                console.warn('⚠️ [Worker] Identity event missing path');
                return;
              }
              const local = await vaultDB.getVault(username);
              const identities = [...(local?.identities || [])];
              const existingIdx = identities.findIndex((i: any) => i?.path === path);
              if (existingIdx >= 0) {
                // Update nickname if changed
                if (nickname && identities[existingIdx]?.nickname !== nickname) {
                  console.log('📝 [Worker] Updating identity nickname:', {
                    path,
                    oldNickname: identities[existingIdx].nickname,
                    newNickname: nickname,
                  });
                  identities[existingIdx] = { ...identities[existingIdx], nickname };
                  await vaultOperations.updateVaultData({
                    username,
                    vaultData: { ...local, identities },
                    skipVersionIncrement: true,
                  });
                  console.log('✅ [Worker] Identity updated');
                } else {
                  console.log('ℹ️ [Worker] Identity already exists with same nickname, skipping');
                }
              } else {
                console.log('📝 [Worker] Adding new identity:', { nickname, path });
                identities.push({
                  nickname,
                  path,
                  index: identities.length,
                  createdAt: Date.now(),
                });
                await vaultOperations.updateVaultData({
                  username,
                  vaultData: { ...local, identities },
                  skipVersionIncrement: true,
                });
                console.log('✅ [Worker] New identity added');
              }
            } catch (e) {
              console.error('❌ [Worker] Failed to process identity PRE event:', e);
            }
            return;
          }

          // Legacy/full-vault stream (initial snapshot or older clients)
          if (d.startsWith(`nostrpass.com_vault_`)) {
            console.log('📥 [Worker] Received full VaultObj event:', {
              d: d.slice(0, 40),
              eventId: ev.id.slice(0, 12),
            });

            let remote: VaultData | null = null;
            try {
              const plaintext = await nip04DecryptJS(
                storagePriv as string,
                storagePub as string,
                ev.content
              );
              remote = JSON.parse(plaintext) as VaultData;
              console.log('✅ [Worker] Decrypted VaultObj successfully');
            } catch (decryptErr) {
              console.error('❌ [Worker] Failed to decrypt VaultObj:', decryptErr);
              remote = null;
            }

            if (!remote) return;

            const local = await vaultDB.getVault(username);

            // Use timestamp-based comparison like DMs (simpler and more reliable)
            const remoteTimestamp = ev.created_at || 0; // Nostr event timestamp
            const localTimestamp = (local as any)?.updatedAt ? Math.floor((local as any).updatedAt / 1000) : 0; // Convert ms to seconds

            console.log('📊 [Worker] VaultObj timestamp comparison:', {
              remoteTimestamp,
              localTimestamp,
              remoteDate: new Date(remoteTimestamp * 1000).toISOString(),
              localDate: local?.updatedAt ? new Date(local.updatedAt).toISOString() : 'never',
              remoteIdentities: remote.identities?.length || 0,
              localIdentities: local?.identities?.length || 0,
              willUpdate: remoteTimestamp > localTimestamp
            });

            if (remoteTimestamp > localTimestamp) {
              console.log('📥 [Worker] Applying newer vault from Nostr (realtime):', {
                remoteTimestamp,
                localTimestamp,
                remoteIdentities: remote.identities?.length || 0,
                localIdentities: local?.identities?.length || 0,
              });
              await vaultOperations.updateVaultData({
                username,
                vaultData: remote,
                skipVersionIncrement: true,
              });
              console.log('✅ [Worker] Vault updated successfully from realtime event');
            } else {
              console.log('ℹ️ [Worker] Remote timestamp not newer, skipping update');
            }
          }
        } catch (e) {
          console.warn('⚠️ [Worker] Failed to process realtime event:', e);
        }
      };

      // Create subscription with callbacks (nostr-tools v2 API)
      // Use subscribeMany with async iterator approach for better compatibility
      console.log('📡 [Worker] Creating subscription with callback-based API');
      console.log('📡 [Worker] Relays:', relays);
      console.log('📡 [Worker] Filter:', filter);

      // Try the iterator-based approach which is more reliable in nostr-tools v2
      const sub = pool.subscribeMany(relays, [filter], {
        onevent(event: NostrEvent) {
          console.log('🔔 [Worker] onevent callback FIRED!', {
            kind: event.kind,
            id: event.id.slice(0, 12),
            created_at: new Date(event.created_at * 1000).toISOString()
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

      // Optional: Slow polling as backup (every 60 seconds)
      // Realtime subscription should handle most updates now
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
      xprivEncryptedPreview: vault.xprivEncrypted?.substring(0, 50),
      salt: vault.salt,
      saltLength: vault.salt?.length,
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
      activeIdentityByApp: vault.activeIdentityByApp || {},
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
      xprivEncryptedPreview: payload.xprivEncrypted?.substring(0, 50),
      salt: payload.salt,
      saltLength: payload.salt?.length,
      passwordSalt: payload.passwordSalt,
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
   * @param params - Object containing username
   * @returns Object with signed event
   */
  saveVaultToNostr: async (params: { username: string }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();
    const vaultRaw = await vaultDB.getVault(params.username);
    if (!vaultRaw) throw new Error('No vault to save');

    // Map from IndexedDB field names to VaultData interface field names
    const vault = {
      ...vaultRaw,
      xprivEncrypted: (vaultRaw as any).encryptedVault || (vaultRaw as any).xprivEncrypted,
    };

    console.log('📤 [saveVaultToNostr] Preparing vault for Nostr sync:', {
      username: vault.username,
      identitiesCount: vault.identities?.length || 0,
      hasXprivEncrypted: !!vault.xprivEncrypted,
      hasEncryptedVaultInDB: !!(vaultRaw as any).encryptedVault,
      updatedAt: new Date(vault.updatedAt || Date.now()).toISOString(),
    });

    // Use SessionStateManager to get session (atomic auth uses this)
    const manager = getSessionStateManager();
    const session = (manager as any).sessions?.get(params.username);

    // CRITICAL: Always use the vault's storage public key
    // During account creation, storage keypair is derived at m/44'/1237'/0'/0/8907 (STORAGE_INDEX)
    const pub = vault.storagePublicKey || vault.publicKey; // Prefer storagePublicKey if available
    let priv = session?.storagePrivateKey;

    // If we don't have the storage private key in session, derive it from xpriv
    if (!priv && session?.xpriv) {
      console.log('🔑 [saveVaultToNostr] Deriving storage keypair from xpriv with STORAGE_INDEX...');
      // IMPORTANT: Use deriveKeypairFromXpriv with STORAGE_INDEX (8907), NOT deriveStorageKeypairFromXpriv!
      // deriveStorageKeypairFromXpriv uses m/44'/1237'/1'/0/0 (wrong path)
      // Account creation uses m/44'/1237'/0'/0/8907 (correct path)
      const derived = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv: session.xpriv,
        index: STORAGE_INDEX,
      });
      priv = derived.privateKey;
      const derivedPub = derived.publicKey;

      // Cache in session for next time
      (session as any).storagePrivateKey = priv;
      (session as any).storagePublicKey = derivedPub;

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
      activeIdentityByApp: vault.activeIdentityByApp || {},
      appPermissions: (vault as any).appPermissions || {},
      updatedAt: Date.now(),
      version: 1,
    };

    console.log('✅ [saveVaultToNostr] Payload created:', {
      identitiesCount: payload.identities.length,
      hasXprivEncrypted: !!payload.xprivEncrypted,
      xprivEncryptedLength: payload.xprivEncrypted?.length,
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
};
