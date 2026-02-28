import {
  BrowserLocalStorageStore,
  LiteCore,
  NostrRelayClient,
  type LiteAuthState,
  type LitePermissionLevel,
  type LitePermissionOperation,
} from '@nostrpass/lite-core';
import {
  createLiteNostrApi,
  type PermissionPromptContext,
  type PermissionPromptDecision,
} from '@nostrpass/lite-api';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const DEFAULT_STATUS_EVENT_NAME = 'nostrpass-lite:status';
const BUTTON_STYLE_ID = 'nostrpass-lite-button-styles';

export type LiteEmbassyStatusKind =
  | 'ready'
  | 'auth_required'
  | 'pin_required'
  | 'permission_required'
  | 'processing'
  | 'success'
  | 'error';

export interface LiteEmbassyStatus {
  kind: LiteEmbassyStatusKind;
  timestamp: number;
  auth: LiteAuthState;
  detail?: Record<string, unknown>;
}

export interface LiteEmbassyConfig {
  appName?: string;
  appDomain?: string;
  namespace?: string;
  environment?: string;
  relays?: string[];
  minRelayAcks?: number;
  storagePrefix?: string;
  debug?: boolean;
  statusEventName?: string;
  rememberByDefault?: boolean;
  permissionSessionMinutes?: number;
  installProviderOnInit?: boolean;
  overrideExistingProvider?: boolean;
  permissionDefaults?: Partial<Record<LitePermissionOperation, LitePermissionLevel>>;
  originResolver?: () => string;
  onPermissionPrompt?: (
    context: PermissionPromptContext
  ) => Promise<PermissionPromptDecision>;
  onStatusChange?: (status: LiteEmbassyStatus) => void;
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

interface SignedEvent extends UnsignedEvent {
  id: string;
  sig: string;
  pubkey: string;
}

export interface LiteNostrProvider {
  getPublicKey(options?: NostrOperationOptions): Promise<string>;
  signEvent(event: UnsignedEvent, options?: NostrOperationOptions): Promise<SignedEvent>;
  nip04: {
    encrypt(pubkey: string, plaintext: string, options?: NostrOperationOptions): Promise<string>;
    decrypt(pubkey: string, ciphertext: string, options?: NostrOperationOptions): Promise<string>;
  };
  nip44: {
    encrypt(pubkey: string, plaintext: string, options?: NostrOperationOptions): Promise<string>;
    decrypt(pubkey: string, ciphertext: string, options?: NostrOperationOptions): Promise<string>;
  };
  createNostrPassLiteButton?: (
    config?: LiteButtonConfig
  ) => LiteButtonController;
}

export interface LiteButtonConfig {
  appendTo?: string | HTMLElement;
  className?: string;
  labelSignedOut?: string;
  labelLocked?: string;
  labelSignedIn?: string;
  onClick?: (embassy: NostrPassLiteEmbassy, auth: LiteAuthState) => void | Promise<void>;
}

export interface LiteButtonController {
  element: HTMLButtonElement;
  refresh: () => void;
  destroy: () => void;
}

function normalizeOrigin(raw?: string): string {
  if (!raw) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'unknown';
  }

  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

function isLiteAuthState(value: unknown): value is LiteAuthState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<LiteAuthState>;
  return (
    typeof candidate.initialized === 'boolean' &&
    typeof candidate.isAuthenticated === 'boolean' &&
    typeof candidate.isLocked === 'boolean'
  );
}

function ensureButtonStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(BUTTON_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = BUTTON_STYLE_ID;
  style.textContent = `
  .nostrpass-lite-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 34px;
    border-radius: 10px;
    border: 1px solid #0f172a;
    background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
    color: #f8fafc;
    font-family: "IBM Plex Sans", "Inter", "Segoe UI", sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 0.45rem 0.78rem;
    box-shadow: 0 10px 20px -16px rgba(15, 23, 42, 0.9);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
    white-space: nowrap;
  }
  .nostrpass-lite-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 28px -20px rgba(15, 23, 42, 0.95);
  }
  .nostrpass-lite-btn:active {
    transform: translateY(0);
  }
  .nostrpass-lite-btn[data-auth="locked"] {
    border-color: #fbbf24;
    background: linear-gradient(180deg, #854d0e 0%, #713f12 100%);
  }
  .nostrpass-lite-btn[data-auth="signed-in"] {
    border-color: #22c55e;
    background: linear-gradient(180deg, #166534 0%, #14532d 100%);
  }
  .nostrpass-lite-btn[data-busy="true"] {
    opacity: 0.88;
    cursor: progress;
    filter: saturate(0.9);
  }
  `;
  document.head.appendChild(style);
}

