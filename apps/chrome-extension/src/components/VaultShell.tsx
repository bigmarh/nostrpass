/**
 * VaultShell - Main Container Component
 * 
 * This is the root component that determines what to show based on worker auth status.
 * No routing - just conditional rendering based on worker session state.
 */

import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { getAuthStatus, triggerAuthStatusRefresh, type AuthStatus } from '../services/authService';
import { useCryptoWorker } from '../providers';
import { Login } from './Login';
import { Dashboard } from './Dashboard';
import { PinUnlock } from './PinUnlock.new'; // Use new PinUnlock component with fullscreen support

export const VaultShell: Component = () => {
  const [authStatus, setAuthStatus] = createSignal<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const cryptoWorker = useCryptoWorker();

  /**
   * Refresh auth status from worker
   * This is the single source of truth
   */
  const refreshStatus = async () => {
    setIsLoading(true);
    try {
      const status = await getAuthStatus(cryptoWorker);
      setAuthStatus(status);
    } catch (error) {
      console.error('[VaultShell] Error refreshing status:', error);
      // On error, assume not authenticated
      setAuthStatus({
        isAuthenticated: false,
        isLocked: true,
        user: null,
        sessionId: null,
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle state changes from child components
   * Child components trigger this after successful actions
   */
  const handleStateChange = () => {
    // Trigger refresh after a short delay to allow worker to update
    setTimeout(() => {
      refreshStatus();
    }, 100);
  };

  // Check auth status on mount
  onMount(() => {
    refreshStatus();

    // Listen for state change events from child components
    const handleVaultStateChange = () => {
      refreshStatus();
    };

    window.addEventListener('vault-state-change', handleVaultStateChange);

    // Also listen for worker broadcast events
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('nostrpass-vault');
      
      const handleBroadcast = (event: MessageEvent) => {
        if (event.data?.type === 'VAULT_BROADCAST') {
          const broadcastType = event.data.data?.broadcastType;
          
          // Refresh on relevant broadcast events
          if (['SESSION_UNLOCKED', 'SESSION_LOCKED', 'USER_LOGGED_IN', 'USER_LOGGED_OUT'].includes(broadcastType)) {
            refreshStatus();
          }
        }
      };

      bc.addEventListener('message', handleBroadcast);

      onCleanup(() => {
        bc.removeEventListener('message', handleBroadcast);
        bc.close();
        window.removeEventListener('vault-state-change', handleVaultStateChange);
      });
    } else {
      onCleanup(() => {
        window.removeEventListener('vault-state-change', handleVaultStateChange);
      });
    }
  });

  /**
   * Render loading state while checking auth status
   */
  const LoadingSpinner = () => (
    <div class="flex items-center justify-center min-h-screen w-full">
      <div class="flex flex-col items-center gap-4">
        <svg
          class="animate-spin h-8 w-8 text-gray-900 dark:text-gray-100"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p class="text-sm text-gray-600 dark:text-gray-400">Loading vault...</p>
      </div>
    </div>
  );

  /**
   * Conditional rendering based on auth status
   * NO state duplication - worker is single source of truth
   */
  return (
    <Show when={!isLoading() && authStatus()} fallback={<LoadingSpinner />}>
      {(status) => {
        // Not authenticated - show login/signup
        if (!status().isAuthenticated) {
          return (
            <Login
              onSuccess={() => {
                triggerAuthStatusRefresh();
                handleStateChange();
              }}
            />
          );
        }

        // Authenticated - always show Dashboard
        // Dashboard will handle showing QuickUnlock modal if vault is locked
        // Worker is source of truth - no state duplication
        if (status().isAuthenticated && status().user) {
          return (
            <Dashboard
              user={status().user}
              onStateChange={() => {
                triggerAuthStatusRefresh();
                handleStateChange();
              }}
            />
          );
        }

        // Fallback (should not happen)
        return <LoadingSpinner />;
      }}
    </Show>
  );
};

