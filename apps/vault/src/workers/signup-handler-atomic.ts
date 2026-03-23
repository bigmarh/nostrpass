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
import { vaultOperations } from './vault-operations';
import type { Identity, LoginObj, VaultObj, IdentifierType } from '@nostrpass/types';

/**
 * Broadcast auth state change to all tabs via BroadcastChannel
 * Note: In SharedWorker context, we can't use self.postMessage
 */
function broadcastAuthStateChanged(state: CompleteSessionState | null) {
  // For Google login, vaultUsername is the actual vault owner (for data lookups)
  // while username is the Google display name (for UI display)
  const vaultUsername = state?.loginObj?.vaultUsername || state?.username;

  const message = {
    type: 'AUTH_STATE_CHANGED',
    state: state ? {
      isAuthenticated: state.isAuthenticated,
      isLocked: !state.isUnlocked,
      user: state.username ? {
        username: state.username,
        publicKey: state.publicKey,
        storagePublicKey: state.storagePublicKey,
        vaultUsername // Include vault username for data lookups (different from username for Google login)
      } : null,
      sessionId: state.sessionId,
      vaultVersion: state.vaultVersion,
      identityCount: state.identityCount,
      environment: state.environment,
      authProvider: state.authProvider
    } : {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null,
      environment: null,
      authProvider: null
    }
  };

  // Send to all tabs via BroadcastChannel (works in both Worker types)
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
  personalPrivateKey: string;
}> {
  // Generate master xpriv directly (no seed needed)
  const { xpriv } = await cryptoPrimitives.generateXpriv();

  // Create Personal identity (index 0)
  const personalKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
    xpriv,
    index: 0
  });

  const personalIdentity: Identity = {
    index: 0,
    nickname: 'Personal',
    publicKey: personalKeypair.publicKey,
    createdAt: Date.now(),
    appPermissions: {}
  };

  return {
    xpriv,
    identities: [personalIdentity],
    personalPrivateKey: personalKeypair.privateKey
  };
}

/**
 * Atomic account creation
 * ONE call replaces 15+ fragmented calls
 *
 * @param identifier - Username or Google UID
 * @param identifierType - 'username' or 'google' (defaults to 'username')
 * @param displayName - Display name (for Google, this is the user's name from Google)
 */
