import {
  LiteCore,
  NostrRelayClient,
  type KeyValueStore,
} from '@nostrpass/lite-core';
import type { LiteMessage, LiteResponse } from '../shared/messages';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const MIN_RELAY_ACKS = 1;

class ChromeStorageStore implements KeyValueStore {
  constructor(private readonly prefix: string) {}

  private key(name: string): string {
    return `${this.prefix}:${name}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(this.key(key));
    return (result[this.key(key)] as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [this.key(key)]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(this.key(key));
  }
}

const core = new LiteCore({
  storage: new ChromeStorageStore('nostrpass-lite-extension'),
  relayClient: new NostrRelayClient(DEFAULT_RELAYS),
  namespace: 'nostrpass-lite',
  environment: 'production',
  relays: DEFAULT_RELAYS,
  allowOffline: false,
  minRelayAcks: MIN_RELAY_ACKS,
});

const initialized = core.initialize();

function normalizedOrigin(raw?: string): string {
  if (!raw) {
    return 'extension';
  }

  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

async function handleMessage(
  message: LiteMessage,
  sender: chrome.runtime.MessageSender
): Promise<LiteResponse> {
  await initialized;

  const origin = normalizedOrigin(message.origin ?? sender.tab?.url);
  console.info('[LiteExtension] handleMessage:start', {
    type: message.type,
    origin,
  });

  try {
    switch (message.type) {
      case 'lite.authState':
        return { success: true, data: core.getAuthState() };
      case 'lite.enrollPassword':
        return {
          success: true,
          data: await core.enrollWithPassword({
            identifier: String(message.data?.identifier ?? ''),
            authSecret: String(message.data?.authSecret ?? ''),
            pin: String(message.data?.pin ?? ''),
            overwriteExistingLogin: Boolean(message.data?.overwriteExistingLogin ?? false),
            overwriteExistingVault: Boolean(message.data?.overwriteExistingVault ?? false),
          }),
        };
      case 'lite.enrollGoogle':
        return {
          success: true,
          data: await core.enrollWithGoogle({
            identifier: String(message.data?.identifier ?? ''),
            authSecret: String(message.data?.authSecret ?? ''),
            pin: String(message.data?.pin ?? ''),
            overwriteExistingLogin: Boolean(message.data?.overwriteExistingLogin ?? false),
            overwriteExistingVault: Boolean(message.data?.overwriteExistingVault ?? false),
          }),
        };
      case 'lite.importKey':
        return {
          success: true,
          data: await core.importKey({
            authMethod: 'password',
            format: String(message.data?.format ?? 'nsec') as 'nsec' | 'hex',
            value: String(message.data?.value ?? ''),
            identifier: String(message.data?.identifier ?? ''),
            authSecret: String(message.data?.authSecret ?? ''),
            pin: String(message.data?.pin ?? ''),
            overwriteExistingLogin: Boolean(message.data?.overwriteExistingLogin ?? false),
            overwriteExistingVault: Boolean(message.data?.overwriteExistingVault ?? false),
          }),
        };
      case 'lite.loginPassword':
        return {
          success: true,
          data: await core.loginWithPassword({
            identifier: String(message.data?.identifier ?? ''),
            authSecret: String(message.data?.authSecret ?? ''),
          }),
        };
      case 'lite.loginGoogle':
        return {
          success: true,
          data: await core.loginWithGoogle({
            identifier: String(message.data?.identifier ?? ''),
            authSecret: String(message.data?.authSecret ?? ''),
          }),
        };
      case 'lite.unlock':
        return {
          success: true,
          data: await core.unlock({ pin: String(message.data?.pin ?? '') }),
        };
      case 'lite.lock':
        return { success: true, data: await core.lock() };
      case 'lite.pendingRequest':
        return {
          success: true,
          data: core.getPendingPermissionRequest(message.data?.requestId as string | undefined),
        };
      case 'lite.resolvePermission':
        return {
          success: true,
          data: await core.resolvePermission({
            requestId: String(message.data?.requestId ?? ''),
            granted: Boolean(message.data?.granted ?? false),
            remember: Boolean(message.data?.remember ?? false),
            level: (message.data?.level as 'ALLOW' | 'ASK_EVERYTIME' | 'DENY' | undefined) ?? 'ALLOW',
          }),
        };
      case 'getPublicKey':
      case 'signEvent':
      case 'nip04.encrypt':
      case 'nip04.decrypt':
      case 'nip44.encrypt':
      case 'nip44.decrypt': {
        const result = await core.requestOperation({
          origin,
          operation: message.type,
          payload: message.data,
        });

        if (!result.success && result.errorCode === 'PERMISSION_REQUIRED') {
          try {
            await chrome.action.openPopup();
          } catch {
            // User can still manually open popup.
          }
        }

        return {
          success: result.success,
          data: result.data,
          error: result.error,
          errorCode: result.errorCode,
          requestId: result.requestId,
        };
      }
      default:
        console.warn('[LiteExtension] unsupported message type', message.type);
        return { success: false, error: 'Unsupported message type' };
    }
  } catch (error) {
    console.error('[LiteExtension] handleMessage:error', message.type, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
      errorCode:
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : undefined,
    };
  }
}

chrome.runtime.onMessage.addListener((message: LiteMessage, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unhandled error',
      })
    );

  return true;
});
