import { MessageHandler, MessageHandlerDependencies } from './types';
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

      // CHECK_PERMISSION is a lightweight preflight check
      // It should NOT validate identity authorization (that's for the actual operation handlers)
      // It only checks: 1) Is vault locked? 2) Does this need permission prompt?

      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Get lock status directly from worker
      const cryptoWorker = deps.getCryptoWorker();
      const workerAuthState = await cryptoWorker.request('getAuthState', { username: currentUser.username });
      const isLocked = workerAuthState.isLocked;

      // Check permission level (don't validate identity authorization here)
      const permissionResult = await deps.checkPermission(action, origin, eventKind, identityIndex);
      const granted = !!permissionResult?.allowed || permissionResult?.sessionGranted === true;
      const needsPrompt = permissionResult?.level === 'ASK_EVERYTIME';

      console.log('[CHECK_PERMISSION] Result:', { granted, needsPrompt, isLocked, action, origin, identityIndex });
      return {
        granted,
        needsPrompt,
        isLocked,
        action,
        origin,
        level: permissionResult?.level
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
      
      // Return permissions for this origin from vault data
      // This is a stub - real implementation would query worker for actual permissions
      return {
        origin,
        permissions: {
          getPublicKey: 'ALLOW',
          signEvent: { kinds: {} },
          nip04: 'ASK_EVERYTIME',
          getRelays: 'ALLOW',
          signData: 'ASK_EVERYTIME'
        }
      };
    }
  }
];