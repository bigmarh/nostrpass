import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount, on } from 'solid-js';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { useMessenger, notifyAuthReady } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile, LoginObj, VaultObj, ErrorCode } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import type { VaultData } from '@nostrpass/nostrHelpers';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { setupWorkerMessageHandlers, setupBroadcastChannelListener, setupMessengerRoutes } from './auth/AuthWorkerBridge';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  hasPinVault: () => boolean;
  isVaultLocked: () => boolean;
  login: (password: string, username: string) => Promise<void>;
  createAccount: (username: string, password: string, pin: string, recovery?: { questions: string[], answers: string[] }) => Promise<{ publicKey: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
    const [hasPinVault, setHasPinVault] = createSignal(false);
  const [isVaultLocked, setIsVaultLocked] = createSignal(true);
  const messenger = useMessenger();
  const { getRelays, environmentName } = useEnvironment();
  const cryptoWorker = getCryptoWorker();

  // Vault lock state is managed explicitly by unlock/lock/logout functions
  // Don't auto-compute it based on hasPinVault, as that causes re-locking after unlock

  // Handle session expired notifications from worker
  createEffect(() => {
    const cleanup = setupWorkerMessageHandlers({
      getCryptoWorkerInstance,
      user,
      setUser,
      setHasPinVault,
      setIsVaultLocked,
      attemptSessionRestore,
      messenger,
      showErrorToast: (code: string) => showErrorToast(code as ErrorCode)
    });

    return cleanup;
  });

  // Set up BroadcastChannel listener for cross-tab communication
  createEffect(() => {
    const broadcastChannel = setupBroadcastChannelListener({
      user,
      setUser,
      setHasPinVault,
      setIsVaultLocked,
      attemptSessionRestore,
      refreshSessionStatus,
      messenger
    });

    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  });

  // Session management on mount
  onMount(async () => {
    console.log('[AuthProvider] onMount - Starting session restoration');
    if (!cryptoWorker) {
      console.log('[AuthProvider] onMount - No cryptoWorker, exiting');
      return;
    }

    // Get session status from worker
    const { VaultDataService } = await import('../services/vaultDataService');
    const vaultDataService = VaultDataService.getInstance();
    const sessionStatus = await vaultDataService.getSessionStatus();
    console.log('[AuthProvider] onMount - Session status:', sessionStatus);

    if (sessionStatus.sessionId && sessionStatus.username) {
      console.log('[AuthProvider] onMount - Found valid session, restoring...');
      localStorage.setItem('vaultsession', sessionStatus.sessionId);
      localStorage.setItem('last-username', sessionStatus.username);

      try {
        const vaultData = await cryptoWorker.getVaultData({
          username: sessionStatus.username,
          includeEncryptedVault: true
        });
        console.log('[AuthProvider] onMount - Vault data:', vaultData ? 'loaded' : 'null');

        if (vaultData) {
          console.log('[AuthProvider] onMount - Checking key status in worker session...');
          const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
          console.log('[AuthProvider] onMount - Key status:', keyStatus);

          const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
          console.log('[AuthProvider] onMount - Computed isUnlocked:', isUnlocked, '(hasPrivateKey:', keyStatus?.hasPrivateKey, ', hasXpriv:', keyStatus?.hasXpriv, ')');

          const restoredUser: User = {
            publicKey: vaultData.publicKey,
            privateKey: '',
            profile: {
              username: vaultData.username,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              preferences: {},
              security: {
                sessionTimeout: 60
              }
            },
            appPermissions: new Map(),
            isAuthenticated: true,
            session: {
              startedAt: Date.now(),
              lastActivityAt: Date.now()
            }
          };

          setUser(restoredUser);
          setHasPinVault(true);
          setIsVaultLocked(!isUnlocked);
          console.log('[AuthProvider] onMount - Session restored. isVaultLocked set to:', !isUnlocked);
        }
      } catch (error) {
        console.error('[AuthProvider] onMount - Error restoring session:', error);
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
      }
    } else {
      console.log('[AuthProvider] onMount - No valid session found, clearing localStorage');
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
    }

    const handleSessionRefresh = (event: CustomEvent) => {
      const { username: eventUsername } = event.detail as any;
      const currentUser = user();
      
      if (currentUser?.profile.username === eventUsername) {
        refreshSessionStatus();
      } else if (!currentUser) {
        attemptSessionRestore();
      }
    };

    window.addEventListener('session-refresh', handleSessionRefresh as unknown as EventListener);

    // Notify MessengerProvider that auth is ready
    console.error('🔍 [AuthProvider] Calling notifyAuthReady');
    notifyAuthReady({
      user,
      cryptoWorker,
      isVaultLocked
    });

    return () => {
      window.removeEventListener('session-refresh', handleSessionRefresh as unknown as EventListener);
    };
  });

  // Helper function to refresh session status
  const refreshSessionStatus = async () => {
    if (!cryptoWorker) return;
    
    try {
      const currentUser = user();
      if (!currentUser) return;
      
      const keyStatus = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
      
      setIsVaultLocked(!isUnlocked);
      setHasPinVault(!isUnlocked);
    } catch (error) {
      console.error('Failed to refresh session status:', error);
      showErrorToast('SESSION_EXPIRED' as ErrorCode);
    }
  };

  async function attemptSessionRestore() {
    if (!cryptoWorker) return;
    try {
      const { VaultDataService } = await import('../services/vaultDataService');
      const sessionStatus = await VaultDataService.getInstance().getSessionStatus();
      if (sessionStatus.sessionId && sessionStatus.username) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
        localStorage.setItem('last-username', sessionStatus.username);
        try {
          const vaultData = await cryptoWorker.getVaultData({
            username: sessionStatus.username,
            includeEncryptedVault: true
          });
          if (vaultData) {
            const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
            const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);
            const restoredUser: User = {
              publicKey: vaultData.publicKey,
              privateKey: '',
              profile: {
                username: vaultData.username,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                preferences: {},
                security: { sessionTimeout: 60 }
              },
              appPermissions: new Map(),
              isAuthenticated: true,
              session: { startedAt: Date.now(), lastActivityAt: Date.now() }
            };
            setUser(restoredUser);
            setHasPinVault(true);
            setIsVaultLocked(!isUnlocked);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Set up message handlers for auth-related requests (runs once when messenger is ready)
  createEffect(on(
    () => messenger.isReady() && messenger.messenger,
    (ready) => {
      if (!ready) return;

      console.log('[AuthProvider] Setting up messenger routes');
      setupMessengerRoutes({
        messenger,
        user,
        isVaultLocked,
        cryptoWorker,
        unlockVault
      });
    },
    { defer: true } // Only run when the tracked value changes from falsy to truthy
  ));

  // Centralized auth change listener - notifies embassy when authentication state changes
  createEffect(on(
    user,
    (currentUser, prevUser) => {
      // Only notify on actual auth state changes (login/logout), not on every render
      const prevUsername = prevUser?.profile.username;
      const currentUsername = currentUser?.profile.username;

      if (prevUsername !== currentUsername) {
        if (messenger.isReady()) {
          console.log('[AuthProvider] Auth state changed, notifying embassy:', {
            from: prevUsername || 'logged out',
            to: currentUsername || 'logged out'
          });

          messenger.send('VAULT_DATA_UPDATED', {
            username: currentUsername || null,
            timestamp: Date.now()
          });
        }
      }
    },
    { defer: true }
  ));

  const createAccount = async (
    username: string, 
    password: string, 
    pin: string, // PIN is now mandatory
    recovery?: { questions: string[], answers: string[] }
  ) => {
    console.log('🎬 [CREATE ACCOUNT] Starting account creation...');
    console.log('👤 [CREATE ACCOUNT] Username:', username);
    console.log('🔐 [CREATE ACCOUNT] Password length:', password.length);
    console.log('🔐 [CREATE ACCOUNT] PIN length:', pin.length, 'PIN preview:', pin.substring(0, 2) + '***');
    console.log('🔐 [CREATE ACCOUNT] Has recovery?', !!recovery);
    
    if (!cryptoWorker) {
      console.error('❌ [CREATE ACCOUNT] Crypto worker not ready');
      throw new Error('Crypto worker not ready');
    }
    if (!pin || pin.length < 4) {
      console.error('❌ [CREATE ACCOUNT] PIN too short');
      throw new Error('PIN must be at least 4 digits');
    }
    
    setIsLoading(true);
    try {
      // Step 1: Create new user with xpriv and Personal identity
      console.log('🔑 [CREATE ACCOUNT] Step 1: Generating master key (xpriv)...');
      const userMasterKey = await createUser();
      
      console.log('✅ [CREATE ACCOUNT] Master key generated:', {
        xprivLength: userMasterKey.xpriv?.length,
        xprivPrefix: userMasterKey.xpriv?.substring(0, 10),
        identitiesCount: userMasterKey.identities?.length
      });
      
      const personalIdentity = userMasterKey.identities[0];
      console.log('👤 [CREATE ACCOUNT] Personal identity:', personalIdentity);
      
      // Step 2: Derive keypairs
      console.log('🔑 [CREATE ACCOUNT] Step 2: Deriving storage and personal keypairs...');
      const { getStorageKeypair } = await import('../services/userService');
      const storageKeypair = await getStorageKeypair(userMasterKey.xpriv);
      const storagePublicKey = storageKeypair.publicKey;
      const storagePrivateKey = storageKeypair.privateKey;
      console.log('✅ [CREATE ACCOUNT] Storage public key:', storagePublicKey);
      console.log('✅ [CREATE ACCOUNT] Storage private key (first 16 chars):', storagePrivateKey.substring(0, 16) + '...');

      const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      console.log('✅ [CREATE ACCOUNT] Personal public key:', personalPublicKey);
      
      // Step 3: Derive key from PASSWORD for account verification
      console.log('🔑 [CREATE ACCOUNT] Step 3: Deriving password key...');
      const passwordDeriveResult = await cryptoWorker.deriveKey({
        password,
      });

      let passwordKey: string;
      let passwordSalt: string;
      if (passwordDeriveResult instanceof Map) {
        passwordKey = passwordDeriveResult.get('key');
        passwordSalt = passwordDeriveResult.get('salt');
      } else {
        passwordKey = (passwordDeriveResult as any).key;
        passwordSalt = (passwordDeriveResult as any).salt;
      }
      console.log('✅ [CREATE ACCOUNT] Password key derived. Salt:', passwordSalt.substring(0, 20) + '...');

      // Step 3.5: Derive PIN salt for consistent encryption
      console.log('🔑 [CREATE ACCOUNT] Step 3.5: Deriving PIN salt...');
      const pinDeriveResult = await cryptoWorker.deriveKey({ password: pin });
      let pinSalt: string;
      if (pinDeriveResult instanceof Map) {
        pinSalt = pinDeriveResult.get('salt');
      } else {
        pinSalt = (pinDeriveResult as any).salt;
      }
      console.log('✅ [CREATE ACCOUNT] PIN salt derived:', pinSalt.substring(0, 20) + '...');

      // Step 4: Encrypt xpriv with PIN using the consistent salt
      console.log('🔐 [CREATE] Encrypting xpriv with PIN...');
      console.log('🔐 [CREATE] PIN details:', { length: pin.length, preview: pin.substring(0, 2) + '***' });
      console.log('🔐 [CREATE] xpriv to encrypt:', { length: userMasterKey.xpriv.length, preview: userMasterKey.xpriv.substring(0, 10) + '...' });

      const xprivEncrypted = await cryptoWorker.encryptDataWithSalt({
        data: userMasterKey.xpriv,
        password: pin,
        salt: pinSalt
      });

      console.log('✅ [CREATE ACCOUNT] xpriv encryption successful!');
      console.log('✅ [CREATE ACCOUNT] Encrypted xpriv length:', xprivEncrypted.length);
      console.log('✅ [CREATE ACCOUNT] Encrypted xpriv preview:', xprivEncrypted.substring(0, 50) + '...');

      // Encrypt storage keypair with PIN for LoginObj using the same salt
      console.log('🔐 [CREATE ACCOUNT] Encrypting storage keypair with PIN...');
      const storageKeypairJson = JSON.stringify({
        privateKey: storagePrivateKey,
        publicKey: storagePublicKey
      });
      const storageKeypairEncrypted = await cryptoWorker.encryptDataWithSalt({
        data: storageKeypairJson,
        password: pin,
        salt: pinSalt
      });
      console.log('✅ [CREATE ACCOUNT] Storage keypair encrypted');
      console.log('✅ [CREATE ACCOUNT] Encrypted keypair length:', storageKeypairEncrypted.length);

      // Step 4: Create user object
      console.log('👤 [CREATE ACCOUNT] Step 4: Creating user object...');
      const newUser: User = {
        publicKey: personalPublicKey,
        privateKey: '',
        profile: {
          username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {
            theme: 'system'
          },
          security: {
            sessionTimeout: 60
          }
        },
        appPermissions: new Map(),
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      // Step 5: Create recovery encryption (if security questions provided)
      console.log('🔐 [CREATE ACCOUNT] Step 5: Processing recovery data...');
      let recoveryData = undefined;
      if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
        console.log('🔐 [CREATE ACCOUNT] Creating recovery encryption with', recovery.questions.length, 'questions');
        const concatenated = recovery.answers
          .map(a => a.toLowerCase().trim())
          .join('|');
        
        const recoveryKeyResult = await cryptoWorker.deriveKey({
          password: concatenated,
        });
        
        let recoveryKey: string;
        let recoverySalt: string;
        if (recoveryKeyResult instanceof Map) {
          recoveryKey = recoveryKeyResult.get('key');
          recoverySalt = recoveryKeyResult.get('salt');
        } else {
          recoveryKey = (recoveryKeyResult as any).key;
          recoverySalt = (recoveryKeyResult as any).salt;
        }
        
        const xprivRecovery = await cryptoWorker.encryptData({
          data: userMasterKey.xpriv,
          password: recoveryKey
        });
        
        recoveryData = {
          questions: recovery.questions,
          xprivRecovery,
          salt: recoverySalt,
          version: 1
        };
        console.log('✅ [CREATE ACCOUNT] Recovery data created');
      } else {
        console.log('ℹ️ [CREATE ACCOUNT] No recovery data provided');
      }

      // Step 6: Create password verifier for login authentication
      console.log('🔐 [CREATE ACCOUNT] Step 6: Creating password verifier...');
      const passwordVerifier = await cryptoWorker.encryptData({
        data: 'NostrPass_Password_Verifier_v1',
        password: passwordKey
      });
      console.log('✅ [CREATE ACCOUNT] Password verifier created');

      // Step 7: Assemble vault objects
      console.log('📦 [CREATE ACCOUNT] Step 7: Assembling vault objects...');
      const vaultObj: VaultObj = {
        username,
        identities: userMasterKey.identities,
        xprivEncrypted,
        xprivRecovery: recoveryData?.xprivRecovery || '',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined,
        salt: pinSalt, // PIN salt for decrypting xprivEncrypted
        version: 1,
        updatedAt: Date.now()
      };

      const loginObj: LoginObj = {
        storagePublicKey,
        storageKeypairEncrypted,  // NEW: PIN-encrypted storage keypair
        username,
        createdAt: Date.now(),
        version: 1,
        passwordSalt,  // Store password salt in LoginObj for decryption
        pinSalt  // NEW: PIN salt for decrypting storage keypair
      };

      const vaultData: VaultData = {
        xprivEncrypted,
        salt: pinSalt, // PIN salt for decrypting xprivEncrypted
        passwordSalt, // Salt for password verification
        publicKey: storagePublicKey,
        storagePublicKey,
        username,
        identities: userMasterKey.identities,
        updatedAt: Date.now(),
        version: 1,
        recovery: recoveryData,
        passwordVerifier
      };
      
      console.log('✅ [CREATE ACCOUNT] VaultObj created:', {
        username: vaultObj.username,
        hasXprivEncrypted: !!vaultObj.xprivEncrypted,
        xprivEncryptedLength: vaultObj.xprivEncrypted.length,
        salt: vaultObj.salt,
        hasRecovery: !!vaultObj.recovery
      });
      
      console.log('✅ [CREATE ACCOUNT] VaultData created:', {
        username: vaultData.username,
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        xprivEncryptedLength: vaultData.xprivEncrypted.length,
        xprivEncryptedPreview: vaultData.xprivEncrypted.substring(0, 50) + '...',
        salt: vaultData.salt,
        saltLength: vaultData.salt?.length,
        passwordSalt: vaultData.passwordSalt,
        hasPasswordVerifier: !!vaultData.passwordVerifier,
        passwordVerifierLength: vaultData.passwordVerifier?.length,
        identitiesCount: vaultData.identities?.length,
        identities: vaultData.identities,
        allKeys: Object.keys(vaultData)
      });
      
      // Step 8: Initialize session in worker
      console.log('🔓 [CREATE ACCOUNT] Step 8: Initializing session in worker...');
      console.log('🔓 [CREATE ACCOUNT] Passing vaultData to initSession:', {
        username,
        publicKey: storagePublicKey,
        vaultDataKeys: Object.keys(vaultData),
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        xprivEncryptedLength: vaultData.xprivEncrypted?.length,
        identitiesCount: vaultData.identities?.length,
        hasSalt: !!vaultData.salt,
        hasPasswordKey: !!passwordKey
      });
      await cryptoWorker.initSession({
        username,
        publicKey: storagePublicKey,
        vaultData,
        passwordKey  // Cache password key for vault operations
      });
      console.log('✅ [CREATE ACCOUNT] Session initialized');

      // Step 8.5: Verify what was saved to IndexedDB
      console.log('🔍 [CREATE ACCOUNT] Step 8.5: Verifying IndexedDB save...');
      const verifyVault = await cryptoWorker.getVaultData({ username, includeEncryptedVault: true });
      console.log('🔍 [CREATE ACCOUNT] Vault data from IndexedDB after initSession:', {
        hasVaultData: !!verifyVault,
        keys: verifyVault ? Object.keys(verifyVault) : [],
        hasXprivEncrypted: !!(verifyVault as any)?.xprivEncrypted,
        xprivEncryptedLength: (verifyVault as any)?.xprivEncrypted?.length,
        identitiesCount: (verifyVault as any)?.identities?.length,
        identities: (verifyVault as any)?.identities,
        salt: (verifyVault as any)?.salt
      });
      
      // Step 9: Unlock session with keys
      console.log('🔓 [CREATE ACCOUNT] Step 9: Unlocking session...');
      const createdKeypair = await getIdentityKeypair(userMasterKey.xpriv, userMasterKey.identities[0]);
      await cryptoWorker.unlockSession({
        username,
        privateKey: createdKeypair.privateKey,
        xpriv: userMasterKey.xpriv
      });
      console.log('✅ [CREATE ACCOUNT] Session unlocked');
      
      localStorage.setItem('last-username', username);

      setUser(newUser);
      setIsVaultLocked(false);
      setHasPinVault(false);
      
      // Step 10: Verify session
      console.log('🔍 [CREATE ACCOUNT] Step 10: Verifying session...');
      const sessionVerify = await cryptoWorker.getSession({ username });
      console.log('✅ [CREATE ACCOUNT] Post-creation session check:', {
        hasSession: !!sessionVerify,
        sessionUsername: (sessionVerify as any)?.username,
        isUnlocked: (sessionVerify as any)?.isUnlocked
      });
      
      // Step 11: Blocking Nostr sync with timeout (Hybrid Approach)
      console.log('🌐 [CREATE ACCOUNT] Step 11: Publishing to Nostr (blocking with timeout)...');

      let syncedToNostr = false;

      try {
        const randomKey = await cryptoWorker.generateKeypair();
        let randomPrivateKey: string;
        let randomPublicKey: string;
        if (randomKey instanceof Map) {
          randomPrivateKey = randomKey.get('privateKey');
          randomPublicKey = randomKey.get('publicKey');
        } else {
          randomPrivateKey = (randomKey as any).privateKey;
          randomPublicKey = (randomKey as any).publicKey;
        }
        if (!randomPrivateKey || !randomPublicKey) {
          throw new Error('Failed to generate random keypair for LoginObj');
        }

        const relays = getRelays();
        const env = environmentName ? environmentName() : 'development';

        // BLOCKING: Try to publish with 15s timeout
        console.log('📤 [CREATE ACCOUNT] Attempting blocking publish to Nostr...');
        await Promise.race([
          // Attempt to publish both LoginObj and VaultObj
          (async () => {
            // Step 1: Publish LoginObj
            const { saveLoginObj } = await import('@nostrpass/nostrHelpers');
            const loginPublished = await saveLoginObj(
              username,
              loginObj,
              randomPublicKey,
              randomPrivateKey,
              relays,
              env,
              passwordKey
            );
            console.log(`✅ [CREATE ACCOUNT] LoginObj published to ${loginPublished.length} relays`);

            // Step 2: Publish VaultObj
            const vaultEvent = await cryptoWorker.createInitialVaultForNostr({
              username,
              passwordKey
            });
            const { publishEvent } = await import('@nostrpass/nostrHelpers');
            const vaultPublished = await publishEvent(vaultEvent.event, relays);
            console.log(`✅ [CREATE ACCOUNT] VaultObj published to ${vaultPublished.length} relays`);

            // Verify minimum relay count
            if (loginPublished.length < 2 || vaultPublished.length < 2) {
              throw new Error('Failed to publish to minimum relay count (need 2+)');
            }

            // Mark as synced
            await cryptoWorker.updateVaultData({
              username,
              vaultData: {
                ...vaultData,
                needsNostrSync: false,
                lastSyncedAt: Date.now()
              },
              skipVersionIncrement: true
            });

            syncedToNostr = true;
            console.log('🎉 [CREATE ACCOUNT] Successfully published to Nostr!');
          })(),

          // Timeout after 15 seconds
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Nostr publish timeout (15s)')), 15000)
          )
        ]);

        console.log('✅ [CREATE ACCOUNT] Blocking sync completed successfully');

      } catch (syncError) {
        console.warn('⚠️ [CREATE ACCOUNT] Blocking sync failed/timed out:', syncError);

        // Fallback: Queue for background retry
        try {
          const randomKey = await cryptoWorker.generateKeypair();
          let randomPrivateKey: string;
          let randomPublicKey: string;
          if (randomKey instanceof Map) {
            randomPrivateKey = randomKey.get('privateKey');
            randomPublicKey = randomKey.get('publicKey');
          } else {
            randomPrivateKey = (randomKey as any).privateKey;
            randomPublicKey = (randomKey as any).publicKey;
          }

          const relays = getRelays();
          const env = environmentName ? environmentName() : 'development';

          const NostrSyncService = (await import('../services/nostrSyncService')).default;
          const syncService = NostrSyncService.getInstance();
          await syncService.queueSync({
            username,
            loginObj,
            randomPublicKey,
            randomPrivateKey,
            passwordKey,
            environment: env,
            relays
          });

          console.log('✅ [CREATE ACCOUNT] Queued for background retry');
          showWarningToast('Account created! Syncing to Nostr in background. Wait 30 seconds before logging in from another device.');
        } catch (queueError) {
          console.error('❌ [CREATE ACCOUNT] Failed to queue background sync:', queueError);
        }
      }

      // Step 12: Realtime will start after unlock via worker
      console.log('🔔 [CREATE ACCOUNT] Step 12: Realtime will start after unlock');

      // Step 13: Send auth status
      console.log('📡 [CREATE ACCOUNT] Step 13: Sending auth status to parent...');
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: personalPublicKey
      });
      
      console.log('🎉 [CREATE ACCOUNT] Account creation complete!');
      console.log('🎉 [CREATE ACCOUNT] Storage public key:', storagePublicKey);
      return { publicKey: storagePublicKey };

    } catch (error) {
      console.error('❌ [CREATE ACCOUNT] Account creation failed:', error);
      console.error('❌ [CREATE ACCOUNT] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      showErrorToast('STORAGE_ERROR' as ErrorCode);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string, username: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    setIsLoading(true);
    try {
      console.log('🔍 [AuthProvider] Starting login for username:', username);

      // Call the new worker login method that orchestrates everything
      const relays = getRelays();
      const env = environmentName ? environmentName() : 'development';

      // Auto-retry logic for newly created accounts
      let result: any = null;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 5000; // 5 seconds

      while (retryCount <= MAX_RETRIES) {
        try {
          result = await cryptoWorker.login({
            username,
            password,
            environment: env,
            relays
          });

          if (result.success) {
            // Login successful
            break;
          }

          // Login failed - check if it's "not found" error
          if (result.error && result.error.includes('not found')) {
            if (retryCount < MAX_RETRIES) {
              console.log(`⏳ [LOGIN] Account not found on Nostr, retrying in ${RETRY_DELAY / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
              showWarningToast(`Looking for your account on Nostr (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              retryCount++;
            } else {
              // All retries exhausted
              throw new Error(
                'Account not found on Nostr after retries. ' +
                'If you just created this account, please wait 30 seconds and try again. ' +
                'The initial sync may still be in progress.'
              );
            }
          } else {
            // Different error (e.g., invalid password) - don't retry
            break;
          }
        } catch (loginError) {
          // Network error or other exception - retry
          if (retryCount < MAX_RETRIES) {
            console.warn(`⚠️ [LOGIN] Login attempt failed, retrying... (${retryCount + 1}/${MAX_RETRIES})`, loginError);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            retryCount++;
          } else {
            throw loginError;
          }
        }
      }

      if (!result || !result.success) {
        console.error('❌ [AuthProvider] Login failed:', result?.error);
        if (result?.error === 'Invalid password') {
          showErrorToast('INVALID_PASSWORD' as ErrorCode);
        }
        throw new Error(result?.error || 'Login failed');
      }

      console.log('✅ [AuthProvider] Login successful');

      // Get vault data to populate UI state (include encrypted vault for PIN unlock)
      const vaultData = await cryptoWorker.getVaultData({
        username,
        includeEncryptedVault: true
      });

      console.log('📦 [LOGIN] Vault data after login:', {
        hasVaultData: !!vaultData,
        keys: vaultData ? Object.keys(vaultData) : [],
        hasXprivEncrypted: !!(vaultData as any)?.xprivEncrypted,
        xprivEncryptedType: typeof (vaultData as any)?.xprivEncrypted,
        xprivEncryptedLength: (vaultData as any)?.xprivEncrypted?.length,
        identitiesCount: (vaultData as any)?.identities?.length,
        identities: (vaultData as any)?.identities,
        salt: (vaultData as any)?.salt,
        passwordSalt: (vaultData as any)?.passwordSalt,
        storagePublicKey: (vaultData as any)?.storagePublicKey
      });

      if (!vaultData) {
        throw new Error('Vault data not found after login');
      }

      // Store username for session persistence
      localStorage.setItem('last-username', username);

      // Set UI state
      setHasPinVault(true);
      setIsVaultLocked(true);
      
      const partialUser: User = {
        publicKey: (vaultData as any).publicKey,
        privateKey: '',
        profile: {
          username: (vaultData as any).username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {},
          security: {
            sessionTimeout: 60
          },
          // Ensure storagePublicKey available for subscriptions
          storagePublicKey: (vaultData as any).storagePublicKey || (vaultData as any).publicKey
        },
        appPermissions: new Map(),
        isAuthenticated: false,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };
      
      setUser(partialUser);
      setIsLoading(false);

      // Check if vault needs Nostr sync and retry if necessary
      try {
        const NostrSyncService = (await import('../services/nostrSyncService')).default;
        const syncService = NostrSyncService.getInstance();
        await syncService.retrySync(username, relays, env);
      } catch (syncError) {
        console.warn('⚠️ [AuthProvider] Failed to check Nostr sync status:', syncError);
      }

      return;

    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
      throw error;
    } finally {
      // no-op
    }
  };

  const logout = async (deleteVault = false) => {
    const currentUser = user();

    // Clear worker session FIRST before clearing UI state
    // This prevents onMount from restoring a stale session on reload
    if (currentUser && cryptoWorker) {
      try {
        console.log('🚪 [AuthProvider] Calling worker logout...');
        await cryptoWorker.logout({
          username: currentUser.profile.username,
          deleteVault
        });
        console.log('✅ [AuthProvider] Worker logout completed');
      } catch (error) {
        console.error('❌ [AuthProvider] Worker logout failed:', error);
      }
    }

    // Clear localStorage
    localStorage.removeItem('last-username');
    localStorage.removeItem('vaultsession');

    // Then clear UI state
    setUser(null);
    setHasPinVault(false);
    setIsVaultLocked(true);

    // Send auth status after all cleanup
    if (messenger.isReady()) {
      messenger.send('AUTH_STATUS', {
        isAuthenticated: false,
        publicKey: null
      });
    }
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    const currentUser = user();
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        profile: { ...currentUser.profile, ...profile }
      };
      setUser(updatedUser);
    }
  };

  const lockVault = async (): Promise<void> => {
    const currentUser = user();
    if (!currentUser) {
      return;
    }
    
    setIsVaultLocked(true);
    setHasPinVault(true);
    
    if (cryptoWorker) {
      cryptoWorker.clearSession({ username: currentUser.profile.username })
        .catch(() => {});
    }
  };

  const unlockVault = async (pin: string): Promise<boolean> => {
    console.log('🔓 [UNLOCK] Starting unlock vault with PIN...');
    
    if (!cryptoWorker) {
      console.error('❌ [UNLOCK] Crypto worker not available');
      return false;
    }
    
    const currentUser = user();
    if (!currentUser) {
      console.error('❌ [UNLOCK] No current user');
      return false;
    }
    
    console.log('👤 [UNLOCK] User:', currentUser.profile.username);
    
    try {
      // Step 1: Get vault data (need encrypted vault for unlock operation)
      console.log('📦 [UNLOCK] Step 1: Fetching vault data...');
      const params = { username: currentUser.profile.username, includeEncryptedVault: true };
      console.log('📦 [UNLOCK] Calling getVaultData with params:', JSON.stringify(params));
      const freshVaultData = await cryptoWorker.getVaultData(params);
      console.log('📦 [UNLOCK] Worker returned freshVaultData:', freshVaultData);
      console.log('📦 [UNLOCK] freshVaultData keys:', freshVaultData ? Object.keys(freshVaultData) : 'null');
      console.log('📦 [UNLOCK] xprivEncrypted value:', (freshVaultData as any)?.xprivEncrypted);
      console.log('📦 [UNLOCK] xprivEncrypted type:', typeof (freshVaultData as any)?.xprivEncrypted);
      console.log('📦 [UNLOCK] xprivEncrypted length:', (freshVaultData as any)?.xprivEncrypted?.length);
      if (!freshVaultData) {
        console.error('❌ [UNLOCK] No vault data found');
        throw new Error('No vault data found');
      }
      console.log('✅ [UNLOCK] Vault data retrieved:', {
        hasXprivEncrypted: !!(freshVaultData as any).xprivEncrypted,
        xprivEncryptedLength: (freshVaultData as any).xprivEncrypted?.length,
        salt: (freshVaultData as any).salt,
        allKeys: Object.keys(freshVaultData)
      });
      
      let xprivEncryptedBlob = (freshVaultData as any).xprivEncrypted;

      // Fallback: If xprivEncrypted is missing, try to get it from xprivs IndexedDB store directly
      if (!xprivEncryptedBlob) {
        console.warn('⚠️ [UNLOCK] xprivEncrypted missing from vault data, checking xprivs store directly...');
        try {
          const currentUser = user();
          if (!currentUser) {
            throw new Error('No user logged in');
          }

          // Open IndexedDB directly to access xprivs store
          // This is a fallback when the worker's getVaultData didn't return it
          const dbRequest = indexedDB.open('NostrPassVault', 2); // Use version 2 to match db.ts
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            dbRequest.onsuccess = () => resolve(dbRequest.result);
            dbRequest.onerror = () => reject(dbRequest.error);
          });

          const transaction = db.transaction(['xprivs'], 'readonly');
          const store = transaction.objectStore('xprivs');
          const getRequest = store.get(currentUser.profile.username);

          const xprivsData = await new Promise<any>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
          });

          db.close();

          // The xprivs store uses 'encryptedXpriv' as the field name (see db.ts:346)
          if (xprivsData?.encryptedXpriv) {
            console.log('✅ [UNLOCK] Found encryptedXpriv in xprivs store');
            xprivEncryptedBlob = xprivsData.encryptedXpriv;
          } else {
            console.error('❌ [UNLOCK] encryptedXpriv not found in xprivs store either', {
              hasXprivsData: !!xprivsData,
              keys: xprivsData ? Object.keys(xprivsData) : []
            });
            throw new Error('Vault data is incomplete - no xprivEncrypted found');
          }
        } catch (error) {
          console.error('❌ [UNLOCK] Failed to get xprivEncrypted from xprivs store:', error);
          throw new Error('Vault data is incomplete - no xprivEncrypted');
        }
      }
      
      console.log('🔍 [UNLOCK] xprivEncrypted blob preview:', xprivEncryptedBlob.substring(0, 50) + '...');
      
      const looksLikeCipher = /^[A-Za-z0-9+/=]+$/.test(xprivEncryptedBlob);
      let payloadToDecrypt = xprivEncryptedBlob;
      console.log('🔍 [UNLOCK] Cipher validation:', { looksLikeCipher });

      if (!looksLikeCipher) {
        console.log('⚠️ [UNLOCK] Encrypted data doesn\'t look like base64');
        console.log('⚠️ [UNLOCK] Cannot refresh from Nostr (would require password key for decryption)');
        // Skip refresh - would need password key for decryption
        // This shouldn't happen with properly formatted vaults
      }
       
      // Step 2: Decrypt xpriv with PIN using the stored salt
      console.log('🔐 [UNLOCK] Step 2: Decrypting xpriv with PIN...');
      console.log('🔐 [UNLOCK] PIN provided:', { length: pin.length, preview: pin.substring(0, 2) + '***' });
      console.log('🔐 [UNLOCK] Using PIN salt:', (freshVaultData as any).salt?.substring(0, 20) + '...');

      let xpriv: string;

      try {
        const pinSalt = (freshVaultData as any).salt;
        if (!pinSalt) {
          console.error('❌ [UNLOCK] No PIN salt found in vault data!');
          throw new Error('Vault data is missing PIN salt');
        }

        xpriv = await cryptoWorker.decryptDataWithSalt({
          encryptedData: payloadToDecrypt,
          password: pin,
          salt: pinSalt
        });
        console.log('✅ [UNLOCK] Decryption successful! xpriv length:', xpriv?.length);
        console.log('✅ [UNLOCK] xpriv preview:', xpriv?.substring(0, 10) + '...');
      } catch (error) {
        console.error('❌ [UNLOCK] PIN decryption failed:', error);
        console.error('❌ [UNLOCK] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          type: typeof error,
          error
        });
        showErrorToast('INVALID_PIN' as ErrorCode);
        return false;
      }

      // Step 3: Detect what we decrypted - storage keypair JSON or xpriv string
      console.log('🔍 [UNLOCK] Step 3: Detecting decrypted data format...');
      let storageKeypair: { privateKey: string; publicKey: string } | null = null;
      let actualXpriv: string | null = null;

      // Check if decrypted data is a JSON storage keypair (from LoginObj)
      if (xpriv.startsWith('{')) {
        try {
          storageKeypair = JSON.parse(xpriv);
          console.log('✅ [UNLOCK] Detected storage keypair JSON format');
          console.log('🔑 [UNLOCK] Storage public key:', storageKeypair?.publicKey?.substring(0, 16) + '...');
        } catch (e) {
          console.error('❌ [UNLOCK] Failed to parse storage keypair JSON:', e);
          showErrorToast('STORAGE_ERROR' as ErrorCode);
          return false;
        }
      } else {
        // It's an actual xpriv string
        actualXpriv = xpriv;
        console.log('✅ [UNLOCK] Detected xpriv string format');
      }

      // Step 4: Unlock session and fetch full vault from Nostr if needed
      console.log('🔓 [UNLOCK] Step 4: Unlocking session...');
      console.log('🔍 [UNLOCK] Identities in local vault:', (freshVaultData as any).identities);

      const hasIdentities = (freshVaultData as any).identities && (freshVaultData as any).identities.length > 0;

      if (storageKeypair && !hasIdentities) {
        // We have storage keypair but no identities - need to fetch VaultObj from Nostr
        console.log('🌐 [UNLOCK] Storage keypair detected with no identities - fetching VaultObj from Nostr...');

        try {
          // Unlock session with storage keypair first
          console.log('🔐 [UNLOCK] Unlocking session with storage keypair...');
          await cryptoWorker.unlockSession({
            username: currentUser.profile.username,
            storagePrivateKey: storageKeypair.privateKey,
            storagePublicKey: storageKeypair.publicKey
          });
          console.log('✅ [UNLOCK] Session unlocked with storage keypair');

          // Now fetch and decrypt VaultObj from Nostr
          const relays = getRelays();
          console.log('🌐 [UNLOCK] Calling assembleStateFromAuthor with relays:', relays);
          const assembled = await cryptoWorker.assembleStateFromAuthor({
            username: currentUser.profile.username,
            relays
          });
          console.log('📦 [UNLOCK] assembleStateFromAuthor returned:', assembled);

          if (assembled && Array.isArray(assembled.identities) && assembled.identities.length > 0) {
            console.log('✅ [UNLOCK] Fetched VaultObj from Nostr with', assembled.identities.length, 'identities');

            // Get existing vault data to preserve username and other fields
            const existingVault = await cryptoWorker.getVaultData({
              username: currentUser.profile.username,
              includeEncryptedVault: true
            });

            // Merge assembled data with existing vault data
            const mergedVaultData = {
              ...existingVault,
              identities: assembled.identities,
              activeIdentityByApp: assembled.perms || existingVault.activeIdentityByApp || {}
            };

            // Update local vault with merged data
            await cryptoWorker.updateVaultData({
              username: currentUser.profile.username,
              vaultData: mergedVaultData,
              skipVersionIncrement: true
            });

            // Get the updated vault data including xpriv
            const updatedVault = await cryptoWorker.getVaultData({
              username: currentUser.profile.username,
              includeEncryptedVault: true
            });

            if ((updatedVault as any).xprivEncrypted) {
              actualXpriv = (updatedVault as any).xprivEncrypted;
              console.log('✅ [UNLOCK] Extracted xpriv from VaultObj');
            }
          } else {
            console.warn('⚠️ [UNLOCK] No identities found in VaultObj from Nostr');
          }
        } catch (nostrError) {
          console.error('❌ [UNLOCK] Failed to fetch VaultObj from Nostr:', nostrError);
          // Continue anyway - user is still unlocked, just without identities
        }
      } else if (hasIdentities && actualXpriv) {
        // We have identities locally and an xpriv - normal flow
        const currentIdentity = (freshVaultData as any).identities[(freshVaultData as any).currentIdentityIndex || 0];
        console.log('✅ [UNLOCK] Found identity locally:', currentIdentity);

        const keypair = await getIdentityKeypair(actualXpriv, currentIdentity);
        console.log('✅ [UNLOCK] Keypair derived:', {
          hasPrivateKey: !!keypair.privateKey,
          publicKey: keypair.publicKey
        });

        await cryptoWorker.unlockSession({
          username: currentUser.profile.username,
          privateKey: keypair.privateKey,
          xpriv: actualXpriv
        });
      } else if (actualXpriv) {
        // Have xpriv but no identities - unlock and will fetch from Nostr later
        console.log('⚠️ [UNLOCK] Have xpriv but no identities, unlocking with xpriv only');

        await cryptoWorker.unlockSession({
          username: currentUser.profile.username,
          xpriv: actualXpriv
        });
      } else {
        console.error('❌ [UNLOCK] Could not determine unlock method');
        showErrorToast('STORAGE_ERROR' as ErrorCode);
        return false;
      }
      console.log('✅ [UNLOCK] Session unlocked in worker');
      
      const updatedUser = {
        ...currentUser,
        privateKey: '',
        isAuthenticated: true
      };

      setUser(updatedUser);
      setHasPinVault(false);
      setIsVaultLocked(false);

      console.log('✅ [UNLOCK] UI state updated - isVaultLocked now:', false);
      
      showSuccessToast('Vault Unlocked', 'Your vault has been successfully unlocked.');
      
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));

      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: currentUser.publicKey
      });

      // Start realtime subscription now that we have storage key in session
      try {
        await startRealtime(currentUser.profile.username);
      } catch (e) {
        console.warn('⚠️ [UNLOCK] Failed to start realtime (non-critical):', e);
      }

      // If we didn't already fetch from Nostr (because we had identities locally), do it now
      if (!storageKeypair || hasIdentities) {
        console.log('🔄 [UNLOCK] Syncing with Nostr for latest vault state...');
        console.log('🔄 [UNLOCK] Conditions - storageKeypair:', !!storageKeypair, 'hasIdentities:', hasIdentities);
        try {
          const relays = getRelays();
          console.log('🔄 [UNLOCK] Calling assembleStateFromAuthor with relays:', relays);
          const assembled = await cryptoWorker.assembleStateFromAuthor({ username: currentUser.profile.username, relays });
          console.log('🔄 [UNLOCK] assembleStateFromAuthor returned:', assembled);
          if (assembled && Array.isArray(assembled.identities)) {
            const local = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
            const localCount = local?.identities?.length || 0;
            const remoteCount = assembled.identities.length || 0;
            console.log('🔄 [UNLOCK] Identity counts - local:', localCount, 'remote:', remoteCount);

            if (remoteCount > localCount) {
              // Remote has more identities - pull from Nostr
              console.log('🔄 [UNLOCK] Updating local vault with remote identities');
              await cryptoWorker.updateVaultData({
                username: currentUser.profile.username,
                vaultData: { ...(local || {}), identities: assembled.identities },
                skipVersionIncrement: true
              });
            } else if (localCount > remoteCount) {
              // Local has more identities - push to Nostr
              console.log('🔄 [UNLOCK] Local vault has more identities - syncing to Nostr');
              try {
                await cryptoWorker.saveVaultToNostr({ username: currentUser.profile.username });
                console.log('✅ [UNLOCK] Successfully synced local identities to Nostr');
              } catch (syncErr) {
                console.error('❌ [UNLOCK] Failed to sync to Nostr:', syncErr);
              }
            } else {
              console.log('🔄 [UNLOCK] Local and remote vaults are in sync');
            }
          } else {
            console.warn('⚠️ [UNLOCK] assembleStateFromAuthor returned no identities or invalid data');
          }
        } catch (e) {
          console.error('❌ [UNLOCK] Nostr sync failed:', e);
        }
      } else {
        console.log('⏭️ [UNLOCK] Skipping Nostr sync - already fetched during unlock');
      }

      // Clear vaultDataService cache to ensure fresh data
      console.log('🧹 [UNLOCK] Clearing vaultDataService cache');
      vaultDataService.clearCache(currentUser.profile.username);

      // Dispatch refresh event to update all components with fresh data
      console.log('📡 [UNLOCK] Dispatching vault-data-refresh event');
      window.dispatchEvent(new CustomEvent('vault-data-refresh', {
        detail: { username: currentUser.profile.username, source: 'unlock-complete' }
      }));

      console.log('🎉 [UNLOCK] Vault unlock complete!');
      return true;
    } catch (error) {
      console.error('❌ [UNLOCK] Unlock vault failed with unexpected error:', error);
      setHasPinVault(true);
      setIsVaultLocked(true);
      return false;
    }
  };

  // After unlock, start realtime Nostr subscription
  const startRealtime = async (username: string) => {
    try {
      console.log('🔧 [startRealtime] Starting subscription for:', username);
      const cryptoWorker = getCryptoWorker();
      console.log('🔧 [startRealtime] Got crypto worker:', !!cryptoWorker);
      const relays = getRelays();
      console.log('🔧 [startRealtime] Got relays:', relays);
      console.log('🔧 [startRealtime] Calling worker.startNostrSubscription...');
      const result = await cryptoWorker.startNostrSubscription({ username, relays });
      console.log('📡 Realtime Nostr subscription started. Result:', result);
    } catch (e) {
      console.warn('⚠️ Failed to start realtime subscription:', e);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: () => !!user(),
    isLoading,
    hasPinVault,
    isVaultLocked: () => isVaultLocked(),
    login,
    createAccount,
    logout,
    updateProfile,
    unlockVault,
    lockVault
  }

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};