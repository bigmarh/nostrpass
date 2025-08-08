import { createWorkerHost } from '@nostrpass/worker-messenger';
import init, { NostrCrypto } from './wasm/nostrpass_crypto.js';
import { vaultDB, type VaultData, type UserSession } from './db';

// Initialize WASM module
let wasmReady = false;
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
}

// In-memory session storage (sensitive data)
const activeSessions = new Map<string, ExtendedSession>();

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

async function ensureWasmReady() {
  if (!wasmReady) {
    // Load WASM module
    await init();
    cryptoInstance = new NostrCrypto();
    wasmReady = true;
    
    // Initialize database
    await vaultDB.init();
    
    // Clear expired sessions on startup
    await vaultDB.clearExpiredSessions();
    
    // Restore active sessions from IndexedDB
    await restoreActiveSessions();
  }
  if (!cryptoInstance) {
    throw new Error('WASM crypto instance not initialized');
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
    
    // Broadcast to all tabs via BroadcastChannel API
    const message = {
      type: 'VAULT_BROADCAST',
      data: {
        broadcastType: type,
        username,
        timestamp: Date.now(),
        ...data
      }
    };
    
    console.log('[Worker] Sending broadcast message:', message);
    
    // Always use BroadcastChannel to communicate between tabs
    if (typeof BroadcastChannel !== 'undefined') {
      const broadcastChannel = new BroadcastChannel('nostrpass-vault');
      broadcastChannel.postMessage(message);
      console.log('[Worker] Broadcast message sent via BroadcastChannel');
      broadcastChannel.close?.();
    }
  } catch (error) {
    console.error('[Worker] Failed to broadcast vault update:', error);
  }
}

interface GenerateKeypairParams {
  seed?: string;
}

interface GenerateKeypairResult {
  publicKey: string;
  privateKey: string;
}

interface SignEventParams {
  event: {
    id?: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
    sig?: string;
  };
  privateKey: string;
}

interface SignEventResult {
  event: {
    id: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
    sig: string;
  };
}

interface EncryptParams {
  plaintext: string;
  recipientPubkey: string;
  privateKey: string;
}

interface DecryptParams {
  ciphertext: string;
  senderPubkey: string;
  privateKey: string;
}

interface DeriveKeyParams {
  password: string;
  salt?: string;
}

interface DeriveKeyResult {
  key: string;
  salt: string;
}

interface EncryptDataParams {
  data: string;
  password?: string;
  key?: string; // Allow direct key usage
}

interface DecryptDataParams {
  encryptedData: string;
  password?: string;
  key?: string; // Allow direct key usage
}

interface GenerateXprivResult {
  xpriv: string;
}

interface DeriveKeypairFromXprivParams {
  xpriv: string;
  index: number;
}

interface DeriveKeypairFromXprivResult {
  privateKey: string;
  publicKey: string;
  path: string;
}

interface SignMessageParams {
  message: string;
  privateKey: string;
}

interface SignMessageResult {
  signature: string;
}

// Session management interfaces
interface CreateSessionParams {
  username: string;
  publicKey: string;
  privateKey: string;
  xpriv?: string; // Master key for deriving all identities
  vaultData: VaultData;
  sessionTimeout?: number; // minutes
}

interface UnlockSessionParams {
  username: string;
  privateKey: string;
  xpriv?: string; // Optional xpriv for full key derivation
}

interface GetSessionParams {
  username: string;
}

interface SessionInfo {
  username: string;
  publicKey: string;
  isUnlocked: boolean;
  expiresAt?: number;
}

