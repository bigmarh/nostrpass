import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { useMessenger } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { User, UserProfile } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  hasPinVault: () => boolean;
  isVaultLocked: () => boolean;
  login: (password: string, username?: string, registrationInfo?: any) => Promise<void>;
  createAccount: (username: string, password: string, pin?: string, recovery?: { questions: string[], answers: string[] }) => Promise<{ publicKey: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [tempVaultData, setTempVaultData] = createSignal<any>(null);
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
        if (!currentUser) return;
        
        if (event.data?.type === 'SESSION_EXPIRED' || event.data?.type === 'SESSION_LOCKED') {
          const { username, reason } = event.data.data;
          
          if (currentUser.profile.username === username) {
            console.log(`🔒 Vault lock notification received for: ${username}, reason: ${reason || event.data.type}`);
            
            // This should already be locked, but ensure UI is in sync
            setIsVaultLocked(true);
            setHasPinVault(true);
            
            // Clear local session
            localStorage.removeItem('vault-session');
            
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
      
      // Cleanup
      return () => {
        workerInstance.removeEventListener('message', handleWorkerMessage);
      };
    } catch (error) {
      console.error('Failed to set up worker message listener:', error);
    }
  });
  
  // Load user session from localStorage on mount
  onMount(async () => {
    const savedSession = localStorage.getItem('vault-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Verify session is still valid
        if (session.expiresAt > Date.now()) {
          // Check if worker has the session
          if (cryptoWorker) {
            const workerSession = await cryptoWorker.getSession({ 
              username: session.user.profile.username 
            });
            if (workerSession) {
              setUser(session.user);
            } else {
              // Session not in worker, clear localStorage
              localStorage.removeItem('vault-session');
            }
          } else {
            // Worker not ready yet, set user
            setUser(session.user);
          }
        } else {
          localStorage.removeItem('vault-session');
        }
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem('vault-session');
      }
    }
  });

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
    pin?: string,
    recovery?: { questions: string[], answers: string[] }
  ) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
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

      let encryptedXpriv;
      let pinSalt;
      let pinHash;
      
      if (pin) {
        // If PIN is provided, encrypt xpriv with PIN only
        console.log('🔐 Creating vault with PIN:', {
          pin: pin,
          pinLength: pin.length
        });
        // Generate a random salt for the PIN
        const saltBytes = new Uint8Array(16);
        crypto.getRandomValues(saltBytes);
        pinSalt = btoa(String.fromCharCode(...saltBytes));
        
        console.log('📌 PIN salt generated:', {
          salt: pinSalt,
          saltLength: pinSalt.length
        });
        
        // Hash the PIN for verification later
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const hash = await crypto.subtle.digest('SHA-256', pinData);
        pinHash = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // For now, use PIN directly with salt as part of the password
        // This is a temporary fix until we update the WASM module
        const saltedPin = `${pin}:${pinSalt}`;
        
        console.log('🔐 Encrypting xpriv with salted PIN:', {
          xprivLength: userMasterKey.xpriv?.length,
          saltedPinLength: saltedPin.length
        });
        
        encryptedXpriv = await cryptoWorker.encryptData({
          data: userMasterKey.xpriv,
          password: saltedPin  // Use salted PIN
        });
        
        console.log('✅ xpriv encrypted:', {
          encryptedLength: encryptedXpriv?.length,
          encryptedPreview: encryptedXpriv?.substring(0, 20) + '...'
        });
      } else {
        // No PIN - this shouldn't happen in the new flow
        throw new Error('PIN is required for vault security');
      }

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
      const vaultData = {
        encryptedXpriv,
        salt: passwordSalt,
        pinSalt,
        pinHash,
        publicKey: storagePublicKey, // Storage key is the main vault key
        storagePublicKey, // Also store it explicitly
        username,
        identities: userMasterKey.identities,
        currentIdentityIndex: 0, // Using Personal identity
        hasPin: !!pin,
        updatedAt: Date.now(),
        recovery: recoveryData,
        passwordVerifier
      };
      
      console.log('📦 Vault data being saved:', {
        ...vaultData,
        encryptedXpriv: '[REDACTED]',
        recovery: recoveryData ? {
          questions: recoveryData.questions,
          xprivRecovery: '[REDACTED]',
          salt: recoveryData.salt,
          version: recoveryData.version
        } : undefined
      });
      
      // Create session in worker with vault data
      // xpriv is all we need - it contains all keys
      const sessionInfo = await cryptoWorker.createSession({
        username,
        publicKey: storagePublicKey, // Use storage key for session
        privateKey: '', // Not needed when we have xpriv
        xpriv: userMasterKey.xpriv, // Pass xpriv for full key derivation
        vaultData,
        sessionTimeout: 60 // 60 minutes
      });
      
      console.log('✅ Session created in worker:', sessionInfo);

      // Store session
      const session = {
        user: newUser,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
      };
      localStorage.setItem('vault-session', JSON.stringify(session));

      setUser(newUser);
      
      // Set vault as unlocked since user just created it
      setIsVaultLocked(false);
      setHasPinVault(false); // No PIN required - vault is fully accessible
      
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
      let vaultData = await cryptoWorker.getVaultData({ username });
      
      // If no local vault but user exists on Nostr, try to retrieve from Nostr
      if (!vaultData && registrationInfo && registrationInfo.pubkey) {
        console.log('No local vault found, retrieving from Nostr...');
        
        try {
          // Import the getVaultFromNostr function directly
          const { getVaultFromNostr } = await import('@nostrpass/nostrHelpers');
          
          // We don't need the user's private key anymore since vault is password-encrypted
          // Pass a dummy value since the function signature still expects it
          const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';
          
          // Retrieve vault from Nostr using the public key
          const nostrVault = await getVaultFromNostr(
            registrationInfo.pubkey,
            dummyPrivateKey,
            getRelays() // Use the getRelays from the component
          );
          
          if (nostrVault) {
            console.log('Found vault on Nostr!');
            vaultData = nostrVault;
            
            // Save to local storage for future use
            await cryptoWorker.createSession({
              username: vaultData.username || username,
              publicKey: registrationInfo.pubkey,
              privateKey: '', // Will be set after decryption
              vaultData,
              sessionTimeout: 60
            });
          }
        } catch (error) {
          console.error('Error retrieving vault from Nostr:', error);
        }
      }
      
      if (!vaultData) {
        // Try old localStorage format for backward compatibility
        const oldVaultDataStr = localStorage.getItem(`vault-data-${username}`);
        if (oldVaultDataStr) {
          vaultData = JSON.parse(oldVaultDataStr);
          // Migrate to worker storage
          await cryptoWorker.createSession({
            username: vaultData.username,
            publicKey: vaultData.publicKey,
            privateKey: '', // Will be set later after decryption
            vaultData: {
              ...vaultData,
              updatedAt: Date.now()
            },
            sessionTimeout: 60
          });
          localStorage.removeItem(`vault-data-${username}`);
          console.log('Migrated vault data to worker storage');
        }
        
        // Check even older format
        if (!vaultData) {
          const oldVaultDataStr = localStorage.getItem('vault-data');
          if (oldVaultDataStr) {
            const oldVaultData = JSON.parse(oldVaultDataStr);
            if (oldVaultData.username === username) {
              vaultData = oldVaultData;
              // Migrate to worker storage
              await cryptoWorker.createSession({
                username: vaultData.username,
                publicKey: vaultData.publicKey,
                privateKey: '',
                vaultData: {
                  ...vaultData,
                  updatedAt: Date.now()
                },
                sessionTimeout: 60
              });
              localStorage.removeItem('vault-data');
              console.log('Migrated old vault data to worker storage');
            }
          }
        }
        
        // If still no vault data, the user might not have saved their vault to Nostr
        if (!vaultData && registrationInfo) {
          console.log('No vault data found locally or on Nostr');
          throw new Error('Invalid username or password');
        }
        
        if (!vaultData) {
          throw new Error('Invalid username or password');
        }
      }

      // Derive key from password
      const encryptDeriveResult = await cryptoWorker.deriveKey({
        password,
        salt: vaultData.salt
      });
      
      // Handle both Map and object results from WASM
      let encryptionKey: string;
      if (encryptDeriveResult instanceof Map) {
        encryptionKey = encryptDeriveResult.get('key');
      } else {
        encryptionKey = encryptDeriveResult.key;
      }

      // Decrypt the master key (xpriv)
      let xpriv: string;
      let privateKey: string;
      let publicKey: string;
      
      // Check if vault has PIN protection
      if (vaultData.hasPin) {
        // Vault is PIN-protected, we can only decrypt partially
        // Store the vault data temporarily and require PIN unlock
        setTempVaultData({
          vaultData,
          encryptionKey,
          username
        });
        
        // For PIN-protected vaults, we need to unlock with PIN first
        // Set flag to indicate PIN is needed
        console.log('Vault has PIN protection, PIN unlock required');
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
          },
          vaultPinHash: vaultData.pinHash // Add PIN hash to user object
        };
        
        // Store partial session
        const session = {
          user: partialUser,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        };
        localStorage.setItem('vault-session', JSON.stringify(session));
        setUser(partialUser);
        
        return; // Exit early - user needs to unlock with PIN
      }
      
      // No PIN protection, decrypt normally
      // Handle both old format (encryptedPrivateKey) and new format (encryptedXpriv)
      try {
        if (vaultData.encryptedXpriv) {
          // New format with xpriv
          xpriv = await cryptoWorker.decryptData({
            encryptedData: vaultData.encryptedXpriv,
            password: encryptionKey
          });
          
          // Get the current identity (default to Personal at index 0)
          const currentIdentity = vaultData.identities[vaultData.currentIdentityIndex || 0];
          const keypair = await getIdentityKeypair(xpriv, currentIdentity);
          privateKey = keypair.privateKey;
          publicKey = keypair.publicKey;
        } else {
          // Old format with direct private key
          privateKey = await cryptoWorker.decryptData({
            encryptedData: vaultData.encryptedPrivateKey,
            password: encryptionKey
          });
          publicKey = vaultData.publicKey;
        }
      } catch (decryptError) {
        console.error('Decryption failed:', decryptError);
        throw new Error('Invalid password. Please check your password and try again.');
      }

      // Verify key pair
      const derivedPublicKey = await cryptoWorker.getPublicKey({ privateKey });
      if (derivedPublicKey !== publicKey) {
        throw new Error('Invalid password');
      }

      // Update the worker session with the unlocked private key
      const sessionInfo = await cryptoWorker.unlockSession({
        username,
        privateKey
      });

      // Create user object (no longer storing private key in main thread)
      const userToStore: User = {
        publicKey,
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
        isAuthenticated: true,
        session: {
          startedAt: Date.now(),
          lastActivityAt: Date.now()
        }
      };

      // Update user state
      setUser(userToStore);
      setIsVaultLocked(false); // Vault is unlocked for non-PIN vaults
      
      // Save session
      const session = {
        user: userToStore,
        expiresAt: sessionInfo.expiresAt || (Date.now() + (60 * 60 * 1000))
      };
      localStorage.setItem('vault-session', JSON.stringify(session));

      // Notify parent of auth status change
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: userToStore.publicKey
      });

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    console.log('Logout called');
    const currentUser = user();
    
    // Clear local state immediately for fast UI response
    setUser(null);
    setTempVaultData(null);
    setHasPinVault(false);
    localStorage.removeItem('vault-session');
    console.log('User state cleared');

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
      
      // Update session
      const session = {
        user: updatedUser,
        expiresAt: Date.now() + (60 * 60 * 1000)
      };
      localStorage.setItem('vault-session', JSON.stringify(session));
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
      
      // Validate vault data
      if (!freshVaultData.pinHash || !freshVaultData.pinSalt || !freshVaultData.encryptedXpriv) {
        console.error('❌ Vault data missing required fields:', {
          hasPinHash: !!freshVaultData.pinHash,
          hasPinSalt: !!freshVaultData.pinSalt,
          hasEncryptedXpriv: !!freshVaultData.encryptedXpriv
        });
        throw new Error('Vault data is incomplete');
      }
      
      console.log('✅ Got vault data:', { 
        hasPinHash: !!freshVaultData.pinHash,
        hasPinSalt: !!freshVaultData.pinSalt,
        hasEncryptedXpriv: !!freshVaultData.encryptedXpriv,
        pinSalt: freshVaultData.pinSalt,
        pinHashPreview: freshVaultData.pinHash?.substring(0, 10) + '...',
        encryptedXprivLength: freshVaultData.encryptedXpriv?.length
      });
      
      // Hash the provided PIN
      const encoder = new TextEncoder();
      const pinData = encoder.encode(pin);
      const hash = await crypto.subtle.digest('SHA-256', pinData);
      const pinHash = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Verify PIN hash
      if (pinHash !== freshVaultData.pinHash) {
        console.log('PIN hash mismatch');
        return false;
      }
      
      
      // For now, use PIN directly with salt as part of the password
      // This matches how we encrypted during account creation
      const saltedPin = `${pin}:${freshVaultData.pinSalt}`;
      
      console.log('🔓 Decrypting xpriv with salted PIN:', {
        encryptedDataType: typeof freshVaultData.encryptedXpriv,
        encryptedDataLength: freshVaultData.encryptedXpriv?.length,
        encryptedDataPreview: freshVaultData.encryptedXpriv?.substring(0, 20) + '...',
        saltedPinLength: saltedPin.length,
        encryptedDataFirstChars: freshVaultData.encryptedXpriv?.substring(0, 10),
        encryptedDataLastChars: freshVaultData.encryptedXpriv?.substring(freshVaultData.encryptedXpriv.length - 10)
      });
      
      const xpriv = await cryptoWorker.decryptData({
        encryptedData: freshVaultData.encryptedXpriv,
        password: saltedPin  // Use salted PIN
      });
      console.log('✅ xpriv decrypted');
      
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
      
      const sessionInfo = await cryptoWorker.unlockSession({
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
      
      // Small delay to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Update session reference
      const session = {
        user: updatedUser,
        expiresAt: sessionInfo.expiresAt
      };
      localStorage.setItem('vault-session', JSON.stringify(session));
      
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
      
      // Clear temp vault data
      setTempVaultData(null);
      
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