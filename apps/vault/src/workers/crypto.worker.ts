import { createWorkerHost } from '@nostrpass/worker-messenger';
import init, { NostrCrypto } from './wasm/nostrpass_crypto.js';
import { vaultDB, type VaultData, type UserSession } from './db';

// Initialize WASM module
let wasmReady = false;
let cryptoInstance: NostrCrypto | null = null;

// Worker initialization timestamp
const workerInitTime = Date.now();
console.log('🚀 Worker initialized at:', new Date(workerInitTime).toISOString());

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
  console.log(`🔐 Session ${action} for ${username}. Total sessions: ${activeSessions.size}`);
  console.log('🔐 All usernames:', Array.from(activeSessions.keys()));
  
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
    console.log('WASM module initialized in worker');
    
    // Initialize database
    await vaultDB.init();
    console.log('IndexedDB initialized in worker');
    
    // Clear expired sessions on startup
    await vaultDB.clearExpiredSessions();
  }
  if (!cryptoInstance) {
    throw new Error('WASM crypto instance not initialized');
  }
  return cryptoInstance;
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
    console.log('🔑 deriveKey called with:', {
      password: params.password,
      passwordLength: params.password?.length,
      salt: params.salt,
      saltLength: params.salt?.length
    });
    
    const crypto = await ensureWasmReady();
    console.log('🔑 Calling WASM deriveKeyFromPassword with salt:', params.salt ? 'provided' : 'will-generate');
    const result = crypto.deriveKeyFromPassword(params.password, params.salt);
    
    // Handle if result is a Map (from serde_wasm_bindgen)
    if (result instanceof Map) {
      const derived = {
        key: result.get('key'),
        salt: result.get('salt'),
      };
      console.log('✅ deriveKey result (from Map):', {
        keyLength: derived.key?.length,
        saltLength: derived.salt?.length
      });
      return derived;
    }
    
    console.log('✅ deriveKey result:', {
      keyLength: result.key?.length,
      saltLength: result.salt?.length
    });
    return result;
  },

  encryptData: async (params: EncryptDataParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    
    // Use key directly if provided, otherwise use password
    const encryptionKey = params.key || params.password;
    if (!encryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    
    console.log('🔐 encryptData called with:', {
      dataLength: params.data?.length,
      usingKey: !!params.key,
      usingPassword: !!params.password
    });
    
    const result = crypto.encryptData(params.data, encryptionKey);
    console.log('✅ encryptData result:', {
      resultType: typeof result,
      resultLength: result?.length
    });
    return result;
  },

  decryptData: async (params: DecryptDataParams): Promise<string> => {
    try {
      // Use key directly if provided, otherwise use password
      const decryptionKey = params.key || params.password;
      if (!decryptionKey) {
        throw new Error('Either key or password must be provided');
      }
      
      console.log('🔐 decryptData called with:', {
        hasEncryptedData: !!params.encryptedData,
        encryptedDataLength: params.encryptedData?.length,
        encryptedDataType: typeof params.encryptedData,
        usingKey: !!params.key,
        usingPassword: !!params.password
      });
      
      if (!params.encryptedData) {
        throw new Error('encryptedData is required');
      }
      
      const crypto = await ensureWasmReady();
      const result = crypto.decryptData(params.encryptedData, decryptionKey);
      console.log('✅ decryptData successful');
      return result;
    } catch (error) {
      console.error('❌ decryptData failed:', error);
      throw error;
    }
  },

  generateXpriv: async (): Promise<GenerateXprivResult> => {
    const crypto = await ensureWasmReady();
    return { xpriv: crypto.generateXpriv() };
  },

  deriveKeypairFromXpriv: async (params: DeriveKeypairFromXprivParams): Promise<DeriveKeypairFromXprivResult> => {
    const crypto = await ensureWasmReady();
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
  },

  // Session management methods
  createSession: async (params: CreateSessionParams): Promise<SessionInfo> => {
    await ensureWasmReady();
    
    console.log('🆕 createSession called for:', params.username, {
      hasPrivateKey: !!params.privateKey,
      privateKeyEmpty: params.privateKey === '',
      hasXpriv: !!params.xpriv,
      willBeUnlocked: !!params.privateKey && params.privateKey !== ''
    });
    
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
      console.log('⚠️ Preventing overwrite of unlocked session with locked session');
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
    console.log('✅ Session created and stored:', {
      username: session.username,
      isUnlocked: session.isUnlocked,
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!session.xpriv,
      xprivLength: session.xpriv?.length
    });
    
    // Verify session was stored correctly
    const storedSession = activeSessions.get(params.username);
    console.log('🔍 Verification - session in map:', {
      found: !!storedSession,
      hasXpriv: !!(storedSession as any)?.xpriv
    });
    
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
    
    console.log('🔓 unlockSession called for:', params.username);
    
    // Get vault data from DB
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      throw new Error('No vault found for user');
    }
    
    // Update session
    const existingSession = activeSessions.get(params.username);
    console.log('🔍 Existing session before unlock:', existingSession ? 
      { username: existingSession.username, isUnlocked: existingSession.isUnlocked, hasXpriv: !!(existingSession as any).xpriv } : 
      'none');
    
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
      (session as any).xpriv = params.xpriv;
      console.log('✅ xpriv stored in session');
    }
    
    activeSessions.set(params.username, session);
    logSessionState('UNLOCKED', params.username);
    console.log('✅ Session unlocked and stored:', { 
      username: session.username, 
      isUnlocked: session.isUnlocked,
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!(session as any).xpriv,
      expiresAt: new Date(session.expiresAt).toISOString()
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
    
    console.log('🔍 getSession called for:', params.username);
    console.log('⏰ Worker uptime:', Math.floor((Date.now() - workerInitTime) / 1000), 'seconds');
    
    // Check in-memory session first
    console.log('🔍 Looking for session with username:', params.username);
    console.log('🗂️ Current sessions in memory:', {
      count: activeSessions.size,
      keys: Array.from(activeSessions.keys()),
      debug: (globalThis as any).__DEBUG_SESSIONS
    });
    const session = activeSessions.get(params.username);
    console.log('📋 Active session found:', session ? {
      username: session.username,
      isUnlocked: session.isUnlocked,
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!(session as any).xpriv,
      expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : 'none'
    } : 'none');
    
    if (session) {
      const now = Date.now();
      const expired = session.expiresAt && session.expiresAt <= now;
      console.log('📊 Session check:', {
        exists: true,
        expired,
        expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : 'none',
        timeLeft: session.expiresAt ? Math.floor((session.expiresAt - now) / 1000) + 's' : 'n/a'
      });
      
      if (!expired) {
        console.log('✅ Returning active session');
        return {
          username: session.username,
          publicKey: session.publicKey,
          isUnlocked: session.isUnlocked,
          expiresAt: session.expiresAt
        };
      } else {
        console.log('⚠️ Session expired, removing from memory');
        activeSessions.delete(params.username);
      }
    }
    
    // Check DB for vault info
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      console.log('❌ No vault data found');
      return null;
    }
    
    console.log('⚠️ Returning vault data with isUnlocked: false');
    return {
      username: vaultData.username,
      publicKey: vaultData.publicKey,
      isUnlocked: false
    };
  },

  clearSession: (params: GetSessionParams): void => {
    console.log('🗑️ clearSession called for:', params.username);
    const existingSession = activeSessions.get(params.username);
    if (existingSession) {
      console.log('🗑️ Clearing session memory only (keeping vault data):', {
        username: existingSession.username,
        wasUnlocked: existingSession.isUnlocked
      });
      
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
      
      logSessionState('LOCKED', params.username);
    } else {
      console.log('⚠️ No session found to clear');
    }
    console.log('🗑️ Session cleared from memory');
    
    // Note: We don't clear from DB on logout to preserve vault data
    // Sessions are only in-memory and expire naturally
  },

  // Get vault data (without sensitive keys)
  getVaultData: async (params: GetSessionParams): Promise<VaultData | null> => {
    await ensureWasmReady();
    return vaultDB.getVault(params.username);
  },
  
  // Update vault data
  updateVaultData: async (params: { username: string; vaultData: VaultData }): Promise<void> => {
    await ensureWasmReady();
    await vaultDB.saveVault(params.vaultData);
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
    console.log('Recovery attempt with answers:', params.answers);
    console.log('Raw answer values:', params.answers.map((a, i) => `[${i}]: "${a}" (length: ${a.length})`));
    const concatenated = params.answers
      .map(a => a.toLowerCase().trim())
      .join('|');
    console.log('Concatenated for recovery:', concatenated);
    console.log('Concatenated length:', concatenated.length);
    
    // Derive recovery key
    const recoveryKeyResult = await handlers.deriveKey({
      password: concatenated,
      salt: params.vaultData.recovery.salt
    });
    console.log('Using salt:', params.vaultData.recovery.salt);
    console.log('Recovery key result:', recoveryKeyResult);
    
    const recoveryKey = recoveryKeyResult.key;
    console.log('Recovery key derived:', recoveryKey ? 'Key present' : 'Key missing');
    
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
        console.warn('No password verifier found. Unable to verify password for PIN reset.');
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
      
      console.log('✅ Updated recovery data with same questions and answers');
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
    
    console.log('🔑 Logging in user:', params.username);
    console.log('📦 Vault data to save:', {
      username: params.vaultData.username,
      hasXprivEncryptedForPin: !!params.vaultData.xprivEncryptedForPin,
      xprivEncryptedForPinLength: params.vaultData.xprivEncryptedForPin?.length
    });
    
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
    
    console.log('✅ User logged in - vault data stored');
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
    
    console.log('🧹 Logging out user:', params.username);
    
    // Remove from active sessions
    activeSessions.delete(params.username);
    
    // Clear vault from IndexedDB - this removes the "logged in" state
    await vaultDB.deleteVault(params.username);
    
    logSessionState('USER_LOGGED_OUT', params.username);
    console.log('✅ User logged out - vault data cleared');
    return { success: true };
  },

  loadVaultFromNostr: async (params: { 
    username: string; 
    encryptedContent: string; 
    storagePublicKey: string 
  }): Promise<VaultData> => {
    await ensureWasmReady();
    
    console.log('📥 loadVaultFromNostr called for:', params.username);
    
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
    console.log('🔓 Decrypting vault data with storage key...');
    
    const decryptedContent = crypto.nip04Decrypt(
      params.encryptedContent,
      derived.privateKey,
      derived.publicKey
    );
    console.log('✅ Vault data decrypted');
    
    // Parse and return the vault data
    const vaultData = JSON.parse(decryptedContent) as VaultData;
    return vaultData;
  },

  saveVaultToNostr: async (params: { 
    username: string;
    usePasswordEncryption?: boolean; // Force password encryption for initial save
  }): Promise<{ event: any }> => {
    await ensureWasmReady();
    
    console.log('💾 saveVaultToNostr called for:', params.username, {
      usePasswordEncryption: params.usePasswordEncryption
    });
    
    // Get vault data
    const vaultData = await vaultDB.getVault(params.username);
    if (!vaultData) {
      console.error('❌ No vault found in IndexedDB for user:', params.username);
      throw new Error('No vault found for user');
    }
    
    console.log('📦 Vault data found:', {
      username: vaultData.username,
      hasXprivEncrypted: !!vaultData.xprivEncrypted,
      hasPublicKey: !!vaultData.publicKey,
      hasStoragePublicKey: !!vaultData.storagePublicKey
    });
    
    // Get session to check if unlocked
    console.log('🔍 Looking for session with username:', params.username);
    console.log('📋 Active sessions:', Array.from(activeSessions.keys()));
    
    const session = activeSessions.get(params.username);
    console.log('🔐 Session in saveVaultToNostr:', session ? {
      username: session.username,
      isUnlocked: session.isUnlocked,
      hasXpriv: !!session.xpriv,
      xprivLength: session.xpriv?.length,
      hasPasswordKey: !!(session as any).passwordKey
    } : 'none');
    
    // Check if we have xpriv access
    const hasXpriv = session && session.xpriv;
    
    if (!hasXpriv) {
      console.error('❌ No xpriv in session - cannot sign vault event');
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
    
    // Get the storage keypair for signing
    const STORAGE_INDEX = 2147483647;
    const derived = await handlers.deriveKeypairFromXpriv({ 
      xpriv,
      index: STORAGE_INDEX 
    });
    
    // Prepare vault content
    let vaultContent: string;
    
    if (usePasswordEncryption) {
      // INITIAL SAVE: No additional encryption, vault is already password+PIN encrypted
      console.log('📦 Initial vault save - no additional encryption');
      vaultContent = JSON.stringify({
        ...vaultData,
        version: 1
      });
    } else {
      // SUBSEQUENT SAVES: Add NIP-04 encryption layer
      console.log('🔐 Subsequent vault save - adding NIP-04 encryption');
      const vaultDataString = JSON.stringify({
        ...vaultData,
        version: (vaultData.version || 1) + 1
      });
      
      // Add NIP-04 encryption on top of password+PIN encryption
      vaultContent = crypto.nip04Encrypt(
        vaultDataString,
        derived.privateKey,
        derived.publicKey
      );
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
    
    // Sign with storage key
    signedEvent = crypto.signEvent(vaultEvent, derived.privateKey);
    console.log('✅ Vault event signed with storage key');
    
    return { event: signedEvent };
  },
};

// Helper to get environment
function getEnvironment(): string {
  // In worker context, we might need to get this differently
  // For now, default to development
  return 'development';
}

export type CryptoWorkerMethods = typeof handlers;

// Log available handler methods
console.log('📋 Registering handlers:', Object.keys(handlers));

// Initialize the worker host
const host = createWorkerHost(handlers as any);
console.log('✅ Worker host created');

// Add debugging for message handling
self.addEventListener('message', (event) => {
  console.log('🔵 Worker received message:', {
    method: event.data?.method,
    id: event.data?.id,
    hasParams: !!event.data?.params
  });
});

// Pre-initialize WASM on worker startup
ensureWasmReady()
  .then(() => {
    console.log('WASM crypto module ready');
  })
  .catch(console.error);

// Check for expired sessions and notify
const checkSessionExpiry = () => {
  const now = Date.now();
  
  activeSessions.forEach((session, username) => {
    if (session.expiresAt && session.expiresAt <= now && session.isUnlocked) {
      console.log('⏰ Session expired for:', username);
      
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

// Log every minute to show worker is alive
setInterval(() => {
  console.log('💓 Worker heartbeat:', {
    uptime: Math.floor((Date.now() - workerInitTime) / 1000) + 's',
    sessions: activeSessions.size,
    time: new Date().toISOString()
  });
}, 60000);