export class NostrPassLiteEmbassy {
  private readonly config: LiteEmbassyConfig;
  private readonly core: LiteCore;
  private readonly nostrApi: ReturnType<typeof createLiteNostrApi>;
  private readonly provider: LiteNostrProvider;
  private initialized = false;
  private providerInstalled = false;
  private previousProvider: unknown = undefined;

  constructor(config: LiteEmbassyConfig = {}) {
    this.config = config;

    const relays = config.relays ?? DEFAULT_RELAYS;
    this.core = new LiteCore({
      storage: new BrowserLocalStorageStore(config.storagePrefix ?? 'nostrpass-lite-embassy'),
      relayClient: new NostrRelayClient(relays),
      namespace: config.namespace ?? 'nostrpass-lite',
      environment: config.environment ?? 'production',
      relays,
      minRelayAcks: config.minRelayAcks ?? 1,
    });

    this.nostrApi = createLiteNostrApi(this.core, {
      originResolver: () => this.resolveOrigin(),
      onPermissionPrompt: (context: PermissionPromptContext) =>
        this.handlePermissionPrompt(context),
    });

    this.provider = {
      getPublicKey: (options) => this.getPublicKey(options),
      signEvent: (event, options) => this.signEvent(event, options),
      nip04: {
        encrypt: (pubkey, plaintext, options) => this.nip04Encrypt(pubkey, plaintext, options),
        decrypt: (pubkey, ciphertext, options) => this.nip04Decrypt(pubkey, ciphertext, options),
      },
      nip44: {
        encrypt: (pubkey, plaintext, options) => this.nip44Encrypt(pubkey, plaintext, options),
        decrypt: (pubkey, ciphertext, options) => this.nip44Decrypt(pubkey, ciphertext, options),
      },
      createNostrPassLiteButton: (buttonConfig) =>
        this.createNostrPassLiteButton(buttonConfig),
    };
  }

  async initialize(): Promise<LiteAuthState> {
    if (this.initialized) {
      return this.core.getAuthState();
    }

    this.emitStatus('processing', { action: 'initialize' });
    const auth = await this.core.initialize();
    this.initialized = true;
    this.emitAuthDrivenStatus(auth, 'ready', { action: 'initialize' });

    if (this.config.installProviderOnInit ?? true) {
      this.installNostrProvider({
        overrideExisting: this.config.overrideExistingProvider ?? false,
      });
    }

    return auth;
  }

  getAuthState(): LiteAuthState {
    return this.core.getAuthState();
  }

  async enrollWithPassword(input: {
    identifier: string;
    authSecret: string;
    pin: string;
    overwriteExistingLogin?: boolean;
    overwriteExistingVault?: boolean;
  }) {
    return this.runAction('enroll', () => this.core.enrollWithPassword(input));
  }

  async importKey(input: {
    format: 'nsec' | 'hex';
    value: string;
    identifier: string;
    authSecret: string;
    pin: string;
    overwriteExistingLogin?: boolean;
    overwriteExistingVault?: boolean;
  }) {
    return this.runAction('importKey', () =>
      this.core.importKey({
        authMethod: 'password',
        ...input,
      })
    );
  }

  async loginWithPassword(input: {
    identifier: string;
    authSecret: string;
  }): Promise<LiteAuthState> {
    return this.runAction('login', () => this.core.loginWithPassword(input));
  }

  async unlock(input: { pin: string }): Promise<LiteAuthState> {
    return this.runAction('unlock', () => this.core.unlock(input));
  }

  async lock(): Promise<LiteAuthState> {
    return this.runAction('lock', () => this.core.lock());
  }

  async logout(): Promise<LiteAuthState> {
    return this.runAction('logout', () => this.core.logout());
  }

  async getPublicKey(_options?: NostrOperationOptions): Promise<string> {
    return this.runNostrOperation('getPublicKey', () => this.nostrApi.getPublicKey());
  }

