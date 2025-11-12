/**
 * AuthSession Module
 *
 * Manages session lifecycle including restoration from localStorage,
 * cross-tab synchronization, and session status refresh.
 *
 * This module handles:
 * - Session restoration on mount from localStorage and worker state
 * - Cross-tab session synchronization via BroadcastChannel
 * - Session status updates from crypto worker
 * - Realtime Nostr subscription management
 *
 * @module AuthSession
 */

import type { User } from '@nostrpass/types';
import type { Accessor, Setter } from 'solid-js';
import type { VaultData } from '@nostrpass/nostrHelpers';

/**
 * Interface for crypto worker methods used in session management.
 * This represents a subset of the worker client API.
 */
interface CryptoWorker {
  getVaultData(params: { username: string }): Promise<VaultData | null>;
  hasKeysInSession(params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean } | null>;
  startNostrSubscription(params: { username: string; relays: string[] }): Promise<void>;
}

/**
 * Session status information returned from worker
 */
export interface SessionStatus {
  sessionId: string | null;
  username: string | null;
}

/**
 * Interface for VaultDataService methods used in session management
 */
interface VaultDataService {
  getSessionStatus(): Promise<SessionStatus>;
}

/**
 * Parameters for restoring session on mount
 */
export interface RestoreSessionParams {
  cryptoWorker: CryptoWorker;
  vaultDataService: VaultDataService;
  setUser: Setter<User | null>;
  setHasPinVault: Setter<boolean>;
  setIsVaultLocked: Setter<boolean>;
}

/**
 * Result of session restoration attempt
 */
export interface RestoreSessionResult {
  success: boolean;
  user: User | null;
  hasPinVault: boolean;
  isVaultLocked: boolean;
}

/**
 * Parameters for attempting session restore (cross-tab sync)
 */
export interface AttemptRestoreParams {
  cryptoWorker: CryptoWorker;
  vaultDataService: VaultDataService;
  setUser: Setter<User | null>;
  setHasPinVault: Setter<boolean>;
  setIsVaultLocked: Setter<boolean>;
}

/**
 * Parameters for refreshing session status
 */
export interface RefreshSessionParams {
  cryptoWorker: CryptoWorker;
  user: Accessor<User | null>;
  setIsVaultLocked: Setter<boolean>;
  setHasPinVault: Setter<boolean>;
}

/**
 * Parameters for session refresh listener
 */
export interface SessionRefreshListenerParams {
  user: Accessor<User | null>;
  refreshSessionStatus: () => Promise<void>;
  attemptSessionRestore: () => Promise<void>;
}

/**
 * Parameters for starting realtime subscription
 */
export interface StartRealtimeParams {
  username: string;
  cryptoWorker: CryptoWorker;
  relays: string[];
}

/**
 * Restore user session from localStorage on mount.
 *
 * Checks the crypto worker for an active session and attempts to restore
 * the user state from cached vault data. Updates localStorage with session
 * information if successful.
 *
 * @param params - Session restoration parameters including worker and setters
 * @returns Promise resolving to restoration result
 *
 * @example
 * ```typescript
 * onMount(async () => {
 *   const result = await restoreSessionOnMount({
 *     cryptoWorker,
 *     vaultDataService,
 *     setUser,
 *     setHasPinVault,
 *     setIsVaultLocked
 *   });
 *
 *   if (result.success) {
 *     console.log('Session restored for:', result.user?.profile.username);
 *   }
 * });
 * ```
 */
