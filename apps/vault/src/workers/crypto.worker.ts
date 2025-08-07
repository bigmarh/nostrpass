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
    
    // Use BroadcastChannel to communicate between tabs
    if (typeof BroadcastChannel !== 'undefined') {
      const broadcastChannel = new BroadcastChannel('nostrpass-vault');
      broadcastChannel.postMessage(message);
      console.log('[Worker] Broadcast message sent via BroadcastChannel');
    } else {
      // Fallback to postMessage for same tab
      self.postMessage(message);
      console.log('[Worker] Broadcast message sent via postMessage (fallback)');
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
    try {
      // Use key directly if provided, otherwise use password
      const decryptionKey = params.key || params.password;
      if (!decryptionKey) {
        throw new Error('Either key or password must be provided');
      }
      
      if (!params.encryptedData) {
        throw new Error('encryptedData is required');
      }
      
      const crypto = await ensureWasmReady();
      const result = crypto.decryptData(params.encryptedData, decryptionKey);
      return result;
    } catch (error) {
      throw error;
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
    
    // Create session
    const sessionTimeout = params.sessionTimeout || 60; // default 60 minutes
    const expiresAt = Date.now() + (sessionTimeout * 60 * 1000);
    
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
    session.expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    
    // Store xpriv if provided for storage key access
    if (params.xpriv) {
      console.log('[Worker] Storing xpriv in session:', {
        type: typeof params.xpriv,
        length: params.xpriv.length,
        prefix: params.xpriv.substring(0, 4),
        suffix: params.xpriv.substring(params.xpriv.length - 4)
      });
      
      // Validate xpriv format (should start with 'xprv' for mainnet)
      if (!params.xpriv.startsWith('xprv') && !params.xpriv.startsWith('tprv')) {
        console.warn('[Worker] WARNING: xpriv has unexpected format');
      }
      
      (session as any).xpriv = params.xpriv;
    }
    
    activeSessions.set(params.username, session);
    logSessionState('UNLOCKED', params.username);
    
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
    
    // Check DB for vault info
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
      throw new Error('Session not unlocked (no xpriv)');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    let privateKey: string;
    
    // If identity index provided and we have xpriv, derive that identity's key
    if (params.identityIndex !== undefined && (session as any).xpriv) {
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv: (session as any).xpriv,
        index: params.identityIndex 
      });
      privateKey = derived.privateKey;
    } else if (session.privateKey) {
      // Use session's private key (current identity)
      privateKey = session.privateKey;
    } else {
      throw new Error('No private key available in session');
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
      throw new Error('Vault is locked (no xpriv)');
    }
    
    // Check if we have xpriv in session
    const xpriv = (session as any).xpriv;
    if (!xpriv) {
      throw new Error('Session does not have xpriv access. Unlock vault with PIN first.');
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

  // Sign arbitrary message with active session
  signMessageWithSession: async (params: { username: string; message: string }): Promise<SignMessageResult> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session not unlocked (no xpriv)');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if (!privateKey && (session as any).xpriv) {
      // Derive private key from xpriv if needed
      const crypto = await ensureWasmReady();
      const identity = await vaultDB.getVault(params.username);
      if (identity?.identities) {
        const currentIdentity = identity.identities[identity.currentIdentityIndex || 0];
        const keypair = crypto.deriveKeypairFromXpriv((session as any).xpriv, currentIdentity.index || 0);
        privateKey = keypair.privateKey;
      }
    }
    
    if (!privateKey) {
      throw new Error('No private key available');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    const crypto = await ensureWasmReady();
    return { signature: crypto.signMessage(params.message, privateKey) };
  },

  // Encrypt with active session
  encryptWithSession: async (params: { username: string; plaintext: string; recipientPubkey: string }): Promise<string> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session not unlocked (no xpriv)');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if (!privateKey && (session as any).xpriv) {
      // Derive private key from xpriv if needed
      const crypto = await ensureWasmReady();
      const identity = await vaultDB.getVault(params.username);
      if (identity?.identities) {
        const currentIdentity = identity.identities[identity.currentIdentityIndex || 0];
        const keypair = crypto.deriveKeypairFromXpriv((session as any).xpriv, currentIdentity.index || 0);
        privateKey = keypair.privateKey;
      }
    }
    
    if (!privateKey) {
      throw new Error('No private key available');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    const crypto = await ensureWasmReady();
    return crypto.nip04Encrypt(
      params.plaintext,
      privateKey,
      params.recipientPubkey
    );
  },

  // Decrypt with active session
  decryptWithSession: async (params: { username: string; ciphertext: string; senderPubkey: string }): Promise<string> => {
    await ensureWasmReady();
    
    const session = activeSessions.get(params.username);
    if (!session || (!session.isUnlocked && !(session as any).xpriv)) {
      throw new Error('Session not unlocked (no xpriv)');
    }
    
    // Get private key from session or derive from xpriv
    let privateKey = session.privateKey;
    if (!privateKey && (session as any).xpriv) {
      // Derive private key from xpriv if needed
      const crypto = await ensureWasmReady();
      const identity = await vaultDB.getVault(params.username);
      if (identity?.identities) {
        const currentIdentity = identity.identities[identity.currentIdentityIndex || 0];
        const keypair = crypto.deriveKeypairFromXpriv((session as any).xpriv, currentIdentity.index || 0);
        privateKey = keypair.privateKey;
      }
    }
    
    if (!privateKey) {
      throw new Error('No private key available');
    }
    
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    const crypto = await ensureWasmReady();
    return crypto.nip04Decrypt(
      params.ciphertext,
      privateKey,
      params.senderPubkey
    );
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
    usePasswordEncryption?: boolean; // Force password encryption for initial save
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
      console.log('[Worker] Session found:', !!session, 'has xpriv:', !!(session && session.xpriv));
      
      // Check if we have xpriv access
      const hasXpriv = session && session.xpriv;
      
      if (!hasXpriv) {
        throw new Error('No xpriv access - vault must be unlocked');
      }
      
      // For initial save, we MUST use password encryption
      const usePasswordEncryption = params.usePasswordEncryption || false;
      
      const crypto = await ensureWasmReady();
      let signedEvent: any;
      
      // We always need xpriv to derive the storage key for signing
      if (!hasXpriv) {
        throw new Error('Cannot save vault without xpriv - vault must be unlocked');
      }
      
      const xpriv = session!.xpriv!; // We already checked hasXpriv above
      console.log('[Worker] Xpriv available, deriving storage keypair...');
      
      // Get the storage keypair for signing
      const STORAGE_INDEX = 2147483647;
      const derived = await handlers.deriveKeypairFromXpriv({ 
        xpriv,
        index: STORAGE_INDEX 
      });
      console.log('[Worker] Storage keypair derived, pubkey:', derived.publicKey.substring(0, 16) + '...');
      
      // Prepare vault content
      let vaultContent: string;
      
      if (usePasswordEncryption) {
        // INITIAL SAVE: No additional encryption, vault is already password+PIN encrypted
        vaultContent = JSON.stringify({
          ...vaultData,
          version: 1
        });
        console.log('[Worker] Using password encryption mode');
      } else {
        // SUBSEQUENT SAVES: Add NIP-04 encryption layer
        const vaultDataString = JSON.stringify({
          ...vaultData,
          version: (vaultData.version || 1) + 1
        });
        
        console.log('[Worker] Encrypting vault data with storage key...');
        console.log('[Worker] Vault data string length:', vaultDataString.length);
        console.log('[Worker] Private key length:', derived.privateKey.length);
        console.log('[Worker] Public key length:', derived.publicKey.length);
        
        try {
          // Use the private key as the encryption key for additional security
          vaultContent = crypto.encryptData(vaultDataString, derived.privateKey);
          console.log('[Worker] Vault data encrypted, content length:', vaultContent.length);
        } catch (encryptError) {
          console.error('[Worker] Data encryption failed:', encryptError);
          throw new Error(`Data encryption failed: ${encryptError instanceof Error ? encryptError.message : 'Unknown error'}`);
        }
      }
      
      // Create vault event
      const vaultEvent = {
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `nostrpass.com_vault_${getEnvironment()}_${derived.publicKey}`],
          ['subject', 'encrypted-vault'],
          ['client', 'nostrpass.com'],
          ['version', String(vaultData.version || 1)]
        ],
        content: vaultContent,
        pubkey: derived.publicKey,
      };
      console.log('[Worker] Vault event created, signing...');
      
      try {
        // Sign with storage key
        signedEvent = crypto.signEvent(vaultEvent, derived.privateKey);
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
        '#d': [`nostrpass.com_vault_${getEnvironment()}_${derived.publicKey}`],
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
      
      // Decrypt the vault content
      let vaultDataString: string;
      const crypto = await ensureWasmReady();
      try {
        // Try to decrypt with storage key (for subsequent saves)
        vaultDataString = crypto.decryptData(vaultEvent.content, derived.privateKey);
        console.log('[Worker] Vault data decrypted with storage key');
      } catch (decryptError) {
        console.log('[Worker] Storage key decryption failed, trying password encryption...');
        // If that fails, try password encryption (for initial saves)
        vaultDataString = vaultEvent.content;
      }
      
      // Parse the vault data
      const vaultData = JSON.parse(vaultDataString);
      console.log('[Worker] Vault data parsed, identities count:', vaultData.identities?.length || 0);
      
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
    
    const session = activeSessions.get(params.username);
    if (!session) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    
    // Get vault data to check permissions
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities) {
      return { allowed: false, level: 'ASK_EVERYTIME', needsPrompt: true };
    }
    
    // Get current identity
    const currentIndex = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[currentIndex];
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
      // Use simplified permission categories
      const { getPermissionCategoryForKind } = await import('@nostrpass/types');
      const category = getPermissionCategoryForKind(params.eventKind);
      
      if (category) {
        permissionLevel = appPerms.permissions[category];
      } else {
        // Unknown kind, deny by default
        permissionLevel = 'DENY';
      }
    } else if (params.action === 'signData') {
      permissionLevel = appPerms.permissions.signData;
    } else if (params.action === 'getPublicKey') {
      permissionLevel = appPerms.getPublicKey;
    } else if (params.action === 'nip04') {
      permissionLevel = appPerms.permissions.messaging;
    } else if (params.action === 'getRelays') {
      // For now, treat getRelays as social permission
      permissionLevel = appPerms.permissions.social;
    }
    
    // Check session permissions for ASK_EVERYTIME (simplified - no ASK_PER_SESSION)
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
    
    const currentIndex = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[currentIndex];
    if (!identity?.appPermissions?.[params.origin]) {
      throw new Error('App permissions not found');
    }
    
    const expiresAt = Date.now() + ((params.sessionDurationMinutes || 60) * 60 * 1000);
    
    if (!identity.appPermissions[params.origin].sessionPermissions) {
      identity.appPermissions[params.origin].sessionPermissions = {
        social: false,
        messaging: false,
        signData: false,
        financial: false,
        expiresAt
      };
    }
    
    if (params.action === 'signEvent' && params.eventKind !== undefined) {
      const { getPermissionCategoryForKind } = await import('@nostrpass/types');
      const category = getPermissionCategoryForKind(params.eventKind);
      if (category) {
        identity.appPermissions[params.origin].sessionPermissions[category] = true;
      }
    } else if (params.action === 'signData') {
      identity.appPermissions[params.origin].sessionPermissions.signData = true;
    }
    
    identity.appPermissions[params.origin].sessionPermissions.expiresAt = expiresAt;
    
    // Update vault data
    await vaultDB.saveVault(vaultData);
  },

  // Get app permissions for an origin
  getAppPermissions: async (params: { username: string; origin: string }): Promise<any> => {
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities) return null;
    
    const currentIndex = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[currentIndex];
    
    return identity?.appPermissions?.[params.origin] || null;
  },

  // Save app permissions
  saveAppPermissions: async (params: {
    username: string;
    origin: string;
    permissions: any;
    appName?: string;
  }): Promise<void> => {
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData?.identities) {
      throw new Error('Vault data not found');
    }
    
    const currentIndex = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[currentIndex];
    if (!identity) {
      throw new Error('Identity not found');
    }
    
    // Initialize app permissions if needed
    if (!identity.appPermissions) {
      identity.appPermissions = {};
    }
    
    const existingPerms = identity.appPermissions[params.origin];
    
    const updatedPermissions = {
      appId: params.origin,
      appName: params.appName || existingPerms?.appName,
      grantedAt: existingPerms?.grantedAt || Date.now(),
      lastUsedAt: Date.now(),
      kinds: params.permissions.kinds || existingPerms?.kinds || {},
      signData: params.permissions.signData || existingPerms?.signData || 'DENY',
      getPublicKey: params.permissions.getPublicKey || existingPerms?.getPublicKey,
      nip04: params.permissions.nip04 || existingPerms?.nip04,
      getRelays: params.permissions.getRelays || existingPerms?.getRelays,
      sessionPermissions: params.permissions.sessionPermissions || existingPerms?.sessionPermissions
    };
    
    identity.appPermissions[params.origin] = updatedPermissions;
    
    // Update vault data
    await vaultDB.saveVault(vaultData);
  },
};

// Helper to get environment
function getEnvironment(): string {
  // In worker context, we might need to get this differently
  // For now, default to development
  return 'development';
}

export type CryptoWorkerMethods = typeof handlers;

// Initialize the worker host
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
const checkSessionExpiry = () => {
  const now = Date.now();
  
  activeSessions.forEach((session, username) => {
    if (session.expiresAt && session.expiresAt <= now && session.isUnlocked) {
      // Mark session as locked
      session.isUnlocked = false;
      
      // Notify the vault UI
      self.postMessage({
        type: 'SESSION_EXPIRED',
        data: {
          username,
          expiredAt: new Date(session.expiresAt).toISOString()
        }
      });
      
      // Remove from active sessions
      activeSessions.delete(username);
      logSessionState('EXPIRED', username);
    }
  });
};

// Check for expired sessions every 30 seconds
setInterval(checkSessionExpiry, 30000);