const handlers = {
  // Preflight: check if session has keys loaded
  hasKeysInSession: async (params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean; hasStorageKeypair: boolean }> => {
    await ensureWasmReady();
    const session = activeSessions.get(params.username);
    const hasPrivateKey = !!(session && session.privateKey);
    const hasXpriv = !!(session && (session as any).xpriv);
    const hasStorageKeypair = !!(session && (session as any).storagePrivateKey && (session as any).storagePublicKey);
    return { hasPrivateKey, hasXpriv, hasStorageKeypair };
  },
  generateKeypair: async (_params: GenerateKeypairParams): Promise<GenerateKeypairResult> => {
    const crypto = await ensureWasmReady();
    return crypto.generateKeypair();
  },

  signEvent: async (params: SignEventParams): Promise<SignEventResult> => {
    const crypto = await ensureWasmReady();
    const signedEvent = crypto.signEvent(params.event, params.privateKey);
    return { event: signedEvent };
  },

  signMessage: async (params: SignMessageParams): Promise<SignMessageResult> => {
    const crypto = await ensureWasmReady();
    return { signature: crypto.signMessage(params.message, params.privateKey) };
  },

  calculateEventId: async (params: { event: any }): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.calculateEventId(params.event);
  },

  getPublicKey: async (params: { privateKey: string }): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.getPublicKey(params.privateKey);
  },

  encrypt: async (params: EncryptParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.nip04Encrypt(
      params.plaintext,
      params.privateKey,
      params.recipientPubkey
    );
  },

  decrypt: async (params: DecryptParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.nip04Decrypt(
      params.ciphertext,
      params.privateKey,
      params.senderPubkey
    );
  },

  // Derive identity keypair using xpriv from the current session
  deriveIdentityFromSession: async (params: { username: string; index: number }): Promise<{ publicKey: string; path: string }> => {
    await ensureWasmReady();
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
    const crypto = await ensureWasmReady();
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
    const crypto = await ensureWasmReady();
    
    // Use key directly if provided, otherwise use password
    const encryptionKey = params.key || params.password;
    if (!encryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    
    const result = crypto.encryptData(params.data, encryptionKey);
    return result;
  },

  decryptData: async (params: DecryptDataParams): Promise<string> => {
    // Use key directly if provided, otherwise use password
    const decryptionKey = params.key || params.password;
    if (!decryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    if (!params.encryptedData) {
      throw new Error('encryptedData is required');
    }
    // Basic base64 validation to catch obvious corruption
    const looksB64 = /^[A-Za-z0-9+/=]+$/.test(params.encryptedData);
    if (!looksB64) {
      throw new Error('Encrypted data is not valid base64');
    }
    const crypto = await ensureWasmReady();
    try {
      return crypto.decryptData(params.encryptedData, decryptionKey);
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('decrypt') || msg.includes('base64')) {
        throw new Error('Invalid PIN or corrupted encrypted data');
      }
      throw e;
    }
  },

  generateXpriv: async (): Promise<GenerateXprivResult> => {
    const crypto = await ensureWasmReady();
    return { xpriv: crypto.generateXpriv() };
  },

  deriveKeypairFromXpriv: async (params: DeriveKeypairFromXprivParams): Promise<DeriveKeypairFromXprivResult> => {
    const crypto = await ensureWasmReady();
    
    // Log the xpriv being used
    console.log('[Worker] deriveKeypairFromXpriv called with:', {
      xprivType: typeof params.xpriv,
      xprivLength: params.xpriv?.length,
      xprivPrefix: params.xpriv?.substring(0, 4),
      index: params.index
    });
    
    // Validate xpriv before passing to WASM
    if (!params.xpriv || typeof params.xpriv !== 'string') {
      throw new Error('Invalid xpriv: must be a non-empty string');
    }
    
    try {
      const result = crypto.deriveKeypairFromXpriv(params.xpriv, params.index);
      
      // Handle if result is a Map (from serde_wasm_bindgen)
      if (result instanceof Map) {
        return {
          path: result.get('path'),
          privateKey: result.get('privateKey'),
          publicKey: result.get('publicKey'),
        };
      }
      
      return result;
    } catch (error) {
      console.error('[Worker] deriveKeypairFromXpriv WASM error:', error);
      throw error;
    }
  },

  // Session management methods
  createSession: async (params: CreateSessionParams): Promise<SessionInfo> => {
    await ensureWasmReady();
    
    
    // Save vault data to IndexedDB
    await vaultDB.saveVault(params.vaultData);
    
    // Create session (no auto-expiry; stays until explicit lock/logout)
    const expiresAt = undefined;
    
    const session: ExtendedSession = {
      username: params.username,
      publicKey: params.publicKey,
      privateKey: params.privateKey,
      isUnlocked: (!!params.privateKey && params.privateKey !== '') || !!params.xpriv, // Unlocked if we have private key OR xpriv
      unlockedAt: Date.now(),
      expiresAt,
      xpriv: params.xpriv // Store xpriv directly in the session object
    }
    
    // Check if there's already an unlocked session - don't overwrite it with a locked one
    const existingSession = activeSessions.get(params.username);
    if (existingSession && existingSession.isUnlocked && !session.isUnlocked) {
      return {
        username: existingSession.username,
        publicKey: existingSession.publicKey,
        isUnlocked: existingSession.isUnlocked,
        expiresAt: existingSession.expiresAt || expiresAt
      };
    }
    
    // Store in memory
    activeSessions.set(params.username, session);
    logSessionState('CREATED', params.username);
    
    // Verify session was stored correctly
    const storedSession = activeSessions.get(params.username);
    
    // Store session info in DB (without private key)
    await vaultDB.saveSession({
      ...session,
      privateKey: undefined // Never persist private key
    });
    
    return {
      username: session.username,
      publicKey: session.publicKey,
      isUnlocked: session.isUnlocked, // Return actual unlock state
      expiresAt
    };
  },

  unlockSession: async (params: UnlockSessionParams): Promise<SessionInfo> => {
    await ensureWasmReady();
    
    // Get vault data from DB
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('No vault found for user');
    }
    
    // Update session
    const existingSession = activeSessions.get(params.username);
    
    const session = existingSession || {
      username: params.username,
      publicKey: vaultData.publicKey,
      isUnlocked: false
    };
    
    session.privateKey = params.privateKey;
    session.isUnlocked = true;
    session.unlockedAt = Date.now();
    // Disable auto-expiry for unlocked sessions
    session.expiresAt = undefined;
    
    // Store xpriv if provided for storage key access
    if (params.xpriv) {
      const sanitized = String(params.xpriv).trim();
      console.log('[Worker] Storing xpriv in session:', {
        type: typeof sanitized,
        length: sanitized.length,
        prefix: sanitized.substring(0, 4),
        suffix: sanitized.substring(Math.max(0, sanitized.length - 4))
      });
      
      // Validate xpriv format early to avoid later base58 parse errors
      if (!/^xprv|^tprv/.test(sanitized)) {
        throw new Error('Invalid xpriv after PIN decrypt');
      }
      
      (session as any).xpriv = sanitized;

      // Also derive and cache the storage keypair so we can publish without needing xpriv each time
      try {
        const STORAGE_INDEX = 2147483647;
        const derived = await handlers.deriveKeypairFromXpriv({ 
          xpriv: sanitized,
          index: STORAGE_INDEX 
        });
        (session as any).storagePrivateKey = derived.privateKey;
        (session as any).storagePublicKey = derived.publicKey;
        console.log('[Worker] Cached storage keypair in session (pubkey prefix):', derived.publicKey.substring(0, 12));
      } catch (e) {
        console.error('[Worker] Failed to derive storage keypair from xpriv:', e);
      }
    }
    
    activeSessions.set(params.username, session);
    logSessionState('UNLOCKED', params.username);
    // Persist non-sensitive session state for cross-tab awareness
    await vaultDB.saveSession({
      username: session.username,
      publicKey: session.publicKey,
      isUnlocked: true,
      expiresAt: undefined
    });
    
    // Broadcast session unlock to all tabs
    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', {
      username: params.username,
      publicKey: session.publicKey
    });
    
    return {
      username: session.username,
      publicKey: session.publicKey,
      isUnlocked: true,
      expiresAt: session.expiresAt
    };
  },

  getSession: async (params: GetSessionParams): Promise<SessionInfo | null> => {
    await ensureWasmReady();
    
    // Check in-memory session first
    const session = activeSessions.get(params.username);
    if (session) {
      const now = Date.now();
      const expired = session.expiresAt && session.expiresAt <= now;
      if (!expired) {
        // If memory says locked, but persisted says unlocked, rehydrate to unlocked
        if (!session.isUnlocked) {
          const stored = await vaultDB.getSession(params.username);
          const ok = !!stored && !!stored.isUnlocked && (!stored.expiresAt || stored.expiresAt > now);
          if (ok) {
            session.isUnlocked = true;
            session.expiresAt = stored.expiresAt;
          }
        }
        return {
          username: session.username,
          publicKey: session.publicKey,
          isUnlocked: session.isUnlocked,
          expiresAt: session.expiresAt
        };
      } else {
        activeSessions.delete(params.username);
      }
    }
    
    // Check persisted session metadata for cross-tab state
    const storedSession = await vaultDB.getSession(params.username);
    if (storedSession) {
      const isUnlocked = !!storedSession.isUnlocked; // ignore expiresAt (no auto-expiry)
      // Rehydrate minimal unlocked session so preflights see unlocked
      if (isUnlocked) {
        const minimal: any = {
          username: storedSession.username,
          publicKey: storedSession.publicKey,
          isUnlocked: true,
          expiresAt: undefined
        };
        activeSessions.set(params.username, minimal);
      }
      return {
        username: storedSession.username,
        publicKey: storedSession.publicKey,
        isUnlocked,
        expiresAt: undefined
      };
    }

    // Fallback to vault data
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      return null;
    }
    return {
      username: vaultData.username,
      publicKey: vaultData.publicKey,
      isUnlocked: false
    };
  },

  clearSession: (params: GetSessionParams): void => {
    const existingSession = activeSessions.get(params.username);
    if (existingSession) {
      
      // Clear sensitive data from memory
      delete existingSession.privateKey;
      delete (existingSession as any).xpriv;
      existingSession.isUnlocked = false;
      
      // Keep the session with basic info (username, publicKey)
      // The vault data in IndexedDB has the PIN-encrypted xpriv
      // This allows unlock without re-login
      
      // Notify the vault UI about manual lock
      self.postMessage({
        type: 'SESSION_LOCKED',
        data: {
          username: params.username,
          reason: 'manual_lock'
        }
      });
      
      // Broadcast session lock to all tabs
      broadcastVaultUpdate(params.username, 'SESSION_LOCKED', {
        username: params.username,
        reason: 'manual_lock'
      });
      
      logSessionState('LOCKED', params.username);
    }
    
    // Note: We don't clear from DB on logout to preserve vault data
    // Sessions are only in-memory and expire naturally
  },

  // Get vault data (without sensitive keys)
  getVaultData: async (params: GetSessionParams): Promise<VaultData | null> => {
    await ensureWasmReady();
    return vaultDB.getVault(params.username);
  },
  
  // Update vault data
  updateVaultData: async (params: { username: string; vaultData: VaultData }): Promise<{ success: boolean }> => {
    const startTime = Date.now();
    console.log('[Worker] updateVaultData called for:', params.username);
    
    await ensureWasmReady();
    
    try {
      await vaultDB.saveVault(params.vaultData);
      console.log('[Worker] updateVaultData completed in:', Date.now() - startTime, 'ms');
      
      // Broadcast vault update to all tabs
      broadcastVaultUpdate(params.username, 'VAULT_DATA_UPDATED', {
        username: params.username,
        timestamp: Date.now(),
        changes: 'vault_data_updated'
      });
      
      return { success: true };
    } catch (error) {
      console.error('[Worker] updateVaultData error:', error);
      throw error;
    }
  },

  // Sign with active session or specific identity
  signEventWithSession: async (params: { username: string; event: any; identityIndex?: number }): Promise<SignEventResult> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    let privateKey: string;
    
    // If identity index provided and we have xpriv, derive that identity's key
    if (params.identityIndex !== undefined && (session as any).xpriv) {
      const sx = (session as any).xpriv as string;
      if (typeof sx !== 'string' || !(/^xprv|^tprv/.test(sx))) {
        delete (session as any).xpriv;
        throw new Error('Session lost xpriv; unlock with PIN again');
      }
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv: sx,
        index: params.identityIndex 
      });
      privateKey = derived.privateKey;
    } else if (session.privateKey) {
      // Use session's private key (current identity)
      privateKey = session.privateKey;
    } else {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    const crypto = await ensureWasmReady();
    const signedEvent = crypto.signEvent(params.event, privateKey);
    return { event: signedEvent };
  },

  // Sign with storage key (for vault operations)
  signEventWithStorageKey: async (params: { username: string; event: any }): Promise<SignEventResult> => {
    await ensureWasmReady();
    
    // Get session to check if unlocked
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    // Check if we have xpriv in session
    const xpriv = (session as any).xpriv;
    if (!xpriv) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    // Get the storage keypair (using max index)
    const STORAGE_INDEX = 2147483647;
    const derived = await handlers.deriveKeypairFromXpriv({ 
      xpriv,
      index: STORAGE_INDEX 
    });
    
    const crypto = await ensureWasmReady();
    const signedEvent = crypto.signEvent(params.event, derived.privateKey);
    return { event: signedEvent };
  },

  // Sign arbitrary message with active session (optionally with a specific identity)
  signMessageWithSession: async (params: { username: string; message: string; identityIndex?: number }): Promise<SignMessageResult> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if ((session as any).xpriv && params.identityIndex !== undefined) {
      const sx = (session as any).xpriv as string;
      if (typeof sx !== 'string' || !(/^xprv|^tprv/.test(sx))) {
        delete (session as any).xpriv;
        throw new Error('Session lost xpriv; unlock with PIN again');
      }
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv: sx, 
        index: params.identityIndex 
      });
      privateKey = (derived as any).privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    // Validate inputs defensively to avoid WASM memory errors
    if (typeof params.message !== 'string') {
      throw new Error('Invalid message for signing');
    }
    if (typeof privateKey !== 'string' || privateKey.length !== 64) {
      throw new Error('Invalid private key for signing');
    }
    const crypto = await ensureWasmReady();
    try {
      const sig = crypto.signMessage(params.message, privateKey);
      return { signature: sig };
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('out of bounds')) {
        throw new Error('Signing failed due to invalid inputs');
      }
      throw e;
    }
  },

  // Encrypt with active session (optionally with a specific identity)
  encryptWithSession: async (params: { username: string; plaintext: string; recipientPubkey?: string; identityIndex?: number; pubkey?: string }): Promise<string> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if ((session as any).xpriv && params.identityIndex !== undefined) {
      const sx = (session as any).xpriv as string;
      if (typeof sx !== 'string' || !(/^xprv|^tprv/.test(sx))) {
        delete (session as any).xpriv;
        throw new Error('Session lost xpriv; unlock with PIN again');
      }
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv: sx, 
        index: params.identityIndex 
      });
      privateKey = (derived as any).privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Session rehydrated without keys; unlock with PIN');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    const crypto = await ensureWasmReady();
    const recipient = params.recipientPubkey || (params as any).pubkey;
    if (typeof recipient !== 'string' || recipient.length === 0) {
      throw new Error('Recipient public key is required');
    }
    if (typeof params.plaintext !== 'string') {
      throw new Error('Plaintext must be a string');
    }
    // Validate compressed secp256k1 pubkey (33 bytes, hex length 66, starts with 02/03)
    const looksHex = /^[0-9a-fA-F]+$/.test(recipient);
    if (!looksHex || recipient.length !== 66 || !(/^02|03/i.test(recipient))) {
      throw new Error('Invalid recipient public key: must be 33-byte compressed hex starting with 02/03');
    }
    try {
      return crypto.nip04Encrypt(
        params.plaintext,
        privateKey,
        recipient
      );
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('out of bounds')) {
        throw new Error('Encryption failed due to invalid keys');
      }
      throw e;
    }
  },

  // Decrypt with active session (optionally with a specific identity)
  decryptWithSession: async (params: { username: string; ciphertext: string; senderPubkey?: string; identityIndex?: number; pubkey?: string }): Promise<string> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session not unlocked (no xpriv)');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if ((session as any).xpriv && params.identityIndex !== undefined) {
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv: (session as any).xpriv, 
        index: params.identityIndex 
      });
      privateKey = (derived as any).privateKey;
    }
    
    if (!privateKey) {
      throw new Error('No private key available (identityIndex required)');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    const crypto = await ensureWasmReady();
    const sender = params.senderPubkey || (params as any).pubkey;
    if (typeof sender !== 'string' || sender.length === 0) {
      throw new Error('Sender public key is required');
    }
    // Validate compressed secp256k1 pubkey (33 bytes, hex length 66, starts with 02/03)
    const looksHex = /^[0-9a-fA-F]+$/.test(sender);
    if (!looksHex || sender.length !== 66 || !(/^02|03/i.test(sender))) {
      throw new Error('Invalid sender public key: must be 33-byte compressed hex starting with 02/03');
    }
    // Validate ciphertext base64-ish
    if (typeof params.ciphertext !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(params.ciphertext)) {
      throw new Error('Invalid ciphertext format');
    }
    try {
      return crypto.nip04Decrypt(
        params.ciphertext,
        privateKey,
        sender
      );
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('out of bounds')) {
        throw new Error('Decryption failed due to invalid keys');
      }
      throw e;
    }
  },

  // Secure PIN recovery - starts recovery session
  startPinRecovery: async (params: { 
    username: string; 
    answers: string[]; 
    vaultData: VaultData 
  }): Promise<{ success: boolean; sessionToken?: string }> => {
    await ensureWasmReady();
    const crypto = await ensureWasmReady();
    
    if (!params.vaultData.recovery) {
      throw new Error('No recovery data found');
    }
    
    // Concatenate answers
    const concatenated = params.answers
      .map(a => a.toLowerCase().trim())
      .join('|');
    
    // Derive recovery key
    const recoveryKeyResult = await handlers.deriveKey({
      password: concatenated,
      salt: params.vaultData.recovery.salt
    });
    
    const recoveryKey = recoveryKeyResult.key;
    
    try {
      // Try to decrypt xpriv with recovery key
      const xpriv = await crypto.decryptData(
        params.vaultData.recovery.xprivRecovery,
        recoveryKey
      );
      
      // Success! Store xpriv in memory temporarily
      const sessionToken = Math.random().toString(36).substring(2, 15);
      const recoverySession = {
        xpriv,
        answers: params.answers,
        username: params.username,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        privateKey: '', // Dummy to match UserSession type
        publicKey: '',
        isUnlocked: false,
        recoveryQuestions: params.vaultData.recovery.questions // Store the original questions
      };
      
      // Store in memory-only map (not IndexedDB)
      activeSessions.set(`recovery_${sessionToken}`, recoverySession);
      logSessionState('RECOVERY_CREATED', `recovery_${sessionToken}`);
      
      return { success: true, sessionToken };
    } catch (error) {
      return { success: false };
    }
  },

  // Complete PIN reset - uses recovery session
  completePinReset: async (params: {
    sessionToken: string;
    newPin: string;
    password: string;
  }): Promise<{ success: boolean; pinSalt?: string }> => {
    await ensureWasmReady();
    const crypto = await ensureWasmReady();
    
    // Get recovery session
    const recoverySession = activeSessions.get(`recovery_${params.sessionToken}`);
    if (!recoverySession) {
      throw new Error('Invalid or expired recovery session');
    }
    
    // Get vault data
    const vaultData = await vaultDB.getVault(recoverySession.username);
    if (!vaultData) {
      throw new Error('Vault data not found');
    }
    
    // Verify password using the password verifier
    const passwordKeyResult = await handlers.deriveKey({
      password: params.password,
      salt: vaultData.salt
    });
    
    try {
      // Use password verifier if available (new vaults)
      if (vaultData.passwordVerifier) {
        const decrypted = await crypto.decryptData(vaultData.passwordVerifier, passwordKeyResult.key);
        if (decrypted !== 'NostrPass_Password_Verifier_v1') {
          throw new Error('Invalid password');
        }
      } else {
        // Fallback for old vaults - we can't verify password with the new scheme
        // For now, we'll have to trust that the user knows their password
        // In production, you might want to require migration or use recovery questions
      }
    } catch {
      throw new Error('Invalid password');
    }
    
    // Password is correct, proceed with PIN reset
    
    // Hash new PIN
    const encoder = new TextEncoder();
    const pinData = encoder.encode(params.newPin);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', pinData);
    const pinHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Derive new PIN key
    const pinKeyResult = await handlers.deriveKey({
      password: params.newPin
    });
    
    // Encrypt xpriv with new PIN only
    if (!recoverySession.xpriv) {
      throw new Error('No xpriv found in recovery session');
    }
    const finalEncryptedXpriv = await crypto.encryptData(
      recoverySession.xpriv,
      pinKeyResult.key
    );
    
    // Update recovery data with the same answers that were just used
    // We MUST update the recovery data because the xpriv might have changed due to PIN reset
    let updatedRecovery = vaultData.recovery;
    if (recoverySession.answers && recoverySession.recoveryQuestions) {
      const concatenated = recoverySession.answers
        .map(a => a.toLowerCase().trim())
        .join('|');
      const newRecoveryKeyResult = await handlers.deriveKey({
        password: concatenated
      });
      
      const newXprivRecovery = await crypto.encryptData(
        recoverySession.xpriv!,
        newRecoveryKeyResult.key
      );
      
      updatedRecovery = {
        questions: recoverySession.recoveryQuestions, // Use the original questions
        xprivRecovery: newXprivRecovery,
        salt: newRecoveryKeyResult.salt,
        version: 1
      };
      
    }
    
    // Create new password verifier with the provided password
    const newPasswordVerifier = await crypto.encryptData(
      'NostrPass_Password_Verifier_v1',
      passwordKeyResult.key
    );

    // Update vault data
    const updatedVaultData = {
      ...vaultData,
      encryptedXpriv: finalEncryptedXpriv,
      pinSalt: pinKeyResult.salt,
      pinHash,
      recovery: updatedRecovery,
      passwordVerifier: newPasswordVerifier,
      updatedAt: Date.now()
    };
    
    // Save to IndexedDB
    await vaultDB.saveVault(updatedVaultData);
    
    // Clean up recovery session
    activeSessions.delete(`recovery_${params.sessionToken}`);
    logSessionState('RECOVERY_CLEARED', `recovery_${params.sessionToken}`);
    
    return { 
      success: true,
      pinSalt: pinKeyResult.salt
    };
  },

  // Simple login - store vault data and password key for PIN unlock
  loginUser: async (params: { 
    username: string; 
    vaultData: VaultData;
  }): Promise<{ success: boolean }> => {
    await ensureWasmReady();
    
   
    
    // Store vault data in IndexedDB - this IS our session
    await vaultDB.saveVault(params.vaultData);
    
    // Create minimal session in memory
    const session: ExtendedSession = {
      username: params.username,
      publicKey: params.vaultData.publicKey,
      isUnlocked: false, // Not unlocked until PIN entered
      unlockedAt: Date.now()
    };
    
    activeSessions.set(params.username, session);
    logSessionState('USER_LOGGED_IN', params.username);
    
    // Broadcast login event to all tabs
    broadcastVaultUpdate(params.username, 'USER_LOGGED_IN', {
      username: params.username,
      publicKey: params.vaultData.publicKey
    });
    
    return { success: true };
  },

  // Check if user is logged in (has vault data)
  isUserLoggedIn: async (params: { username: string }): Promise<{ loggedIn: boolean }> => {
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    return { loggedIn: !!vaultData };
  },
  
  // Get password key from session (for PIN unlock)

  // Simple logout - just clear vault data
  logoutUser: async (params: { username: string }): Promise<{ success: boolean }> => {
    await ensureWasmReady();
    
    
    // Remove from active sessions
    activeSessions.delete(params.username);
    
    // Clear vault from IndexedDB - this removes the "logged in" state
    await vaultDB.deleteVault(params.username);
    
    logSessionState('USER_LOGGED_OUT', params.username);
    
    // Broadcast logout event to all tabs
    broadcastVaultUpdate(params.username, 'USER_LOGGED_OUT', {
      username: params.username
    });
    
    return { success: true };
  },

  loadVaultFromNostr: async (params: { 
    username: string; 
    encryptedContent: string; 
    storagePublicKey: string 
  }): Promise<VaultData> => {
    await ensureWasmReady();
    
    
    // Get session to access xpriv
    const session = activeSessions.get(params.username);
    if (!session || !(session as any).xpriv) {
      throw new Error('Session does not have xpriv access. Cannot decrypt vault.');
    }
    
    const xpriv = (session as any).xpriv;
    
    // Get the storage keypair
    const STORAGE_INDEX = 2147483647;
    const derived = await handlers.deriveKeypairFromXpriv({ 
      xpriv,
      index: STORAGE_INDEX 
    });
    
    // Verify the storage public key matches
    if (derived.publicKey !== params.storagePublicKey) {
      throw new Error('Storage public key mismatch. This vault belongs to a different account.');
    }
    
    // Decrypt vault data using NIP-04 decryption
    const crypto = await ensureWasmReady();
    
    const decryptedContent = crypto.nip04Decrypt(
      params.encryptedContent,
      derived.privateKey,
      derived.publicKey
    );
    
    // Parse and return the vault data
    const vaultData = JSON.parse(decryptedContent) as VaultData;
    return vaultData;
  },

  saveVaultToNostr: async (params: { 
    username: string;
  }): Promise<{ event: any }> => {
    try {
      console.log('[Worker] saveVaultToNostr called for:', params.username);
      
      await ensureWasmReady();
      console.log('[Worker] WASM ready');
      
      // Get vault data
      const vaultData = await vaultDB.getVault(params.username);
      if (!vaultData) {
        throw new Error('No vault found for user');
      }
      console.log('[Worker] Vault data retrieved, identities count:', vaultData.identities?.length || 0);
      
      // Get session to check if unlocked
      const session = activeSessions.get(params.username);
      console.log('[Worker] Session found:', !!session, {
        hasXpriv: !!(session && (session as any).xpriv),
        hasStorageKey: !!(session && (session as any).storagePrivateKey)
      });

      // Allow publishing if either xpriv is present or storage keypair is cached
      const hasStorageSigning = !!(session && ((session as any).xpriv || (session as any).storagePrivateKey));
      if (!hasStorageSigning) {
        throw new Error('No xpriv access - vault must be unlocked');
      }
      
      const crypto = await ensureWasmReady();
      let signedEvent: any;
      
      let storagePrivateKey = (session as any).storagePrivateKey as string | undefined;
      let storagePublicKey = (session as any).storagePublicKey as string | undefined;

      if (!storagePrivateKey || !storagePublicKey) {
        // Fallback: derive on demand from xpriv
        const xpriv = (session as any).xpriv as string;
        console.log('[Worker] Deriving storage keypair from xpriv...');
        const STORAGE_INDEX = 2147483647;
        const derived = await handlers.deriveKeypairFromXpriv({ 
          xpriv,
          index: STORAGE_INDEX 
        });
        storagePrivateKey = derived.privateKey;
        storagePublicKey = derived.publicKey;
        console.log('[Worker] Storage keypair derived from xpriv (pubkey prefix):', storagePublicKey.substring(0, 16));
      } else {
        console.log('[Worker] Using cached storage keypair (pubkey prefix):', storagePublicKey.substring(0, 16));
      }
      
      // Create VaultObj from VaultData
      const vaultObj = {
        username: vaultData.username,
        identities: vaultData.identities,
        xprivEncrypted: vaultData.xprivEncrypted,
        xprivRecovery: vaultData.recovery?.xprivRecovery || '',
        recovery: vaultData.recovery ? {
          questions: vaultData.recovery.questions,
          salt: vaultData.recovery.salt,
          version: vaultData.recovery.version
        } : undefined,
        salt: vaultData.salt,
        version: (vaultData.version || 1) + 1,
        updatedAt: Date.now()
      };
      
      // Store as plain JSON (no additional encryption needed)
      const vaultContent = JSON.stringify(vaultObj);
      console.log('[Worker] VaultObj created, content length:', vaultContent.length);
      
      // Create vault event
      const vaultEvent = {
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `nostrpass.com_vault_${storagePublicKey}_${getEnvironment()}`],
          ['subject', 'encrypted-vault'],
          ['client', 'nostrpass.com'],
          ['version', String(vaultObj.version)]
        ],
        content: vaultContent,
        pubkey: storagePublicKey,
      };
      console.log('[Worker] Vault event created, signing...');
      
      try {
        // Sign with storage key
        signedEvent = crypto.signEvent(vaultEvent, storagePrivateKey);
        console.log('[Worker] Vault event signed successfully, event ID:', signedEvent.id);
      } catch (signError) {
        console.error('[Worker] Event signing failed:', signError);
        throw new Error(`Event signing failed: ${signError instanceof Error ? signError.message : 'Unknown error'}`);
      }
      
      return { event: signedEvent };
    } catch (error) {
      console.error('[Worker] saveVaultToNostr error:', error);
      throw error;
    }
  },

  // Get LoginObj from Nostr
  getLoginObj: async (params: { 
    username: string; 
    environment: string;
  }): Promise<{ loginObj: any } | null> => {
    try {
      console.log('[Worker] getLoginObj called for:', params.username);
      
      // Import Nostr helpers
      const { getLoginObj } = await import('@nostrpass/nostrHelpers');
      
      // Get relays from environment
      const { getRelays } = await import('../providers/EnvironmentProvider');
      const relays = getRelays();
      
      // Get LoginObj from Nostr
      const loginObj = await getLoginObj(params.username, params.environment, relays);
      
      if (loginObj) {
        console.log('[Worker] LoginObj found:', {
          storagePublicKey: loginObj.storagePublicKey,
          username: loginObj.username
        });
        return { loginObj };
      } else {
        console.log('[Worker] No LoginObj found for username:', params.username);
        return null;
      }
    } catch (error) {
      console.error('[Worker] getLoginObj error:', error);
      throw error;
    }
  },

  // Get current session status
  getSessionStatus: async (): Promise<{ sessionId: string | null; username: string | null }> => {
    try {
      console.log('[Worker] getSessionStatus called, activeSessions size:', activeSessions.size);
      console.log('[Worker] activeSessions entries:', Array.from(activeSessions.entries()));
      
      // First check in-memory sessions (including restored locked sessions)
      for (const [username, session] of activeSessions.entries()) {
        console.log('[Worker] Checking in-memory session for:', username, {
          isUnlocked: session.isUnlocked,
          hasXpriv: !!session.xpriv,
          expiresAt: session.expiresAt
        });
        
        // Return any session that exists (unlocked or locked)
        // This includes sessions restored from IndexedDB on worker startup
        const sessionId = `${username}_${session.expiresAt || Date.now()}`;
        console.log('[Worker] Found session (locked or unlocked):', { sessionId, username, isUnlocked: session.isUnlocked });
        return { sessionId, username };
      }
      
      // If no in-memory sessions, check IndexedDB for any vault data
      console.log('[Worker] No in-memory sessions, checking IndexedDB...');
      
      // Get all vaults from IndexedDB
      const allVaults = await vaultDB.getAllVaults();
      
      if (allVaults.length > 0) {
        // Return the first vault found (most recent or primary user)
        const vaultData = allVaults[0];
        const sessionId = `${vaultData.username}_${Date.now()}`;
        console.log('[Worker] Found vault data in IndexedDB for:', vaultData.username);
        console.log('[Worker] Found persisted session:', { sessionId, username: vaultData.username });
        return { sessionId, username: vaultData.username };
      }
      
      console.log('[Worker] No active sessions found');
      return { sessionId: null, username: null };
    } catch (error) {
      console.error('[Worker] getSessionStatus error:', error);
      return { sessionId: null, username: null };
    }
  },

  // Get vault data from Nostr
  getVaultFromNostr: async (params: { 
    username: string;
  }): Promise<{ vaultData: any; eventId: string; timestamp: number } | null> => {
    try {
      console.log('[Worker] getVaultFromNostr called for:', params.username);
      
      await ensureWasmReady();
      
      // Get session to check if unlocked
      const session = activeSessions.get(params.username);
      if (!session || !session.xpriv) {
        throw new Error('No xpriv access - vault must be unlocked');
      }
      
      console.log('[Worker] Session xpriv type:', typeof session.xpriv);
      console.log('[Worker] Session xpriv length:', session.xpriv?.length);
      
      // Validate xpriv format
      if (typeof session.xpriv !== 'string' || session.xpriv.length === 0) {
        throw new Error('Invalid xpriv format in session');
      }
      
      // Get the storage keypair for decryption
      const STORAGE_INDEX = 2147483647;
      let derived;
      try {
        derived = await handlers.deriveKeypairFromXpriv({ 
          xpriv: session.xpriv,
          index: STORAGE_INDEX 
        });
      } catch (deriveError) {
        console.error('[Worker] Failed to derive keypair from xpriv:', deriveError);
        throw new Error(`Failed to derive storage keypair: ${deriveError instanceof Error ? deriveError.message : 'Unknown error'}`);
      }
      
      console.log('[Worker] Storage keypair derived for retrieval, pubkey:', derived.publicKey.substring(0, 16) + '...');
      
      // Get relays and fetch from Nostr
      const { getEvent } = await import('@nostrpass/nostrHelpers');
      const { getRelays } = await import('../providers/EnvironmentProvider');
      const relays = getRelays();
      
      // Create filter to find vault events
      const filter = {
        kinds: [30078],
        authors: [derived.publicKey],
        '#d': [`nostrpass.com_vault_${derived.publicKey}_${getEnvironment()}`],
        limit: 1
      };
      
      console.log('[Worker] Fetching vault from Nostr with filter:', filter);
      
      // Get the latest vault event
      const vaultEvent = await getEvent(relays, filter);
      if (!vaultEvent) {
        console.log('[Worker] No vault event found on Nostr');
        return null;
      }
      
      console.log('[Worker] Vault event found, event ID:', vaultEvent.id);
      
      // VaultObj is stored as plain JSON, no decryption needed
      const vaultData = JSON.parse(vaultEvent.content);
      console.log('[Worker] VaultObj parsed, identities count:', vaultData.identities?.length || 0);
      
      return {
        vaultData,
        eventId: vaultEvent.id,
        timestamp: vaultEvent.created_at * 1000 // Convert to milliseconds
      };
    } catch (error) {
      console.error('[Worker] getVaultFromNostr error:', error);
      throw error;
    }
  },

  // Check permissions for an operation
  checkPermission: async (params: { 
    username: string; 
    origin: string; 
    action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
    eventKind?: number;
  }): Promise<{ allowed: boolean; level: string; needsPrompt: boolean }> => {
    await ensureWasmReady();
    
    let session = activeSessions.get(params.username);
    if (!session || session.isUnlocked !== true) {
      // Attempt to rehydrate from persisted session metadata for cross-tab
      const stored = await vaultDB.getSession(params.username);
      const now = Date.now();
      const ok = !!stored && !!stored.isUnlocked && (!stored.expiresAt || stored.expiresAt > now);
      if (ok) {
        session = {
          username: stored.username,
          publicKey: stored.publicKey,
          isUnlocked: true,
          expiresAt: stored.expiresAt
        } as any;
        activeSessions.set(params.username, session as any);
      } else {
        return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
      }
    }
    
    // For sensitive actions, require actual keys present in-memory
    if (params.action === 'signEvent' || params.action === 'signData' || params.action === 'nip04') {
      const hasKeys = !!(session && (session.privateKey || (session as any).xpriv));
      if (!hasKeys) {
        return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
      }
    }
    
    // Get vault data to check permissions
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    
    // Select identity by active mapping and require authorization
    const activeIndex = vaultData.activeIdentityByApp?.[params.origin];
    if (activeIndex === undefined || activeIndex === null) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    const identity = vaultData.identities[activeIndex];
    if (!identity?.appPermissions) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    
    // Check app permissions
    const appPerms = identity.appPermissions[params.origin];
    if (!appPerms) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    
    let permissionLevel = 'DENY';
    
    // Check specific permission based on action
    if (params.action === 'signEvent' && params.eventKind !== undefined) {
      // Use permission categories from types
      const { getPermissionCategoryForKind } = await import('@nostrpass/types');
      const category = getPermissionCategoryForKind(params.eventKind);
      
      if (category && appPerms.permissions) {
        permissionLevel = appPerms.permissions[category] || 'DENY';
      } else {
        // Unknown kind or no permissions structure, deny by default
        permissionLevel = 'DENY';
      }
    } else if (params.action === 'signData') {
      permissionLevel = appPerms.permissions?.signData || 'DENY';
    } else if (params.action === 'getPublicKey') {
      permissionLevel = appPerms.getPublicKey || 'DENY';
    } else if (params.action === 'nip04') {
      permissionLevel = appPerms.permissions?.messaging || 'DENY';
    } else if (params.action === 'getRelays') {
      // For now, treat getRelays as social permission
      permissionLevel = appPerms.permissions?.social || 'DENY';
    }
    
    // Check session permissions for ASK_EVERYTIME
    let sessionGranted = false;
    if (permissionLevel === 'ASK_EVERYTIME' && appPerms.sessionPermissions) {
      const now = Date.now();
      if (appPerms.sessionPermissions.expiresAt > now) {
        if (params.action === 'signEvent' && params.eventKind !== undefined) {
          const { getPermissionCategoryForKind } = await import('@nostrpass/types');
          const category = getPermissionCategoryForKind(params.eventKind);
          if (category) {
            sessionGranted = appPerms.sessionPermissions[category] === true;
          }
        } else if (params.action === 'signData') {
          sessionGranted = appPerms.sessionPermissions.signData === true;
        } else if (params.action === 'nip04') {
          sessionGranted = appPerms.sessionPermissions.messaging === true;
        }
      }
    }
    
    return {
      allowed: permissionLevel === 'ALLOW' || (permissionLevel === 'ASK_EVERYTIME' && sessionGranted),
      level: permissionLevel,
      needsPrompt: permissionLevel === 'ASK_EVERYTIME' && !sessionGranted
    };
  },

  // Grant session permission (for ASK_EVERYTIME operations)
  grantSessionPermission: async (params: {
    username: string;
    origin: string;
    action: 'signEvent' | 'signData';
    eventKind?: number;
    sessionDurationMinutes?: number;
  }): Promise<void> => {
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities) {
      throw new Error('Vault data not found');
    }
    
    const identity = vaultData.identities.find((id: any) => id?.appPermissions && id.appPermissions[params.origin]);
    if (!identity?.appPermissions?.[params.origin]) {
      throw new Error('App permissions not found');
    }
    
    const expiresAt = Date.now() + ((params.sessionDurationMinutes || 60) * 60 * 1000);
    
    // Initialize session permissions if needed
    if (!identity.appPermissions[params.origin].sessionPermissions) {
      identity.appPermissions[params.origin].sessionPermissions = {
        social: false,
        messaging: false,
        signData: false,
        financial: false,
        expiresAt
      };
    }
    
    // Grant permission based on action
    if (params.action === 'signEvent' && params.eventKind !== undefined) {
      const { getPermissionCategoryForKind } = await import('@nostrpass/types');
      const category = getPermissionCategoryForKind(params.eventKind);
      if (category) {
        identity.appPermissions[params.origin].sessionPermissions[category] = true;
      }
    } else if (params.action === 'signData') {
      identity.appPermissions[params.origin].sessionPermissions.signData = true;
    }
    
    // Update expiration
    identity.appPermissions[params.origin].sessionPermissions.expiresAt = expiresAt;
    
    // Update vault data
    await vaultDB.saveVault(vaultData);
  },

  // Get app permissions for an origin
  getAppPermissions: async (params: { username: string; origin: string }): Promise<any> => {
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities || vaultData.identities.length === 0) return null;
    const identity = vaultData.identities[0];

    return identity?.appPermissions?.[params.origin] || null;
  },

  // Save app permissions
  saveAppPermissions: async (params: {
    username: string;
    origin: string;
    permissions: any;
    appName?: string;
  }): Promise<void> => {
    console.log('[Worker] saveAppPermissions called with:', params);
    await ensureWasmReady();
    console.log('[Worker] WASM ready');
    
    const vaultData = await vaultDB.getVault(params.username);
    console.log('[Worker] Vault data retrieved, identities count:', vaultData?.identities?.length);
    if (!vaultData?.identities) {
      throw new Error('Vault data not found');
    }
    
    const identity = vaultData.identities[0];
    console.log('[Worker] Using identity index:', 0);
    
    // Initialize app permissions if needed
    if (!identity.appPermissions) {
      identity.appPermissions = {};
    }
    
    const existingPerms = identity.appPermissions[params.origin];
    console.log('[Worker] Existing permissions for origin:', !!existingPerms);
    
    // Create updated permissions object with proper structure
    const updatedPermissions = {
      appId: params.origin,
      appName: params.appName || existingPerms?.appName,
      grantedAt: existingPerms?.grantedAt || Date.now(),
      lastUsedAt: Date.now(),
      
      // Handle the new permission structure
      permissions: {
        // Preserve existing permissions or use defaults
        social: params.permissions.social || existingPerms?.permissions?.social || 'ASK_EVERYTIME',
        messaging: params.permissions.messaging || existingPerms?.permissions?.messaging || 'ASK_EVERYTIME',
        signData: params.permissions.signData || existingPerms?.permissions?.signData || 'ASK_EVERYTIME',
        financial: params.permissions.financial || existingPerms?.permissions?.financial || 'ASK_EVERYTIME',
      },
      
      // Handle getPublicKey permission
      getPublicKey: params.permissions.getPublicKey || existingPerms?.getPublicKey || 'ALLOW',
      
      // Preserve session permissions
      sessionPermissions: existingPerms?.sessionPermissions,
      
      // Preserve any other existing fields
      ...existingPerms,
      
      // Override with new values
      ...params.permissions
    };
    
    identity.appPermissions[params.origin] = updatedPermissions;
    console.log('[Worker] Updated permissions for origin:', params.origin);
    console.log('[Worker] Updated permissions object:', JSON.stringify(updatedPermissions, null, 2));
    
    // Update vault data
    console.log('[Worker] Saving vault data...');
    await vaultDB.saveVault(vaultData);
    console.log('[Worker] Vault data saved successfully');
    console.log('[Worker] Final vault data structure:', JSON.stringify({
        identities: vaultData.identities?.map(id => ({
            nickname: id.nickname,
            appPermissions: id.appPermissions ? Object.keys(id.appPermissions) : []
        }))
    }, null, 2));
    console.log('[Worker] saveAppPermissions completed successfully');
  },
};

// Helper to get environment
function getEnvironment(): string {
  // In worker context, we might need to get this differently
  // For now, default to development
  return 'development';
}

export type CryptoWorkerMethods = typeof handlers;

// Initialize the worker host (works for both Dedicated and Shared workers)
const host = createWorkerHost(handlers as any);


// Pre-initialize WASM on worker startup
ensureWasmReady()
  .then(() => {
    // WASM crypto module ready
  })
  .catch(() => {
    // Error initializing WASM
  });

// Check for expired sessions and notify
// Auto-expiry disabled: no periodic expiry checks

