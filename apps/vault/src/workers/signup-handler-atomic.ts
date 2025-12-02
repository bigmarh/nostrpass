/**
 * Atomic Signup Handler
 *
 * Streamlined account creation in ONE atomic operation.
 * Replaces 15+ fragmented worker calls with 1 atomic call.
 *
 * Flow:
 * 1. Generate master key (xpriv) + identities
 * 2. Derive all keypairs (personal, storage)
 * 3. Encrypt with PIN + password
 * 4. Create vault objects (VaultData, LoginObj, VaultObj)
 * 5. Publish to Nostr (non-blocking background)
 * 6. Create unlocked session
 * 7. Broadcast AUTH_STATE_CHANGED
 *
 * Result: User is immediately logged in and unlocked, Nostr sync happens in background.
 */

import { getSessionStateManager, type CompleteSessionState } from './session-state-manager';
import { cryptoPrimitives } from './crypto-primitives';
import { vaultDB, type VaultData } from './db';
import type { Identity, LoginObj, VaultObj } from '@nostrpass/types';

/**
 * Broadcast auth state change to main thread and all tabs
 */
function broadcastAuthStateChanged(state: CompleteSessionState | null) {
  const message = {
    type: 'AUTH_STATE_CHANGED',
    state: state ? {
      isAuthenticated: state.isAuthenticated,
      isLocked: !state.isUnlocked,
      user: state.username ? {
        username: state.username,
        publicKey: state.publicKey,
        storagePublicKey: state.storagePublicKey
      } : null,
      sessionId: state.sessionId,
      vaultVersion: state.vaultVersion,
      identityCount: state.identityCount
    } : {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null
    }
  };

  // Send to main thread
  self.postMessage(message);

  // Send to all tabs via BroadcastChannel
  try {
    const channel = new BroadcastChannel('nostrpass-vault');
    channel.postMessage(message);
    channel.close();
  } catch (error) {
    console.error('[signup-handler-atomic] Failed to broadcast:', error);
  }
}

/**
 * Generate master key and identities
 */
async function generateMasterKey(): Promise<{
  xpriv: string;
  identities: Identity[];
}> {
  // Generate random seed
  const seed = cryptoPrimitives.generateRandomBytes({ length: 32 });

  // Derive master xpriv
  const xpriv = await cryptoPrimitives.deriveXprivFromSeed({ seed });

  // Create Personal identity (index 0)
  const personalKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
    xpriv,
    index: 0
  });

  const personalIdentity: Identity = {
    index: 0,
    nickname: 'Personal',
    publicKey: personalKeypair.publicKey,
    npub: await cryptoPrimitives.convertToNpub({ hex: personalKeypair.publicKey }),
    createdAt: Date.now(),
    appPermissions: {}
  };

  return {
    xpriv,
    identities: [personalIdentity]
  };
}

/**
 * Atomic account creation
 * ONE call replaces 15+ fragmented calls
 */
