import { MessageHandler, MessageHandlerDependencies } from './index';
import { Msg } from '@nostrpass/types';

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