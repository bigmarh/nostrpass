import { NostrCrypto } from './crypto.noble';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';
import { SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';
import { vaultDB, type VaultData, type UserSession } from './db';
import { getEnvironment } from '@nostrpass/nostrHelpers';
import { buildEnvelope, verifyEnvelope, identityStreamId, permStreamId, deriveIdentityId, deriveAppId } from './pre.helpers';

/**
 * Handler architecture and naming
 *
 * There are two layers of crypto operations in this worker:
 *
 * 1) Primitive crypto functions (stateless) that require a raw key:
 *    - crypto.signEvent(event, privateKey)
 *    - crypto.signMessage(message, privateKey)
 *    - crypto.nip04Encrypt(plaintext, privateKey, recipientPubkey)
 *    - crypto.nip04Decrypt(ciphertext, privateKey, senderPubkey)
 *
 * 2) Session-aware handlers (stateful) that never expose raw keys and derive
 *    the correct key from the in-memory session by username + identityIndex:
 *    - signEventWithSession({ username, event, identityIndex })
 *    - signMessageWithSession({ username, message, identityIndex })
 *    - encryptWithSession({ username, plaintext, recipientPubkey, identityIndex })
 *    - decryptWithSession({ username, ciphertext, senderPubkey, identityIndex })
 *
 * The "WithSession" suffix disambiguates these safe, session-backed handlers
 * from the raw-key primitives. External calls (Embassy/Vault APIs) must use
 * the session-aware handlers. The primitives are only used internally when
 * we already hold the key material.
 */

// Initialize crypto module (Noble libraries)
let cryptoReady = false;
let cryptoInstance: NostrCrypto | null = null;

// Worker initialization timestamp
const workerInitTime = Date.now();

// Extended session type for recovery
interface ExtendedSession extends UserSession {
  recoveryQuestions?: string[];
  answers?: string[];
  xpriv?: string;
  // Cache storage keypair derived from xpriv to allow publishing without re-supplying xpriv
  storagePrivateKey?: string;
  storagePublicKey?: string;
  // Cache password key for vault encryption operations
  passwordKey?: string;
}

// In-memory session storage (sensitive data)
const activeSessions = new Map<string, ExtendedSession>();

// Track active Nostr subscriptions per username
const nostrSubscriptions = new Map<string, { pool: SimplePool; relays: string[]; unsub: (() => void) | null }>();
const nostrPollers = new Map<string, number>();

async function pollOnceAndApply(params: { username: string; relays: string[]; pubkey: string; storagePriv: string; storagePub: string; env: string }) {
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
            version: (remote as any).version
          });
        } catch {
          // Fallback to plain JSON parse for legacy unencrypted events (should not exist anymore)
          try { remote = JSON.parse(ev.content) as VaultData; } catch { remote = null; }
        }
        if (!remote) continue;
        const local = await vaultDB.getVault(username);
        const remoteVersion = (remote as any).version || 0;
        const localVersion = (local as any)?.version || 0;
        if (remoteVersion > localVersion) {
          console.log('📥 [Worker] Applying newer vault from Nostr (poll):', { remoteVersion, localVersion, remoteIdentities: remote.identities?.length });
          await handlers.updateVaultData({ username, vaultData: remote, skipVersionIncrement: true });
          break;
        }
      } catch {}
    }
  } catch (e) {
    console.warn('⚠️ [Worker] Poll once failed:', e);
  }
}

// Debug helper to log session changes
function logSessionState(action: string, username: string) {
  // Also log to a global for debugging
  (globalThis as any).__DEBUG_SESSIONS = {
    count: activeSessions.size,
    usernames: Array.from(activeSessions.keys()),
    lastAction: action,
    lastUsername: username,
    timestamp: new Date().toISOString()
  };
}

// Helper to ensure session is not already unlocked
function ensureNotLocked(username: string) {
  const session = activeSessions.get(username);
  if (session?.isUnlocked) {
    console.warn(`[Worker] Session for ${username} is already unlocked`);
    // Don't throw - just warn. Allow re-unlocking.
  }
}

// Helper to check if session is expired
function isSessionExpired(session: ExtendedSession): boolean {
  if (!session.unlockedAt) return true;
  
  // Session expires after 30 minutes of inactivity
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  const now = Date.now();
  const timeSinceUnlock = now - session.unlockedAt;
  
  return timeSinceUnlock > SESSION_TIMEOUT;
}

// PIN attempt tracking
const pinAttempts = new Map<string, { count: number; lastAttempt: number }>();

function resetPinAttempts(username: string) {
  pinAttempts.delete(username);
}

async function ensureCryptoReady() {
  if (!cryptoReady) {
    // Create Noble crypto instance (no initialization needed)
    cryptoInstance = new NostrCrypto();
    cryptoReady = true;
    
    // Initialize database
    await vaultDB.init();
    
    // Clear expired sessions on startup
    await vaultDB.clearExpiredSessions();
    
    // Restore active sessions from IndexedDB
    await restoreActiveSessions();
  }
  if (!cryptoInstance) {
    throw new Error('Crypto instance not initialized');
  }
  return cryptoInstance;
}

// Restore active sessions from IndexedDB on worker startup
async function restoreActiveSessions() {
  try {
    console.log('[Worker] Restoring active sessions from IndexedDB...');
    
    // Get all vault data from IndexedDB
    const allVaults = await vaultDB.getAllVaults();
    
    for (const vaultData of allVaults) {
      // Create a basic session entry for each vault (locked state)
      const session: ExtendedSession = {
        username: vaultData.username,
        publicKey: vaultData.publicKey,
        isUnlocked: false, // Sessions start locked after restart
        unlockedAt: Date.now()
      };
      
      activeSessions.set(vaultData.username, session);
      console.log('[Worker] Restored session for:', vaultData.username);
    }
    
    console.log('[Worker] Restored', activeSessions.size, 'sessions from IndexedDB');
  } catch (error) {
    console.error('[Worker] Failed to restore active sessions:', error);
  }
}

// Broadcast vault updates to all tabs
function broadcastVaultUpdate(username: string, type: string, data: any) {
  try {
    console.log('[Worker] Broadcasting vault update:', { type, username, data });
    
    const message = {
      type: 'VAULT_BROADCAST',
      data: {
        broadcastType: type,
        username,
        timestamp: Date.now(),
        ...data
      }
    };
    
    // Broadcast to all tabs via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('nostrpass-vault');
        bc.postMessage(message);
        // Close promptly to avoid leaks
        try { bc.close(); } catch {}
      }
    } catch (e) {
      console.warn('[Worker] BroadcastChannel unavailable:', e);
    }
    
    // Also post to the current client (for dedicated worker consumers)
    try {
      if (typeof self !== 'undefined' && (self as any).postMessage) {
        (self as any).postMessage(message);
      }
    } catch {}
  } catch (error) {
    console.error('[Worker] Failed to broadcast vault update:', error);
  }
}

// Import type definitions
import type {
  GenerateKeypairParams,
  GenerateKeypairResult,
  SignEventParams,
  SignEventResult,
  SignMessageParams,
  SignMessageResult,
  EncryptParams,
  DecryptParams,
  DeriveKeyParams,
  DeriveKeyResult,
  EncryptDataParams,
  DecryptDataParams,
  CreateVaultParams,
  CreateVaultResult,
  UnlockVaultParams,
  UnlockVaultResult,
  LockVaultParams,
  GetSessionParams,
  GetSessionResult,
  RecoverVaultParams,
  RecoverVaultResult,
  UpdateVaultRecoveryParams,
  CheckVaultExistsParams,
  CheckVaultExistsResult,
  DeleteVaultParams,
  DeleteVaultResult,
} from '@nostrpass/types';

