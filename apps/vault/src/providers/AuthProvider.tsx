import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { useMessenger } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import { setupMessageHandlers } from '../messageHandlers';
import type { VaultData } from '@nostrpass/nostrHelpers';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  hasPinVault: () => boolean;
  isVaultLocked: () => boolean;
  login: (password: string, username?: string, registrationInfo?: any) => Promise<void>;
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
  const { getRelays } = useEnvironment();
  const cryptoWorker = getCryptoWorker();

  // Update isVaultLocked based on conditions
  createEffect(() => {
    const currentUser = user();
    
    if (!currentUser || !cryptoWorker) {
      setIsVaultLocked(true);
      return;
    }

    // Vault is locked if it has PIN protection and hasn't been unlocked
    // hasPinVault indicates PIN is required but not yet entered
    if (hasPinVault()) {
      setIsVaultLocked(true);
    }
  });

  // Handle session expired notifications from worker
  createEffect(() => {
    try {
      const workerInstance = getCryptoWorkerInstance();
      if (!workerInstance) return;
      
      // Listen for session messages from worker
      const handleWorkerMessage = (event: MessageEvent) => {
        const currentUser = user();
        
        // Handle vault broadcasts (for all tabs)
        if (event.data?.type === 'VAULT_BROADCAST') {
          console.log('📡 Raw broadcast message received:', event.data);
          const { broadcastType, username, timestamp, ...data } = event.data.data;
          console.log(`📡 Vault broadcast received: ${broadcastType} for ${username}`, { timestamp, data });
          
          // Handle different broadcast types
          switch (broadcastType) {
            case 'VAULT_DATA_UPDATED':
              // Refresh vault data in all tabs
              if (currentUser?.profile.username === username) {
                console.log('🔄 Refreshing vault data due to broadcast');
                // Trigger vault data refresh
                const refreshEvent = new CustomEvent('vault-data-refresh', { 
                  detail: { username, timestamp } 
                });
                console.log('📤 Dispatching vault-data-refresh event:', refreshEvent);
                window.dispatchEvent(refreshEvent);
                console.log('✅ Vault-data-refresh event dispatched');
              } else {
                console.log('❌ Username mismatch in AuthProvider:', { 
                  currentUsername: currentUser?.profile.username, 
                  broadcastUsername: username 
                });
              }
              break;
              
            case 'USER_LOGGED_IN':
              // Another tab logged in - refresh session status
              if (currentUser?.profile.username === username) {
                console.log('🔄 User logged in from another tab');
                // Refresh session status
                window.dispatchEvent(new CustomEvent('session-refresh', { 
                  detail: { username, timestamp } 
                }));
              }
              break;
              
            case 'USER_LOGGED_OUT':
              // Another tab logged out - clear local state
              if (currentUser?.profile.username === username) {
                console.log('🔄 User logged out from another tab');
                // Clear local state
                setUser(null);
                setHasPinVault(false);
                setIsVaultLocked(true);
                localStorage.removeItem('vaultsession');
                localStorage.removeItem('last-username');
              }
              break;
              
            case 'SESSION_UNLOCKED':
              // Another tab unlocked the vault
              if (currentUser?.profile.username === username) {
                console.log('🔓 Vault unlocked from another tab');
                setIsVaultLocked(false);
                setHasPinVault(false);
              }
              break;
              
            case 'SESSION_LOCKED':
              // Another tab locked the vault
              if (currentUser?.profile.username === username) {
                console.log('🔒 Vault locked from another tab');
                setIsVaultLocked(true);
                setHasPinVault(true);
              }
              break;
          }
          return;
        }
        
        // Handle existing session messages
        if (event.data?.type === 'SESSION_EXPIRED' || event.data?.type === 'SESSION_LOCKED') {
          const { username, reason } = event.data.data;
          
          if (currentUser?.profile.username === username) {
            console.log(`🔒 Vault lock notification received for: ${username}, reason: ${reason || event.data.type}`);
            
            // This should already be locked, but ensure UI is in sync
            setIsVaultLocked(true);
            setHasPinVault(true);
            
            // Clear username
            localStorage.removeItem('last-username');
            
            // Notify parent of auth status change
            if (messenger.isReady()) {
              messenger.send('AUTH_STATUS', {
                isAuthenticated: false,
                publicKey: null,
                reason: reason || 'session_expired'
              });
            }
            
            // Show notification to user (optional)
            console.log('🔒 Vault locked due to:', reason || 'session expiry');
          }
        }
      };
      
      // Add listener to worker
      workerInstance.addEventListener('message', handleWorkerMessage);
      
      // Set up BroadcastChannel listener for cross-tab communication
      let broadcastChannel: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('nostrpass-vault');
        broadcastChannel.onmessage = (event) => {
          console.log('📡 BroadcastChannel message received:', event.data);
          if (event.data?.type === 'VAULT_BROADCAST') {
            // Handle the same broadcast types as worker messages
            const { broadcastType, username, timestamp, ...data } = event.data.data;
            console.log(`📡 BroadcastChannel vault broadcast: ${broadcastType} for ${username}`, { timestamp, data });
            
            const currentUser = user();
            
            switch (broadcastType) {
              case 'VAULT_DATA_UPDATED':
                if (currentUser?.profile.username === username) {
                  console.log('🔄 Refreshing vault data due to BroadcastChannel');
                  const refreshEvent = new CustomEvent('vault-data-refresh', { 
                    detail: { username, timestamp } 
                  });
                  window.dispatchEvent(refreshEvent);
                }
                break;
                
              case 'SESSION_UNLOCKED':
                if (currentUser?.profile.username === username) {
                  console.log('🔓 Vault unlocked from another tab (BroadcastChannel)');
                  setIsVaultLocked(false);
                  setHasPinVault(false);
                }
                break;
                
              case 'SESSION_LOCKED':
                if (currentUser?.profile.username === username) {
                  console.log('🔒 Vault locked from another tab (BroadcastChannel)');
                  setIsVaultLocked(true);
                  setHasPinVault(true);
                }
                break;
            }
          }
        };
        console.log('✅ BroadcastChannel listener set up');
      }
      
      // Cleanup
      return () => {
        workerInstance.removeEventListener('message', handleWorkerMessage);
        if (broadcastChannel) {
          broadcastChannel.close();
          console.log('🧹 BroadcastChannel listener cleaned up');
        }
      };
    } catch (error) {
      console.error('Failed to set up worker message listener:', error);
    }
  });
  
  // Session management on mount
  onMount(async () => {
    if (!cryptoWorker) return;
    
    console.log('Checking session status...');
    
    // Get session status from worker
    const { VaultDataService } = await import('../services/vaultDataService');
    const vaultDataService = VaultDataService.getInstance();
    const sessionStatus = await vaultDataService.getSessionStatus();
    
    console.log('Session status from worker:', sessionStatus);
    
    // Update localStorage based on worker's session status
    if (sessionStatus.sessionId && sessionStatus.username) {
      localStorage.setItem('vaultsession', sessionStatus.sessionId);
      localStorage.setItem('last-username', sessionStatus.username);
      console.log('Session restored from worker:', sessionStatus.username);
      
      // Restore user state from worker session
      try {
        const vaultData = await cryptoWorker.getVaultData({ username: sessionStatus.username });
        if (vaultData) {
          // Check if the session is actually unlocked
          const sessionInfo = await cryptoWorker.getSession({ username: sessionStatus.username });
          const isUnlocked = sessionInfo?.isUnlocked || false;
          
          // Create user object from vault data
          const restoredUser: User = {
            publicKey: vaultData.publicKey,
            privateKey: '', // Private key stays in worker
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
            isAuthenticated: true, // User is authenticated since session exists
            session: {
              startedAt: Date.now(),
              lastActivityAt: Date.now()
            }
          };
          
          setUser(restoredUser);
          setHasPinVault(true); // PIN is always required after restart
          setIsVaultLocked(!isUnlocked); // Vault is locked unless session is unlocked
          
          if (isUnlocked) {
            console.log('✅ User session restored successfully (unlocked)');
          } else {
            console.log('✅ User session restored successfully (locked - PIN required)');
          }
        }
      } catch (error) {
        console.error('Failed to restore user session:', error);
        // Clear invalid session
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
      }
    } else {
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
      console.log('No active session found');
    }

    // Listen for session refresh events from other tabs
    const handleSessionRefresh = (event: CustomEvent) => {
      const { username: eventUsername } = event.detail;
      const currentUser = user();
      
      if (currentUser?.profile.username === eventUsername) {
        console.log('🔄 Refreshing session status due to broadcast from another tab');
        // Re-check session status
        refreshSessionStatus();
      }
    };

    window.addEventListener('session-refresh', handleSessionRefresh as EventListener);
    
    return () => {
      window.removeEventListener('session-refresh', handleSessionRefresh as EventListener);
    };
  });

  // Helper function to refresh session status
  const refreshSessionStatus = async () => {
    if (!cryptoWorker) return;
    
    try {
      const currentUser = user();
      if (!currentUser) return;
      
      const sessionInfo = await cryptoWorker.getSession({ username: currentUser.profile.username });
      const isUnlocked = sessionInfo?.isUnlocked || false;
      
      setIsVaultLocked(!isUnlocked);
      setHasPinVault(!isUnlocked);
      
      console.log('🔄 Session status refreshed:', { isUnlocked });
    } catch (error) {
      console.error('Failed to refresh session status:', error);
    }
  };

  // Set up message handlers for auth-related requests
  createEffect(() => {
    if (!messenger.isReady() || !messenger.messenger) return;

    // Handle public key requests from parent - NIP-07 compliant
    messenger.messenger.route('GET_PUBLIC_KEY', {
      handler: async (_data: any) => {
        const currentUser = user();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        // Try to get public key from current identity in vault
        if (cryptoWorker && currentUser.profile?.username) {
          try {
            const vaultData = await cryptoWorker.getVaultData({ 
              username: currentUser.profile.username 
            });
            
            if (vaultData?.identities) {
              const currentIdentity = vaultData.identities[vaultData.currentIdentityIndex || 0];
              if (currentIdentity?.publicKey) {
                // NIP-07: Return just the hex public key string
                return currentIdentity.publicKey;
              }
            }
          } catch (error) {
            console.warn('Failed to get identity public key:', error);
          }
        }

        // Fallback to user object public key
        // NIP-07: Return just the hex public key string
        return currentUser.publicKey;
      }
    });

    // Handle sign event requests
    messenger.messenger.route('SIGN_EVENT', {
      handler: async (data: any) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Check if user has private key access
        const currentUserData = user();
        if (!currentUserData?.privateKey && currentUserData?.vaultPinHash) {
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        // Use session-based signing in worker
        const result = await cryptoWorker.signEventWithSession({
          username: currentUser.profile.username,
          event: data.event
        });

        // NIP-07: signEvent() returns the signed event object directly
        return result.event;
      }
    });

    // Handle sign data requests
    messenger.messenger.route('SIGN_DATA', {
      handler: async (data: { data: string }) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Check if user has private key access
        const currentUserData = user();
        if (!currentUserData?.privateKey && currentUserData?.vaultPinHash) {
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        // Use session-based signing for arbitrary data
        const result = await cryptoWorker.signMessageWithSession({
          username: currentUser.profile.username,
          message: data.data
        });

        return {
          signature: result.signature
        };
      }
    });

    // Handle encrypt requests (NIP-04)
    messenger.messenger.route('ENCRYPT', {
      handler: async (data: { plaintext: string; recipientPubkey: string }) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Check if user has private key access
        const currentUserData = user();
        if (!currentUserData?.privateKey && currentUserData?.vaultPinHash) {
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        // Use session-based encryption
        const encrypted = await cryptoWorker.encryptWithSession({
          username: currentUser.profile.username,
          plaintext: data.plaintext,
          recipientPubkey: data.recipientPubkey
        });

        // NIP-07: nip04.encrypt() returns just the encrypted string
        return encrypted;
      }
    });

    // Handle decrypt requests (NIP-04)
    messenger.messenger.route('DECRYPT', {
      handler: async (data: { ciphertext: string; senderPubkey: string }) => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        // Check if user has private key access
        const currentUserData = user();
        if (!currentUserData?.privateKey && currentUserData?.vaultPinHash) {
          throw new Error('Vault is locked. Please unlock with PIN.');
        }

        // Use session-based decryption
        const decrypted = await cryptoWorker.decryptWithSession({
          username: currentUser.profile.username,
          ciphertext: data.ciphertext,
          senderPubkey: data.senderPubkey
        });

        // NIP-07: nip04.decrypt() returns just the decrypted string
        return decrypted;
      }
    });

    // Handle auth status requests
    messenger.messenger.route('GET_AUTH_STATUS', {
      handler: () => {
        return {
          isAuthenticated: !!user(),
          publicKey: user()?.publicKey || null
        };
      }
    });
    
    // Handle auth status response (acknowledgment from parent)
    messenger.messenger.route('AUTH_STATUS_RESPONSE', {
      handler: (data: any) => {
        // Just acknowledge - parent is confirming receipt of AUTH_STATUS
        console.log('Auth status acknowledged by parent:', data);
      }
    });
  });

  const createAccount = async (
    username: string, 
    password: string, 
    pin: string, // PIN is now mandatory
    recovery?: { questions: string[], answers: string[] }
  ) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    if (!pin || pin.length < 4) throw new Error('PIN must be at least 4 digits');
    
    setIsLoading(true);
    try {
      // Create new user with xpriv and Personal identity
      const userMasterKey = await createUser();
      console.log('Created user master key:', userMasterKey);
      
      // Get the keypair for the Personal identity (index 0)
      const personalIdentity = userMasterKey.identities[0];
      console.log('Personal identity:', personalIdentity);
      
      // Get storage public key only - this is the user's permanent NostrPass ID
      const { getStorageKeypair } = await import('../services/userService');
      const { publicKey: storagePublicKey } = await getStorageKeypair(userMasterKey.xpriv);
      console.log('Storage public key (NostrPass ID):', storagePublicKey);
      
      // Get personal identity keypair for the user object
      const { publicKey: personalPublicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      
      // Derive encryption key from password
      const passwordDeriveResult = await cryptoWorker.deriveKey({
        password,
      });
      
      // Handle both Map and object results from WASM
      let passwordKey: string;
      let passwordSalt: string;
      if (passwordDeriveResult instanceof Map) {
        passwordKey = passwordDeriveResult.get('key');
        passwordSalt = passwordDeriveResult.get('salt');
      } else {
        passwordKey = passwordDeriveResult.key;
        passwordSalt = passwordDeriveResult.salt;
      }

      console.log('🔐 Double encryption flow:', {
        step1: 'Encrypting xpriv with PIN directly',
        pinLength: pin.length
      });
      
      // Step 1: Encrypt xpriv with PIN directly (no derivation needed)
      const xprivEncryptedWithPin = await cryptoWorker.encryptData({
        data: userMasterKey.xpriv,
        password: pin
      });
      
      console.log('📌 Step 1 complete: xpriv encrypted with PIN');
      
      // Step 3: Encrypt the PIN-encrypted xpriv with password key
      const xprivEncrypted = await cryptoWorker.encryptData({
        data: xprivEncryptedWithPin,
        key: passwordKey
      });
      
      console.log('✅ Step 2 complete: Double encryption done');

      // Create user object with Personal identity keys for app interactions
      const newUser: User = {
        publicKey: personalPublicKey, // Personal identity for app interactions
        privateKey: '', // Private key stays in worker
        profile: {
          username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {
            theme: 'system'
          },
          security: {
            sessionTimeout: 60 // 60 minutes default
          }
        },
        appPermissions: new Map(),
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      // Prepare recovery data if provided
      let recoveryData = undefined;
      if (recovery && recovery.questions.length > 0 && recovery.answers.length > 0) {
        // Concatenate and normalize answers
        console.log('Setting up recovery with answers:', recovery.answers);
        console.log('Raw answer values:', recovery.answers.map((a, i) => `[${i}]: "${a}" (length: ${a.length})`));
        const concatenated = recovery.answers
          .map(a => a.toLowerCase().trim())
          .join('|');
        console.log('Concatenated for storage:', concatenated);
        console.log('Concatenated length:', concatenated.length);
        
        // Derive recovery key
        const recoveryKeyResult = await cryptoWorker.deriveKey({
          password: concatenated,
        });
        console.log('Recovery key result type:', typeof recoveryKeyResult, recoveryKeyResult);
        
        // Extract key and salt (handling Map result from WASM)
        let recoveryKey: string;
        let recoverySalt: string;
        if (recoveryKeyResult instanceof Map) {
          recoveryKey = recoveryKeyResult.get('key');
          recoverySalt = recoveryKeyResult.get('salt');
        } else {
          recoveryKey = recoveryKeyResult.key;
          recoverySalt = recoveryKeyResult.salt;
        }
        console.log('Generated salt:', recoverySalt);
        console.log('Recovery key present:', recoveryKey ? 'Yes' : 'No');
        
        // Encrypt xpriv with recovery key
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
      }

      // Create a password verifier for later password verification
      const passwordVerifier = await cryptoWorker.encryptData({
        data: 'NostrPass_Password_Verifier_v1',
        password: passwordKey
      });

      // Store encrypted data in worker's IndexedDB
      const vaultData: VaultData = {
        xprivEncrypted, // Double-encrypted: PIN then password
        salt: passwordSalt,
        publicKey: storagePublicKey, // Storage key is the main vault key
        storagePublicKey, // Also store it explicitly
        username,
        identities: userMasterKey.identities,
        currentIdentityIndex: 0, // Using Personal identity
        updatedAt: Date.now(),
        version: 1, // Initial version
        recovery: recoveryData,
        passwordVerifier
      };
      
      console.log('📦 Vault data being saved:', {
        ...vaultData,
        xprivEncrypted: '[REDACTED]',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          xprivRecovery: '[REDACTED]',
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined
      });
      
      // Create session in worker with vault data
      // xpriv is all we need - it contains all keys
      console.log('📝 Creating session with:', {
        username,
        publicKey: storagePublicKey,
        hasXpriv: !!userMasterKey.xpriv,
        xprivLength: userMasterKey.xpriv?.length
      });
      
      const sessionInfo = await cryptoWorker.createSession({
        username,
        publicKey: storagePublicKey, // Use storage key for session
        xpriv: userMasterKey.xpriv, // Pass xpriv for full key derivation
        vaultData,
        sessionTimeout: 60 // 60 minutes
      });
      
      console.log('✅ Session created in worker:', sessionInfo);
      
      // Verify session has xpriv by checking it immediately
      const sessionCheck = await cryptoWorker.getSession({ username });
      console.log('🔍 Session verification:', {
        found: !!sessionCheck,
        hasXpriv: sessionCheck ? 'xpriv' in sessionCheck : false
      });

      // Save username for session persistence
      localStorage.setItem('last-username', username);

      setUser(newUser);
      
      // Set vault as unlocked since user just created it
      setIsVaultLocked(false);
      setHasPinVault(false); // No PIN required - vault is fully accessible
      
      // IMPORTANT: The session must have xpriv for saving to Nostr
      // Let's verify it's there
      const sessionVerify = await cryptoWorker.getSession({ username });
      console.log('🔍 Post-creation session check:', {
        hasSession: !!sessionVerify,
        sessionUsername: sessionVerify?.username,
        isUnlocked: sessionVerify?.isUnlocked
      });
      
      // Vault is created locally and will be saved to Nostr after registration
      // when we have access to the signed event
      console.log('✅ Vault created locally, will sync to Nostr after registration');

      // Notify parent of auth status change
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: personalPublicKey // Send personal identity key for app interactions
      });
      
      // Return storage public key for username registration
      return { publicKey: storagePublicKey };

    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string, username?: string, registrationInfo?: any) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {
      // Username is required for login
      if (!username) {
        throw new Error('Username is required');
      }

      // First try to load from local storage
      console.log('🔍 Checking for local vault data for username:', username);
      let vaultData = await cryptoWorker.getVaultData({ username });
      console.log('📦 Local vault data:', vaultData ? 'Found' : 'Not found');
      
      // If no local vault but user exists on Nostr, try to retrieve from Nostr
      if (!vaultData && registrationInfo && registrationInfo.pubkey) {
        console.log('No local vault found, retrieving from Nostr...');
        console.log('Registration info:', registrationInfo);
        
        try {
          // Import the getVaultFromNostr function directly
          const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
             
          // Retrieve vault from Nostr using the public key
          console.log('🌐 Calling getVaultFromNostr with:', {
            pubkey: registrationInfo.pubkey,
            relays: getRelays()
          });
          const nostrVault = await getVaultFromNostr(
            registrationInfo.pubkey,
            getRelays() // Use the getRelays from the component
          );
          
          console.log('📥 Nostr vault result:', nostrVault ? 'Found' : 'Not found');
          if (nostrVault) {
            console.log('Found vault on Nostr!');
            console.log('📦 Vault Data from Nostr:', {
              username: nostrVault.username,
              publicKey: nostrVault.publicKey,
              xprivEncryptedLength: nostrVault.xprivEncrypted?.length,
              salt: nostrVault.salt,
              hasRecovery: !!nostrVault.recovery,
              identitiesCount: nostrVault.identities?.length || 0,
              currentIdentityIndex: nostrVault.currentIdentityIndex,
              updatedAt: new Date(nostrVault.updatedAt).toISOString(),
              version: nostrVault.version,
              storagePublicKey: nostrVault.storagePublicKey,
              hasPasswordVerifier: !!nostrVault.passwordVerifier
            });
            
            // NostrVaultData and VaultData now use the same property names
            vaultData = nostrVault as VaultData;
            
            // Save to local storage for future use
            await cryptoWorker.createSession({
              username: vaultData.username || username,
              publicKey: registrationInfo.pubkey,
              vaultData,
              sessionTimeout: 60
            });
          }
        } catch (error) {
          console.error('❌ Error retrieving vault from Nostr:', error);
          console.error('Error details:', error instanceof Error ? error.message : error);
        }
      }
      
      // Check if we have vault data
      if (!vaultData) {
        console.error('No vault data found for user');
        throw new Error('No vault found for this username');
      }

      console.log('Vault data loaded:', {
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        hasXprivEncryptedForPin: !!(vaultData as any).xprivEncryptedForPin,
        salt: vaultData.salt ? 'present' : 'missing'
      });
      
      // If vault already has PIN-encrypted version, skip password decryption
      if ((vaultData as any).xprivEncryptedForPin) {
        console.log('Vault already has PIN-encrypted xpriv, skipping password decryption');
      } else {
        // Need to decrypt outer password layer
        if (!vaultData.xprivEncrypted) {
          console.error('❌ Vault missing xprivEncrypted');
          throw new Error('Vault data is incomplete');
        }
        
        console.log('Decrypting outer password layer...');
        
        // Derive key from password to decrypt the outer layer
        const encryptDeriveResult = await cryptoWorker.deriveKey({
          password,
          salt: vaultData.salt
        });
        
        // Handle both Map and object results from WASM
        let passwordKey: string;
        if (encryptDeriveResult instanceof Map) {
          passwordKey = encryptDeriveResult.get('key');
        } else {
          passwordKey = encryptDeriveResult.key;
        }
        
        // Decrypt the outer password layer to get PIN-encrypted xpriv
        const xprivEncryptedWithPin = await cryptoWorker.decryptData({
          encryptedData: vaultData.xprivEncrypted,
          key: passwordKey
        });
        
        // Update vault data with the PIN-encrypted version
        (vaultData as any).xprivEncryptedForPin = xprivEncryptedWithPin;
        console.log('✅ Added xprivEncryptedForPin to vault data');
      }
      
      // Simple login - store vault data (with PIN-encrypted version if we added it)
      console.log('Logging in user with vault data...');
      console.log('Vault data has xprivEncryptedForPin:', !!(vaultData as any).xprivEncryptedForPin);
      await cryptoWorker.loginUser({
        username,
        vaultData
      });
      
      // Save username for next session check
      localStorage.setItem('last-username', username);
      
      // Get session status and save session ID
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      console.log('User logged in successfully');
      
      console.log('Vault requires PIN unlock (mandatory)');
      setHasPinVault(true);
      setIsVaultLocked(true); // Vault is locked until PIN entered
      
      // Create a partial user object for navigation
      const partialUser: User = {
        publicKey: vaultData.publicKey,
        privateKey: '', // No private key until PIN unlock
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
        isAuthenticated: false, // Not fully authenticated until PIN unlock
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };
        
        // No need to store session - vault data is our session
      setUser(partialUser);
      console.log('✅ Login successful - vault locked, awaiting PIN');
      setIsLoading(false); // Important: clear loading state before returning
      
      return; // Exit early - user needs to unlock with PIN

    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false); // Clear loading state on error too
      throw error;
    } finally {
      // Don't set loading false here as it might override the earlier calls
    }
  };

  const logout = async () => {
    console.log('Logout called');
    const currentUser = user();
    
    // Clear local state immediately for fast UI response
    setUser(null);
    setHasPinVault(false);
    setIsVaultLocked(true);
    localStorage.removeItem('last-username');
    localStorage.removeItem('vaultsession');
    console.log('User state cleared');
    
    // Clear vault data in worker (this is the real logout)
    if (currentUser && cryptoWorker) {
      try {
        await cryptoWorker.logoutUser({ username: currentUser.profile.username });
        console.log('User logged out - vault data cleared');
      } catch (error) {
        console.error('Failed to logout user:', error);
      }
    }

    // Notify parent of auth status change immediately if messenger is ready
    if (messenger.isReady()) {
      messenger.send('AUTH_STATUS', {
        isAuthenticated: false,
        publicKey: null
      });
      console.log('Auth status sent to parent');
    }
    
    // Clear worker session in background (non-blocking)
    if (currentUser && cryptoWorker) {
      console.log('Clearing session for user:', currentUser.profile.username);
      // Don't await - let it complete in background
      cryptoWorker.clearSession({ 
        username: currentUser.profile.username 
      }).catch((error: unknown) => {
        // Ignore timeout errors during logout - not critical
        if (error instanceof Error && error.message.includes('timeout')) {
          console.log('Worker session cleanup timed out (non-critical)');
        } else {
          console.error('Failed to clear worker session:', error);
        }
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
      
      // No session storage needed - vault data is our session
    }
  };

  const lockVault = async (): Promise<void> => {
    console.log('🔒 lockVault called');
    const currentUser = user();
    if (!currentUser) {
      console.log('❌ No current user');
      return;
    }
    
    // INSTANT UI UPDATE
    setIsVaultLocked(true);
    setHasPinVault(true); // Indicate PIN is needed to unlock
    console.log('🔒 Vault locked instantly');
    
    // Background worker cleanup (non-blocking)
    if (cryptoWorker) {
      cryptoWorker.clearSession({ username: currentUser.profile.username })
        .catch((error: any) => {
          console.warn('⚠️ Worker session clear failed (non-critical):', error);
          // UI already shows locked - this is just cleanup
        });
    }
  };

  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!cryptoWorker) {
      console.error('❌ Crypto worker not ready');
      return false;
    }
    
    // Get the current user to find username
    const currentUser = user();
    if (!currentUser) {
      console.error('❌ No user logged in');
      return false;
    }
    
    console.log('🔐 Starting vault unlock for:', currentUser.profile.username);
    
    try {
      // Get fresh vault data from worker (in case it was just updated by PIN reset)
      console.log('📊 Getting vault data for:', currentUser.profile.username);
      const freshVaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      if (!freshVaultData) {
        throw new Error('No vault data found');
      }
      
      console.log('🔍 Vault data check:', {
        hasXprivEncrypted: !!freshVaultData.xprivEncrypted,
        hasXprivEncryptedForPin: !!(freshVaultData as any).xprivEncryptedForPin,
        xprivEncryptedLength: freshVaultData.xprivEncrypted?.length,
        xprivEncryptedForPinLength: (freshVaultData as any).xprivEncryptedForPin?.length
      });
      
      // Validate vault data
      if (!freshVaultData.xprivEncrypted) {
        console.error('❌ Vault data missing xprivEncrypted');
        throw new Error('Vault data is incomplete');
      }
      
      // Check if we have the PIN-encrypted version
      if (!(freshVaultData as any).xprivEncryptedForPin) {
        console.error('❌ Vault not prepared for PIN unlock');
        console.log('ℹ️ xprivEncryptedForPin is only available after login with password');
        // Don't logout - just fail the unlock
        throw new Error('Vault locked - please login with password to unlock');
      }
      
      console.log('🔐 Decrypting with PIN...');
      
      // Decrypt with PIN to get plain xpriv
      let xpriv: string;
      try {
        xpriv = await cryptoWorker.decryptData({
          encryptedData: (freshVaultData as any).xprivEncryptedForPin,
          password: pin
        });
        console.log('✅ Decrypted with PIN - vault unlocked');
      } catch (error) {
        console.log('❌ PIN decryption failed - invalid PIN');
        return false;
      }
      
      // Get the current identity (default to Personal at index 0)
      console.log('👤 Getting identity keypair...');
      const currentIdentity = freshVaultData.identities[freshVaultData.currentIdentityIndex || 0];
      const keypair = await getIdentityKeypair(xpriv, currentIdentity);
      console.log('✅ Got keypair:', { hasPrivateKey: !!keypair.privateKey });
      
      // Update the worker session with the xpriv for full key derivation access
      console.log('🔓 Calling cryptoWorker.unlockSession with:', {
        username: currentUser.profile.username,
        hasPrivateKey: !!keypair.privateKey,
        hasXpriv: !!xpriv
      });
      
      await cryptoWorker.unlockSession({
        username: currentUser.profile.username,
        privateKey: keypair.privateKey,
        xpriv // Pass xpriv for storage key access
      });
      
      // Update user (without storing private key in main thread)
      const updatedUser = {
        ...currentUser,
        privateKey: '', // Private key stays in worker
        isAuthenticated: true // Ensure authenticated flag is set
      };
      
      // Update all state atomically
      console.log('🔄 Updating vault state to unlocked...');
      setUser(updatedUser);
      setHasPinVault(false); // Clear PIN flag after successful unlock
      setIsVaultLocked(false); // Vault is now unlocked
      
      // Update session ID after successful unlock
      const { VaultDataService } = await import('../services/vaultDataService');
      const vaultDataService = VaultDataService.getInstance();
      const sessionStatus = await vaultDataService.getSessionStatus();
      if (sessionStatus.sessionId) {
        localStorage.setItem('vaultsession', sessionStatus.sessionId);
      }
      
      // Small delay to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // No session storage needed - vault data is our session
      
      // Save updated vault to Nostr (in case PIN was just added or reset)
      try {
        // Use the worker to save vault with storage key
        const vaultEvent = await cryptoWorker.saveVaultToNostr({ username: currentUser.profile.username });
        
        // Publish the signed event to relays
        const { publishEvent } = await import('@nostrpass/nostrHelpers');
        const relays = getRelays();
        await publishEvent(vaultEvent.event, relays);
        console.log('✅ Vault synced to Nostr with storage key');
      } catch (error) {
        // Don't fail the unlock operation if Nostr sync fails
        if (error instanceof Error && error.message.includes('pow:')) {
          console.warn('Nostr relay requires Proof of Work - vault saved locally but not synced');
        } else {
          console.error('Failed to sync vault to Nostr:', error);
        }
        // Continue anyway - local vault is working
      }
        
      // Notify parent of full auth
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: currentUser.publicKey
      });
      
      console.log('✅ Vault unlock completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to unlock vault:', error);
      
      // Reset state to consistent locked state on error
      setHasPinVault(true);
      setIsVaultLocked(true);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      return false;
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