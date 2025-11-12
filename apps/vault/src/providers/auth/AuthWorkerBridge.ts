/**
 * AuthWorkerBridge Module
 *
 * Manages communication between AuthProvider and Web Workers, including:
 * - Worker message handling (session events, vault broadcasts)
 * - BroadcastChannel for cross-tab synchronization
 * - Messenger routes for NIP-07 operations (getPublicKey, signEvent, encrypt, decrypt)
 * - Permission checking and identity resolution
 *
 * @module AuthWorkerBridge
 */

import type { Accessor, Setter } from 'solid-js';
import type { User } from '@nostrpass/types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

/**
 * Interface for crypto worker methods used in worker bridge
 */
interface CryptoWorker {
  getVaultData(params: { username: string }): Promise<any>;
  hasKeysInSession(params: { username: string }): Promise<{ hasPrivateKey: boolean; hasXpriv: boolean } | null>;
  signEventWithSession(params: { username: string; event: any; identityIndex: number }): Promise<{ event: any }>;
  signMessageWithSession(params: { username: string; message: string; identityIndex: number }): Promise<{ signature: string }>;
  encryptWithSession(params: { username: string; plaintext: string; recipientPubkey: string; identityIndex: number }): Promise<string>;
  decryptWithSession(params: { username: string; ciphertext: string; senderPubkey: string; identityIndex: number }): Promise<string>;
  checkPermission(params: { username: string; origin: string; action: string; eventKind?: number }): Promise<any>;
}

/**
 * Interface for messenger service
 */
interface Messenger {
  isReady(): boolean;
  send(type: string, data: any): void;
  messenger?: {
    route(type: string, config: { handler: (data: any, context?: any) => Promise<any> | any }): void;
  };
}

/**
 * Parameters for setting up worker message handlers
 */
export interface WorkerMessageHandlerParams {
  getCryptoWorkerInstance: () => Worker | null;
  user: Accessor<User | null>;
  setUser: Setter<User | null>;
  setHasPinVault: Setter<boolean>;
  setIsVaultLocked: Setter<boolean>;
  attemptSessionRestore: () => Promise<void>;
  messenger: Messenger;
  showErrorToast?: (code: string) => void;
}

/**
 * Parameters for setting up BroadcastChannel listener
 */
export interface BroadcastChannelParams {
  user: Accessor<User | null>;
  setUser: Setter<User | null>;
  setHasPinVault: Setter<boolean>;
  setIsVaultLocked: Setter<boolean>;
  attemptSessionRestore: () => Promise<void>;
  refreshSessionStatus: () => Promise<void>;
  messenger: Messenger;
}

/**
 * Parameters for setting up messenger routes
 */
export interface MessengerRoutesParams {
  messenger: Messenger;
  user: Accessor<User | null>;
  isVaultLocked: Accessor<boolean>;
  cryptoWorker: CryptoWorker | null;
  unlockVault: (pin: string) => Promise<boolean>;
}

/**
 * Convert origin URL to app key (sanitized domain)
 *
 * @param origin - The origin URL (e.g., "https://example.com")
 * @returns Sanitized domain string (e.g., "example.com")
 *
 * @example
 * ```typescript
 * const key = appKeyFromOrigin('https://app.example.com:3000');
 * // Returns: 'app.example.com'
 * ```
 */
export function appKeyFromOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    return sanitizeDomain(u.host);
  } catch {
    return sanitizeDomain(origin);
  }
}

/**
 * Get the identity index for a given app origin.
 *
 * This function resolves which identity should be used for a given origin by:
 * 1. Checking activeIdentityByApp mapping in vault data
 * 2. Finding an identity with permissions for the app
 * 3. Triggering account picker if no authorized identity found
 *
 * @param cryptoWorker - The crypto worker instance
 * @param username - The current user's username
 * @param origin - The origin requesting access
 * @param DEV_BYPASS - If true, always return index 0 (for development)
 * @returns Promise resolving to the identity index
 *
 * @throws {Error} If no identities found in vault
 * @throws {Error} If account selection is cancelled
 * @throws {Error} If selected identity is not authorized
 *
 * @example
 * ```typescript
 * const idx = await getAppIdentityIndexForOrigin(
 *   cryptoWorker,
 *   'alice',
 *   'https://app.example.com',
 *   false
 * );
 * ```
 */
