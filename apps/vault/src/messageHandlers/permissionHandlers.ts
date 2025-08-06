import { MessageHandler, MessageHandlerDependencies } from './index';

export const permissionHandlers: MessageHandler[] = [
  {
    route: 'REQUEST_PERMISSION',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const origin = context?.origin || 'unknown';
      const { action, eventKind } = data;

      // This would trigger the permission UI prompt
      // For now, just check the permission
      const hasPermission = await deps.checkPermission(action, origin, eventKind);
      
      return {
        granted: hasPermission,
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