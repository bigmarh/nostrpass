import { MessageHandler, MessageHandlerDependencies } from './index';
import { Msg } from '@nostrpass/types';
import { vaultError, ErrorCode } from './errors';

export const permissionHandlers: MessageHandler[] = [
  {
    route: Msg.CHECK_PERMISSION,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }

      const origin = context?.origin || 'unknown';
      const { action, eventKind, identityIndex } = data;

      // This would trigger the permission UI prompt
      // For now, just check the permission
      // Validate requested identity matches authorized identity for this origin
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        return { granted: false, action, origin };
      }
      const hasPermission = await deps.checkPermission(action, origin, eventKind, identityIndex);
      const needsPrompt = !hasPermission;
      return {
        granted: hasPermission,
        needsPrompt,
        action,
        origin
      };
    }
  },

  {
    route: 'GET_PERMISSIONS',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const origin = context?.origin || 'unknown';
      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw new Error('Missing identity index');
      }
      
      // TODO: Return all permissions for this origin
      return {
        origin,
        permissions: {
          getPublicKey: 'ALLOW',
          signEvent: { kinds: {} },
          nip04: 'DENY',
          getRelays: 'DENY',
          signData: 'DENY'
        }
      };
    }
  }
];