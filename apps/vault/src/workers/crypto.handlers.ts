import init, { NostrCrypto } from './wasm/nostrpass_crypto.js';
import { encrypt as nip04EncryptJS, decrypt as nip04DecryptJS } from 'nostr-tools/nip04';
import { vaultDB, type VaultData, type UserSession } from './db';

/**
 * Handler architecture and naming
 *
 * There are two layers of crypto operations in this worker:
 *
 * 1) Primitive WASM functions (stateless) that require a raw key:
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
 * The “WithSession” suffix disambiguates these safe, session-backed handlers
 * from the raw-key primitives. External calls (Embassy/Vault APIs) must use
 * the session-aware handlers. The primitives are only used internally when
 * we already hold the key material.
 */

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
    // Load WASM module with explicit path
    try {
      // Try to load WASM from public folder
      const wasmUrl = '/nostrpass_crypto_bg.wasm';
      await init(wasmUrl);
    } catch (e) {
      console.warn('[Worker] Failed to load WASM from public folder, trying worker path:', e);
      try {
        // Try worker directory path
        const wasmUrl = '/src/workers/wasm/nostrpass_crypto_bg.wasm';
        await init(wasmUrl);
      } catch (e2) {
        console.warn('[Worker] Failed to load WASM with explicit URL, trying default:', e2);
        // Fallback to default initialization
        await init();
      }
    }
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
  // Initialize a locked session by saving vault data and seeding minimal session state
  initSession: async (params: { username: string; publicKey: string; vaultData: any }): Promise<{ success: boolean }> => {
    await ensureWasmReady();
    // Normalize vault data
    const vaultToSave = { ...params.vaultData };
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
      unlockedAt: Date.now()
    };
    activeSessions.set(params.username, session);
    logSessionState('SESSION_INIT', params.username);
    // Persist non-sensitive session status
    await vaultDB.saveSession({ username: params.username, publicKey: params.publicKey, isUnlocked: false } as any);
    // Broadcast login event
    broadcastVaultUpdate(params.username, 'USER_LOGGED_IN', { username: params.username, publicKey: params.publicKey });
    return { success: true };
  },

  // Sign a Nostr event using the current session keys for a specific identity
  signEventWithSession: async (params: { username: string; event: any; identityIndex: number }): Promise<{ event: any }> => {
    const crypto = await ensureWasmReady();
    const session = activeSessions.get(params.username);
    if (!session) throw new Error('No session found');

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
    const crypto = await ensureWasmReady();
    const session = activeSessions.get(params.username);
    if (!session) throw new Error('No session found');

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
    const crypto = await ensureWasmReady();
    const session = activeSessions.get(params.username);
    if (!session) throw new Error('No session found');

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
    const crypto = await ensureWasmReady();
    const session = activeSessions.get(params.username);
    if (!session) throw new Error('No session found');

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
    await ensureWasmReady();
    const row = await vaultDB.getXpriv(params.username);
    if (!row) return null;
    return row;
  },
  // Preflight: check if session has keys loaded
  hasKeysInSession: async (params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean; hasStorageKeypair: boolean }> => {
    await ensureWasmReady();
    const session = activeSessions.get(params.username);
    const hasPrivateKey = !!(session && session.privateKey);
    const hasXpriv = !!(session && (session as any).xpriv);
    const hasStorageKeypair = !!(session && (session as any).storagePrivateKey && (session as any).storagePublicKey);
    return { hasPrivateKey, hasXpriv, hasStorageKeypair };
  },

  // Generate a new master extended private key (xpriv)
  generateXpriv: async (): Promise<{ xpriv: string }> => {
    const crypto = await ensureWasmReady();
    const xpriv = crypto.generateXpriv();
    return { xpriv };
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
    await ensureWasmReady();
    return nip04EncryptJS(
      params.privateKey,
      params.recipientPubkey,
      params.plaintext
    );
  },

  decrypt: async (params: DecryptParams): Promise<string> => {
    await ensureWasmReady();
    return nip04DecryptJS(
      params.privateKey,
      params.senderPubkey,
      params.ciphertext
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
    
    return crypto.encryptData(params.data, encryptionKey);
  },

  decryptData: async (params: DecryptDataParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    
    // Use key directly if provided, otherwise use password
    const decryptionKey = params.key || params.password;
    if (!decryptionKey) {
      throw new Error('Either key or password must be provided');
    }
    
    return crypto.decryptData(params.encryptedData, decryptionKey);
  },

  deriveKeypairFromXpriv: async (params: { xpriv: string; index: number }): Promise<any> => {
    const crypto = await ensureWasmReady();
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

  // Add the vault management handlers
  createVault: async (params: CreateVaultParams): Promise<CreateVaultResult> => {
    const crypto = await ensureWasmReady();
    
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
    const crypto = await ensureWasmReady();
    
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
    
    // Update session
    const session: ExtendedSession = {
      username: params.username,
      publicKey: vaultData.publicKey,
      privateKey: decrypted.privateKey,
      xpriv: decrypted.xpriv,
      isUnlocked: true,
      unlockedAt: Date.now()
    };
    console.log('[Unlock] Session seeds:', {
      hasPrivateKey: !!session.privateKey,
      hasXpriv: !!session.xpriv
    });
    
    // Store recovery data if available
    if (vaultData.recoveryQuestions && vaultData.recoveryAnswers) {
      session.recoveryQuestions = vaultData.recoveryQuestions;
      session.answers = vaultData.recoveryAnswers;
    }
    
    activeSessions.set(params.username, session);
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
    await ensureWasmReady();
    const v = await vaultDB.getVault(params.username);
    const session = activeSessions.get(params.username) || {
      username: params.username,
      publicKey: v?.publicKey || '',
      isUnlocked: false,
      unlockedAt: Date.now()
    } as ExtendedSession;
    if (params.privateKey) session.privateKey = params.privateKey;
    if (params.xpriv) (session as any).xpriv = params.xpriv;
    session.isUnlocked = !!(session.privateKey || (session as any).xpriv);
    session.unlockedAt = Date.now();
    activeSessions.set(params.username, session);
    logSessionState('UNLOCKED_ALIAS', params.username);
    await vaultDB.saveSession({ username: params.username, publicKey: session.publicKey!, isUnlocked: session.isUnlocked } as any);
    broadcastVaultUpdate(params.username, 'SESSION_UNLOCKED', { username: params.username });
    return { success: true };
  },

  lockVault: async (params: LockVaultParams): Promise<void> => {
    await ensureWasmReady();
    
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
    await ensureWasmReady();
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
    await ensureWasmReady();
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
    await ensureWasmReady();
    
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
    const crypto = await ensureWasmReady();
    
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
    await ensureWasmReady();
    
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
    await ensureWasmReady();
    
    const vaultData = await vaultDB.getVault(params.username);
    return { exists: !!vaultData };
  },

  deleteVault: async (params: DeleteVaultParams): Promise<DeleteVaultResult> => {
    await ensureWasmReady();
    
    // Remove from active sessions
    activeSessions.delete(params.username);
    logSessionState('delete', params.username);
    
    // Delete from database
    await vaultDB.deleteVault(params.username);
    
    // Broadcast deletion
    broadcastVaultUpdate(params.username, 'VAULT_DELETED', {});
    
    return { success: true };
  },

  getVaultData: async (params: { username: string }): Promise<VaultData | null> => {
    await ensureWasmReady();
    
    // Get vault data from database
    const vaultData = await vaultDB.getVault(params.username);
    
    if (!vaultData) {
      return null;
    }
    
    // Return the vault data in the expected format
    return {
      username: vaultData.username,
      publicKey: vaultData.publicKey,
      xprivEncrypted: vaultData.encryptedVault,
      salt: vaultData.salt,
      identities: vaultData.identities || [],
      storagePublicKey: vaultData.publicKey,
      activeIdentityByApp: vaultData.activeIdentityByApp || {},
      lastSyncedAt: vaultData.lastSyncedAt,
      updatedAt: vaultData.updatedAt || vaultData.lastUnlocked,
      createdAt: vaultData.createdAt
    } as any;
  },

  // Update vault data atomically and broadcast change
  updateVaultData: async (params: { username: string; vaultData: any }): Promise<void> => {
    await ensureWasmReady();
    const toSave = { ...params.vaultData };
    // Ensure redundant fields are in sync (write primary -> encryptedVault for storage only)
    if (toSave.xprivEncrypted) {
      toSave.encryptedVault = toSave.xprivEncrypted;
    }
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
      await ensureWasmReady();
      
      // Prefer any active in-memory session
      if (activeSessions.size > 0) {
        for (const [uname, session] of activeSessions.entries()) {
          const sessionId = `${uname}_${session.unlockedAt || Date.now()}`;
          return { sessionId, username: uname };
        }
      }
      
      // Fallback: any vault in DB indicates a potential session (locked)
      const allVaults = await vaultDB.getAllVaults();
      if (allVaults && allVaults.length > 0) {
        const uname = allVaults[0].username;
        const sessionId = `${uname}_${Date.now()}`;
        return { sessionId, username: uname };
      }
      
      return { sessionId: null, username: null };
    } catch (error) {
      console.error('[Worker] Error in getSessionStatus:', error);
      return { sessionId: null, username: null };
    }
  }
  ,
  // Refresh session (broadcast to all tabs)
  refreshSession: async (params: { username: string }): Promise<{ success: boolean }> => {
    await ensureWasmReady();
    
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
    await ensureWasmReady();
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
    await ensureWasmReady();
    
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

  // Build a minimal vault event for Nostr publishing (fallback if WASM builder missing)
  saveVaultToNostr: async (params: { username: string }): Promise<{ event: any }> => {
    const crypto = await ensureWasmReady();
    const vault = await vaultDB.getVault(params.username);
    if (!vault) throw new Error('No vault to save');
    const session = (activeSessions as any).get(params.username);
    
    // Prefer storage keypair
    let pub = session?.storagePublicKey || vault.publicKey;
    let priv = session?.storagePrivateKey || session?.privateKey;
    
    if (!priv && session?.xpriv) {
      const STORAGE_INDEX = 1000000;
      const derived = await handlers.deriveKeypairFromXpriv({ xpriv: session.xpriv, index: STORAGE_INDEX });
      priv = (derived as any).privateKey;
      pub = (derived as any).publicKey;
      (session as any).storagePrivateKey = priv;
      (session as any).storagePublicKey = pub;
    }
    
    if (!priv) {
      throw new Error('No private key available for signing');
    }
    
    // Ensure pubkey corresponds to the private key used for signing
    try {
      const derivedPub = crypto.getPublicKey(String(priv));
      if (derivedPub && typeof derivedPub === 'string') {
        pub = derivedPub;
      }
    } catch {}
    
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
      encryptedVault: vault.xprivEncrypted || (vault as any).encryptedVault,
      salt: vault.salt,
      identities: vault.identities || [],
      activeIdentityByApp: vault.activeIdentityByApp || {},
      appPermissions: (vault as any).appPermissions || {},
      updatedAt: Date.now(),
      version: 1
    };
    
    // Build the event with strict string coercion for wasm expectations
    const dTag = String(`nostrpass.com_vault_${pub}_development`);
    const event = {
      kind: 30001 as number,
      content: String(JSON.stringify(payload)),
      tags: [[String('d'), dTag]] as string[][],
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
  }
};

// Export utility functions for worker initialization
export { ensureWasmReady, activeSessions, logSessionState };