export async function handleAtomicCreateAccount(params: {
  username?: string; // Deprecated, use identifier
  identifier?: string;
  identifierType?: IdentifierType;
  displayName?: string;
  password: string;
  pin: string;
  relays: string[];
  environment?: string;
  recovery?: {
    questions: string[];
    answers: string[];
  };
  googleUid?: string; // Google UID if using Google auth
}) {
  // Support both old 'username' param and new 'identifier' param
  const identifier = params.identifier || params.username;
  const identifierType = params.identifierType || 'username';
  const displayName = params.displayName || identifier;

  if (!identifier) {
    throw new Error('identifier or username is required');
  }

  const {
    password,
    pin,
    relays,
    environment = 'production',
    recovery,
    googleUid
  } = params;

  console.log('[signup-atomic] Starting atomic account creation:', {
    identifier: identifier?.substring(0, 8) + '...',
    identifierType,
    displayName,
    environment
  });

  // Validate inputs
  if (!pin || pin.length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }

  try {
    // ===== Step 1: Generate cryptographic material =====
    console.log('[signup-atomic] Generating master key...');
    const { xpriv, identities, personalPrivateKey } = await generateMasterKey();
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
      username: displayName!, // Use display name for vault
      identities,
      xprivEncrypted,
      xprivRecovery: recoveryData?.xprivRecovery || '',
      recovery: recoveryData ? {
        questions: recoveryData.questions,
        xprivRecovery: recoveryData.xprivRecovery,
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
      username: displayName!, // Use display name for LoginObj
      createdAt: Date.now(),
      version: 1,
      passwordSalt,
      pinSalt,
      // Auth provider info
      authProvider: identifierType,
      googleUid: identifierType === 'google' ? googleUid : undefined
    };

    const vaultData: VaultData = {
      xprivEncrypted,
      salt: pinSalt,
      passwordSalt,
      publicKey: storagePublicKey,
      storagePublicKey,
      username: displayName!, // Use display name for local vault
      identities,
      updatedAt: Date.now(),
      version: 1,
      recovery: recoveryData
    };

    // ===== Step 6: Save to IndexedDB =====
    console.log('[signup-atomic] Saving to IndexedDB...');
    await vaultDB.init();
    await vaultDB.saveVault(vaultData);

    // ===== Step 7: Create unlocked session =====
    console.log('[signup-atomic] Creating unlocked session...');
    const manager = getSessionStateManager();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = Date.now();

    // Create complete session state (already unlocked)
    const session: CompleteSessionState = {
      isAuthenticated: true,
      isUnlocked: true,
      username: identifier!, // Login identifier (Google UID or username)
      displayName: displayName!, // Human-readable name for UI
      publicKey: personalIdentity.publicKey,
      storagePublicKey,
      vaultVersion: 1,
      identityCount: identities.length,
      sessionId,
      createdAt: now,
      unlockedAt: now,
      expiresAt: now + (30 * 60 * 1000), // 30 minutes
      relays,
      environment, // Store environment used for signup
      xpriv,
      privateKey: personalPrivateKey,
      storagePrivateKey,
      vaultData
    };

    // Store in session manager using username as key (consistent with SessionStateManager.login)
    (manager as any).sessions.set(identifier, session);
    (manager as any).activeUsername = identifier;

    // Persist session to IndexedDB for restore on refresh
    await vaultDB.saveSession({
      storagePublicKey, // Primary key
      sessionId,
      username: identifier!, // Login identifier
      displayName: displayName!, // Human-readable name
      publicKey: storagePublicKey,
      isUnlocked: true,
      unlockedAt: now,
      createdAt: now,
      environment,
      authProvider: identifierType === 'google' ? 'google' : 'username',
      identifier: identifier! // Store the actual identifier (Google UID or username) for session restore
    });

    // ===== Step 8: Publish to Nostr (non-blocking background) =====
    console.log('[signup-atomic] Starting background Nostr sync...');
    console.log('[signup-atomic] Publish params:', {
      identifier: identifier?.substring(0, 8) + '...',
      identifierType,
      displayName,
      environment,
      vaultUsername: displayName,
      relayCount: relays.length
    });

    // Fire and forget - don't block account creation
    console.log('[signup-atomic] Relays being used for publish:', relays);
    publishToNostrBackground({
      identifier: identifier!,
      identifierType,
      displayName: displayName!,
      loginObj,
      vaultObj,
      passwordKey,
      storagePublicKey,
      storagePrivateKey,
      relays,
      environment,
      vaultUsername: displayName! // For Google auth, use displayName as vault identifier
    }).then(() => {
      console.log('[signup-atomic] ✅ Background Nostr sync completed successfully!');
      console.log('[signup-atomic] ✅ LoginObj d-tag prefix:', `nostrpass.com_login_${identifier!.substring(0, 8)}..._${identifierType}_`);
    }).catch(error => {
      console.error('[signup-atomic] ❌ Background Nostr sync FAILED:', error);
      console.error('[signup-atomic] ❌ Error details:', {
        message: error?.message,
        stack: error?.stack?.substring(0, 500)
      });
      // Don't throw - account creation still succeeded locally
    });

    // ===== Step 9: Broadcast auth state change =====
    broadcastAuthStateChanged(session);

    console.log('[signup-atomic] Account creation complete!');

    return {
      success: true,
      username: displayName,
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
  identifier: string;
  identifierType: IdentifierType;
  displayName: string;
  loginObj: LoginObj;
  vaultObj: VaultObj;
  passwordKey: string;  // Used for LoginObj encryption only
  storagePublicKey: string;
  storagePrivateKey: string;
  relays: string[];
  environment: string;
  vaultUsername?: string; // For Google auth: used in d-tag for multi-vault support
}) {
  const {
    identifier,
    identifierType,
    displayName,
    loginObj,
    vaultObj,
    passwordKey,  // Used for LoginObj encryption only
    storagePublicKey,
    storagePrivateKey,
    relays,
    environment,
    vaultUsername
  } = params;

  try {
    console.log('[signup-atomic-nostr] Publishing to Nostr:', {
      identifier: identifier?.substring(0, 8) + '...',
      identifierType,
      displayName,
      environment
    });

    // Dynamically import to avoid bloating main bundle
    const { saveLoginObj, saveVaultObj, getNamespace, getEnvironment } = await import('@nostrpass/nostrHelpers');

    // Debug: log the namespace/environment being used in the worker context
    console.log('[signup-atomic-nostr] Worker context namespace/environment:', {
      namespace: getNamespace(),
      configEnvironment: getEnvironment(),
      paramEnvironment: environment
    });

    // Generate random keypair for LoginObj signing
    // Note: For Google SIGNUPS, we use random keypair (can't unlink primary auth)
    // For Google LINKING (existing username vault), we use storage keypair (see handleLinkGoogleAccount)
    const randomKeypair = await cryptoPrimitives.generateKeypair({});
    const randomPrivateKey = randomKeypair.privateKey;
    const randomPublicKey = randomKeypair.publicKey;

    // Publish LoginObj with identifier type
    // For Google auth, include storagePublicKey in d-tag for multi-vault support
    // The d-tag format is: ${namespace}_login_${hash(googleUid)}_google_${hash(storagePublicKey)}_${environment}
    const loginPublished = await saveLoginObj(
      identifier,
      identifierType,
      loginObj,
      randomPublicKey,
      randomPrivateKey,
      relays,
      environment,
      passwordKey,
      identifierType === 'google' ? storagePublicKey : undefined, // storagePublicKey for multi-vault d-tag
      identifierType === 'google' ? displayName : undefined // displayName for vault picker UI
    );
    console.log(`[signup-atomic-nostr] LoginObj published to ${loginPublished.length} relays`);

    // Cache LoginObj in IndexedDB for fast future logins
    const { vaultDB } = await import('./db');
    await vaultDB.init();
    const cacheKey = `${identifier}_${identifierType}`;
    await vaultDB.saveLoginObj(cacheKey, loginObj, loginObj.passwordSalt, environment);
    console.log('[signup-atomic-nostr] LoginObj cached in IndexedDB');

    // Publish VaultObj (encrypted with storage key, not password!)
    const vaultPublished = await saveVaultObj(
      vaultObj,
      storagePublicKey,
      storagePrivateKey,
      relays
    );
    console.log(`[signup-atomic-nostr] VaultObj published to ${vaultPublished.length} relays`);

    // Verify minimum relay count
    if (loginPublished.length === 0 || vaultPublished.length === 0) {
      throw new Error('Failed to publish to any relays');
    }

    console.log('[signup-atomic-nostr] Nostr sync successful!');

    // Notify UI of successful sync via BroadcastChannel (works in SharedWorker)
    try {
      const channel = new BroadcastChannel('nostrpass-vault');
      channel.postMessage({
        type: 'NOSTR_SYNC_COMPLETE',
        data: {
          username: displayName,
          loginRelayCount: loginPublished.length,
          vaultRelayCount: vaultPublished.length
        }
      });
      channel.close();
    } catch (broadcastError) {
      console.warn('[signup-atomic-nostr] Failed to broadcast sync complete:', broadcastError);
    }

  } catch (error) {
    console.error('[signup-atomic-nostr] Nostr sync failed:', error);

    // Notify UI of sync failure via BroadcastChannel (works in SharedWorker)
    try {
      const channel = new BroadcastChannel('nostrpass-vault');
      channel.postMessage({
        type: 'NOSTR_SYNC_FAILED',
        data: {
          username: displayName,
          error: (error as Error).message
        }
      });
      channel.close();
    } catch (broadcastError) {
      console.warn('[signup-atomic-nostr] Failed to broadcast sync failed:', broadcastError);
    }

    throw error;
  }
}

/**
 * Link Google Account Handler
 *
 * Allows existing username-based accounts to add Google as an alternative sign-in method.
 * Creates a new LoginObj keyed by Google UID that points to the same vault.
 *
 * Flow:
 * 1. Verify password is correct
 * 2. Get existing session state (must be authenticated)
 * 3. Create new LoginObj with Google UID as identifier
 * 4. Publish to Nostr with _google_ identifier type
 */
export async function handleLinkGoogleAccount(params: {
  username: string;
  password: string;
  googleUid: string;
  displayName: string; // Vault username - shown in vault picker when logging in with Google
  googleDisplayName?: string; // Google account name/email - shown in vault settings
  relays: string[];
  environment?: string; // Optional - will use session environment if not provided
}): Promise<{ success: boolean; vaultUsername?: string; storagePublicKey?: string; googleUid?: string }> {
  const {
    username,
    password,
    googleUid,
    displayName,
    googleDisplayName,
    relays
  } = params;

  // Get session manager to verify we have an active session
  const manager = getSessionStateManager();
  const session = manager.getAuthState(username);

  if (!session || !session.isAuthenticated) {
    throw new Error('Must be logged in to link Google account');
  }

  if (!session.isUnlocked) {
    throw new Error('Vault must be unlocked to link Google account');
  }

  // Use environment from session (the one used at login), not from UI
  // This ensures linking uses the same environment as the original account
  const environment = session.environment || params.environment || 'production';

  console.log('[link-google] Starting Google account linking:', {
    username,
    googleUid: googleUid?.substring(0, 8) + '...',
    environment,
    sessionEnvironment: session.environment
  });

  try {
    // ===== Step 0: Check if this vault is already linked to this Google UID =====
    // NOTE: Multi-vault per Google account IS supported - we only check for duplicate links
    // to the SAME vault to avoid creating duplicate LoginObj events
    console.log('[link-google] Checking if this vault is already linked to this Google UID...');

    const { getLoginObj } = await import('@nostrpass/nostrHelpers');

    try {
      // Try to get LoginObj for this Google UID with the current vault's password
      // If it exists and matches THIS vault's storagePublicKey, it's a re-link (allowed)
      const existingLogin = await getLoginObj(googleUid, 'google', environment, relays, password);
      if (existingLogin && existingLogin.loginObj.storagePublicKey === session.storagePublicKey) {
        console.log('[link-google] This vault is already linked to this Google account, will update/re-link');
        // Continue - we'll overwrite the existing LoginObj with updated fields
      } else if (existingLogin) {
        // Different vault with same password - this is fine, multi-vault is supported
        console.log('[link-google] Google account linked to different vault(s), creating additional link for this vault');
      }
    } catch (decryptError: any) {
      // If we can't decrypt, either:
      // 1. No existing link (good - proceed)
      // 2. Linked to other vault(s) with different password(s) (also fine - multi-vault supported)
      console.log('[link-google] No existing link found or different password, proceeding with new link');
    }

    // ===== Step 1: Verify password by re-deriving key =====
    console.log('[link-google] Verifying password...');

    // Get the password salt - try multiple sources for backward compatibility
    // 1. From LoginObj (new accounts)
    // 2. From VaultData (accounts created before loginObj stored passwordSalt)
    let passwordSalt = session.loginObj?.passwordSalt;
    if (!passwordSalt && session.vaultData?.passwordSalt) {
      passwordSalt = session.vaultData.passwordSalt;
      console.log('[link-google] Using passwordSalt from vaultData (fallback)');
    }
    if (!passwordSalt) {
      throw new Error('Cannot verify password - no salt stored in LoginObj or VaultData');
    }

    // Derive password key with existing salt
    const passwordDeriveResult = await cryptoPrimitives.deriveKey({
      password,
      salt: passwordSalt
    });
    const passwordKey = passwordDeriveResult.key;

    // We verify by checking if we can derive the same key
    // (Since we're already authenticated, we trust the session state)
    // The password key will be used to encrypt the new LoginObj

    // ===== Step 2: Create new LoginObj for Google UID =====
    console.log('[link-google] Creating LoginObj for Google UID...');

    // Get the storage keypair from session
    const storagePublicKey = session.storagePublicKey;
    const sessionKeys = manager.getSensitiveKeys(username);
    const storagePrivateKey = sessionKeys.storagePrivateKey;

    if (!storagePublicKey || !storagePrivateKey) {
      throw new Error('Storage keypair not available in session');
    }

    // Get vaultData from session
    const vaultData = session.vaultData;
    if (!vaultData) {
      throw new Error('Vault data not available in session');
    }

    // Validate required vaultData fields
    if (!vaultData.salt) {
      throw new Error('vaultData.salt (PIN salt) is required but missing');
    }
    if (!vaultData.username) {
      throw new Error('vaultData.username is required but missing');
    }

    // Encrypt storage keypair with PIN
    const storageKeypairJson = JSON.stringify({
      privateKey: storagePrivateKey,
      publicKey: storagePublicKey
    });
    const storageKeypairEncrypted = await cryptoPrimitives.encryptDataWithSalt({
      data: storageKeypairJson,
      password: vaultData.salt, // Use the same PIN salt as the original account
      salt: vaultData.salt
    });

    // Get the original vault username (the username the VaultObj is stored under)
    // This is critical for looking up the VaultObj during unlock
    const originalVaultUsername = vaultData.username;

    // CRITICAL: Use the verified passwordSalt variable (already checked at lines 593-600)
    // vaultData.passwordSalt might be undefined for older accounts, but passwordSalt is guaranteed to be set
    if (!passwordSalt) {
      throw new Error('passwordSalt is required but undefined - this should never happen');
    }

    console.log('[link-google] Creating LoginObj with verified password metadata');

    const googleLoginObj: LoginObj = {
      storagePublicKey,
      storageKeypairEncrypted,
      username: displayName, // Use Google display name for display
      createdAt: Date.now(),
      version: 1,
      passwordSalt, // Use the verified passwordSalt variable, NOT vaultData.passwordSalt
      pinSalt: vaultData.salt,
      // Auth provider info
      authProvider: 'google',
      googleUid,
      vaultUsername: originalVaultUsername // Original username for VaultObj lookup
    };

    // ===== Step 3: Publish to Nostr =====
    console.log('[link-google] ========================================');
    console.log('[link-google] Publishing LoginObj to Nostr');
    console.log('[link-google] Google UID:', googleUid?.substring(0, 12) + '...');
    console.log('[link-google] Identifier Type: google');
    console.log('[link-google] Environment:', environment);
    console.log('[link-google] Relays:', relays);
    console.log('[link-google] displayName (vault username for picker):', displayName);
    console.log('[link-google] googleDisplayName (for settings):', googleDisplayName);
    console.log('[link-google] ========================================');

    const { saveLoginObj, getNamespace } = await import('@nostrpass/nostrHelpers');
    console.log('[link-google] Current namespace:', getNamespace());

    // Use STORAGE keypair for Google LoginObjs (not random)
    // This allows us to publish tombstone events with the same key to unlink later
    // The storage keypair is already available from the session

    // Publish LoginObj with Google identifier type (multi-vault d-tag format)
    // CRITICAL: Pass storagePublicKey (not vaultUsername) for multi-vault d-tag generation
    // The d-tag format is: ${namespace}_login_${hash(googleUid)}_google_${hash(storagePublicKey)}_${environment}
    const loginPublished = await saveLoginObj(
      googleUid,           // Use Google UID as identifier
      'google',            // Identifier type
      googleLoginObj,
      storagePublicKey,    // Use storage keypair so we can tombstone later
      storagePrivateKey,   // Use storage keypair so we can tombstone later
      relays,
      environment,
      passwordKey,         // Encrypt with password
      storagePublicKey,    // storagePublicKey for multi-vault d-tag (REQUIRED for multi-vault)
      displayName          // Display name for vault picker UI
    );

    console.log(`[link-google] LoginObj published to ${loginPublished.length} relays:`, loginPublished);

    if (loginPublished.length === 0) {
      throw new Error('Failed to publish to any relays');
    }

    // ===== Step 4: Cache in IndexedDB =====
    console.log('[link-google] Caching LoginObj...');
    await vaultDB.init();
    const cacheKey = `${googleUid}_google`;
    await vaultDB.saveLoginObj(cacheKey, googleLoginObj, googleLoginObj.passwordSalt, environment);

    // ===== Step 5: Update vault's linkedAuthProviders and sync to Nostr =====
    // Store the Google display name (email/name) so we can show which Google account is linked in settings
    // Sync to Nostr so linkedAuthProviders is available on all devices
    console.log('[link-google] Updating vault linkedAuthProviders...');
    console.log('[link-google] Looking up vault by storagePublicKey:', storagePublicKey?.slice(0, 12) + '...');
    console.log('[link-google] Fallback username:', originalVaultUsername);
    try {
      // Try to find vault by storagePublicKey first (primary), then by username (fallback)
      let currentVault = await vaultDB.getVault(storagePublicKey);
      if (!currentVault && originalVaultUsername) {
        console.log('[link-google] Not found by storagePublicKey, trying username:', originalVaultUsername);
        currentVault = await vaultDB.getVaultByUsername(originalVaultUsername);
      }
      console.log('[link-google] Vault lookup result:', {
        found: !!currentVault,
        username: currentVault?.username,
        storagePublicKey: currentVault?.storagePublicKey?.slice(0, 12) + '...',
        existingLinkedAuthProviders: currentVault?.linkedAuthProviders?.length || 0
      });
      if (currentVault) {
        const linkedAuthProviders = currentVault.linkedAuthProviders || [];

        // Check if already in the list (avoid duplicates by googleUid)
        const existingIndex = linkedAuthProviders.findIndex(
          (p: any) => p.provider === 'google' && p.googleUid === googleUid
        );

        const linkedEntry = {
          provider: 'google' as const,
          linkedAt: Date.now(),
          displayName: googleDisplayName || displayName, // Google account name/email for display in settings
          googleUid // Store UID for deduplication
        };

        if (existingIndex >= 0) {
          // Update existing entry
          linkedAuthProviders[existingIndex] = linkedEntry;
        } else {
          // Add new entry
          linkedAuthProviders.push(linkedEntry);
        }

        // Use updateVaultData with syncToNostr to persist to both IndexedDB and Nostr
        console.log('[link-google] Calling updateVaultData with syncToNostr: true');
        await vaultOperations.updateVaultData({
          storagePublicKey,
          vaultData: {
            ...currentVault,
            linkedAuthProviders
          },
          options: { syncToNostr: true }
        });
        console.log('[link-google] ✅ Updated vault with linkedAuthProviders and synced to Nostr:', linkedEntry.displayName);
      } else {
        console.error('[link-google] ❌ Vault not found in IndexedDB! Cannot update linkedAuthProviders.');
        console.error('[link-google] ❌ Tried storagePublicKey:', storagePublicKey?.slice(0, 12) + '...');
        console.error('[link-google] ❌ Tried username:', originalVaultUsername);
      }
    } catch (e) {
      // This is actually critical for linkedAuthProviders to persist across devices!
      console.error('[link-google] ❌ FAILED to update linkedAuthProviders:', e);
      console.error('[link-google] ❌ linkedAuthProviders will NOT persist to Nostr');
    }

    console.log('[link-google] Google account linked successfully!');

    // Return storagePublicKey so the UI can store it in localStorage for multi-vault fallback lookups
    // This is critical because custom tag queries (#google-uid-hash, #auth-provider) may not be indexed by all relays
    return { success: true, vaultUsername: originalVaultUsername, storagePublicKey, googleUid };

  } catch (error) {
    console.error('[link-google] Failed to link Google account:', error);
    throw error;
  }
}

/**
 * Unlink Google Account Handler
 *
 * Removes the link between a vault and a Google account by:
 * 1. Publishing a tombstone event to Nostr (replaces the LoginObj)
 * 2. Removing from vault's linkedAuthProviders
 * 3. Cleaning up localStorage fallback
 *
 * The tombstone approach means the LoginObj event is replaced with one
 * that has a 't: tombstone' tag, which getAllGoogleLoginObjs filters out.
 */
export async function handleUnlinkGoogleAccount(params: {
  googleUid: string;
  relays: string[];
  environment?: string;
}): Promise<{ success: boolean; publishedTo?: string[] }> {
  const { googleUid, relays } = params;

  // Get session manager to verify we have an active session
  // Use getAuthState() without username param to use activeUsername automatically
  const manager = getSessionStateManager();
  const session = manager.getAuthState(); // Uses activeUsername internally

  console.log('[unlink-google] Checking session:', {
    found: !!session,
    isAuthenticated: session?.isAuthenticated,
    isUnlocked: session?.isUnlocked,
    hasStoragePublicKey: !!session?.storagePublicKey,
    username: session?.username
  });

  if (!session || !session.isAuthenticated) {
    throw new Error('No active session - must be logged in to unlink');
  }

  if (!session.isUnlocked) {
    throw new Error('Vault must be unlocked to unlink Google account');
  }

  // Use environment from session (the one used at login)
  const environment = session.environment || params.environment || 'production';
  const storagePublicKey = session.storagePublicKey;

  console.log('[unlink-google] Starting Google account unlinking:', {
    googleUid: googleUid?.substring(0, 8) + '...',
    storagePublicKey: storagePublicKey?.substring(0, 12) + '...',
    environment
  });

  try {
    // ===== Step 1: Publish tombstone to Nostr =====
    console.log('[unlink-google] Publishing tombstone event...');

    // Get storage private key from session (needed to sign the tombstone with same key as original)
    const sessionKeys = manager.getSensitiveKeys(session.username);
    const storagePrivateKey = sessionKeys.storagePrivateKey;
    if (!storagePrivateKey) {
      throw new Error('Storage private key not available - vault must be unlocked');
    }

    const { tombstoneGoogleLoginObj } = await import('@nostrpass/nostrHelpers');

    const publishedTo = await tombstoneGoogleLoginObj(
      googleUid,
      storagePublicKey,
      storagePrivateKey,
      environment,
      relays
    );

    console.log(`[unlink-google] Tombstone published to ${publishedTo.length} relay(s)`);

    // ===== Step 2: Remove from vault's linkedAuthProviders =====
    console.log('[unlink-google] Removing from linkedAuthProviders...');

    try {
      // Try to find vault by storagePublicKey first, then by username (fallback)
      let currentVault = await vaultDB.getVault(storagePublicKey);
      if (!currentVault && session.username) {
        console.log('[unlink-google] Vault not found by storagePublicKey, trying username:', session.username);
        currentVault = await vaultDB.getVaultByUsername(session.username);
      }

      console.log('[unlink-google] Vault lookup result:', {
        found: !!currentVault,
        username: currentVault?.username,
        linkedAuthProviders: currentVault?.linkedAuthProviders?.length || 0
      });

      if (currentVault && currentVault.linkedAuthProviders) {
        const updatedProviders = currentVault.linkedAuthProviders.filter(
          (p: any) => !(p.provider === 'google' && p.googleUid === googleUid)
        );

        console.log('[unlink-google] Filtering linkedAuthProviders:', {
          before: currentVault.linkedAuthProviders.length,
          after: updatedProviders.length,
          googleUidToRemove: googleUid?.substring(0, 8) + '...'
        });

        // Update vault data and sync to Nostr
        await vaultOperations.updateVaultData({
          storagePublicKey,
          vaultData: {
            ...currentVault,
            linkedAuthProviders: updatedProviders
          },
          options: { syncToNostr: true }
        });

        console.log('[unlink-google] ✅ Removed from linkedAuthProviders');
      } else {
        console.warn('[unlink-google] ⚠️ No vault found or no linkedAuthProviders to update');
      }
    } catch (e) {
      console.error('[unlink-google] ❌ Failed to update linkedAuthProviders:', e);
    }

    // ===== Step 3: Clean up IndexedDB cache =====
    console.log('[unlink-google] Cleaning up cached LoginObj...');
    try {
      const cacheKey = `${googleUid}_google`;
      await vaultDB.deleteLoginObj(cacheKey);
      console.log('[unlink-google] Removed cached LoginObj');
    } catch (e) {
      console.warn('[unlink-google] Failed to delete cached LoginObj (non-critical):', e);
    }

    console.log('[unlink-google] Google account unlinked successfully!');

    return { success: true, publishedTo };

  } catch (error) {
    console.error('[unlink-google] Failed to unlink Google account:', error);
    throw error;
  }
}
