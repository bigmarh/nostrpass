/**
 * Crypto Handlers - Main Entry Point
 *
 * This file serves as the main entry point for all crypto worker operations.
 * It imports and re-exports handlers from four specialized modules:
 *
 * 1. crypto-primitives.ts - Stateless cryptographic operations
 * 2. vault-operations.ts - Database CRUD operations
 * 3. session-manager.ts - Session lifecycle and validation
 * 4. nostr-sync.ts - Nostr relay synchronization
 *
 * This architecture provides:
 * - Better code organization (split 2,268 lines into 4 focused modules)
 * - Easier testing and maintenance
 * - Clear separation of concerns
 * - Reduced cognitive load for developers
 */

// Import all modules
import { cryptoPrimitives, ensureCryptoReady as ensureCryptoPrimitivesReady } from './crypto-primitives';
import { vaultOperations, setActiveSessions, setLogSessionState } from './vault-operations';
import { sessionManager, activeSessions, logSessionState } from './session-manager';
import { nostrSync } from './nostr-sync';

// Import atomic auth handlers (new simplified API)
import {
  handleGetAuthState,
  handleAtomicLogin,
  handleAtomicUnlock,
  handleAtomicLogout,
  handleLockSession,
  handleGetVaultDataFromSession,
  handleUpdateVaultMetadata,
  handleHasValidSession
} from './auth-handlers-atomic';

// Import atomic signup handler
import { handleAtomicCreateAccount } from './signup-handler-atomic';

// Wire up dependencies to avoid circular imports
// vault-operations needs access to activeSessions for deleteVault
setActiveSessions(activeSessions);
setLogSessionState(logSessionState);

/**
 * Unified handlers object that maintains backward compatibility
 * All handlers from the four modules are merged into a single export
 */
export const handlers = {
  // Crypto primitives (stateless operations)
  ...cryptoPrimitives,

  // Vault operations (database CRUD)
  ...vaultOperations,

  // Session management (session lifecycle, auth, permissions)
  ...sessionManager,

  // Nostr synchronization (relay interactions, PRE events)
  ...nostrSync,

  // Atomic auth handlers (new simplified API - can be used alongside old API)
  getAuthState: handleGetAuthState,
  atomicLogin: handleAtomicLogin,
  atomicUnlock: handleAtomicUnlock,
  atomicLogout: handleAtomicLogout,
  atomicCreateAccount: handleAtomicCreateAccount,
  lockSession: handleLockSession,
  getVaultDataFromSession: handleGetVaultDataFromSession,
  updateVaultMetadata: handleUpdateVaultMetadata,
  hasValidSession: handleHasValidSession,
};

/**
 * Export utility functions for worker initialization and external access
 * These maintain the same API as before the refactor
 */
export {
  ensureCryptoPrimitivesReady as ensureCryptoReady,
  activeSessions,
  logSessionState
};