// Define all crypto handlers
export const handlers = {
  // Publish identity meta PRE event (encrypted with storage keypair)
  publishIdentityMeta: async (params: { username: string; nickname: string; path: string }): Promise<{ eventId: string }> => {
    await ensureCryptoReady();
    const { username, nickname, path } = params;
    const session = activeSessions.get(username);
    if (!session?.storagePrivateKey) throw new Error('Storage key not available');
    const storagePriv = session.storagePrivateKey;
    const storagePub = session.storagePublicKey || vaultDB.getVault(username).then(v => v?.storagePublicKey || v?.publicKey);
    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');
    const storagePublicKey = (vault as any).storagePublicKey || (vault as any).publicKey;
    const env = getEnvironment();

    // Build envelope
    const data = { identityId: `npid:${path}`, nickname, path };
    const envelope = buildEnvelope({ data });
    const payloadJson = JSON.stringify(envelope);

    // Encrypt via NIP-04 with storage key
    const encryptedContent = await nip04EncryptJS(storagePriv, storagePublicKey, payloadJson);

    // Build PRE event
    const dTag = `np/identity/${identityStreamId(storagePriv, data.identityId)}`;
    const event = {
      kind: 30078 as number,
      pubkey: storagePublicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", dTag]],
      content: encryptedContent,
      id: '',
      sig: ''
    };

    const crypto = await ensureCryptoReady();
    const signed = crypto.signEvent(event, storagePriv);

    // Publish
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080'
    ];
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, signed));
    pool.close(relays);
    return { eventId: signed.id };
  },

  // Publish permissions for identity+app as PRE event
  publishPermissions: async (params: { username: string; path: string; appDomain: string; appPermissions: string[] }): Promise<{ eventId: string }> => {
    await ensureCryptoReady();
    const { username, path, appDomain, appPermissions } = params;
    const session = activeSessions.get(username);
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
    const data = { identityId, appId, appPermissions };
    const envelope = buildEnvelope({ data });
    const payloadJson = JSON.stringify(envelope);

    // Encrypt and publish
    const encryptedContent = await nip04EncryptJS(storagePriv, storagePublicKey, payloadJson);
    const dTag = `np/perm/${streamId}`;
    const event = {
      kind: 30078 as number,
      pubkey: storagePublicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", dTag]],
      content: encryptedContent,
      id: '',
      sig: ''
    };
    const crypto = await ensureCryptoReady();
    const signed = crypto.signEvent(event, storagePriv);
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
      'ws://localhost:8080'
    ];
    const pool = new SimplePool();
    await Promise.all(pool.publish(relays, signed));
    pool.close(relays);
    return { eventId: signed.id };
  },

  // Assemble current state from PRE streams (author-only fetch)
  assembleStateFromAuthor: async (params: { username: string; relays: string[] }): Promise<{ identities: any[]; perms: Record<string, string[]> }> => {
    await ensureCryptoReady();
    const { username, relays } = params;
    const session = activeSessions.get(username);
    if (!session?.storagePrivateKey) throw new Error('Storage key not available');
    const storagePriv = session.storagePrivateKey;
    const vault = await vaultDB.getVault(username);
    if (!vault) throw new Error('Vault not found');
    const storagePublicKey = (vault as any).storagePublicKey || (vault as any).publicKey;

    const pool = new SimplePool();
    const filter: Filter = { kinds: [30078], authors: [storagePublicKey], limit: 500 };
    const events = await pool.querySync(relays, filter);
    pool.close(relays);

    // Group latest by d-tag
    const latestByD = new Map<string, any>();
    for (const ev of events) {
      const d = (ev.tags.find(t => t[0] === 'd')?.[1]) || '';
      if (!d) continue;
      const cur = latestByD.get(d);
      if (!cur || ev.created_at > cur.created_at) latestByD.set(d, ev);
    }

    const identities: any[] = [];
    const perms: Record<string, string[]> = {};

    for (const [d, ev] of latestByD.entries()) {
      try {
        const plaintext = await nip04DecryptJS(storagePriv as string, storagePublicKey as string, ev.content);
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
  // Start realtime Nostr subscription for a user's vault
  startNostrSubscription: async (params: { username: string; relays: string[] }): Promise<{ started: boolean }> => {
    await ensureCryptoReady();
    const { username, relays } = params;
    const session = activeSessions.get(username);
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
      try { existing.unsub?.(); } catch {}
      try { existing.pool.close(existing.relays); } catch {}
      nostrSubscriptions.delete(username);
    }

    // Try realtime subscription first; fall back to polling on error
    try {
      const pool = new SimplePool();
      const dTag = `nostrpass.com_vault_${pubkey}_${env}`;
      const filter: Filter = { kinds: [30078], authors: [pubkey], '#d': [dTag] };

      console.log('📡 [Worker] Subscribing to Nostr (author PRE):', { username, pubkey: pubkey.slice(0, 16), dTag, relaysCount: relays.length });

      const sub: any = (pool as any).subscribeMany
        ? (pool as any).subscribeMany(relays, [filter])
        : (pool as any).sub(relays as any, [filter]);

      const onEvent = async (ev: NostrEvent) => {
        try {
          let remote: VaultData | null = null;
          try {
            const plaintext = await nip04DecryptJS(storagePriv as string, storagePub as string, ev.content);
            remote = JSON.parse(plaintext) as VaultData;
          } catch {
            // ignore if not decryptable with storage key
            remote = null;
          }
          if (!remote) return;

          const local = await vaultDB.getVault(username);
          const remoteVersion = (remote as any).version || 0;
          const localVersion = (local as any)?.version || 0;
          if (remoteVersion > localVersion) {
            console.log('📥 [Worker] Applying newer vault from Nostr (realtime):', { remoteVersion, localVersion });
            await handlers.updateVaultData({ username, vaultData: remote, skipVersionIncrement: true });
          }
        } catch (e) {
          console.warn('⚠️ [Worker] Failed to process realtime event:', e);
        }
      };

      // Attach listeners using whichever API is available
      if (sub && typeof sub.on === 'function') {
        sub.on('event', onEvent);
        sub.on('eose', () => console.log('📡 [Worker] Nostr EOSE for', username));
        nostrSubscriptions.set(username, { pool, relays, unsub: () => { try { sub.unsub?.(); } catch {} } });
      } else if (sub && typeof sub.onEvent === 'function') {
        sub.onEvent(onEvent);
        if (typeof sub.onEnd === 'function') sub.onEnd(() => console.log('📡 [Worker] Nostr EOSE for', username));
        nostrSubscriptions.set(username, { pool, relays, unsub: () => { try { sub.close?.(); } catch {} } });
      } else {
        throw new Error('Unknown subscription interface');
      }

      // Light periodic reconcile (author query) as safety net
      const key = `${username}`;
      const reconcile = setInterval(() => {
        pollOnceAndApply({ username, relays, pubkey, storagePriv, storagePub, env });
      }, 60000) as unknown as number;
      nostrPollers.set(key, reconcile);

      console.log('✅ [Worker] Realtime subscription active');
      return { started: true };
    } catch (subErr) {
      console.warn('⚠️ [Worker] Realtime subscription failed; falling back to polling:', subErr);
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

  // Stop realtime Nostr subscription for a user
  stopNostrSubscription: async (params: { username: string }): Promise<{ stopped: boolean }> => {
    const { username } = params;
    const existing = nostrSubscriptions.get(username);
    if (existing) {
      try { existing.unsub?.(); } catch {}
      try { existing.pool.close(existing.relays); } catch {}
      nostrSubscriptions.delete(username);
    }
    const key = `${username}`;
    if (nostrPollers.has(key)) {
      clearInterval(nostrPollers.get(key)!);
      nostrPollers.delete(key);
    }
    return { stopped: true };
  },
  // Initialize a locked session by saving vault data and seeding minimal session state
  initSession: async (params: { username: string; publicKey: string; vaultData: any; passwordKey?: string }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    
    console.log('🔧 [initSession] Received vault data:', {
      username: params.username,
      hasXprivEncrypted: !!params.vaultData.xprivEncrypted,
      xprivEncryptedLength: params.vaultData.xprivEncrypted?.length,
      hasIdentities: !!params.vaultData.identities,
      identitiesCount: params.vaultData.identities?.length,
      allKeys: Object.keys(params.vaultData)
    });
    
    // Normalize vault data - map xprivEncrypted to encryptedVault for database storage
    const vaultToSave = {
      ...params.vaultData,
      encryptedVault: params.vaultData.xprivEncrypted,  // Map to DB field name
      publicKey: params.publicKey,
      lastUnlocked: Date.now(),
      createdAt: params.vaultData.createdAt || Date.now()
    };
    
    console.log('💾 [initSession] Saving vault with mapped fields:', {
      username: vaultToSave.username,
      hasEncryptedVault: !!vaultToSave.encryptedVault,
      encryptedVaultLength: vaultToSave.encryptedVault?.length,
      hasIdentities: !!vaultToSave.identities,
      allKeys: Object.keys(vaultToSave)
    });
    
    // Save/refresh vault data
    await vaultDB.saveVault(vaultToSave);
    // Persist xprivs store too if present
    try {
      const enc = vaultToSave.xprivEncrypted;
      const pinSalt = vaultToSave.salt;
      if (enc && pinSalt) {
        await vaultDB.saveXpriv(params.username, enc, pinSalt, vaultToSave.passwordSalt);
      }
    } catch {}
    // Seed minimal locked session in-memory
    const session: ExtendedSession = {
      username: params.username,
      publicKey: params.publicKey,
      isUnlocked: false,
      unlockedAt: Date.now(),
      passwordKey: params.passwordKey  // Cache password key for vault encryption
    };
    activeSessions.set(params.username, session);
    logSessionState('SESSION_INIT', params.username);
    // Persist non-sensitive session status
    const sessionId = `session_${params.username}_${Date.now()}`;
    await vaultDB.saveSession({ 
      sessionId,
      username: params.username, 
      publicKey: params.publicKey, 
      isUnlocked: false,
      createdAt: Date.now()
    } as any);
    // Broadcast login event
    broadcastVaultUpdate(params.username, 'USER_LOGGED_IN', { username: params.username, publicKey: params.publicKey });
    return { success: true };
  },

  // Sign a Nostr event using the current session keys for a specific identity
  signEventWithSession: async (params: { username: string; event: any; identityIndex: number }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    // Resolve private key for identity
    let privateKey: string | undefined = undefined;
    let publicKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
      publicKey = crypto.getPublicKey(privateKey);
    } else if ((session as any).xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: (session as any).xpriv as string, index: params.identityIndex });
      privateKey = (derived as any).privateKey;
      publicKey = (derived as any).publicKey;
    }

    if (!privateKey) throw new Error('No session key available for signing');

    // Prepare event
    const evt = { ...params.event };
    if (!evt.created_at) evt.created_at = Math.floor(Date.now() / 1000);
    if (!evt.kind) evt.kind = 1;
    if (!evt.tags) evt.tags = [];
    if (!evt.pubkey) evt.pubkey = publicKey!;

    // Sign
    const signed = crypto.signEvent(evt, String(privateKey));
    if (signed instanceof Map) {
      return {
        event: {
          id: signed.get('id') || evt.id,
          kind: signed.get('kind') || evt.kind,
          content: signed.get('content') || evt.content,
          tags: signed.get('tags') || evt.tags,
          created_at: signed.get('created_at') || evt.created_at,
          pubkey: signed.get('pubkey') || evt.pubkey,
          sig: signed.get('sig') || ''
        }
      };
    }
    return { event: signed };
  },

  // Sign arbitrary data using session keys for a specific identity
  signMessageWithSession: async (params: { username: string; message: string; identityIndex: number }): Promise<{ signature: string }> => {
    const crypto = await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if ((session as any).xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: (session as any).xpriv as string, index: params.identityIndex });
      privateKey = (derived as any).privateKey;
    }
    if (!privateKey) throw new Error('No session key available for signing');

    const signature = crypto.signMessage(params.message, privateKey);
    return { signature };
  },

  // Encrypt with session key for a specific identity (NIP-04)
  encryptWithSession: async (params: { username: string; plaintext: string; recipientPubkey: string; identityIndex: number }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if ((session as any).xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: (session as any).xpriv as string, index: params.identityIndex });
      privateKey = (derived as any).privateKey;
    }
    if (!privateKey) throw new Error('No session key available for encryption');

    // Use nostr-tools NIP-04 (spec-compliant)
    return nip04EncryptJS(privateKey, params.recipientPubkey, params.plaintext);
  },

  // Decrypt with session key for a specific identity (NIP-04)
  decryptWithSession: async (params: { username: string; ciphertext: string; senderPubkey: string; identityIndex: number }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    if (!session || !session.isUnlocked || isSessionExpired(session)) {
      throw new Error('Session expired or locked');
    }

    let privateKey: string | undefined = undefined;
    if (params.identityIndex === 0 && session.privateKey) {
      privateKey = session.privateKey;
    } else if ((session as any).xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: (session as any).xpriv as string, index: params.identityIndex });
      privateKey = (derived as any).privateKey;
    }
    if (!privateKey) throw new Error('No session key available for decryption');

    // Use nostr-tools NIP-04 (spec-compliant)
    return nip04DecryptJS(privateKey, params.senderPubkey, params.ciphertext);
  },

  // Return PIN-encrypted xpriv and salts from the dedicated store
  getEncryptedXpriv: async (params: { username: string }): Promise<{ encryptedXpriv: string; pinSalt: string; passwordSalt?: string } | null> => {
    await ensureCryptoReady();
    const row = await vaultDB.getXpriv(params.username);
    if (!row) return null;
    return row;
  },
  // Preflight: check if session has keys loaded
  hasKeysInSession: async (params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean; hasStorageKeypair: boolean }> => {
    await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    const hasPrivateKey = !!(session && session.privateKey);
    const hasXpriv = !!(session && (session as any).xpriv);
    const hasStorageKeypair = !!(session && (session as any).storagePrivateKey && (session as any).storagePublicKey);
    return { hasPrivateKey, hasXpriv, hasStorageKeypair };
  },

  // Generate a new master extended private key (xpriv)
  generateXpriv: async (): Promise<{ xpriv: string }> => {
    const crypto = await ensureCryptoReady();
    const xpriv = crypto.generateXpriv();
    return { xpriv };
  },

  generateKeypair: async (_params: GenerateKeypairParams): Promise<GenerateKeypairResult> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateKeypair();
  },

  signEvent: async (params: SignEventParams): Promise<SignEventResult> => {
    const crypto = await ensureCryptoReady();
    const signedEvent = crypto.signEvent(params.event, params.privateKey);
    return { event: signedEvent };
  },

  signMessage: async (params: SignMessageParams): Promise<SignMessageResult> => {
    const crypto = await ensureCryptoReady();
    return { signature: crypto.signMessage(params.message, params.privateKey) };
  },

  calculateEventId: async (params: { event: any }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.calculateEventId(params.event);
  },

  getPublicKey: async (params: { privateKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.getPublicKey(params.privateKey);
  },

  encrypt: async (params: EncryptParams): Promise<string> => {
    await ensureCryptoReady();
    return nip04EncryptJS(
      params.privateKey,
      params.recipientPubkey,
      params.plaintext
    );
  },

  decrypt: async (params: DecryptParams): Promise<string> => {
    await ensureCryptoReady();
    return nip04DecryptJS(
      params.privateKey,
      params.senderPubkey,
      params.ciphertext
    );
  },

  // Derive identity keypair using xpriv from the current session
  deriveIdentityFromSession: async (params: { username: string; index: number }): Promise<{ publicKey: string; path: string }> => {
    await ensureCryptoReady();
    const session = activeSessions.get(params.username);
    if (!session || !(session as any).xpriv) {
      throw new Error('No xpriv in session - please unlock with PIN first');
    }
    
    const xpriv = (session as any).xpriv as string;
    
    // Use existing derive helper
    const derived = await handlers.deriveKeypairFromXpriv({ xpriv, index: params.index });
    
    let publicKey: string;
    let path: string;
    
    if (derived instanceof Map) {
      publicKey = derived.get('publicKey');
      path = derived.get('path') || `m/44'/1237'/0'/0/${params.index}`;
    } else {
      publicKey = (derived as any).publicKey;
      path = (derived as any).path || `m/44'/1237'/0'/0/${params.index}`;
    }
    
    return { publicKey, path };
  },

  deriveKey: async (params: DeriveKeyParams): Promise<DeriveKeyResult> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveKeyFromPassword(params.password, params.salt);
    
    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      const derived = {
        key: result.get('key'),
        salt: result.get('salt'),
      };
      return derived;
    }
    
    return result;
  },

  encryptData: async (params: EncryptDataParams): Promise<string> => {
    const crypto = await ensureCryptoReady();
    
    // Use key directly if provided, otherwise use password
    const encryptionKey = params.key || params.password;
    if (!encryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    
    // Use Argon2id-based encryption for better security
    return crypto.encryptDataWithArgon2(params.data, encryptionKey);
  },

  decryptData: async (params: DecryptDataParams): Promise<string> => {
    const crypto = await ensureCryptoReady();
    
    // Use key directly if provided, otherwise use password
    const decryptionKey = params.key || params.password;
    if (!decryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    
    // Use Argon2id-based decryption for better security
    return crypto.decryptDataWithArgon2(params.encryptedData, decryptionKey);
  },

  deriveKeypairFromXpriv: async (params: { xpriv: string; index: number }): Promise<any> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveKeypairFromXpriv(params.xpriv, params.index);
    
    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      return {
        privateKey: result.get('privateKey'),
        publicKey: result.get('publicKey'),
        path: result.get('path')
      };
    }
    
    return result;
  },

  // PIN-based encryption with specific salt (for xpriv encryption)
  encryptDataWithSalt: async (params: { data: string; password: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptDataWithSalt(params.data, params.password, params.salt);
  },

  // PIN-based decryption with specific salt (for xpriv decryption)
  decryptDataWithSalt: async (params: { encryptedData: string; password: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptDataWithSalt(params.encryptedData, params.password, params.salt);
  },

  // Generate secure random bytes
  generateRandomBytes: async (params: { length: number }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateRandomBytes(params.length);
  },

  // Generate secure salt
  generateSalt: async (): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.generateSalt();
  },

  // Derive storage keypair from xpriv for vault data encryption
  deriveStorageKeypairFromXpriv: async (params: { xpriv: string }): Promise<any> => {
    const crypto = await ensureCryptoReady();
    const result = crypto.deriveStorageKeypairFromXpriv(params.xpriv);
    
    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      return {
        privateKey: result.get('privateKey'),
        publicKey: result.get('publicKey'),
        path: result.get('path')
      };
    }
    
    return result;
  },

  // Get storage derivation path
  getStoragePath: async (): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.getStoragePath();
  },

  // Encrypt LoginObj with storage public key
  encryptLoginObj: async (params: { loginObj: string; storagePublicKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptLoginObj(params.loginObj, params.storagePublicKey);
  },

  // Decrypt LoginObj with storage private key
  decryptLoginObj: async (params: { encryptedLoginObj: string; storagePrivateKey: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptLoginObj(params.encryptedLoginObj, params.storagePrivateKey);
  },

  // Encrypt VaultObj with PIN
  encryptVaultObj: async (params: { vaultObj: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.encryptVaultObj(params.vaultObj, params.pin, params.salt);
  },

  // Decrypt VaultObj with PIN
  decryptVaultObj: async (params: { encryptedVaultObj: string; pin: string; salt: string }): Promise<string> => {
    const crypto = await ensureCryptoReady();
    return crypto.decryptVaultObj(params.encryptedVaultObj, params.pin, params.salt);
  },

  // Add the vault management handlers
  createVault: async (params: CreateVaultParams): Promise<CreateVaultResult> => {
    const crypto = await ensureCryptoReady();
    
    // Generate the vault
    const vaultResult = crypto.createVault(params.username, params.pin);
    
    // Handle result Map
    let vault: any;
    if (vaultResult instanceof Map) {
      vault = {
        username: vaultResult.get('username'),
        publicKey: vaultResult.get('publicKey'),
        privateKey: vaultResult.get('privateKey'),
        xpriv: vaultResult.get('xpriv'),
        derivationPath: vaultResult.get('derivationPath'),
        encryptedVault: vaultResult.get('encryptedVault'),
        salt: vaultResult.get('salt'),
      };
    } else {
      vault = vaultResult;
    }
    
    // Store encrypted vault data (xprivEncrypted only)
    await vaultDB.saveVault({
      username: vault.username,
      publicKey: vault.publicKey,
      encryptedVault: vault.xprivEncrypted || vault.encryptedVault,
      salt: vault.salt,
      derivationPath: vault.derivationPath,
      createdAt: Date.now(),
      lastUnlocked: Date.now(),
      sessionExpiry: Date.now() + (24 * 60 * 60 * 1000)
    });
    
    // Create active session
    const session: ExtendedSession = {
      username: vault.username,
      publicKey: vault.publicKey,
      privateKey: vault.privateKey,
      xpriv: vault.xpriv,
      isUnlocked: true,
      unlockedAt: Date.now()
    };
    
    activeSessions.set(vault.username, session);
    logSessionState('create', vault.username);
    
    // Broadcast vault creation
    broadcastVaultUpdate(vault.username, 'VAULT_CREATED', {
      publicKey: vault.publicKey
    });
    
    return {
      username: vault.username,
      publicKey: vault.publicKey,
      derivationPath: vault.derivationPath
    };
  },

  unlockVault: async (params: UnlockVaultParams): Promise<UnlockVaultResult> => {
    await ensureCryptoReady();
    
    // Get vault data from IndexedDB
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('Vault not found');
    }
    
    console.log('[Unlock] Starting unlock', { username: params.username });
    console.log('[Unlock] Vault fields presence:', {
      hasXprivEncrypted: !!(vaultData as any).encryptedVault,
      hasSalt: !!(vaultData as any).salt
    });

    // Decrypt the vault
    ensureNotLocked(params.username);
    const decryptedResult = crypto.decryptVault(
      vaultData.encryptedVault,
      params.pin
    );
    
    // Handle result Map
    let decrypted: any;
    if (decryptedResult instanceof Map) {
      decrypted = {
        privateKey: decryptedResult.get('privateKey'),
        xpriv: decryptedResult.get('xpriv'),
        publicKey: decryptedResult.get('publicKey')
      };
    } else {
      decrypted = decryptedResult;
    }
    
    // Validate xpriv if present
    if (decrypted.xpriv) {
      const sanitized = decrypted.xpriv.trim().replace(/\s+/g, '');
      
      // Basic format check
      if (!/^(xprv|tprv)/.test(sanitized)) {
        throw new Error('Invalid xpriv after PIN decrypt - must start with xprv or tprv');
      }
      
      // Test derivation to ensure xpriv is valid
      try {
        const testDerive = await handlers.deriveKeypairFromXpriv({ 
          xpriv: sanitized,
          index: 0
        });
        
        if (!testDerive || !testDerive.publicKey) {
          throw new Error('Invalid xpriv - derivation test failed');
        }
        
        console.log('[Worker] xpriv validated successfully via test derivation');
      } catch (error) {
        console.error('[Worker] xpriv validation failed:', error);
        throw new Error(`Invalid xpriv - validation failed: ${error.message}`);
      }
      
      decrypted.xpriv = sanitized;
    } else {
      console.warn('[Unlock] No xpriv in decrypted payload');
    }
    
    // Derive storage keypair from xpriv for Nostr operations
    let storagePrivateKey: string | undefined;
    let storagePublicKey: string | undefined;
    
    if (decrypted.xpriv) {
      try {
        // IMPORTANT: Use STORAGE_INDEX (8907) to match account creation
        const { STORAGE_INDEX } = await import('@nostrpass/types');
        const storageKeypair = await handlers.deriveKeypairFromXpriv({ xpriv: decrypted.xpriv, index: STORAGE_INDEX });
        if (storageKeypair instanceof Map) {
          storagePrivateKey = storageKeypair.get('privateKey');
          storagePublicKey = storageKeypair.get('publicKey');
        } else {
          storagePrivateKey = storageKeypair.privateKey;
          storagePublicKey = storageKeypair.publicKey;
        }
        console.log('[Unlock] Storage keypair derived for Nostr operations with STORAGE_INDEX');
      } catch (error) {
        console.error('[Unlock] Failed to derive storage keypair:', error);
        // Continue without storage keypair - will affect Nostr sync but not local operations
      }
    }
    
    // Update session
    const session: ExtendedSession = {
      username: params.username,
      publicKey: vaultData.publicKey,
      privateKey: decrypted.privateKey,
      xpriv: decrypted.xpriv,
      isUnlocked: true,
      unlockedAt: Date.now(),
      // Cache storage keypair for Nostr operations (signing/encryption)
      storagePrivateKey,
      storagePublicKey
    };
    console.log('[Unlock] Session seeds:', {
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!session.xpriv,
      hasStorageKeypair: !!(storagePrivateKey && storagePublicKey)
    });
    
    // Store recovery data if available
    if (vaultData.recoveryQuestions && vaultData.recoveryAnswers) {
      session.recoveryQuestions = vaultData.recoveryQuestions;
      session.answers = vaultData.recoveryAnswers;
    }
    
    activeSessions.set(params.username, session);
    resetPinAttempts(params.username);
    logSessionState('unlock', params.username);
    
    // Update last unlocked time
    await vaultDB.updateLastUnlocked(params.username);
    
    // Broadcast unlock as SESSION_UNLOCKED for consistency with UI handlers
    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', {
      publicKey: vaultData.publicKey
    });
    console.log('[Unlock] Unlock flow completed');
    
    return {
      username: params.username,
      publicKey: vaultData.publicKey,
      isUnlocked: true
    };
  },

  // Back-compat alias: unlockSession behaves like unlockVault but accepts { username, privateKey, xpriv }
  unlockSession: async (params: { username: string; privateKey?: string; xpriv?: string }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    const v = await vaultDB.getVault(params.username);
    const session = activeSessions.get(params.username) || {
      username: params.username,
      publicKey: v?.publicKey || '',
      isUnlocked: false,
      unlockedAt: Date.now()
    } as ExtendedSession;
    ensureNotLocked(params.username);
    if (params.privateKey) session.privateKey = params.privateKey;
    if (params.xpriv) (session as any).xpriv = params.xpriv;
    session.isUnlocked = !!(session.privateKey || (session as any).xpriv);
    session.unlockedAt = Date.now();
    // Derive and cache storage keypair if available
    if ((session as any).xpriv && !session.storagePrivateKey) {
      try {
        const { STORAGE_INDEX } = await import('@nostrpass/types');
        const derived = await handlers.deriveKeypairFromXpriv({ xpriv: (session as any).xpriv, index: STORAGE_INDEX });
        if (derived instanceof Map) {
          session.storagePrivateKey = derived.get('privateKey');
          session.storagePublicKey = derived.get('publicKey');
        } else {
          session.storagePrivateKey = (derived as any).privateKey;
          session.storagePublicKey = (derived as any).publicKey;
        }
        console.log('[UnlockSession] Storage keypair derived and cached');
      } catch (e) {
        console.warn('[UnlockSession] Failed to derive storage keypair:', e);
      }
    }
    activeSessions.set(params.username, session);
    resetPinAttempts(params.username);
    logSessionState('UNLOCKED_ALIAS', params.username);
    const sessionId = `session_${params.username}_${Date.now()}`;
    await vaultDB.saveSession({ 
      sessionId,
      username: params.username, 
      publicKey: session.publicKey!, 
      isUnlocked: session.isUnlocked,
      createdAt: Date.now()
    } as any);
    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', { username: params.username });
    return { success: true };
  },

  lockVault: async (params: LockVaultParams): Promise<void> => {
    await ensureCryptoReady();
    
    const session = activeSessions.get(params.username);
    if (session) {
      // Clear sensitive data
      delete session.privateKey;
      delete (session as any).xpriv;
      delete (session as any).storagePrivateKey;
      delete (session as any).storagePublicKey;
      session.isUnlocked = false;
      
      logSessionState('lock', params.username);
      
      // Broadcast lock as SESSION_LOCKED for consistency with UI handlers
      broadcastVaultUpdate(params.username, 'SESSION_LOCKED', {});
    }
  },

  // Explicit logout clears session and broadcasts to all tabs
  logoutUser: async (params: { username: string }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    const username = params.username;
    // Clear in-memory session data
    const session = activeSessions.get(username);
    if (session) {
      delete session.privateKey;
      delete (session as any).xpriv;
      delete (session as any).storagePrivateKey;
      delete (session as any).storagePublicKey;
      session.isUnlocked = false;
    }
    activeSessions.delete(username);
    logSessionState('logout', username);
    // Clear persisted session row
    try { await vaultDB.clearAllSessions(); } catch {}
    // Notify other tabs
    broadcastVaultUpdate(username, 'USER_LOGGED_OUT', {});
    return { success: true };
  },

  // Clear session without full logout (used by UI for cleanup)
  clearSession: async (params: { username: string }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    const username = params.username;
    const session = activeSessions.get(username);
    if (session) {
      delete session.privateKey;
      delete (session as any).xpriv;
      delete (session as any).storagePrivateKey;
      delete (session as any).storagePublicKey;
      session.isUnlocked = false;
    }
    try { await vaultDB.clearAllSessions(); } catch {}
    broadcastVaultUpdate(username, 'SESSION_LOCKED', {});
    return { success: true };
  },

  getSession: async (params: GetSessionParams): Promise<GetSessionResult> => {
    await ensureCryptoReady();
    
    const session = activeSessions.get(params.username);
    const vaultData = await vaultDB.getVault(params.username);
    
    if (!session && !vaultData) {
      return {
        exists: false,
        isUnlocked: false
      };
    }
    
    return {
      exists: true,
      isUnlocked: session?.isUnlocked || false,
      publicKey: session?.publicKey || vaultData?.publicKey,
      hasRecovery: !!(vaultData?.recoveryQuestions && vaultData?.recoveryAnswers)
    };
  },

  // Additional handlers for recovery, etc.
  recoverVault: async (params: RecoverVaultParams): Promise<RecoverVaultResult> => {
    const crypto = await ensureCryptoReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('Vault not found');
    }
    
    if (!vaultData.recoveryQuestions || !vaultData.recoveryAnswers) {
      throw new Error('No recovery data found for this vault');
    }
    
    // Verify answers match
    const providedAnswers = params.answers.map(a => a.toLowerCase().trim());
    const storedAnswers = vaultData.recoveryAnswers.map(a => a.toLowerCase().trim());
    
    if (JSON.stringify(providedAnswers) !== JSON.stringify(storedAnswers)) {
      throw new Error('Recovery answers do not match');
    }
    
    // Generate new PIN and re-encrypt vault
    const newPin = params.newPin;
    
    // Decrypt with recovery
    const privateKey = crypto.recoverPrivateKey(
      vaultData.encryptedVault,
      params.answers.join('')
    );
    
    // Re-encrypt with new PIN
    const newVault = crypto.createVaultFromKeys(
      params.username,
      privateKey,
      newPin
    );
    
    // Handle result Map
    let vault: any;
    if (newVault instanceof Map) {
      vault = {
        encryptedVault: newVault.get('encryptedVault'),
        salt: newVault.get('salt'),
      };
    } else {
      vault = newVault;
    }
    
    // Update vault
    await vaultDB.updateVault(params.username, {
      encryptedVault: vault.encryptedVault,
      salt: vault.salt
    });
    
    return {
      username: params.username,
      publicKey: vaultData.publicKey
    };
  },

  updateVaultRecovery: async (params: UpdateVaultRecoveryParams): Promise<void> => {
    await ensureCryptoReady();
    
    // Update recovery data in database
    await vaultDB.updateVault(params.username, {
      recoveryQuestions: params.questions,
      recoveryAnswers: params.answers
    });
    
    // Update session if active
    const session = activeSessions.get(params.username);
    if (session) {
      session.recoveryQuestions = params.questions;
      session.answers = params.answers;
    }
  },

  checkVaultExists: async (params: CheckVaultExistsParams): Promise<CheckVaultExistsResult> => {
    await ensureCryptoReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    return { exists: !!vaultData };
  },

  deleteVault: async (params: DeleteVaultParams): Promise<DeleteVaultResult> => {
    await ensureCryptoReady();
    
    // Remove from active sessions
    activeSessions.delete(params.username);
    logSessionState('delete', params.username);
    
    // Delete from database (vaults, xprivs, sessions)
    await vaultDB.deleteVault(params.username);
    
    // Broadcast deletion
    broadcastVaultUpdate(params.username, 'VAULT_DELETED', {});
    
    return { success: true };
  },

  // Clear all data (for testing/reset)
  clearAllData: async (): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    
    // Clear all in-memory sessions
    activeSessions.clear();
    
    // Clear all database stores
    await vaultDB.clearAll();
    
    console.log('🗑️ All vault data cleared');
    
    return { success: true };
  },

  getVaultData: async (params: { username: string }): Promise<VaultData | null> => {
    try {
      console.log('📥 [getVaultData] Request received for username:', params.username);
      
      console.log('🔄 [getVaultData] Ensuring crypto ready...');
      await ensureCryptoReady();
      console.log('✅ [getVaultData] Crypto ready');
      
      // Get vault data from database
      console.log('🗄️ [getVaultData] Querying IndexedDB...');
      const vaultData = await vaultDB.getVault(params.username);
      console.log('✅ [getVaultData] IndexedDB query complete, found:', !!vaultData);
      
      if (!vaultData) {
        console.log('❌ [getVaultData] No vault found for username:', params.username);
        return null;
      }
      
      console.log('📤 [getVaultData] Retrieved vault data:', {
      username: vaultData.username,
      hasPasswordVerifier: !!(vaultData as any).passwordVerifier,
      hasPasswordSalt: !!(vaultData as any).passwordSalt,
      hasXprivEncrypted: !!vaultData.encryptedVault,
      hasRecovery: !!(vaultData as any).recovery,
      identitiesCount: vaultData.identities?.length || 0,
      identities: vaultData.identities
    });
    
    // Return the vault data in the expected format (including password verification fields!)
    return {
      username: vaultData.username,
      publicKey: vaultData.publicKey,
      xprivEncrypted: vaultData.encryptedVault,
      salt: vaultData.salt,
      passwordSalt: (vaultData as any).passwordSalt, // CRITICAL: Include for password verification
      passwordVerifier: (vaultData as any).passwordVerifier, // CRITICAL: Include for password verification
      identities: vaultData.identities || [],
      storagePublicKey: vaultData.publicKey,
      activeIdentityByApp: vaultData.activeIdentityByApp || {},
      recovery: (vaultData as any).recovery, // Include recovery data
      lastSyncedAt: vaultData.lastSyncedAt,
      updatedAt: vaultData.updatedAt || vaultData.lastUnlocked,
      createdAt: vaultData.createdAt,
      version: (vaultData as any).version || 1
    } as any;
    } catch (error) {
      console.error('❌ [getVaultData] Error:', error);
      throw error;
    }
  },

  // Save a new vault (used when fetching from Nostr for the first time)
  saveVault: async (params: {
    username: string;
    publicKey: string;
    xprivEncrypted: string;
    salt: string;
    identities?: any[];
    activeIdentityByApp?: Record<string, number | null>;
    passwordVerifier?: string;
    passwordSalt?: string;
    recovery?: any;
    lastSyncedAt?: number;
    updatedAt?: number;
    createdAt?: number;
  }): Promise<void> => {
    await ensureCryptoReady();
    
    const vaultData = {
      username: params.username,
      publicKey: params.publicKey,
      xprivEncrypted: params.xprivEncrypted,
      encryptedVault: params.xprivEncrypted, // Redundant field for compatibility
      salt: params.salt,
      identities: params.identities || [],
      activeIdentityByApp: params.activeIdentityByApp || {},
      passwordVerifier: params.passwordVerifier,
      passwordSalt: params.passwordSalt,
      recovery: params.recovery,
      lastSyncedAt: params.lastSyncedAt || Date.now(),
      updatedAt: params.updatedAt || Date.now(),
      createdAt: params.createdAt || Date.now(),
      lastUnlocked: Date.now()
    };
    
    // Persist to vaults store
    await vaultDB.saveVault(vaultData);
    
    // Mirror to xprivs store if present
    try {
      if (params.xprivEncrypted && params.salt) {
        await vaultDB.saveXpriv(params.username, params.xprivEncrypted, params.salt, params.passwordSalt);
      }
    } catch (err) {
      console.error('Failed to mirror to xprivs store:', err);
    }
    
    console.log('✅ Vault saved to IndexedDB');
  },

  // Update vault data atomically and broadcast change
  updateVaultData: async (params: { username: string; vaultData: any; skipVersionIncrement?: boolean }): Promise<void> => {
    await ensureCryptoReady();
    const toSave = { ...params.vaultData };
    
    // Increment version for sync conflict resolution (unless explicitly skipped for Nostr downloads)
    if (!params.skipVersionIncrement) {
      toSave.version = (toSave.version || 0) + 1;
      toSave.updatedAt = Date.now();
    }
    
    // Ensure redundant fields are in sync (write primary -> encryptedVault for storage only)
    if (toSave.xprivEncrypted) {
      toSave.encryptedVault = toSave.xprivEncrypted;
    }
    
    console.log('💾 [updateVaultData] Saving vault with:', {
      username: toSave.username,
      version: toSave.version,
      identitiesCount: toSave.identities?.length || 0,
      hasXprivEncrypted: !!toSave.xprivEncrypted,
      hasEncryptedVault: !!toSave.encryptedVault,
      updatedAt: toSave.updatedAt ? new Date(toSave.updatedAt).toISOString() : 'N/A'
    });
    
    // Persist
    await vaultDB.saveVault(toSave);
    // Mirror to xprivs store if present
    try {
      const enc = toSave.xprivEncrypted;
      const pinSalt = toSave.salt;
      if (enc && pinSalt) {
        await vaultDB.saveXpriv(params.username, enc, pinSalt, toSave.passwordSalt);
      }
    } catch {}
    // Broadcast
    broadcastVaultUpdate(params.username, 'VAULT_DATA_UPDATED', { username: params.username });
  },

  // Session status helper for UI (kept for compatibility)
  getSessionStatus: async (_params?: { username?: string }): Promise<{ sessionId: string | null; username: string | null }> => {
    try {
      await ensureCryptoReady();
      
      // Check persisted sessions table (source of truth for logged-in state)
      // This gets cleared on logout, so if empty, user is logged out
      const allSessions = await vaultDB.getAllSessions();
      if (allSessions.length > 0) {
        const latest = allSessions[allSessions.length - 1];
        
        // Restore to activeSessions if not already there
        if (!activeSessions.has(latest.username)) {
          try {
            const vaultData = await vaultDB.getVault(latest.username);
            if (vaultData) {
              // Create a locked session (no keys in memory after refresh)
              activeSessions.set(latest.username, {
                username: latest.username,
                publicKey: vaultData.publicKey,
                isUnlocked: false,
                unlockedAt: Date.now()
              });
            }
          } catch {}
        }
        
        return { sessionId: latest.sessionId, username: latest.username };
      }
      
      // No sessions in DB = user is logged out
      // Don't check vaults or activeSessions - sessions table is source of truth
      return { sessionId: null, username: null };
    } catch (error) {
      console.error('[Worker] Error in getSessionStatus:', error);
      return { sessionId: null, username: null };
    }
  }
  ,
  // Refresh session (broadcast to all tabs)
  refreshSession: async (params: { username: string }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    
    const session = activeSessions.get(params.username);
    if (session) {
      // Update session activity timestamp
      session.unlockedAt = Date.now();
      
      // Broadcast session refresh
      broadcastVaultUpdate(params.username, 'SESSION_REFRESH', {
        username: params.username,
        publicKey: session.publicKey,
        isUnlocked: session.isUnlocked
      });
    }
    
    return { success: true };
  },

  // Check permission for an operation
  checkPermission: async (params: { method: string; origin?: string; username?: string }): Promise<{ allowed: boolean }> => {
    // For now, allow all operations from the same origin
    // This can be enhanced with more granular permission checks
    return { allowed: true };
  },

  // Get app permissions for a specific origin using the active identity for that app
  getAppPermissions: async (params: { username: string; origin: string; identityIndex?: number }): Promise<any | null> => {
    await ensureCryptoReady();
    const vault = await vaultDB.getVault(params.username);
    if (!vault || !vault.identities || vault.identities.length === 0) return null;
    const identityIndex = Math.max(0, Math.min(
      (params.identityIndex ?? (vault as any).activeIdentityByApp?.[params.origin] ?? 0),
      (vault.identities.length - 1)
    ));
    const identity = vault.identities[identityIndex] as any;
    const appPerms = (identity.appPermissions || {})[params.origin];
    return appPerms || null;
  },

  // Save/update app permissions scoped to origin on the active identity for that app
  saveAppPermissions: async (params: { username: string; origin: string; permissions: any; appName?: string; identityIndex?: number }): Promise<{ success: boolean }> => {
    await ensureCryptoReady();
    
    const { username, origin, permissions, appName } = params;
    // Get current vault data
    const vault = await vaultDB.getVault(username);
    if (!vault) {
      throw new Error('Vault not found');
    }
    
    // Ensure identities array exists
    const updatedVault = { ...vault } as any;
    updatedVault.identities = Array.isArray(updatedVault.identities) ? [...updatedVault.identities] : [];
    if (updatedVault.identities.length === 0) {
      updatedVault.identities.push({ appPermissions: {} });
    }
    // Determine the active identity for this app (fallback to 0)
    const identityIndex = Math.max(0, Math.min(
      (params.identityIndex ?? updatedVault.activeIdentityByApp?.[origin] ?? 0),
      (updatedVault.identities.length - 1)
    ));
    const identity = { ...updatedVault.identities[identityIndex] };
    identity.appPermissions = { ...(identity.appPermissions || {}) };
    
    const existing = identity.appPermissions[origin] || {
      appId: origin,
      appName: appName || origin,
      grantedAt: Date.now(),
      lastUsedAt: Date.now(),
      permissions: {
        social: 'ASK_EVERYTIME',
        messaging: 'ASK_EVERYTIME',
        signData: 'ASK_EVERYTIME',
        financial: 'ASK_EVERYTIME',
      },
      getPublicKey: 'ALLOW',
    };
    
    // Merge top-level and nested permission categories
    const merged = {
      ...existing,
      ...(appName ? { appName } : {}),
      lastUsedAt: Date.now(),
      ...(permissions.getPublicKey ? { getPublicKey: permissions.getPublicKey } : {}),
      permissions: {
        ...existing.permissions,
        ...(permissions.permissions || {}),
      },
    };
    
    identity.appPermissions[origin] = merged;
    updatedVault.identities[identityIndex] = identity;
    updatedVault.updatedAt = Date.now();
    
    // Persist
    await vaultDB.saveVault(updatedVault);
    
    // Broadcast the update
    broadcastVaultUpdate(username, 'PERMISSIONS_UPDATED', { 
      origin,
      permissions: merged 
    });
    
    return { success: true };
  },

  // Mine Proof of Work for a Nostr event (runs in worker thread to avoid blocking UI)
  minePow: async (params: { event: any; difficulty: number }): Promise<any> => {
    await ensureCryptoReady();
    console.log(`⛏️ [Worker] Mining PoW with difficulty ${params.difficulty}...`);
    const startTime = Date.now();
    
    try {
      const { minePow } = await import('nostr-tools/nip13');
      const minedEvent = minePow(params.event, params.difficulty);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [Worker] PoW mined in ${duration}s! Event ID: ${minedEvent.id}`);
      return minedEvent;
    } catch (error) {
      console.error('❌ [Worker] PoW mining failed:', error);
      throw error;
    }
  },

  // Create initial vault event for Nostr (PASSWORD-ENCRYPTED for account creation)
  createInitialVaultForNostr: async (params: { username: string; passwordKey: string }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();
    const vaultRaw = await vaultDB.getVault(params.username);
    if (!vaultRaw) throw new Error('No vault to save');
    
    // Map from IndexedDB field names to VaultData interface field names
    const vault = {
      ...vaultRaw,
      xprivEncrypted: (vaultRaw as any).encryptedVault || (vaultRaw as any).xprivEncrypted
    };
    
    console.log('📤 [createInitialVaultForNostr] Creating initial password-encrypted vault:', {
      username: vault.username,
      identitiesCount: vault.identities?.length || 0,
      hasXprivEncrypted: !!vault.xprivEncrypted,
      updatedAt: new Date(vault.updatedAt || Date.now()).toISOString()
    });
    
    const session = (activeSessions as any).get(params.username);
    const pub = vault.storagePublicKey || vault.publicKey;
    
    // Ensure we have a storage private key available for signing. Derive it if missing.
    let priv = session?.storagePrivateKey as string | undefined;
    if (!priv && session?.xpriv) {
      try {
        const { STORAGE_INDEX } = await import('@nostrpass/types');
        const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: STORAGE_INDEX });
        if (derived instanceof Map) {
          priv = derived.get('privateKey');
          (session as any).storagePrivateKey = priv;
          (session as any).storagePublicKey = derived.get('publicKey');
        } else {
          priv = (derived as any).privateKey;
          (session as any).storagePrivateKey = priv;
          (session as any).storagePublicKey = (derived as any).publicKey;
        }
        console.log('🔑 [createInitialVaultForNostr] Derived storage keypair via STORAGE_INDEX for signing');
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
      version: 1
    };
    
    console.log('✅ [createInitialVaultForNostr] Payload created:', {
      identitiesCount: payload.identities.length,
      hasXprivEncrypted: !!payload.xprivEncrypted,
      xprivEncryptedLength: payload.xprivEncrypted?.length
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
        identities: payload.identities.length
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
      env
    });
    
    const event = {
      kind: 30078 as number,
      content: String(encryptedContent),
      tags: [[String('d'), dTag], [String('encryption'), String('password-aes')]] as string[][],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: String(pub),
      id: '',
      sig: ''
    };
    
    // Resolve signing key with detailed diagnostics
    const signingKey = (priv || session?.storagePrivateKey || session?.privateKey) as string | undefined;
    console.log('🧾 [createInitialVaultForNostr] Signing key check:', {
      hasPrivLocal: !!priv,
      hasSession: !!session,
      hasSessionStoragePriv: !!(session && (session as any).storagePrivateKey),
      hasSessionPrivKey: !!(session && (session as any).privateKey)
    });
    if (!signingKey) {
      console.error('❌ [createInitialVaultForNostr] Missing signing key', {
        username: params.username,
        haveLocalPriv: !!priv,
        haveSession: !!session,
        haveSessionStoragePrivateKey: !!(session && (session as any).storagePrivateKey),
        haveSessionPrivateKey: !!(session && (session as any).privateKey)
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
      identities: payload.identities.length
    });
    
    return { event };
  },

  // Build a minimal vault event for Nostr publishing (STORAGE KEY-ENCRYPTED for sync operations)
  saveVaultToNostr: async (params: { username: string }): Promise<{ event: any }> => {
    const crypto = await ensureCryptoReady();
    const vaultRaw = await vaultDB.getVault(params.username);
    if (!vaultRaw) throw new Error('No vault to save');
    
    // Map from IndexedDB field names to VaultData interface field names
    const vault = {
      ...vaultRaw,
      xprivEncrypted: (vaultRaw as any).encryptedVault || (vaultRaw as any).xprivEncrypted
    };
    
    console.log('📤 [saveVaultToNostr] Preparing vault for Nostr sync:', {
      username: vault.username,
      identitiesCount: vault.identities?.length || 0,
      hasXprivEncrypted: !!vault.xprivEncrypted,
      hasEncryptedVaultInDB: !!(vaultRaw as any).encryptedVault,
      updatedAt: new Date(vault.updatedAt || Date.now()).toISOString()
    });
    
    const session = (activeSessions as any).get(params.username);
    
    // CRITICAL: Always use the vault's storage public key
    // During account creation, storage keypair is derived at m/44'/1237'/0'/0/8907 (STORAGE_INDEX)
    const pub = vault.storagePublicKey || vault.publicKey;  // Prefer storagePublicKey if available
    let priv = session?.storagePrivateKey;
    
    // If we don't have the storage private key in session, derive it from xpriv
    if (!priv && session?.xpriv) {
      console.log('🔑 [saveVaultToNostr] Deriving storage keypair from xpriv with STORAGE_INDEX...');
      // IMPORTANT: Use deriveKeypairFromXpriv with STORAGE_INDEX (8907), NOT deriveStorageKeypairFromXpriv!
      // deriveStorageKeypairFromXpriv uses m/44'/1237'/1'/0/0 (wrong path)
      // Account creation uses m/44'/1237'/0'/0/8907 (correct path)
      const { STORAGE_INDEX } = await import('@nostrpass/types');
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: STORAGE_INDEX });
      priv = (derived as any).privateKey;
      const derivedPub = (derived as any).publicKey;
      
      // Cache in session for next time
      (session as any).storagePrivateKey = priv;
      (session as any).storagePublicKey = derivedPub;
      
      // Verify it matches vault.storagePublicKey
      if (derivedPub !== pub) {
        console.error('❌ [saveVaultToNostr] Storage key mismatch!', {
          derivedPub,
          vaultStoragePublicKey: pub,
          usedStorageIndex: STORAGE_INDEX
        });
        throw new Error('Storage keypair derivation mismatch');
      }
      console.log('✅ [saveVaultToNostr] Storage keypair derived and verified with STORAGE_INDEX');
    }
    
    if (!priv) {
      throw new Error('No storage private key available for signing vault event');
    }
    
    // Basic hex sanity checks for pub and priv
    const isHex = (s: string) => typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
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
      version: 1
    };
    
    console.log('✅ [saveVaultToNostr] Payload created:', {
      identitiesCount: payload.identities.length,
      hasXprivEncrypted: !!payload.xprivEncrypted,
      xprivEncryptedLength: payload.xprivEncrypted?.length
    });
    
    // CRITICAL: Encrypt the payload with STORAGE PRIVATE KEY (NIP-04) for sync operations
    // This allows cross-tab sync without requiring the password
    const payloadJson = JSON.stringify(payload);
    let encryptedContent: string;
    
    console.log('🔐 [WORKER saveVaultToNostr] Starting NIP-04 encryption with storage key...');
    console.log('🔐 [WORKER saveVaultToNostr] Using storage private key from session');
    
    try {
      // Use NIP-04 encryption with storage key for sync operations
      const { encrypt } = await import('nostr-tools/nip04');
      encryptedContent = await encrypt(priv, String(pub), payloadJson);
      console.log('✅ [WORKER saveVaultToNostr] Payload encrypted with storage key!', {
        encryptedSize: encryptedContent.length,
        identities: payload.identities.length
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
      env
    });
    
    const event = {
      kind: 30078 as number, // NIP-78 arbitrary custom app data (replaceable) - MUST match getVaultFromNostr
      content: String(encryptedContent), // Use NIP-04 encrypted content
      tags: [[String('d'), dTag], [String('encryption'), String('nip04')]] as string[][], // Mark as NIP-04 encrypted
      created_at: Math.floor(Date.now() / 1000),
      pubkey: String(pub),
      id: '',
      sig: ''
    };
    
    // Calculate event ID
    const eventId = await crypto.calculateEventId({
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content
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
        sig: signedEvent.get('sig') || ''
      };
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
    return { event: normalized };
  },

  // Get vault data from Nostr relays
  getVaultFromNostr: async (params: { username: string }): Promise<{ vaultData: any; eventId: string; timestamp: number } | null> => {
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
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'ws://localhost:8080'
    ];
    
    // Query Nostr for vault data
    const vaultData = await getVaultFromNostr(storagePublicKey, relays);
    
    if (!vaultData) {
      return null;
    }
    
    return {
      vaultData,
      eventId: '', // Event ID would need to be returned from getVaultFromNostr
      timestamp: vaultData.updatedAt || Date.now()
    };
  }
};

// Export utility functions for worker initialization
export { ensureCryptoReady, activeSessions, logSessionState };