  async signEvent(
    event: UnsignedEvent,
    _options?: NostrOperationOptions
  ): Promise<SignedEvent> {
    return this.runNostrOperation('signEvent', () =>
      this.nostrApi.signEvent(event)
    ) as Promise<SignedEvent>;
  }

  async nip04Encrypt(
    pubkey: string,
    plaintext: string,
    _options?: NostrOperationOptions
  ): Promise<string> {
    return this.runNostrOperation('nip04.encrypt', () =>
      this.nostrApi.nip04.encrypt(pubkey, plaintext)
    );
  }

  async nip04Decrypt(
    pubkey: string,
    ciphertext: string,
    _options?: NostrOperationOptions
  ): Promise<string> {
    return this.runNostrOperation('nip04.decrypt', () =>
      this.nostrApi.nip04.decrypt(pubkey, ciphertext)
    );
  }

  async nip44Encrypt(
    pubkey: string,
    plaintext: string,
    _options?: NostrOperationOptions
  ): Promise<string> {
    return this.runNostrOperation('nip44.encrypt', () =>
      this.nostrApi.nip44.encrypt(pubkey, plaintext)
    );
  }

  async nip44Decrypt(
    pubkey: string,
    ciphertext: string,
    _options?: NostrOperationOptions
  ): Promise<string> {
    return this.runNostrOperation('nip44.decrypt', () =>
      this.nostrApi.nip44.decrypt(pubkey, ciphertext)
    );
  }

  installNostrProvider(options: { overrideExisting?: boolean } = {}): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const overrideExisting = options.overrideExisting ?? false;
    const windowWithNostr = window as Window & { nostr?: LiteNostrProvider };

    if (windowWithNostr.nostr && !overrideExisting) {
      this.debug('Provider already exists, install skipped');
      return false;
    }

    if (!this.providerInstalled) {
      this.previousProvider = windowWithNostr.nostr;
    }

