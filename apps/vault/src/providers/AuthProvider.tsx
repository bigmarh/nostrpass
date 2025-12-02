/**
 * Streamlined AuthProvider
 *
 * Simplified auth provider using atomic operations and single source of truth.
 * Replaces complex multi-signal state with ONE authState signal.
 *
 * Key improvements:
 * - 1 worker call instead of 3-5 (getAuthState)
 * - 1 state signal instead of 4 (user, isLoading, hasPinVault, isVaultLocked)
 * - 1 restoration function instead of 3 (onMount, attemptRestore, refreshStatus)
 * - 1 event listener instead of 3 types (worker messages only)
 * - No state drift (worker is single source of truth)
 */

import { createContext, useContext, ParentComponent, createSignal, createEffect, onMount, on } from 'solid-js';
import { useMessenger, notifyAuthReady } from './MessengerProvider';
import { useEnvironment } from './EnvironmentProvider';
import type { UserProfile, ErrorCode } from '@nostrpass/types';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { setupMessengerRoutes } from './auth/AuthWorkerBridge';

/**
 * Complete auth state - everything in one object
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  user: {
    username: string;
    publicKey: string;
    storagePublicKey?: string;
  } | null;
  sessionId: string | null;
  vaultVersion?: number;
  identityCount?: number;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLocked: true,
  isLoading: false,
  user: null,
  sessionId: null
};

interface AuthContextType {
  authState: () => AuthState;
  // Derived getters for backward compatibility
  user: () => AuthState['user'];
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  hasPinVault: () => boolean;
  isVaultLocked: () => boolean;
  // Operations
  login: (password: string, username: string) => Promise<void>;
  createAccount: (username: string, password: string, pin: string, recovery?: { questions: string[], answers: string[] }) => Promise<{ publicKey: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [authState, setAuthState] = createSignal<AuthState>(initialState);
  const messenger = useMessenger();
  const { getRelays, environmentName } = useEnvironment();
  const cryptoWorker = getCryptoWorker();

  /**
   * Restore auth state from worker - ONE call
   */
  const restoreAuthState = async () => {
    if (!cryptoWorker) {
      console.log('[AuthProvider] No crypto worker, skipping restore');
      return;
    }

    try {
      console.log('[AuthProvider] Restoring auth state from worker...');

      // ONE call replaces 3-5 calls
      const state = await cryptoWorker.getAuthState({});

      console.log('[AuthProvider] Auth state from worker:', state);

      if (state?.isAuthenticated) {
        // Update localStorage for session persistence
        if (state.sessionId) {
          localStorage.setItem('vaultsession', state.sessionId);
        }
        if (state.user?.username) {
          localStorage.setItem('last-username', state.user.username);
        }

        // Set complete auth state atomically
        setAuthState({
          isAuthenticated: true,
          isLocked: state.isLocked,
          isLoading: false,
          user: state.user,
          sessionId: state.sessionId,
          vaultVersion: state.vaultVersion,
          identityCount: state.identityCount
        });

        console.log('[AuthProvider] Session restored:', {
          username: state.user?.username,
          isLocked: state.isLocked
        });
      } else {
        // Not authenticated - clear state
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
        setAuthState(initialState);
        console.log('[AuthProvider] No active session');
      }
    } catch (error) {
      console.error('[AuthProvider] Failed to restore auth state:', error);
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
      setAuthState(initialState);
    }
  };

  /**
   * Handle worker auth state changes - ONE event type
   */
  createEffect(() => {
    const workerInstance = getCryptoWorkerInstance();

    if (!workerInstance) {
      console.log('[AuthProvider] No worker instance');
      return;
    }

    const handleWorkerMessage = (event: MessageEvent) => {
      const { type, state } = event.data;

      // Listen for ONE event type: AUTH_STATE_CHANGED
      if (type === 'AUTH_STATE_CHANGED') {
        console.log('[AuthProvider] Auth state changed from worker:', state);

        if (state?.isAuthenticated) {
          setAuthState({
            isAuthenticated: true,
            isLocked: state.isLocked,
            isLoading: false,
            user: state.user,
            sessionId: state.sessionId,
            vaultVersion: state.vaultVersion,
            identityCount: state.identityCount
          });

          // Update localStorage
          if (state.sessionId) {
            localStorage.setItem('vaultsession', state.sessionId);
          }
          if (state.user?.username) {
            localStorage.setItem('last-username', state.user.username);
          }

          // Notify messenger of auth change
          if (messenger.isReady()) {
            messenger.send('VAULT_DATA_UPDATED', {
              username: state.user?.username,
              timestamp: Date.now()
            });
          }
        } else {
          // Logged out
          setAuthState(initialState);
          localStorage.removeItem('vaultsession');
          localStorage.removeItem('last-username');

          if (messenger.isReady()) {
            messenger.send('AUTH_STATUS', {
              isAuthenticated: false,
              publicKey: null
            });
          }
        }
      }
    };

    workerInstance.addEventListener('message', handleWorkerMessage as EventListener);

    // Also listen to BroadcastChannel for SharedWorker broadcasts
    const channel = new BroadcastChannel('nostrpass-vault');
    channel.onmessage = (event: MessageEvent) => {
      handleWorkerMessage(event);
    };

    return () => {
      workerInstance.removeEventListener('message', handleWorkerMessage as EventListener);
      channel.close();
    };
  });

  /**
   * Restore session on mount
   */
  onMount(async () => {
    console.log('[AuthProvider] Mounted - restoring auth state');
    await restoreAuthState();

    // Notify MessengerProvider that auth is ready
    notifyAuthReady({
      user: () => {
        const state = authState();
        return state.user ? {
          publicKey: state.user.publicKey,
          privateKey: '',
          profile: {
            username: state.user.username,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            preferences: {},
            security: { sessionTimeout: 60 }
          },
          appPermissions: new Map(),
          isAuthenticated: state.isAuthenticated,
          session: { startedAt: Date.now(), lastActivityAt: Date.now() }
        } : null;
      },
      cryptoWorker,
      isVaultLocked: () => authState().isLocked
    });
  });

  /**
   * Setup messenger routes when ready
   */
  createEffect(on(
    () => messenger.isReady() && messenger.messenger,
    (ready) => {
      if (!ready) return;

      console.log('[AuthProvider] Setting up messenger routes');
      setupMessengerRoutes({
        messenger,
        user: () => {
          const state = authState();
          return state.user ? {
            publicKey: state.user.publicKey,
            privateKey: '',
            profile: {
              username: state.user.username,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              preferences: {},
              security: { sessionTimeout: 60 }
            },
            appPermissions: new Map(),
            isAuthenticated: state.isAuthenticated,
            session: { startedAt: Date.now(), lastActivityAt: Date.now() }
          } : null;
        },
        isVaultLocked: () => authState().isLocked,
        cryptoWorker,
        unlockVault
      });
    },
    { defer: true }
  ));

  /**
   * Login with atomic operation
   */
  const login = async (password: string, username: string) => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('[AuthProvider] Starting atomic login...');

      await cryptoWorker.atomicLogin({
        username,
        password,
        relays: getRelays(),
        environment: environmentName()
      });

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Logged in successfully');
    } catch (error) {
      console.error('[AuthProvider] Login failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      showErrorToast((error as Error).message as ErrorCode);
      throw error;
    }
  };

  /**
   * Unlock vault with atomic operation
   */
  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    const state = authState();
    if (!state.user?.username) {
      throw new Error('No user logged in');
    }

    try {
      console.log('[AuthProvider] Starting atomic unlock...');

      await cryptoWorker.atomicUnlock({
        username: state.user.username,
        pin
      });

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Vault unlocked');
      return true;
    } catch (error) {
      console.error('[AuthProvider] Unlock failed:', error);
      showErrorToast((error as Error).message as ErrorCode);
      return false;
    }
  };

  /**
   * Logout with atomic operation
   */
  const logout = async () => {
    if (!cryptoWorker) {
      return;
    }

    const state = authState();
    if (!state.user?.username) {
      return;
    }

    try {
      console.log('[AuthProvider] Starting atomic logout...');

      await cryptoWorker.atomicLogout({
        username: state.user.username
      });

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Logged out successfully');
    } catch (error) {
      console.error('[AuthProvider] Logout failed:', error);
      showErrorToast((error as Error).message as ErrorCode);
    }
  };

  /**
   * Lock vault
   */
  const lockVault = async () => {
    if (!cryptoWorker) {
      return;
    }

    const state = authState();
    if (!state.user?.username) {
      return;
    }

    try {
      console.log('[AuthProvider] Locking vault...');

      await cryptoWorker.lockSession({
        username: state.user.username
      });

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Vault locked');
    } catch (error) {
      console.error('[AuthProvider] Lock failed:', error);
      showErrorToast((error as Error).message as ErrorCode);
    }
  };

  /**
   * Create account with atomic operation
   */
  const createAccount = async (
    username: string,
    password: string,
    pin: string,
    recovery?: { questions: string[], answers: string[] }
  ): Promise<{ publicKey: string }> => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('[AuthProvider] Starting atomic account creation...');

      const result = await cryptoWorker.atomicCreateAccount({
        username,
        password,
        pin,
        relays: getRelays(),
        environment: environmentName(),
        recovery
      });

      // State will be updated via AUTH_STATE_CHANGED event
      // User is immediately logged in and unlocked

      showSuccessToast('Account created successfully');

      return {
        publicKey: result.publicKey
      };
    } catch (error) {
      console.error('[AuthProvider] Account creation failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      showErrorToast((error as Error).message as ErrorCode);
      throw error;
    }
  };

  /**
   * Update profile (placeholder)
   */
  const updateProfile = (profile: Partial<UserProfile>) => {
    console.log('[AuthProvider] updateProfile called:', profile);
    // TODO: Implement if needed
  };

  // Provide context value
  const contextValue: AuthContextType = {
    authState,
    // Derived getters for backward compatibility
    user: () => {
      const state = authState();
      return state.user ? {
        publicKey: state.user.publicKey,
        privateKey: '',
        profile: {
          username: state.user.username,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          preferences: {},
          security: { sessionTimeout: 60 },
          storagePublicKey: state.user.storagePublicKey
        },
        appPermissions: new Map(),
        isAuthenticated: state.isAuthenticated,
        session: { startedAt: Date.now(), lastActivityAt: Date.now() }
      } : null;
    },
    isAuthenticated: () => authState().isAuthenticated,
    isLoading: () => authState().isLoading,
    hasPinVault: () => authState().isAuthenticated, // Has vault if authenticated
    isVaultLocked: () => authState().isLocked,
    // Operations
    login,
    createAccount,
    logout,
    updateProfile,
    unlockVault,
    lockVault
  };

  return (
    <AuthContext.Provider value={contextValue}>
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