export async function restoreSessionOnMount(
  params: RestoreSessionParams
): Promise<RestoreSessionResult> {
  const {
    cryptoWorker,
    vaultDataService,
    setUser,
    setHasPinVault,
    setIsVaultLocked
  } = params;

  console.log('[AuthSession] Starting session restoration on mount');

  try {
    // Get session status from worker
    const sessionStatus = await vaultDataService.getSessionStatus();
    console.log('[AuthSession] Session status:', {
      hasSessionId: !!sessionStatus.sessionId,
      username: sessionStatus.username
    });

    if (sessionStatus.sessionId && sessionStatus.username) {
      // Update localStorage with session data
      localStorage.setItem('vaultsession', sessionStatus.sessionId);
      localStorage.setItem('last-username', sessionStatus.username);

      try {
        // Try to load vault data from worker
        const vaultData = await cryptoWorker.getVaultData({ username: sessionStatus.username });

        if (vaultData) {
          console.log('[AuthSession] Vault data loaded, checking key status');

          // Check if session has keys (unlocked state)
          const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
          const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);

          console.log('[AuthSession] Key status:', {
            hasPrivateKey: keyStatus?.hasPrivateKey,
            hasXpriv: keyStatus?.hasXpriv,
            isUnlocked
          });

          // Create restored user object
          const restoredUser: User = {
            publicKey: vaultData.publicKey,
            privateKey: '', // Never store private key in UI thread
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

          // Update state
          setUser(restoredUser);
          setHasPinVault(true);
          setIsVaultLocked(!isUnlocked);

          console.log('[AuthSession] Session restored successfully:', {
            username: vaultData.username,
            isUnlocked
          });

          return {
            success: true,
            user: restoredUser,
            hasPinVault: true,
            isVaultLocked: !isUnlocked
          };
        } else {
          console.log('[AuthSession] No vault data found for session');
        }
      } catch (error) {
        console.error('[AuthSession] Failed to restore vault data:', error);

        // Clear invalid session data
        localStorage.removeItem('vaultsession');
        localStorage.removeItem('last-username');
      }
    } else {
      console.log('[AuthSession] No active session found');

      // Clear stale localStorage data
      localStorage.removeItem('vaultsession');
      localStorage.removeItem('last-username');
    }

    return {
      success: false,
      user: null,
      hasPinVault: false,
      isVaultLocked: true
    };
  } catch (error) {
    console.error('[AuthSession] Session restoration failed:', error);

    // Clean up on error
    localStorage.removeItem('vaultsession');
    localStorage.removeItem('last-username');

    return {
      success: false,
      user: null,
      hasPinVault: false,
      isVaultLocked: true
    };
  }
}

/**
 * Try to restore session from worker (cross-tab synchronization).
 *
 * This function is called when another tab logs in or updates the session.
 * It attempts to restore the current tab's session state from the worker's
 * shared session data.
 *
 * @param params - Restore parameters including worker and state setters
 * @returns Promise that resolves when restoration attempt completes
 *
 * @example
 * ```typescript
 * // Called from BroadcastChannel or custom event listener
 * const attemptRestore = async () => {
 *   await attemptSessionRestore({
 *     cryptoWorker,
 *     vaultDataService,
 *     setUser,
 *     setHasPinVault,
 *     setIsVaultLocked
 *   });
 * };
 *
 * window.addEventListener('session-refresh', attemptRestore);
 * ```
 */
export async function attemptSessionRestore(
  params: AttemptRestoreParams
): Promise<void> {
  const {
    cryptoWorker,
    vaultDataService,
    setUser,
    setHasPinVault,
    setIsVaultLocked
  } = params;

  console.log('[AuthSession] Attempting session restore (cross-tab sync)');

  try {
    // Get current session status from worker
    const sessionStatus = await vaultDataService.getSessionStatus();

    if (sessionStatus.sessionId && sessionStatus.username) {
      console.log('[AuthSession] Active session found:', sessionStatus.username);

      // Update localStorage
      localStorage.setItem('vaultsession', sessionStatus.sessionId);
      localStorage.setItem('last-username', sessionStatus.username);

      try {
        // Load vault data
        const vaultData = await cryptoWorker.getVaultData({ username: sessionStatus.username });

        if (vaultData) {
          // Check unlock status
          const keyStatus = await cryptoWorker.hasKeysInSession({ username: sessionStatus.username });
          const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);

          console.log('[AuthSession] Vault data loaded:', {
            username: vaultData.username,
            isUnlocked
          });

          // Create user object
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

          // Update state
          setUser(restoredUser);
          setHasPinVault(true);
          setIsVaultLocked(!isUnlocked);

          console.log('[AuthSession] Session restored from cross-tab sync');
        } else {
          console.log('[AuthSession] No vault data available for restore');
        }
      } catch (error) {
        console.error('[AuthSession] Failed to load vault data during restore:', error);
        // Don't throw - allow silent failure for cross-tab sync
      }
    } else {
      console.log('[AuthSession] No active session to restore');
    }
  } catch (error) {
    console.error('[AuthSession] Session restore attempt failed:', error);
    // Don't throw - allow silent failure for cross-tab sync
  }
}

/**
 * Update vault lock state from worker.
 *
 * Queries the crypto worker to determine if the vault has active keys
 * in the session, and updates the UI lock state accordingly.
 *
 * @param params - Refresh parameters including worker and state setters
 * @returns Promise that resolves when status is refreshed
 *
 * @example
 * ```typescript
 * // Refresh after unlock event from another tab
 * await refreshSessionStatus({
 *   cryptoWorker,
 *   user,
 *   setIsVaultLocked,
 *   setHasPinVault
 * });
 * ```
 */