export async function getAppIdentityIndexForOrigin(
  cryptoWorker: CryptoWorker,
  username: string,
  origin: string,
  DEV_BYPASS: boolean = false
): Promise<number> {
  const vaultData = await cryptoWorker.getVaultData({ username });

  if (!vaultData?.identities || vaultData.identities.length === 0) {
    throw new Error('No identities found');
  }

  if (DEV_BYPASS) {
    return 0;
  }

  const appKey = appKeyFromOrigin(origin);
  let activeIndex = (vaultData as any).activeIdentityByApp?.[appKey];

  // Try to find identity with permissions for this app
  if (activeIndex === undefined || activeIndex === null) {
    activeIndex = (vaultData as any).identities.findIndex(
      (id: any) => id?.appPermissions && id.appPermissions[appKey]
    );
  }

  // If no authorized identity, trigger account picker
  if (activeIndex === -1 || activeIndex === undefined || activeIndex === null) {
    const requestId = `account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const handleSelected = (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail.requestId === requestId) {
          cleanup();
          resolve(ce.detail.identityIndex);
        }
      };

      const handleRejected = (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail.requestId === requestId) {
          cleanup();
          reject(new Error(ce.detail.error || 'Account selection cancelled'));
        }
      };

      const cleanup = () => {
        window.removeEventListener('account-picker-selected', handleSelected as EventListener);
        window.removeEventListener('account-picker-rejected', handleRejected as EventListener);
      };

      window.addEventListener('account-picker-selected', handleSelected as EventListener);
      window.addEventListener('account-picker-rejected', handleRejected as EventListener);

      // Trigger account picker UI
      window.dispatchEvent(new CustomEvent('vault-account-picker', {
        detail: { appOrigin: origin, requestId }
      }));
    });
  }

  // Validate that the identity has permissions for this app
  const identity = (vaultData as any).identities[activeIndex];
  if (!identity?.appPermissions || !identity.appPermissions[appKey]) {
    throw new Error('Selected identity is not authorized for this application');
  }

  return activeIndex;
}

/**
 * Set up worker message handlers for session events.
 *
 * Listens for messages from the crypto worker including:
 * - VAULT_BROADCAST: Cross-tab vault updates
 * - SESSION_EXPIRED: Session timeout events
 * - SESSION_LOCKED: Vault locked events
 *
 * @param params - Handler parameters including worker instance and state setters
 * @returns Cleanup function to remove listeners
 *
 * @example
 * ```typescript
 * createEffect(() => {
 *   const cleanup = setupWorkerMessageHandlers({
 *     getCryptoWorkerInstance,
 *     user,
 *     setUser,
 *     setHasPinVault,
 *     setIsVaultLocked,
 *     attemptSessionRestore,
 *     messenger,
 *     showErrorToast
 *   });
 *   return cleanup;
 * });
 * ```
 */
export function setupWorkerMessageHandlers(
  params: WorkerMessageHandlerParams
): () => void {
  const {
    getCryptoWorkerInstance,
    user,
    setUser,
    setHasPinVault,
    setIsVaultLocked,
    attemptSessionRestore,
    messenger,
    showErrorToast
  } = params;

  try {
    const workerInstance = getCryptoWorkerInstance();
    if (!workerInstance) {
      return () => {}; // No-op cleanup
    }

    const handleWorkerMessage = (event: MessageEvent) => {
      const currentUser = user();

      // Handle vault broadcasts (for all tabs)
      if ((event as any).data?.type === 'VAULT_BROADCAST') {
        const { broadcastType, username, timestamp } = (event as any).data.data;

        switch (broadcastType) {
          case 'VAULT_DATA_UPDATED':
            if (currentUser?.profile.username === username) {
              const refreshEvent = new CustomEvent('vault-data-refresh', {
                detail: { username, timestamp }
              });
              window.dispatchEvent(refreshEvent);
            }
            break;

          case 'USER_LOGGED_IN':
            // Another tab logged in - refresh session status
            attemptSessionRestore();
            if (messenger.isReady() && currentUser?.publicKey) {
              messenger.send('AUTH_STATUS', {
                isAuthenticated: false,
                publicKey: currentUser.publicKey
              });
            }
            window.dispatchEvent(new CustomEvent('session-refresh', {
              detail: { username, timestamp }
            }));
            break;

          case 'SESSION_REFRESH':
            attemptSessionRestore();
            break;

          case 'USER_LOGGED_OUT':
            if (currentUser?.profile.username === username) {
              setUser(null);
              setHasPinVault(false);
              setIsVaultLocked(true);
              localStorage.removeItem('vaultsession');
              localStorage.removeItem('last-username');
              if (messenger.isReady()) {
                messenger.send('AUTH_STATUS', {
                  isAuthenticated: false,
                  publicKey: null
                });
              }
            }
            break;

          case 'SESSION_UNLOCKED':
            if (currentUser?.profile.username === username) {
              setIsVaultLocked(false);
              setHasPinVault(false);
            }
            break;

          case 'SESSION_LOCKED':
            if (currentUser?.profile.username === username) {
              setIsVaultLocked(true);
              setHasPinVault(true);
            }
            break;
        }
        return;
      }

      // Handle existing session messages
      if (
        (event as any).data?.type === 'SESSION_EXPIRED' ||
        (event as any).data?.type === 'SESSION_LOCKED'
      ) {
        const { username, reason } = (event as any).data.data;

        if (currentUser?.profile.username === username) {
          setIsVaultLocked(true);
          setHasPinVault(true);
          localStorage.removeItem('last-username');
          if (messenger.isReady()) {
            messenger.send('AUTH_STATUS', {
              isAuthenticated: false,
              publicKey: null,
              reason: reason || (event as any).data.type
            });
          }
        }
      }
    };

    // Add listener to worker
    workerInstance.addEventListener('message', handleWorkerMessage as unknown as EventListener);

    // Return cleanup function
    return () => {
      workerInstance.removeEventListener('message', handleWorkerMessage as unknown as EventListener);
    };
  } catch (error) {
    console.error('[AuthWorkerBridge] Failed to set up worker message listener:', error);
    if (showErrorToast) {
      showErrorToast('NETWORK_ERROR');
    }
    return () => {}; // No-op cleanup
  }
}

/**
 * Set up BroadcastChannel listener for cross-tab communication.
 *
 * Creates a BroadcastChannel to listen for vault events from other tabs.
 * Handles vault updates, session changes, and user authentication state.
 *
 * @param params - Channel parameters including state setters and callbacks
 * @returns BroadcastChannel instance (caller should close on cleanup) or null if not supported
 *
 * @example
 * ```typescript
 * createEffect(() => {
 *   const channel = setupBroadcastChannelListener({
 *     user,
 *     setUser,
 *     setHasPinVault,
 *     setIsVaultLocked,
 *     attemptSessionRestore,
 *     refreshSessionStatus,
 *     messenger
 *   });
 *
 *   return () => {
 *     if (channel) channel.close();
 *   };
 * });
 * ```
 */
export function setupBroadcastChannelListener(
  params: BroadcastChannelParams
): BroadcastChannel | null {
  const {
    user,
    setUser,
    setHasPinVault,
    setIsVaultLocked,
    attemptSessionRestore,
    refreshSessionStatus,
    messenger
  } = params;

  if (typeof BroadcastChannel === 'undefined') {
    console.warn('[AuthWorkerBridge] BroadcastChannel not supported in this environment');
    return null;
  }

  const broadcastChannel = new BroadcastChannel('nostrpass-vault');

  broadcastChannel.onmessage = (event) => {
    if ((event as any).data?.type === 'VAULT_BROADCAST') {
      const { broadcastType, username, timestamp } = (event as any).data.data;
      const currentUser = user();

      switch (broadcastType) {
        case 'VAULT_DATA_UPDATED':
          if (currentUser?.profile.username === username) {
            const refreshEvent = new CustomEvent('vault-data-refresh', {
              detail: { username, timestamp }
            });
            window.dispatchEvent(refreshEvent);
          }
          break;

        case 'SESSION_UNLOCKED':
          if (currentUser?.profile.username === username) {
            refreshSessionStatus();
          }
          break;

        case 'SESSION_LOCKED':
          if (currentUser?.profile.username === username) {
            setIsVaultLocked(true);
            setHasPinVault(true);
          }
          break;

        case 'USER_LOGGED_OUT':
          if (currentUser?.profile.username === username) {
            setUser(null);
            setHasPinVault(false);
            setIsVaultLocked(true);
            localStorage.removeItem('vaultsession');
            localStorage.removeItem('last-username');
            if (messenger.isReady()) {
              messenger.send('AUTH_STATUS', {
                isAuthenticated: false,
                publicKey: null
              });
            }
          }
          break;

        case 'USER_LOGGED_IN':
          attemptSessionRestore();
          if (messenger.isReady() && currentUser?.publicKey) {
            messenger.send('AUTH_STATUS', {
              isAuthenticated: false,
              publicKey: currentUser.publicKey
            });
          }
          window.dispatchEvent(new CustomEvent('session-refresh', {
            detail: { username, timestamp }
          }));
          break;

        case 'SESSION_REFRESH':
          attemptSessionRestore();
          break;
      }
    }
  };

  return broadcastChannel;
}

/**
 * Set up Messenger routes for NIP-07 operations and auth requests.
 *
 * Registers message handlers for:
 * - GET_PUBLIC_KEY: Get public key for connected identity
 * - SIGN_EVENT: Sign Nostr event with session keys
 * - SIGN_DATA: Sign arbitrary data
 * - ENCRYPT: NIP-04 encryption
 * - DECRYPT: NIP-04 decryption
 * - UNLOCK_WITH_PIN: Unlock vault with PIN
 * - CHECK_PERMISSION: Check app permissions
 * - GET_AUTH_STATUS: Get current auth state
 * - AUTH_STATUS_RESPONSE: Acknowledge auth status receipt
 *
 * @param params - Route parameters including messenger, state accessors, and worker
 *
 * @example
 * ```typescript
 * createEffect(() => {
 *   if (!messenger.isReady() || !messenger.messenger) return;
 *
 *   setupMessengerRoutes({
 *     messenger,
 *     user,
 *     isVaultLocked,
 *     cryptoWorker,
 *     unlockVault
 *   });
 * });
 * ```
 */
export function setupMessengerRoutes(params: MessengerRoutesParams): void {
  const { messenger, user, isVaultLocked, cryptoWorker, unlockVault } = params;

  if (!messenger.messenger) {
    console.warn('[AuthWorkerBridge] Messenger not ready, cannot set up routes');
    return;
  }

  const DEV_BYPASS = false;

  // Handle public key requests from parent - NIP-07 compliant
  messenger.messenger.route('GET_PUBLIC_KEY', {
    handler: async (_data: any, context: any) => {
      const currentUser = user();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const origin = context?.origin || 'unknown';
      if (!cryptoWorker) throw new Error('Crypto not ready');
      if (!currentUser.profile?.username) throw new Error('No username');

      const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });

      // Only allow if identity is connected to this app
      const idx = await getAppIdentityIndexForOrigin(
        cryptoWorker,
        currentUser.profile.username,
        origin,
        DEV_BYPASS
      );
      const identity = (vaultData as any)?.identities?.[idx];
      if (!identity?.publicKey) throw new Error('No connected identity public key');
      return identity.publicKey;
    }
  });

  // Handle sign event requests
  messenger.messenger.route('SIGN_EVENT', {
    handler: async (data: any, context: any) => {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // If session rehydrated without keys, ask Embassy to prompt for PIN
      try {
        const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
        if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'SIGN_EVENT_MISSING_KEYS',
              eventKind: data?.event?.kind,
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Session rehydrated without keys; unlock with PIN');
        }
      } catch {}

      // Gate on vault lock state (do NOT rely on privateKey presence in UI thread)
      if (isVaultLocked()) {
        try {
          messenger.send('PROMPT_REQUIRED', {
            promptType: 'PIN_PAD',
            reason: 'SIGN_EVENT',
            eventKind: data?.event?.kind,
            origin: context?.origin || 'unknown'
          });
        } catch {}
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      const origin = context?.origin || 'unknown';
      const identityIndex = await getAppIdentityIndexForOrigin(
        cryptoWorker,
        currentUser.profile.username,
        origin,
        DEV_BYPASS
      );

      // Ensure event has required fields (pubkey, created_at)
      try {
        const vdata = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
        const identity = (vdata as any)?.identities?.[identityIndex];
        if (identity?.publicKey) {
          if (!data.event) data.event = {};
          if (!data.event.pubkey) data.event.pubkey = identity.publicKey;
          if (!data.event.created_at) data.event.created_at = Math.floor(Date.now() / 1000);
        }
      } catch {}

      // Use session-based signing in worker
      try {
        const result = await cryptoWorker.signEventWithSession({
          username: currentUser.profile.username,
          event: data.event,
          identityIndex
        });
        // NIP-07: signEvent() returns the signed event object directly
        return result.event;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err ?? 'SIGN_EVENT failed');
        throw new Error(msg);
      }
    }
  });

  // Handle sign data requests
  messenger.messenger.route('SIGN_DATA', {
    handler: async (data: { data: string }, context: any) => {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Preflight: prompt for PIN if keys missing
      try {
        const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
        if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'SIGN_DATA_MISSING_KEYS',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Session rehydrated without keys; unlock with PIN');
        }
        // Post-unlock settle: if just unlocked, give worker a brief moment to attach keys
        if (!ks?.hasPrivateKey) {
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 120));
            const again = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
            if (again?.hasPrivateKey || again?.hasXpriv) break;
            if (i === 4) {
              throw new Error('Session rehydrated without keys; unlock with PIN');
            }
          }
        }
      } catch {}

      // Gate on vault lock state
      if (isVaultLocked()) {
        try {
          messenger.send('PROMPT_REQUIRED', {
            promptType: 'PIN_PAD',
            reason: 'SIGN_DATA',
            origin: context?.origin || 'unknown'
          });
        } catch {}
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      const origin = context?.origin || 'unknown';
      const identityIndex = await getAppIdentityIndexForOrigin(
        cryptoWorker,
        currentUser.profile.username,
        origin,
        DEV_BYPASS
      );

      // Use session-based signing for arbitrary data
      try {
        const result = await cryptoWorker.signMessageWithSession({
          username: currentUser.profile.username,
          message: data.data,
          identityIndex
        });
        return { signature: result.signature };
      } catch (err: any) {
        // Normalize error for messenger
        const msg = err instanceof Error ? err.message : String(err ?? 'Sign data failed');
        throw new Error(msg);
      }
    }
  });

  // Handle encrypt requests (NIP-04)
  messenger.messenger.route('ENCRYPT', {
    handler: async (data: { plaintext: string; recipientPubkey: string }, context: any) => {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Preflight: prompt for PIN if keys missing
      try {
        const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
        if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'ENCRYPT_MISSING_KEYS',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Session rehydrated without keys; unlock with PIN');
        }
      } catch {}

      // Gate on vault lock state
      if (isVaultLocked()) {
        try {
          messenger.send('PROMPT_REQUIRED', {
            promptType: 'PIN_PAD',
            reason: 'ENCRYPT',
            origin: context?.origin || 'unknown'
          });
        } catch {}
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      const origin = context?.origin || 'unknown';
      const identityIndex = await getAppIdentityIndexForOrigin(
        cryptoWorker,
        currentUser.profile.username,
        origin,
        DEV_BYPASS
      );

      // Use session-based encryption
      const encrypted = await cryptoWorker.encryptWithSession({
        username: currentUser.profile.username,
        plaintext: data.plaintext,
        recipientPubkey: data.recipientPubkey,
        identityIndex
      });

      // NIP-07: nip04.encrypt() returns just the encrypted string
      return encrypted;
    }
  });

  // Handle decrypt requests (NIP-04)
  messenger.messenger.route('DECRYPT', {
    handler: async (data: { ciphertext: string; senderPubkey: string }, context: any) => {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Preflight: prompt for PIN if keys missing
      try {
        const ks = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
        if (!ks?.hasPrivateKey && !ks?.hasXpriv) {
          try {
            messenger.send('PROMPT_REQUIRED', {
              promptType: 'PIN_PAD',
              reason: 'DECRYPT_MISSING_KEYS',
              origin: context?.origin || 'unknown'
            });
          } catch {}
          throw new Error('Session rehydrated without keys; unlock with PIN');
        }
      } catch {}

      // Gate on vault lock state
      if (isVaultLocked()) {
        try {
          messenger.send('PROMPT_REQUIRED', {
            promptType: 'PIN_PAD',
            reason: 'DECRYPT',
            origin: context?.origin || 'unknown'
          });
        } catch {}
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      const origin = context?.origin || 'unknown';
      const identityIndex = await getAppIdentityIndexForOrigin(
        cryptoWorker,
        currentUser.profile.username,
        origin,
        DEV_BYPASS
      );

      // Use session-based decryption
      const decrypted = await cryptoWorker.decryptWithSession({
        username: currentUser.profile.username,
        ciphertext: data.ciphertext,
        senderPubkey: data.senderPubkey,
        identityIndex
      });

      // NIP-07: nip04.decrypt() returns just the decrypted string
      return decrypted;
    }
  });

  // Unlock with PIN (called by Embassy after PIN prompt)
  messenger.messenger.route('UNLOCK_WITH_PIN', {
    handler: async (data: { pin: string }) => {
      if (!data?.pin) {
        throw new Error('PIN is required');
      }
      const success = await unlockVault(data.pin);
      // Broadcast updated auth status to parent immediately so cross-tab preflight sees unlocked
      try {
        messenger.send('AUTH_STATUS', {
          isAuthenticated: !!user(),
          publicKey: user()?.publicKey || null
        });
      } catch {}
      return { success };
    }
  });

  // Preflight permission check
  messenger.messenger.route('CHECK_PERMISSION', {
    handler: async (data: { action: 'getPublicKey' | 'signEvent' | 'signData' | 'nip04' | 'getRelays'; eventKind?: number }, context: any) => {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      const rawOrigin = context?.origin || 'unknown';
      const appKey = appKeyFromOrigin(rawOrigin);
      const result = await cryptoWorker.checkPermission({
        username: currentUser.profile.username,
        origin: appKey,
        action: data.action,
        eventKind: data.eventKind
      });
      // If vault is unlocked in UI and worker should also be unlocked, cheerfully clear needsPrompt
      const isLocked = isVaultLocked();
      const normalized = isLocked ? result : { ...result, needsPrompt: false };
      return { ...normalized, isLocked };
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
      console.log('[AuthWorkerBridge] Auth status acknowledged by parent:', data);
    }
  });
}
