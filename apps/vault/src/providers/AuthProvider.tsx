import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { useMessenger } from './MessengerProvider';
import { useCryptoWorker, useCryptoWorkerReady } from './CryptoWorkerProvider';
import type { User, UserProfile } from '@nostrpass/types';
import { createUser, getIdentityKeypair } from '../services/userService';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  isVaultUnlocked: () => boolean;
  login: (password: string, username?: string, registrationInfo?: any) => Promise<void>;
  createAccount: (username: string, password: string, pin?: string) => Promise<{ publicKey: string }>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = createSignal(false);
  const [tempVaultData, setTempVaultData] = createSignal<any>(null);
  const messenger = useMessenger();
  const cryptoReady = useCryptoWorkerReady();
  let cryptoWorker: ReturnType<typeof useCryptoWorker> | null = null;

  // Initialize crypto worker when ready
  createEffect(() => {
    if (cryptoReady()) {
      cryptoWorker = useCryptoWorker();
    }
  });

  // Load user session from localStorage on mount
  onMount(() => {
    const savedSession = localStorage.getItem('vault-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Verify session is still valid
        if (session.expiresAt > Date.now()) {
          setUser(session.user);
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

    // Handle public key requests from parent
    messenger.messenger.route('GET_PUBLIC_KEY', {
      handler: async (_data: any) => {
        const currentUser = user();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        return {
          publicKey: currentUser.publicKey,
          timestamp: Date.now()
        };
      }
    });

    // Handle sign event requests
    messenger.messenger.route('SIGN_EVENT', {
      handler: async (data: any) => {
        const currentUser = user();
        if (!currentUser || !currentUser.privateKey || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        const result = await cryptoWorker.signEvent({
          event: data.event,
          privateKey: currentUser.privateKey
        });

        return {
          signedEvent: result.event
        };
      }
    });

    // Handle encrypt requests (NIP-04)
    messenger.messenger.route('ENCRYPT', {
      handler: async (data: { plaintext: string; recipientPubkey: string }) => {
        const currentUser = user();
        if (!currentUser || !currentUser.privateKey || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        const encrypted = await cryptoWorker.encrypt({
          plaintext: data.plaintext,
          recipientPubkey: data.recipientPubkey,
          privateKey: currentUser.privateKey
        });

        return { ciphertext: encrypted };
      }
    });

    // Handle decrypt requests (NIP-04)
    messenger.messenger.route('DECRYPT', {
      handler: async (data: { ciphertext: string; senderPubkey: string }) => {
        const currentUser = user();
        if (!currentUser || !currentUser.privateKey || !cryptoWorker) {
          throw new Error('User not authenticated or crypto not ready');
        }

        const decrypted = await cryptoWorker.decrypt({
          ciphertext: data.ciphertext,
          senderPubkey: data.senderPubkey,
          privateKey: currentUser.privateKey
        });

        return { plaintext: decrypted };
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
  });

  const createAccount = async (username: string, password: string, pin?: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {
      // Create new user with xpriv and Personal identity
      const userMasterKey = await createUser();
      console.log('Created user master key:', userMasterKey);
      
      // Get the keypair for the Personal identity (index 0)
      const personalIdentity = userMasterKey.identities[0];
      console.log('Personal identity:', personalIdentity);
      
      const { privateKey, publicKey } = await getIdentityKeypair(userMasterKey.xpriv, personalIdentity);
      
      // Derive encryption key from password
      const { key: passwordKey, salt: passwordSalt } = await cryptoWorker.deriveKey({
        password,
      });

      let encryptedXpriv;
      let pinSalt;
      let pinHash;
      
      if (pin) {
        // If PIN is provided, use double encryption: password -> PIN -> xpriv
        // First encrypt with PIN
        const { key: pinKey, salt: derivedPinSalt } = await cryptoWorker.deriveKey({
          password: pin,
        });
        pinSalt = derivedPinSalt;
        
        // Hash the PIN for verification later
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const hash = await crypto.subtle.digest('SHA-256', pinData);
        pinHash = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        const pinEncryptedXpriv = await cryptoWorker.encryptData({
          data: userMasterKey.xpriv,
          password: pinKey
        });
        
        // Then encrypt with password
        encryptedXpriv = await cryptoWorker.encryptData({
          data: pinEncryptedXpriv,
          password: passwordKey
        });
      } else {
        // No PIN, just encrypt with password (backward compatibility)
        encryptedXpriv = await cryptoWorker.encryptData({
          data: userMasterKey.xpriv,
          password: passwordKey
        });
      }

      // Create user object with Personal identity keys
      const newUser: User = {
        publicKey,
        privateKey, // Keep in memory for this session
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

      // Store encrypted data locally with username as key
      const vaultData = {
        encryptedXpriv,
        salt: passwordSalt,
        pinSalt,
        pinHash,
        publicKey,
        username,
        identities: userMasterKey.identities,
        currentIdentityIndex: 0, // Using Personal identity
        hasPin: !!pin
      };
      // Store per-user vault data
      console.log('Vault data being stored:', vaultData);
      localStorage.setItem(`vault-data-${username}`, JSON.stringify(vaultData));
      // Also store a list of known usernames
      const knownUsers = JSON.parse(localStorage.getItem('vault-known-users') || '[]');
      if (!knownUsers.includes(username)) {
        knownUsers.push(username);
        localStorage.setItem('vault-known-users', JSON.stringify(knownUsers));
      }

      // Store session
      const session = {
        user: newUser,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
      };
      localStorage.setItem('vault-session', JSON.stringify(session));

      setUser(newUser);

      // Notify parent of auth status change
      messenger.send('AUTH_STATUS', {
        isAuthenticated: true,
        publicKey: newUser.publicKey
      });
      
      return { publicKey: newUser.publicKey };

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

      // Load user-specific vault data
      const vaultDataStr = localStorage.getItem(`vault-data-${username}`);
      if (!vaultDataStr) {
        // Try old format for backward compatibility
        const oldVaultDataStr = localStorage.getItem('vault-data');
        if (oldVaultDataStr) {
          const oldVaultData = JSON.parse(oldVaultDataStr);
          if (oldVaultData.username === username) {
            // Migrate to new format
            localStorage.setItem(`vault-data-${username}`, oldVaultDataStr);
            localStorage.removeItem('vault-data');
          } else {
            // User exists on Nostr but no local vault data
            if (registrationInfo) {
              throw new Error('No vault data found on this device. Multi-device sync coming soon!');
            }
            throw new Error('User not found');
          }
        } else {
          // User exists on Nostr but no local vault data
          if (registrationInfo) {
            console.log('User registered on Nostr:', registrationInfo);
            throw new Error('No vault data found on this device. Multi-device sync coming soon!');
          }
          throw new Error('User not found');
        }
      }

      const vaultData = JSON.parse(localStorage.getItem(`vault-data-${username}`)!);

      // Derive key from password
      const { key: encryptionKey } = await cryptoWorker.deriveKey({
        password,
        salt: vaultData.salt
      });

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
        
        // Create a limited user object without private key access
        const userToStore: User = {
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
          isAuthenticated: true,
          vaultPinHash: vaultData.pinHash, // Store PIN hash for verification
          session: {
            startedAt: Date.now(),
            lastActivityAt: Date.now()
          }
        };
        
        setUser(userToStore);
        setIsVaultUnlocked(false);
        
        // Don't notify parent of full auth - vault is locked
        return; // Exit early - user needs to unlock with PIN
      }
      
      // No PIN protection, decrypt normally
      // Handle both old format (encryptedPrivateKey) and new format (encryptedXpriv)
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

      // Verify key pair
      const derivedPublicKey = await cryptoWorker.getPublicKey({ privateKey });
      if (derivedPublicKey !== publicKey) {
        throw new Error('Invalid password');
      }

      // Create user object
      const userToStore: User = {
        publicKey,
        privateKey,
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

      // Store session
      const session = {
        user: userToStore,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
      };
      localStorage.setItem('vault-session', JSON.stringify(session));

      setUser(userToStore);

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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vault-session');

    messenger.send('AUTH_STATUS', {
      isAuthenticated: false,
      publicKey: null
    });
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

  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    const vaultData = tempVaultData();
    if (!vaultData) {
      throw new Error('No vault data to unlock');
    }
    
    try {
      // Hash the provided PIN
      const encoder = new TextEncoder();
      const pinData = encoder.encode(pin);
      const hash = await crypto.subtle.digest('SHA-256', pinData);
      const pinHash = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Verify PIN hash
      if (pinHash !== vaultData.vaultData.pinHash) {
        return false;
      }
      
      // Derive PIN key
      const { key: pinKey } = await cryptoWorker.deriveKey({
        password: pin,
        salt: vaultData.vaultData.pinSalt
      });
      
      // First decrypt with password key to get PIN-encrypted data
      const pinEncryptedXpriv = await cryptoWorker.decryptData({
        encryptedData: vaultData.vaultData.encryptedXpriv,
        password: vaultData.encryptionKey
      });
      
      // Then decrypt with PIN to get xpriv
      const xpriv = await cryptoWorker.decryptData({
        encryptedData: pinEncryptedXpriv,
        password: pinKey
      });
      
      // Get the current identity (default to Personal at index 0)
      const currentIdentity = vaultData.vaultData.identities[vaultData.vaultData.currentIdentityIndex || 0];
      const keypair = await getIdentityKeypair(xpriv, currentIdentity);
      
      // Update user with decrypted private key
      const currentUser = user();
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          privateKey: keypair.privateKey
        };
        setUser(updatedUser);
        setIsVaultUnlocked(true);
        
        // Notify parent of full auth
        messenger.send('AUTH_STATUS', {
          isAuthenticated: true,
          publicKey: currentUser.publicKey
        });
      }
      
      // Clear temp vault data
      setTempVaultData(null);
      
      return true;
    } catch (error) {
      console.error('Failed to unlock vault:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: () => !!user(),
    isLoading,
    isVaultUnlocked,
    login,
    createAccount,
    logout,
    updateProfile,
    unlockVault
  };

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