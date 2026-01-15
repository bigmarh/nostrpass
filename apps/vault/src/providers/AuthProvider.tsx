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
import type { UserProfile, ErrorCode, IdentifierType } from '@nostrpass/types';
import { getCryptoWorker, getCryptoWorkerInstance } from '../services/cryptoWorkerSingleton';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { setupMessengerRoutes } from './auth/AuthWorkerBridge';

/**
 * Complete auth state - everything in one object
 *
 * Key identifier: storagePublicKey is the UNIVERSAL vault identifier.
 * - username is for display only
 * - storagePublicKey is used for all data lookups
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  user: {
    username: string; // Login identifier (Google UID for Google auth, actual username for username auth)
    displayName: string; // Human-readable name for UI display
    publicKey: string; // Nostr public key (npub)
    storagePublicKey: string; // Universal vault identifier (used for all lookups)
  } | null;
  sessionId: string | null;
  vaultVersion?: number;
  identityCount?: number;
  environment?: string | null; // Environment used for login (production, demo, etc.)
  authProvider?: 'username' | 'google' | null; // How the user logged in
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLocked: true,
  isLoading: false,
  user: null,
  sessionId: null,
  environment: null,
  authProvider: null
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
  login: (password: string, identifier: string, identifierType?: IdentifierType, displayName?: string, environment?: string, vaultDTag?: string, vaultPasswordSalt?: string) => Promise<void>;
  createAccount: (identifier: string, password: string, pin: string, recovery?: { questions: string[], answers: string[] }, identifierType?: IdentifierType, displayName?: string, googleUid?: string, environment?: string) => Promise<{ publicKey: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [authState, setAuthState] = createSignal<AuthState>(initialState);
  const messenger = useMessenger();
  const { getRelays, storageEnvironmentName } = useEnvironment();
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
          identityCount: state.identityCount,
          environment: state.environment,
          authProvider: state.authProvider
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
            identityCount: state.identityCount,
            environment: state.environment,
            authProvider: state.authProvider
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
            console.log('[AuthProvider] Sending logout notification to embassy');
            messenger.send('AUTH_STATUS', {
              isAuthenticated: false,
              publicKey: null
            });
            // Also send explicit LOGOUT message to trigger button updates
            messenger.send('LOGOUT', {});
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
          storagePublicKey: state.user.storagePublicKey,
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
            storagePublicKey: state.user.storagePublicKey,
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
        isVaultLocked: () => authState().isLocked,
        cryptoWorker,
        unlockVault
      });
    },
    { defer: true }
  ));

  /**
   * Login with atomic operation
   * @param password - User's password for decryption
   * @param identifier - Username or Google UID
   * @param identifierType - 'username' or 'google' (defaults to 'username')
   * @param displayName - Display name (for Google auth)
   * @param environment - Optional environment override (if provided, takes precedence)
   * @param vaultDTag - For multi-vault Google auth: specific d-tag to fetch
   * @param vaultPasswordSalt - For multi-vault: password salt from vault picker
   */
  const login = async (password: string, identifier: string, identifierType: IdentifierType = 'username', displayName?: string, environment?: string, vaultDTag?: string, vaultPasswordSalt?: string) => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      // Import getEnvironment and getNamespace to check for custom settings from global config
      const { getEnvironment, getNamespace, isConfiguredByUser } = await import('@nostrpass/nostrHelpers');
      const globalEnv = getEnvironment();
      const globalNamespace = getNamespace();
      const providerEnv = storageEnvironmentName();
      const userConfigured = isConfiguredByUser();

      // Priority: explicit param > user advanced settings > developer URL param > global default
      // User settings take precedence because they explicitly configured it
      let effectiveEnvironment: string;
      if (environment) {
        // Explicit param passed to function (e.g., from Google auth flow)
        effectiveEnvironment = environment;
      } else if (userConfigured) {
        // User explicitly configured via Advanced settings modal
        effectiveEnvironment = globalEnv;
      } else {
        // Developer's URL param or global default
        effectiveEnvironment = providerEnv;
      }

      console.log('[AuthProvider] ========================================');
      console.log('[AuthProvider] STARTING LOGIN');
      console.log('[AuthProvider] Identifier:', identifier);
      console.log('[AuthProvider] Identifier Type:', identifierType);
      console.log('[AuthProvider] Display Name:', displayName);
      console.log('[AuthProvider] Global Config - Namespace:', globalNamespace);
      console.log('[AuthProvider] Global Config - Environment:', globalEnv);
      console.log('[AuthProvider] Provider Environment:', providerEnv);
      console.log('[AuthProvider] User Configured:', userConfigured);
      console.log('[AuthProvider] Explicit Environment Param:', environment);
      console.log('[AuthProvider] EFFECTIVE Environment:', effectiveEnvironment);
      console.log('[AuthProvider] ========================================');

      await cryptoWorker.atomicLogin({
        identifier,
        identifierType,
        password,
        relays: getRelays(),
        environment: effectiveEnvironment,
        namespace: globalNamespace,
        displayName,
        vaultDTag,
        vaultPasswordSalt
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
   * Uses storagePublicKey as the session identifier
   */
  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    const state = authState();
    if (!state.user?.storagePublicKey) {
      throw new Error('No user logged in');
    }

    try {
      console.log('[AuthProvider] Starting atomic unlock for user:', state.user.username);

      // Worker looks up session by username
      await cryptoWorker.atomicUnlock({
        username: state.user.username,
        pin
      });

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Vault unlocked');
      return true;
    } catch (error) {
      console.error('[AuthProvider] Unlock failed:', error);
      // Don't show toast for VaultObj not found - let caller handle with custom UI
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes('VaultObj not found')) {
        showErrorToast(errorMessage as ErrorCode);
      }
      // Rethrow so caller can see the actual error message
      throw error;
    }
  };

  /**
   * Logout with atomic operation
   * Uses storagePublicKey as the session identifier
   */
  const logout = async () => {
    if (!cryptoWorker) {
      return;
    }

    const state = authState();
    if (!state.user?.storagePublicKey) {
      return;
    }

    try {
      console.log('[AuthProvider] Starting atomic logout for storagePublicKey:', state.user.storagePublicKey.slice(0, 12) + '...');

      await cryptoWorker.atomicLogout({
        username: state.user.storagePublicKey
      });

      // Notify embassy about logout and request vault close
      if (messenger) {
        console.log('[AuthProvider] Sending logout message to embassy');
        messenger.send('nostrpass:logout', {
          storagePublicKey: state.user.storagePublicKey,
          username: state.user.username,
          timestamp: Date.now()
        });

        // Request embassy to close/hide the vault
        console.log('[AuthProvider] Requesting embassy to hide vault');
        messenger.send('HIDE_VAULT', {});
      }

      // State will be updated via AUTH_STATE_CHANGED event
      showSuccessToast('Logged out successfully');
    } catch (error) {
      console.error('[AuthProvider] Logout failed:', error);
      showErrorToast((error as Error).message as ErrorCode);
    }
  };

  /**
   * Lock vault
   * Uses storagePublicKey as the session identifier
   */
  const lockVault = async () => {
    if (!cryptoWorker) {
      return;
    }

    const state = authState();
    if (!state.user?.storagePublicKey) {
      return;
    }

    try {
      console.log('[AuthProvider] Locking vault for storagePublicKey:', state.user.storagePublicKey.slice(0, 12) + '...');

      await cryptoWorker.lockSession({
        username: state.user.storagePublicKey
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
   * @param identifier - Username or Google UID
   * @param password - User's password for encryption
   * @param pin - PIN for vault unlock
   * @param recovery - Optional recovery questions/answers
   * @param identifierType - 'username' or 'google' (defaults to 'username')
   * @param displayName - Display name (for Google auth)
   * @param googleUid - Google UID (only for Google auth)
   * @param environment - Optional environment override (if provided, takes precedence)
   */
  const createAccount = async (
    identifier: string,
    password: string,
    pin: string,
    recovery?: { questions: string[], answers: string[] },
    identifierType: IdentifierType = 'username',
    displayName?: string,
    googleUid?: string,
    environment?: string
  ): Promise<{ publicKey: string }> => {
    if (!cryptoWorker) {
      throw new Error('Crypto worker not ready');
    }

    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      // Determine effective environment (same logic as login)
      const { getEnvironment, getNamespace, isConfiguredByUser } = await import('@nostrpass/nostrHelpers');
      const globalEnv = getEnvironment();
      const globalNamespace = getNamespace();
      const providerEnv = storageEnvironmentName();
      const userConfigured = isConfiguredByUser();

      // Priority: explicit param > user advanced settings > developer URL param > global default
      // User settings take precedence because they explicitly configured it
      let effectiveEnvironment: string;
      if (environment) {
        // Explicit param passed to function (e.g., from Google auth flow)
        effectiveEnvironment = environment;
      } else if (userConfigured) {
        // User explicitly configured via Advanced settings modal
        effectiveEnvironment = globalEnv;
      } else {
        // Developer's URL param or global default
        effectiveEnvironment = providerEnv;
      }

      console.log('[AuthProvider] ========================================');
      console.log('[AuthProvider] STARTING ACCOUNT CREATION');
      console.log('[AuthProvider] Identifier:', identifier);
      console.log('[AuthProvider] Identifier Type:', identifierType);
      console.log('[AuthProvider] Display Name:', displayName);
      console.log('[AuthProvider] Global Config - Namespace:', globalNamespace);
      console.log('[AuthProvider] Global Config - Environment:', globalEnv);
      console.log('[AuthProvider] Provider Environment:', providerEnv);
      console.log('[AuthProvider] User Configured:', userConfigured);
      console.log('[AuthProvider] Explicit Environment Param:', environment);
      console.log('[AuthProvider] EFFECTIVE Environment:', effectiveEnvironment);
      console.log('[AuthProvider] ========================================');

      const result = await cryptoWorker.atomicCreateAccount({
        identifier,
        identifierType,
        displayName: displayName || identifier,
        password,
        pin,
        relays: getRelays(),
        environment: effectiveEnvironment,
        recovery,
        googleUid
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
        // storagePublicKey is the universal vault identifier for all data lookups
        storagePublicKey: state.user.storagePublicKey,
        username: state.user.username, // Include username at top level for backward compatibility
        displayName: state.user.displayName, // Include displayName for UI display
        profile: {
          username: state.user.username,
          displayName: state.user.displayName, // Include displayName in profile too
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
