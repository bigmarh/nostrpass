import type {
  LiteCore,
  LitePermissionLevel,
  LitePermissionOperation,
  LiteResolvePermissionInput,
} from '@nostrpass/lite-core';

export interface PermissionPromptContext {
  requestId: string;
  origin: string;
  operation: LitePermissionOperation;
}

export interface PermissionPromptDecision {
  granted: boolean;
  remember?: boolean;
  level?: LitePermissionLevel;
  sessionDurationMinutes?: number;
}

export interface LiteNostrApiOptions {
  originResolver?: () => string;
  onPermissionPrompt?: (
    context: PermissionPromptContext
  ) => Promise<PermissionPromptDecision>;
}

interface NostrOperationOptions {
  identityIndex?: number;
}

interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
}

async function runWithPermissionRetry<T>(
  core: LiteCore,
  operation: LitePermissionOperation,
  payload: Record<string, unknown>,
  options: LiteNostrApiOptions
): Promise<T> {
  console.info('[LiteAPI] operation:start', { operation });
  const origin = options.originResolver?.() ?? window.location.origin;
  const result = await core.requestOperation<T>({
    origin,
    operation,
    payload,
  });

  if (result.success) {
    console.info('[LiteAPI] operation:done', { operation, immediate: true });
    return result.data as T;
  }

  if (result.errorCode !== 'PERMISSION_REQUIRED' || !result.requestId) {
    throw new Error(result.error ?? 'Operation failed');
  }

  if (!options.onPermissionPrompt) {
    throw new Error('Permission required but no prompt handler is configured');
  }

  const pending = core.getPendingPermissionRequest(result.requestId);
  if (!pending) {
    throw new Error('Pending permission request was not found');
  }

  const decision = await options.onPermissionPrompt({
    requestId: result.requestId,
    origin: pending.origin,
    operation: pending.operation,
  });

  const resolution: LiteResolvePermissionInput = {
    requestId: result.requestId,
    granted: decision.granted,
    remember: decision.remember,
    level: decision.level,
    sessionDurationMinutes: decision.sessionDurationMinutes,
  };

  const resolved = await core.resolvePermission<T>(resolution);
  if (!resolved.success) {
    throw new Error(resolved.error ?? 'Operation denied');
  }

  console.info('[LiteAPI] operation:done', { operation, immediate: false });
  return resolved.data as T;
}

export function createLiteNostrApi(core: LiteCore, options: LiteNostrApiOptions = {}) {
  return {
    async getPublicKey(_opts?: NostrOperationOptions): Promise<string> {
      return runWithPermissionRetry<string>(core, 'getPublicKey', {}, options);
    },

    async signEvent(event: UnsignedEvent, _opts?: NostrOperationOptions) {
      return runWithPermissionRetry(core, 'signEvent', { event }, options);
    },

    nip04: {
      async encrypt(pubkey: string, plaintext: string, _opts?: NostrOperationOptions) {
        return runWithPermissionRetry<string>(
          core,
          'nip04.encrypt',
          { pubkey, plaintext },
          options
        );
      },
      async decrypt(pubkey: string, ciphertext: string, _opts?: NostrOperationOptions) {
        return runWithPermissionRetry<string>(
          core,
          'nip04.decrypt',
          { pubkey, ciphertext },
          options
        );
      },
    },

    nip44: {
      async encrypt(pubkey: string, plaintext: string, _opts?: NostrOperationOptions) {
        return runWithPermissionRetry<string>(
          core,
          'nip44.encrypt',
          { pubkey, plaintext },
          options
        );
      },
      async decrypt(pubkey: string, ciphertext: string, _opts?: NostrOperationOptions) {
        return runWithPermissionRetry<string>(
          core,
          'nip44.decrypt',
          { pubkey, ciphertext },
          options
        );
      },
    },
  };
}

export function installWindowNostr(
  core: LiteCore,
  options: LiteNostrApiOptions & { overrideExisting?: boolean } = {}
): void {
  const api = createLiteNostrApi(core, options);

  if (options.overrideExisting || !(window as Window & { nostr?: unknown }).nostr) {
    (window as Window & { nostr?: unknown }).nostr = api;
  }
}
