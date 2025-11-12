import { MessageHandler, MessageHandlerDependencies } from './index';
import { Msg } from '@nostrpass/types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { nip19 } from 'nostr-tools';

const BYPASS_GATES = true; // temporary for wiring ops

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
    route: Msg.GET_RELAYS,
    handler: async (_data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      if (!BYPASS_GATES) {
        const permission = await deps.checkPermission('getRelays', origin);
        if (!permission.allowed) {
          throw new Error('Permission denied');
        }
      }

      // TODO: Return user's configured relays
      return {
        'ws://localhost:8080': { read: true, write: true },
        'wss://relay.damus.io': { read: true, write: true },
        'wss://nos.lol': { read: true, write: true }
      };
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
        let activeIndex = initialVaultData.activeIdentityByApp?.[appKey];
        if (activeIndex === undefined || activeIndex === null) {
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