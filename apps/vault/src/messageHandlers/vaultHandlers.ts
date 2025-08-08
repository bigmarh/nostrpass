import { MessageHandler, MessageHandlerDependencies } from './index';

const BYPASS_GATES = true; // temporary for wiring ops

export const vaultHandlers: MessageHandler[] = [
  {
    route: 'SHOW_VAULT',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      // This would be handled by the UI layer
      return { acknowledged: true };
    }
  },

  {
    route: 'HIDE_VAULT',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      // This would be handled by the UI layer
      return { acknowledged: true };
    }
  },

  {
    route: 'GET_RELAYS',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      if (!BYPASS_GATES) {
        const hasPermission = await deps.checkPermission('getRelays', origin);
        if (!hasPermission) {
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
  }
];