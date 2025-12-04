import { MessageHandler, MessageHandlerDependencies } from './types';
import { Msg } from '@nostrpass/types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { nip19 } from 'nostr-tools';
import { showSuccessToast } from '../components/Toast';
import { addAuditEvent } from '../components/AuditLog';
import { vaultError, ErrorCode } from './errors';
import { permissionPromptManager } from '../utils/permissionPromptManager';
import { getActiveIdentity } from '../utils/activeIdentityManager';

function originToAppKey(origin: string): string {
  try {
    // Try parsing as URL
    let url: URL;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      url = new URL(origin);
    } else {
      // Add protocol if missing (for localhost:3200 format)
      url = new URL(`http://${origin}`);
    }
    return sanitizeDomain(url.host);
  } catch (e) {
    // Final fallback: sanitize the raw string
    return sanitizeDomain(origin);
  }
}

const BYPASS_GATES = false; // Permissions enforced

export const vaultHandlers: MessageHandler[] = [
  {
    route: Msg.SHOW_VAULT,
    handler: async (_data: any, _context: any, _deps: MessageHandlerDependencies) => {
      // This would be handled by the UI layer
      return { acknowledged: true };
    }
  },

  {
    route: Msg.HIDE_VAULT,
    handler: async (_data: any, _context: any, _deps: MessageHandlerDependencies) => {
      // This would be handled by the UI layer
      return { acknowledged: true };
    }
  },

  {
    route: Msg.NAVIGATE,
    handler: async (data: any, _context: any, _deps: MessageHandlerDependencies) => {
      console.log('[NAVIGATE] Received navigation request:', data);
      const { path } = data;

      if (!path || typeof path !== 'string') {
        throw new Error('Invalid navigation path');
      }

      // Use window.history to navigate without reload
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));

      console.log('[NAVIGATE] Navigated to:', path);
      return { acknowledged: true, path };
    }
  },

  {
    route: Msg.GET_RELAYS,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys

      const identityIndex = data?.identityIndex ?? 0;

      // Check permissions (may trigger async prompt)
      const permissionResult = await deps.checkPermission('getRelays', origin, undefined, identityIndex);

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult.level === 'DENY') {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }

      if (!permissionResult.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: data?.appName,
            action: 'getRelays',
            identityIndex
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Return user's configured relays from vault data
      // For now, return default relays - customRelays can be added to vault settings
      const relays = {
        'wss://relay.damus.io': { read: true, write: true },
        'wss://nos.lol': { read: true, write: true },
        'wss://relay.nostr.band': { read: true, write: true }
      };

      showSuccessToast('Relays Retrieved', `Relay list provided to ${data?.appName || 'app'}`);

      // Log audit event
      addAuditEvent({
        type: 'permission',
        action: 'Relays Retrieved',
        details: `Relay list provided to ${data?.appName || 'app'} (${origin})`,
        appName: data?.appName,
        appId: origin,
        identityIndex: identityIndex,
        severity: 'low'
      });

      return relays;
    }
  },

  {
    route: Msg.MANAGE_ACCOUNTS,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (deps.isVaultLocked()) {
        throw new Error('Vault is locked. Please unlock before managing accounts.');
      }

      const cryptoWorker = deps.getCryptoWorker();
      if (!cryptoWorker) {
        throw new Error('Crypto not ready');
      }

      const origin = context?.origin || data?.appDomain || window.location.origin;
      const appName = data?.appName;
      const forcePrompt = data?.forcePrompt ?? true;

      let appKey = origin;
      try {
        const url = new URL(origin);
        appKey = sanitizeDomain(url.host);
      } catch {
        appKey = sanitizeDomain(origin);
      }

      const username = currentUser.profile.username;
      const loadVaultData = async () => {
        const result = await cryptoWorker.getVaultData({ username });
        return result;
      };

      const resolveIdentityInfo = async (identityIndex: number) => {
        const vaultData = await loadVaultData();
        const identity = vaultData?.identities?.[identityIndex];
        if (!identity) {
          return {
            identityIndex,
            identity: undefined
          };
        }

        let npub: string | undefined;
        try {
          npub = identity.publicKey ? nip19.npubEncode(identity.publicKey) : undefined;
        } catch {
          npub = undefined;
        }

        return {
          identityIndex,
          identity: {
            nickname: identity.nickname,
            publicKey: identity.publicKey,
            npub,
            path: identity.path,
            authorized: !!identity.appPermissions?.[appKey]
          }
        };
      };

      const initialVaultData = await loadVaultData();
      const getExistingIndex = () => {
        if (!initialVaultData?.identities || initialVaultData.identities.length === 0) {
          return -1;
        }
        // Get active identity from localStorage first
        const currentUser = deps.getUser();
        if (!currentUser?.profile?.username) {
          return -1;
        }

        let activeIndex = getActiveIdentity(currentUser.profile.username, rawOrigin);
        if (activeIndex === undefined || activeIndex === null) {
          // Fallback: find first identity with permissions for this app
          activeIndex = initialVaultData.identities.findIndex((id: any) => id?.appPermissions && id.appPermissions[appKey]);
        }
        return activeIndex ?? -1;
      };

      if (!forcePrompt) {
        const existingIndex = getExistingIndex();
        if (existingIndex !== -1) {
          return resolveIdentityInfo(existingIndex);
        }
      }

      const requestId = `account-picker-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const identityIndex = await new Promise<number>((resolve, reject) => {
        const handleSelected = (event: Event) => {
          const ce = event as CustomEvent<{ requestId: string; identityIndex: number }>;
          if (ce.detail.requestId === requestId) {
            cleanup();
            resolve(ce.detail.identityIndex);
          }
        };

        const handleRejected = (event: Event) => {
          const ce = event as CustomEvent<{ requestId: string; error?: string }>;
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

        window.dispatchEvent(new CustomEvent('vault-account-picker', {
          detail: {
            appOrigin: origin,
            appName,
            requestId
          }
        }));
      });

      return resolveIdentityInfo(identityIndex);
    }
  }
];