export async function refreshSessionStatus(
  params: RefreshSessionParams
): Promise<void> {
  const { cryptoWorker, user, setIsVaultLocked, setHasPinVault } = params;

  console.log('[AuthSession] Refreshing session status');

  try {
    const currentUser = user();

    if (!currentUser) {
      console.log('[AuthSession] No current user, skipping refresh');
      return;
    }

    // Check key status in worker session
    const keyStatus = await cryptoWorker.hasKeysInSession({
      username: currentUser.profile.username
    });

    const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);

    console.log('[AuthSession] Session status refreshed:', {
      username: currentUser.profile.username,
      hasPrivateKey: keyStatus?.hasPrivateKey,
      hasXpriv: keyStatus?.hasXpriv,
      isUnlocked
    });

    // Update lock state
    setIsVaultLocked(!isUnlocked);
    setHasPinVault(!isUnlocked);
  } catch (error) {
    console.error('[AuthSession] Failed to refresh session status:', error);
    // On error, assume locked for security
    setIsVaultLocked(true);
    setHasPinVault(true);
  }
}

/**
 * Set up event listener for cross-tab session refresh events.
 *
 * Listens for 'session-refresh' custom events dispatched when another tab
 * changes the session state (login, logout, unlock, lock). Automatically
 * refreshes or restores the current tab's session state.
 *
 * @param params - Listener parameters including user accessor and callbacks
 * @returns Cleanup function to remove event listener
 *
 * @example
 * ```typescript
 * onMount(() => {
 *   const cleanup = setupSessionRefreshListener({
 *     user,
 *     refreshSessionStatus: async () => {
 *       await refreshSessionStatus({
 *         cryptoWorker,
 *         user,
 *         setIsVaultLocked,
 *         setHasPinVault
 *       });
 *     },
 *     attemptSessionRestore: async () => {
 *       await attemptSessionRestore({
 *         cryptoWorker,
 *         vaultDataService,
 *         setUser,
 *         setHasPinVault,
 *         setIsVaultLocked
 *       });
 *     }
 *   });
 *
 *   return cleanup; // Called on component unmount
 * });
 * ```
 */
export function setupSessionRefreshListener(
  params: SessionRefreshListenerParams
): () => void {
  const { user, refreshSessionStatus, attemptSessionRestore } = params;

  console.log('[AuthSession] Setting up session refresh listener');

  /**
   * Handle session-refresh events from other tabs
   */
  const handleSessionRefresh = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { username: eventUsername } = customEvent.detail || {};

    console.log('[AuthSession] Session refresh event received:', {
      eventUsername,
      currentUsername: user()?.profile.username
    });

    const currentUser = user();

    if (currentUser?.profile.username === eventUsername) {
      // Same user - just refresh status
      console.log('[AuthSession] Refreshing status for current user');
      refreshSessionStatus().catch((error) => {
        console.error('[AuthSession] Failed to refresh session status:', error);
      });
    } else if (!currentUser) {
      // No current user - attempt full restore
      console.log('[AuthSession] No current user, attempting full restore');
      attemptSessionRestore().catch((error) => {
        console.error('[AuthSession] Failed to restore session:', error);
      });
    } else {
      console.log('[AuthSession] Different user logged in, ignoring event');
    }
  };

  // Register event listener
  window.addEventListener('session-refresh', handleSessionRefresh as EventListener);

  // Return cleanup function
  return () => {
    console.log('[AuthSession] Cleaning up session refresh listener');
    window.removeEventListener('session-refresh', handleSessionRefresh as EventListener);
  };
}

/**
 * Start Nostr realtime subscription for vault updates.
 *
 * Initiates a realtime subscription in the crypto worker to listen for
 * vault updates from Nostr relays. This enables automatic synchronization
 * when vault data is updated from other devices or clients.
 *
 * @param params - Subscription parameters including username, worker, and relays
 * @returns Promise that resolves when subscription is started
 *
 * @example
 * ```typescript
 * // Start after successful unlock
 * await startRealtimeSubscription({
 *   username: 'alice',
 *   cryptoWorker,
 *   relays: ['wss://relay.damus.io', 'wss://relay.nostr.band']
 * });
 * ```
 */
export async function startRealtimeSubscription(
  params: StartRealtimeParams
): Promise<void> {
  const { username, cryptoWorker, relays } = params;

  console.log('[AuthSession] Starting realtime Nostr subscription:', {
    username,
    relayCount: relays.length
  });

  try {
    await cryptoWorker.startNostrSubscription({ username, relays });
    console.log('[AuthSession] Realtime subscription started successfully');
  } catch (error) {
    console.error('[AuthSession] Failed to start realtime subscription:', error);
    // Non-critical failure - log but don't throw
    console.warn('[AuthSession] Vault will still work, but real-time sync disabled');
  }
}
