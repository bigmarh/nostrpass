import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount } from 'solid-js';
import { useMessenger } from './MessengerProvider';
import { useCryptoWorker, useCryptoWorkerReady } from './CryptoWorkerProvider';
import type { User, UserProfile } from '@nostrpass/types';

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  login: (password: string, username?: string) => Promise<void>;
  createAccount: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
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

  const createAccount = async (username: string, password: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {
      // Generate new keypair
      const { privateKey, publicKey } = await cryptoWorker.generateKeypair({});
      
      // Derive encryption key from password
      const { key: encryptionKey, salt } = await cryptoWorker.deriveKey({
        password,
      });

      // Encrypt private key with derived key
      const encryptedPrivateKey = await cryptoWorker.encryptData({
        data: privateKey,
        password: encryptionKey
      });

      // Create user object
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

      // Store encrypted data locally
      const vaultData = {
        encryptedPrivateKey,
        salt,
        publicKey,
        username
      };
      localStorage.setItem('vault-data', JSON.stringify(vaultData));

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

    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string, username?: string) => {
    if (!cryptoWorker) throw new Error('Crypto worker not ready');
    
    setIsLoading(true);
    try {
      // Load vault data
      const vaultDataStr = localStorage.getItem('vault-data');
      if (!vaultDataStr) {
        throw new Error('No vault data found');
      }

      const vaultData = JSON.parse(vaultDataStr);
      
      // Verify username if provided
      if (username && vaultData.username !== username) {
        throw new Error('Invalid username');
      }

      // Derive key from password
      const { key: encryptionKey } = await cryptoWorker.deriveKey({
        password,
        salt: vaultData.salt
      });

      // Decrypt private key
      const privateKey = await cryptoWorker.decryptData({
        encryptedData: vaultData.encryptedPrivateKey,
        password: encryptionKey
      });

      // Verify key pair
      const derivedPublicKey = await cryptoWorker.getPublicKey({ privateKey });
      if (derivedPublicKey !== vaultData.publicKey) {
        throw new Error('Invalid password');
      }

      // Create user object
      const userToStore: User = {
        publicKey: vaultData.publicKey,
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

  const value: AuthContextType = {
    user,
    isAuthenticated: () => !!user(),
    isLoading,
    login,
    createAccount,
    logout,
    updateProfile
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