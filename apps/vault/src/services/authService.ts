/**
 * Auth Service
 *
 * Provides worker queries for authentication status.
 * Worker session is the single source of truth.
 */

import type { User } from '@nostrpass/types';

export interface AuthStatus {
  isAuthenticated: boolean;
  isLocked: boolean;
  user: {
    username: string;
    publicKey: string;
    storagePublicKey?: string;
  } | null;
  sessionId: string | null;
  timestamp: number;
}

/**
 * Get authentication status from worker (atomic version)
 * This uses the new atomic handlers for single-call auth state
 */
export async function getAuthStatus(cryptoWorker: any): Promise<AuthStatus> {
  if (!cryptoWorker) {
    return {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null,
      timestamp: Date.now()
    };
  }

  try {
    // Try atomic API first
    if (typeof cryptoWorker.getAuthState === 'function') {
      const state = await cryptoWorker.getAuthState({});

      if (!state.isAuthenticated) {
        return {
          isAuthenticated: false,
          isLocked: true,
          user: null,
          sessionId: null,
          timestamp: Date.now()
        };
      }

      return {
        isAuthenticated: state.isAuthenticated,
        isLocked: state.isLocked,
        user: {
          username: state.username,
          publicKey: state.publicKey,
          storagePublicKey: state.storagePublicKey
        },
        sessionId: state.sessionId,
        timestamp: Date.now()
      };
    }

    // Fallback to old multi-call approach
    const { VaultDataService } = await import('./vaultDataService');
    const vaultDataService = VaultDataService.getInstance();
    const sessionStatus = await vaultDataService.getSessionStatus();

    if (!sessionStatus.sessionId || !sessionStatus.username) {
      return {
        isAuthenticated: false,
        isLocked: true,
        user: null,
        sessionId: null,
        timestamp: Date.now()
      };
    }

    const keyStatus = await cryptoWorker.hasKeysInSession({
      username: sessionStatus.username
    });

    const isUnlocked = !!(keyStatus?.hasPrivateKey || keyStatus?.hasXpriv);

    const vaultData = await cryptoWorker.getVaultData({
      username: sessionStatus.username
    });

    if (!vaultData) {
      return {
        isAuthenticated: false,
        isLocked: true,
        user: null,
        sessionId: null,
        timestamp: Date.now()
      };
    }

    return {
      isAuthenticated: true,
      isLocked: !isUnlocked,
      user: {
        username: sessionStatus.username,
        publicKey: vaultData.publicKey,
        storagePublicKey: vaultData.storagePublicKey || vaultData.publicKey
      },
      sessionId: sessionStatus.sessionId,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[authService] Error getting auth status:', error);
    return {
      isAuthenticated: false,
      isLocked: true,
      user: null,
      sessionId: null,
      timestamp: Date.now()
    };
  }
}

/**
 * Refresh auth status after an action (login, unlock, logout)
 * Triggers a state refresh event
 */
export function triggerAuthStatusRefresh(): void {
  window.dispatchEvent(new CustomEvent('vault-state-change', {
    detail: { timestamp: Date.now() }
  }));
}

/**
 * Get current user from worker
 * Returns null if not authenticated
 */
export async function getCurrentUser(cryptoWorker: any): Promise<User | null> {
  const status = await getAuthStatus(cryptoWorker);

  if (!status.isAuthenticated || !status.user) {
    return null;
  }

  // Get vault data for full user info
  const vaultData = await cryptoWorker.getVaultData({
    username: status.user.username
  });

  if (!vaultData) {
    return null;
  }

  return {
    publicKey: status.user.publicKey,
    privateKey: '',
    profile: {
      username: status.user.username,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preferences: {},
      security: {
        sessionTimeout: 60
      },
      storagePublicKey: status.user.storagePublicKey
    },
    appPermissions: new Map(),
    isAuthenticated: true,
    session: {
      startedAt: Date.now(),
      lastActivityAt: Date.now()
    }
  };
}