export async function handleAtomicCreateAccount(params: {
  username: string;
  password: string;
  pin: string;
  relays: string[];
  environment?: string;
  recovery?: {
    questions: string[];
    answers: string[];
  };
}) {
  const {
    username,
    password,
    pin,
    relays,
    environment = 'production',
    recovery
  } = params;

  console.log('[signup-atomic] Starting atomic account creation for:', username);

  // Validate inputs
  if (!pin || pin.length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }

  try {
    // ===== Step 1: Generate cryptographic material =====
    console.log('[signup-atomic] Generating master key...');
    const { xpriv, identities } = await generateMasterKey();
    const personalIdentity = identities[0];

    // Derive storage keypair (index 1337)
    const STORAGE_INDEX = 1337;
    const storageKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
      xpriv,
      index: STORAGE_INDEX
    });
    const storagePublicKey = storageKeypair.publicKey;
    const storagePrivateKey = storageKeypair.privateKey;

    // ===== Step 2: Derive encryption keys =====
    console.log('[signup-atomic] Deriving encryption keys...');

    // Derive password key for vault encryption
    const passwordDeriveResult = await cryptoPrimitives.deriveKey({ password });
    const passwordKey = passwordDeriveResult.key;
    const passwordSalt = passwordDeriveResult.salt;

    // Derive PIN salt for consistent encryption
    const pinDeriveResult = await cryptoPrimitives.deriveKey({ password: pin });
    const pinSalt = pinDeriveResult.salt;

    // ===== Step 3: Encrypt sensitive data =====
    console.log('[signup-atomic] Encrypting xpriv and storage keypair...');

    // Encrypt xpriv with PIN
    const xprivEncrypted = await cryptoPrimitives.encryptDataWithSalt({
      data: xpriv,
      password: pin,
      salt: pinSalt
    });

    // Encrypt storage keypair with PIN for LoginObj
    const storageKeypairJson = JSON.stringify({
      privateKey: storagePrivateKey,
      publicKey: storagePublicKey
    });
    const storageKeypairEncrypted = await cryptoPrimitives.encryptDataWithSalt({
      data: storageKeypairJson,
      password: pin,
      salt: pinSalt
    });

    // Create password verifier for login authentication
    const passwordVerifier = await cryptoPrimitives.encryptData({
      data: 'NostrPass_Password_Verifier_v1',
      password: passwordKey
    });

    // ===== Step 4: Handle recovery (if provided) =====
    let recoveryData: {
      questions: string[];
      xprivRecovery: string;
      salt: string;
      version: number;
    } | undefined;

    if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
      console.log('[signup-atomic] Creating recovery encryption...');
      const concatenated = recovery.answers
        .map(a => a.toLowerCase().trim())
        .join('|');

      const recoveryKeyResult = await cryptoPrimitives.deriveKey({
        password: concatenated
      });

      const xprivRecovery = await cryptoPrimitives.encryptData({
        data: xpriv,
        password: recoveryKeyResult.key
      });

      recoveryData = {
        questions: recovery.questions,
        xprivRecovery,
        salt: recoveryKeyResult.salt,
        version: 1
      };
    }

    // ===== Step 5: Assemble vault objects =====
    console.log('[signup-atomic] Assembling vault objects...');

    const vaultObj: VaultObj = {
      username,
      identities,
      xprivEncrypted,
      xprivRecovery: recoveryData?.xprivRecovery || '',
      recovery: recoveryData ? {
        questions: recoveryData.questions,
        salt: recoveryData.salt,
        version: recoveryData.version
      } : undefined,
      salt: pinSalt,
      version: 1,
      updatedAt: Date.now()
    };

    const loginObj: LoginObj = {
      storagePublicKey,
      storageKeypairEncrypted,
      username,
      createdAt: Date.now(),
      version: 1,
      passwordSalt,
      pinSalt
    };

    const vaultData: VaultData = {
      xprivEncrypted,
      salt: pinSalt,
      passwordSalt,
      publicKey: storagePublicKey,
      storagePublicKey,
      username,
      identities,
      updatedAt: Date.now(),
      version: 1,
      recovery: recoveryData,
      passwordVerifier
    };

    // ===== Step 6: Save to IndexedDB =====
    console.log('[signup-atomic] Saving to IndexedDB...');
    await vaultDB.init();
    await vaultDB.saveVault(username, vaultData);

    // ===== Step 7: Create unlocked session =====
    console.log('[signup-atomic] Creating unlocked session...');
    const manager = getSessionStateManager();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = Date.now();

    // Create complete session state (already unlocked)
    const session: CompleteSessionState = {
      isAuthenticated: true,
      isUnlocked: true,
      username,
      publicKey: personalIdentity.publicKey,
      storagePublicKey,
      vaultVersion: 1,
      identityCount: identities.length,
      sessionId,
      createdAt: now,
      unlockedAt: now,
      expiresAt: now + (30 * 60 * 1000), // 30 minutes
      xpriv,
      privateKey: personalIdentity.publicKey, // TODO: derive private key properly
      storagePrivateKey,
      vaultData
    };

    // Store in session manager (this bypasses login + unlock - goes straight to unlocked)
    (manager as any).sessions.set(username, session);
    (manager as any).activeUsername = username;

    // ===== Step 8: Publish to Nostr (non-blocking background) =====
    console.log('[signup-atomic] Starting background Nostr sync...');

    // Fire and forget - don't block account creation
    publishToNostrBackground({
      username,
      loginObj,
      vaultObj,
      passwordKey,
      storagePublicKey,
      storagePrivateKey,
      relays,
      environment
    }).catch(error => {
      console.error('[signup-atomic] Background Nostr sync failed:', error);
      // Don't throw - account creation still succeeded locally
    });

    // ===== Step 9: Broadcast auth state change =====
    broadcastAuthStateChanged(session);

    console.log('[signup-atomic] Account creation complete!');

    return {
      success: true,
      username,
      publicKey: personalIdentity.publicKey,
      sessionId,
      identityCount: identities.length
    };

  } catch (error) {
    console.error('[signup-atomic] Account creation failed:', error);
    throw error;
  }
}

/**
 * Background Nostr publishing (non-blocking)
 */
async function publishToNostrBackground(params: {
  username: string;
  loginObj: LoginObj;
  vaultObj: VaultObj;
  passwordKey: string;
  storagePublicKey: string;
  storagePrivateKey: string;
  relays: string[];
  environment: string;
}) {
  const {
    username,
    loginObj,
    vaultObj,
    passwordKey,
    storagePublicKey,
    storagePrivateKey,
    relays,
    environment
  } = params;

  try {
    console.log('[signup-atomic-nostr] Publishing to Nostr...');

    // Dynamically import to avoid bloating main bundle
    const { saveLoginObj, publishVaultObj } = await import('@nostrpass/nostrHelpers');

    // Generate random keypair for LoginObj encryption
    const randomKeypair = await cryptoPrimitives.generateKeypair();
    const randomPrivateKey = randomKeypair.privateKey;
    const randomPublicKey = randomKeypair.publicKey;

    // Publish LoginObj
    const loginPublished = await saveLoginObj(
      username,
      loginObj,
      randomPublicKey,
      randomPrivateKey,
      relays,
      environment,
      passwordKey
    );
    console.log(`[signup-atomic-nostr] LoginObj published to ${loginPublished.length} relays`);

    // Publish VaultObj
    const vaultPublished = await publishVaultObj(
      username,
      vaultObj,
      storagePublicKey,
      storagePrivateKey,
      relays,
      passwordKey
    );
    console.log(`[signup-atomic-nostr] VaultObj published to ${vaultPublished.length} relays`);

    // Verify minimum relay count
    if (loginPublished.length === 0 || vaultPublished.length === 0) {
      throw new Error('Failed to publish to any relays');
    }

    console.log('[signup-atomic-nostr] Nostr sync successful!');

    // Notify UI of successful sync
    self.postMessage({
      type: 'NOSTR_SYNC_COMPLETE',
      data: {
        username,
        loginRelayCount: loginPublished.length,
        vaultRelayCount: vaultPublished.length
      }
    });

  } catch (error) {
    console.error('[signup-atomic-nostr] Nostr sync failed:', error);

    // Notify UI of sync failure
    self.postMessage({
      type: 'NOSTR_SYNC_FAILED',
      data: {
        username,
        error: (error as Error).message
      }
    });

    throw error;
  }
}
