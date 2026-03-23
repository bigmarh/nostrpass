import { Msg, type PermissionLevel } from '@nostrpass/types';

export interface MessageHandlerDependencies {
  getUser: () => any;
  getCryptoWorker: () => any;
  checkPermission: (
    action: string,
    origin: string,
    eventKind?: number,
    identityIndex?: number
  ) => Promise<{ allowed: boolean; level: PermissionLevel; sessionGranted?: boolean }>;
  isVaultLocked: () => boolean;
  getAppIdentityIndex: (origin: string) => Promise<number>;
}

export interface MessageHandler {
  route: Msg | string;
  handler: (data: any, context: any, deps: MessageHandlerDependencies) => Promise<any>;
}