    windowWithNostr.nostr = this.provider;
    this.providerInstalled = true;
    window.dispatchEvent(new Event('nostr-ready'));
    this.emitStatus('ready', { action: 'install-provider' });
    this.debug('Installed window.nostr provider');
    return true;
  }

  uninstallNostrProvider(): void {
    if (typeof window === 'undefined' || !this.providerInstalled) {
      return;
    }

    const windowWithNostr = window as Window & { nostr?: LiteNostrProvider };
    if (this.previousProvider === undefined) {
      delete windowWithNostr.nostr;
    } else {
      windowWithNostr.nostr = this.previousProvider as LiteNostrProvider;
    }
    this.providerInstalled = false;
    this.debug('Uninstalled window.nostr provider');
  }

  createNostrPassLiteButton(config: LiteButtonConfig = {}): LiteButtonController {
    if (typeof document === 'undefined') {
      throw new Error('Buttons require a browser environment');
    }

    ensureButtonStyles();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ['nostrpass-lite-btn', config.className ?? ''].join(' ').trim();

    const applyLabel = () => {
      const auth = this.core.getAuthState();
      if (!auth.isAuthenticated) {
        button.dataset.auth = 'signed-out';
        button.textContent = config.labelSignedOut ?? 'Use NostrPass';
        return;
      }

      if (auth.isLocked) {
        button.dataset.auth = 'locked';
        button.textContent = config.labelLocked ?? 'Unlock NostrPass';
        return;
      }

      button.dataset.auth = 'signed-in';
      button.textContent = config.labelSignedIn ?? 'Connected';
    };

    const statusEventName = this.config.statusEventName ?? DEFAULT_STATUS_EVENT_NAME;
    const statusListener = ((event: CustomEvent<LiteEmbassyStatus>) => {
      const kind = event.detail?.kind;
      button.dataset.busy = kind === 'processing' ? 'true' : 'false';
      applyLabel();
    }) as EventListener;

    button.addEventListener('click', () => {
      const auth = this.core.getAuthState();
      if (config.onClick) {
        void config.onClick(this, auth);
      } else if (!auth.isAuthenticated) {
        this.emitStatus('auth_required', { source: 'button' }, auth);
      } else if (auth.isLocked) {
        this.emitStatus('pin_required', { source: 'button' }, auth);
      } else {
        this.emitStatus('ready', { source: 'button' }, auth);
      }
    });
    window.addEventListener(statusEventName, statusListener);
    applyLabel();

    if (config.appendTo) {
      if (typeof config.appendTo === 'string') {
        const mount = document.querySelector(config.appendTo);
        mount?.appendChild(button);
      } else {
        config.appendTo.appendChild(button);
      }
    }

    return {
      element: button,
      refresh: applyLabel,
      destroy: () => {
        window.removeEventListener(statusEventName, statusListener);
        button.remove();
      },
    };
  }

  private async runAction<T>(action: string, fn: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    this.emitStatus('processing', { action });
    try {
      const result = await fn();
      const auth = this.extractAuthState(result) ?? this.core.getAuthState();
      this.emitAuthDrivenStatus(auth, 'success', { action });
      return result;
    } catch (error) {
      this.emitStatus('error', {
        action,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async runNostrOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    this.emitStatus('processing', { operation });
    try {
      const result = await fn();
      this.emitAuthDrivenStatus(this.core.getAuthState(), 'success', { operation });
      return result;
    } catch (error) {
      this.emitStatus('error', {
        operation,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.initialize();
  }

  private resolveOrigin(): string {
    if (this.config.originResolver) {
      return normalizeOrigin(this.config.originResolver());
    }
    if (this.config.appDomain) {
      return normalizeOrigin(this.config.appDomain);
    }
    if (typeof window !== 'undefined') {
      return normalizeOrigin(window.location.origin);
    }
    return 'unknown';
  }

  private async handlePermissionPrompt(
    context: PermissionPromptContext
  ): Promise<PermissionPromptDecision> {
    this.emitStatus('permission_required', {
      operation: context.operation,
      origin: context.origin,
      requestId: context.requestId,
    });

    const defaultLevel = this.config.permissionDefaults?.[context.operation];
    if (defaultLevel === 'DENY') {
      return { granted: false };
    }

    if (defaultLevel === 'ALLOW' || defaultLevel === 'ASK_PER_SESSION') {
      return {
        granted: true,
        remember: true,
        level: defaultLevel,
        sessionDurationMinutes:
          defaultLevel === 'ASK_PER_SESSION'
            ? this.config.permissionSessionMinutes ?? 60
            : undefined,
      };
    }

    if (this.config.onPermissionPrompt) {
      return this.config.onPermissionPrompt(context);
    }

    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return { granted: false };
    }

    const granted = window.confirm(
      `Allow ${context.origin} to call ${context.operation}?\n(OK = allow, Cancel = deny)`
    );
    if (!granted) {
      return { granted: false };
    }

    return {
      granted: true,
      remember: this.config.rememberByDefault ?? true,
      level: 'ALLOW',
    };
  }

  private extractAuthState(result: unknown): LiteAuthState | null {
    if (isLiteAuthState(result)) {
      return result;
    }
    if (!result || typeof result !== 'object') {
      return null;
    }
    const authState = (result as { authState?: unknown }).authState;
    return isLiteAuthState(authState) ? authState : null;
  }

  private emitAuthDrivenStatus(
    auth: LiteAuthState,
    successKind: Extract<LiteEmbassyStatusKind, 'ready' | 'success'>,
    detail?: Record<string, unknown>
  ): void {
    if (!auth.isAuthenticated) {
      this.emitStatus('auth_required', detail, auth);
      return;
    }
    if (auth.isLocked) {
      this.emitStatus('pin_required', detail, auth);
      return;
    }
    this.emitStatus(successKind, detail, auth);
  }

  private emitStatus(
    kind: LiteEmbassyStatusKind,
    detail?: Record<string, unknown>,
    authState?: LiteAuthState
  ): void {
    const payload: LiteEmbassyStatus = {
      kind,
      timestamp: Date.now(),
      auth: authState ?? this.core.getAuthState(),
      detail,
    };

    this.config.onStatusChange?.(payload);

    if (typeof window !== 'undefined') {
      const eventName = this.config.statusEventName ?? DEFAULT_STATUS_EVENT_NAME;
      window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
    }

    this.debug('status', payload);
  }

  private debug(message: string, data?: unknown): void {
    if (!this.config.debug) {
      return;
    }
    if (data === undefined) {
      console.info('[LiteEmbassy]', message);
      return;
    }
    console.info('[LiteEmbassy]', message, data);
  }
}
