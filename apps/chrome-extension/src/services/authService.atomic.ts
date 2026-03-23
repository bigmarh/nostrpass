/**
 * Atomic Auth Service
 *
 * Simplified auth service using SessionStateManager.
 * ONE call instead of 3+.
 *
 * This is how the CLI tool works - simple and reliable.
 */

export interface AuthStatus {
  isAuthenticated: boolean;
  isLocked: boolean;
  user: {
    username: string;
    publicKey: string;
    storagePublicKey?: string;
  } | null;
  sessionId: string | null;
  vaultVersion?: number;
  identityCount?: number;
  timestamp: number;
}

/**
 * Get authentication status
 * ONE call returns complete state - no more piecing together!
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
    // ONE call instead of 3+!
    const state = await cryptoWorker.getAuthState({});

    return {
      isAuthenticated: state.isAuthenticated,
      isLocked: state.isLocked,
      user: state.user,
      sessionId: state.sessionId,
      vaultVersion: state.vaultVersion,
      identityCount: state.identityCount,
      timestamp: state.timestamp
    };
  } catch (error) {
    console.error('[authService.atomic] Error getting auth status:', error);
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
 * Atomic login
 * Like the CLI: fetch from Nostr → create session → done
 */
export async function atomicLogin(
  cryptoWorker: any,
  params: {
    username: string;
    password: string;
    relays: string[];
    environment?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await cryptoWorker.atomicLogin(params);
    return { success: true };
  } catch (error: any) {
    console.error('[authService.atomic] Login failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atomic unlock
 * Decrypts keys and updates session
 */
export async function atomicUnlock(
  cryptoWorker: any,
  params: {
    username: string;
    pin: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await cryptoWorker.atomicUnlock(params);
    return { success: true };
  } catch (error: any) {
    console.error('[authService.atomic] Unlock failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atomic logout
 * Clears everything
 */
export async function atomicLogout(
  cryptoWorker: any,
  username: string
): Promise<{ success: boolean }> {
  try {
    await cryptoWorker.atomicLogout({ username });
    return { success: true };
  } catch (error) {
    console.error('[authService.atomic] Logout failed:', error);
    return { success: false };
  }
}

/**
 * Lock session (keep authenticated but clear keys)
 */
export async function lockSession(
  cryptoWorker: any,
  username: string
): Promise<{ success: boolean }> {
  try {
    await cryptoWorker.lockSession({ username });
    return { success: true };
  } catch (error) {
    console.error('[authService.atomic] Lock failed:', error);
    return { success: false };
  }
}

/**
 * Refresh auth status (useful after operations)
 */
export async function refreshAuthStatus(cryptoWorker: any): Promise<AuthStatus> {
  return getAuthStatus(cryptoWorker);
}
