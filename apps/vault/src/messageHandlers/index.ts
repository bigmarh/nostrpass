import { IframeMessenger } from '@nostrpass/messenger';
import { authHandlers } from './authHandlers';
import { vaultHandlers } from './vaultHandlers';
import { permissionHandlers } from './permissionHandlers';

export function setupMessageHandlers(
  messenger: IframeMessenger,
  dependencies: MessageHandlerDependencies
) {
  // Register all auth-related handlers
  authHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => handler(data, context, dependencies)
    });
  });

  // Register vault UI handlers
  vaultHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => handler(data, context, dependencies)
    });
  });

  // Register permission handlers
  permissionHandlers.forEach(({ route, handler }) => {
    messenger.route(route, {
      handler: (data: any, context: any) => handler(data, context, dependencies)
    });
  });

}

export interface MessageHandlerDependencies {
  getUser: () => any;
  getCryptoWorker: () => any;
  checkPermission: (action: string, origin: string, eventKind?: number) => Promise<boolean>;
  isVaultLocked: () => boolean;
  getAppIdentityIndex: (origin: string) => Promise<number>;
}

export interface MessageHandler {
  route: string;
  handler: (data: any, context: any, deps: MessageHandlerDependencies) => Promise<any>;
}