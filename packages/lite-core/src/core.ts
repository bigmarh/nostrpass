import { randomBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { generateSecretKey } from 'nostr-tools';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { encrypt as nip04Encrypt, decrypt as nip04Decrypt } from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';
import type {
  KeyValueStore,
  LiteAuthState,
  LiteEnrollInput,
  LiteImportKeyInput,
  LiteLoginInput,
  LiteLoginPayload,
  LiteOperationRequest,
  LiteOperationResult,
  LitePendingPermissionRequest,
  LiteResolvePermissionInput,
  LiteSetupResult,
  LiteUnlockInput,
  LiteVaultPayload,
  RelayClient,
} from './types';
import { createLoginDTag, createVaultDTag, stableHash } from './tags';
import { decryptString, derivePublicKey, encryptString, normalizePrivateKey } from './crypto';

const KIND = 30078;
const AUTH_STATE_KEY = 'auth-state';
const LOGIN_CACHE_PREFIX = 'cache:login';
const VAULT_CACHE_PREFIX = 'cache:vault';
const RESUME_KEY = 'resume';
const DEFAULT_SESSION_PERMISSION_MINUTES = 60;

/** Session data stored encrypted-with-PIN so the vault can be unlocked after a page refresh. */
interface LiteResumePayload {
  authMethod: 'password' | 'google';
  identifier: string;
  relays: string[];
  loginPayload: LiteLoginPayload;
  vaultSecret: string;
  storagePrivateKey: string;
  vaultPayload: LiteVaultPayload;
}

interface LiteCoreOptions {
  storage: KeyValueStore;
  relayClient: RelayClient;
  namespace?: string;
  environment?: string;
  relays?: string[];
  allowOffline?: boolean;
  minRelayAcks?: number;
  now?: () => number;
}

interface LiteSession {
  authMethod: 'password' | 'google';
  identifier: string;
  authSecret: string;
  relays: string[];
  loginPayload: LiteLoginPayload;
  vaultSecret: string;
  storagePrivateKey: string;
  vaultPayload: LiteVaultPayload;
  unlockedPrivateKey?: string;
}

export class LiteCore {
  private readonly storage: KeyValueStore;
  private readonly relayClient: RelayClient;
  private readonly namespace: string;
  private readonly environment: string;
  private readonly defaultRelays: string[];
  private readonly allowOffline: boolean;
  private readonly minRelayAcks: number;
  private readonly now: () => number;

  private session: LiteSession | null = null;
  private authState: LiteAuthState = {
    initialized: false,
    isAuthenticated: false,
    isLocked: true,
  };

  private pendingPermissionRequests = new Map<string, LitePendingPermissionRequest>();
  private readonly sessionPermissionGrants = new Map<string, number>();

  constructor(options: LiteCoreOptions) {
    this.storage = options.storage;
    this.relayClient = options.relayClient;
    this.namespace = options.namespace ?? 'nostrpass.com';
    this.environment = options.environment ?? 'production';
    this.defaultRelays = options.relays ?? [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
    ];
    this.allowOffline = options.allowOffline ?? false;
    this.minRelayAcks = Math.max(
      0,
      Math.floor(options.minRelayAcks ?? 1)
    );
    this.now = options.now ?? (() => Date.now());
  }

  async initialize(): Promise<LiteAuthState> {
    this.logStep('initialize:start');
    const [cached, resumeToken] = await Promise.all([
      this.storage.get<LiteAuthState>(AUTH_STATE_KEY),
      this.storage.get<string>(RESUME_KEY),
    ]);

    if (cached?.isAuthenticated && resumeToken !== null) {
      // Resume token exists — restore as "logged in but locked" so the PIN screen shows
      this.authState = {
        initialized: true,
        isAuthenticated: true,
        isLocked: true,
        authMethod: cached.authMethod,
        identifier: cached.identifier,
        publicKey: cached.publicKey,
      };
    } else {
      // No resume token or user was logged out — start fresh
      if (resumeToken !== null) {
        // Stale resume (auth state says signed-out) — clean it up
        await this.storage.remove(RESUME_KEY);
      }
      this.authState.initialized = true;
    }

    await this.persistAuthState();
    this.logStep('initialize:done', this.authState);
    return this.getAuthState();
  }

  getAuthState(): LiteAuthState {
    return { ...this.authState };
  }

  getPendingPermissionRequest(
    requestId?: string
  ): LitePendingPermissionRequest | null {
    if (requestId) {
      return this.pendingPermissionRequests.get(requestId) ?? null;
    }

    const first = this.pendingPermissionRequests.values().next();
    return first.done ? null : first.value;
  }

  async enrollWithPassword(input: Omit<LiteEnrollInput, 'authMethod'>): Promise<LiteSetupResult> {
    return this.enroll({ ...input, authMethod: 'password' });
  }

  async enrollWithGoogle(input: Omit<LiteEnrollInput, 'authMethod'>): Promise<LiteSetupResult> {
    return this.enroll({ ...input, authMethod: 'google' });
  }

  async loginWithPassword(
    input: Omit<LiteLoginInput, 'authMethod'>
  ): Promise<LiteAuthState> {
    return this.login({ ...input, authMethod: 'password' });
  }

  async loginWithGoogle(
    input: Omit<LiteLoginInput, 'authMethod'>
  ): Promise<LiteAuthState> {
    return this.login({ ...input, authMethod: 'google' });
  }

  async importKey(input: LiteImportKeyInput): Promise<LiteSetupResult> {
    this.logStep('importKey:start', {
      authMethod: input.authMethod,
      identifier: input.identifier,
      format: input.format,
    });
    const privateKeyHex = normalizePrivateKey({ format: input.format, value: input.value });
    this.logStep('importKey:keyNormalized', {
      pubkey: derivePublicKey(privateKeyHex),
    });
    return this.enroll({
      ...input,
      privateKeyHex,
    });
  }

  async login(input: LiteLoginInput): Promise<LiteAuthState> {
    this.logStep('login:start', {
      authMethod: input.authMethod,
      identifier: input.identifier,
    });
    this.assertNonEmpty(input.identifier, 'Identifier is required');
    this.assertNonEmpty(input.authSecret, 'Auth secret is required');

    const relays = input.relays ?? this.defaultRelays;
    const loginDTag = createLoginDTag(
      this.namespace,
      input.authMethod,
      input.identifier,
      this.environment
    );

    const loginEvent = await this.fetchLoginRecord(loginDTag);
    if (!loginEvent) {
      this.logStep('login:missingLoginRecord', { loginDTag });
      return this.errorState('No login record found', 'NOT_FOUND');
    }
    this.logStep('login:loginRecordFound', {
      loginDTag,
      createdAt: loginEvent.createdAt,
    });

    let loginPayload: LiteLoginPayload;
    try {
      const decryptedLogin = decryptString(loginEvent.content, input.authSecret);
      loginPayload = JSON.parse(decryptedLogin) as LiteLoginPayload;
    } catch {
      this.logStep('login:loginDecryptFailed');
      return this.errorState('Unable to decrypt login record', 'INVALID_INPUT');
    }
    this.logStep('login:loginDecrypted', {
      publicKey: loginPayload.publicKey,
      storagePublicKey: loginPayload.storagePublicKey,
    });

    const vaultEvent =
      (await this.relayClient.getLatest({
        kinds: [KIND],
        authors: [loginPayload.storagePublicKey],
        dTags: [loginPayload.vaultDTag],
        limit: 20,
      })) ??
      (await this.storage.get<{ content: string; createdAt: number; pubkey: string }>(
        this.vaultCacheKey(loginPayload.publicKey)
      ));

    if (!vaultEvent) {
      this.logStep('login:missingVaultRecord', {
        vaultDTag: loginPayload.vaultDTag,
      });
      return this.errorState('Vault record not found', 'NOT_FOUND');
    }
    this.logStep('login:vaultRecordFound', {
      createdAt: vaultEvent.createdAt,
      pubkey: vaultEvent.pubkey,
    });

    let vaultSecret: string;
    let storagePrivateKey: string;
    let vaultPayload: LiteVaultPayload;

    try {
      vaultSecret = decryptString(loginPayload.vaultSecretEncrypted, input.authSecret);
      storagePrivateKey = decryptString(
        loginPayload.storagePrivateKeyEncrypted,
        input.authSecret
      );
      vaultPayload = JSON.parse(decryptString(vaultEvent.content, vaultSecret)) as LiteVaultPayload;
    } catch {
      this.logStep('login:vaultDecryptFailed');
      return this.errorState('Unable to decrypt vault', 'INVALID_INPUT');
    }
    this.logStep('login:vaultDecrypted', {
      publicKey: vaultPayload.publicKey,
    });

    this.session = {
      authMethod: input.authMethod,
      identifier: input.identifier,
      authSecret: input.authSecret,
      relays,
      loginPayload,
      vaultSecret,
      storagePrivateKey,
      vaultPayload,
    };
    this.sessionPermissionGrants.clear();

    this.authState = {
      initialized: true,
      isAuthenticated: true,
      isLocked: true,
      authMethod: input.authMethod,
      identifier: input.identifier,
      publicKey: vaultPayload.publicKey,
    };

    await this.cacheLoginAndVault(loginDTag, loginEvent.content, loginPayload.publicKey, vaultEvent.content);
    await this.persistAuthState();
    this.logStep('login:done', this.authState);
    return this.getAuthState();
  }

  async unlock(input: LiteUnlockInput): Promise<LiteAuthState> {
    this.logStep('unlock:start');
    this.assertNonEmpty(input.pin, 'PIN is required');

    // ── Resume path (page refresh — session is null) ──────────────────────────
    if (!this.session) {
      this.logStep('unlock:resume:start');
      const resumeEncrypted = await this.storage.get<string>(RESUME_KEY);
      if (!resumeEncrypted) {
        this.logStep('unlock:resume:noToken');
        return this.errorState('Session expired. Please sign in again.', 'NOT_AUTHENTICATED');
      }

      let resume: LiteResumePayload;
      try {
        resume = JSON.parse(decryptString(resumeEncrypted, input.pin)) as LiteResumePayload;
      } catch {
        // Wrong PIN — throw WITHOUT calling errorState() so auth stays locked (not logged-out)
        this.logStep('unlock:resume:badPin');
        throw Object.assign(new Error('Invalid PIN'), { code: 'INVALID_INPUT' });
      }

      // Restore session from resume payload (authSecret not needed for operations)
      this.session = {
        authMethod: resume.authMethod,
        identifier: resume.identifier,
        authSecret: '',
        relays: resume.relays,
        loginPayload: resume.loginPayload,
        vaultSecret: resume.vaultSecret,
        storagePrivateKey: resume.storagePrivateKey,
        vaultPayload: resume.vaultPayload,
      };

      // Refresh vault payload from cache so permissions are up to date
      const freshVault = await this.storage.get<{ content: string }>(
        this.vaultCacheKey(resume.vaultPayload.publicKey)
      );
      if (freshVault) {
        try {
          const fresh = JSON.parse(decryptString(freshVault.content, resume.vaultSecret)) as LiteVaultPayload;
          this.session.vaultPayload = fresh;
        } catch { /* use resume payload as-is */ }
      }

      this.logStep('unlock:resume:sessionRestored');
    }

    // ── Common unlock path ────────────────────────────────────────────────────
    try {
      const privateKeyHex = decryptString(
        this.session.vaultPayload.privateKeyEncrypted,
        input.pin
      );
      const derived = derivePublicKey(privateKeyHex);
      if (derived !== this.session.vaultPayload.publicKey) {
        this.logStep('unlock:pubkeyMismatch', {
          expected: this.session.vaultPayload.publicKey,
          got: derived,
        });
        return this.errorState('PIN unlock validation failed', 'INVALID_INPUT');
      }
      this.session.unlockedPrivateKey = privateKeyHex;
    } catch {
      this.logStep('unlock:decryptFailed');
      return this.errorState('Invalid PIN', 'INVALID_INPUT');
    }

    // Save fresh resume token so next page load can PIN-unlock again
    await this.saveResumeToken(input.pin);

    this.authState.isLocked = false;
    await this.persistAuthState();
    this.logStep('unlock:done', this.authState);
    return this.getAuthState();
  }

  async lock(): Promise<LiteAuthState> {
    if (this.session) {
      delete this.session!.unlockedPrivateKey;
    }
    this.sessionPermissionGrants.clear();
    if (this.authState.isAuthenticated) {
      this.authState.isLocked = true;
    }
    await this.persistAuthState();
    return this.getAuthState();
  }

  async logout(): Promise<LiteAuthState> {
    this.session = null;
    this.pendingPermissionRequests.clear();
    this.sessionPermissionGrants.clear();
    this.authState = {
      initialized: true,
      isAuthenticated: false,
      isLocked: true,
    };
    await Promise.all([
      this.persistAuthState(),
      this.storage.remove(RESUME_KEY),
    ]);
    return this.getAuthState();
  }

  async requestOperation<T>(
    request: LiteOperationRequest
  ): Promise<LiteOperationResult<T>> {
    this.logStep('operation:start', {
      origin: request.origin,
      operation: request.operation,
    });
    if (!this.session) {
      this.logStep('operation:blocked:notAuthenticated');
      return {
        success: false,
        error: 'Not authenticated',
        errorCode: 'NOT_AUTHENTICATED',
      };
    }

    if (request.operation !== 'getPublicKey' && !this.session!.unlockedPrivateKey) {
      this.logStep('operation:blocked:locked');
      return {
        success: false,
        error: 'Vault is locked',
        errorCode: 'LOCKED',
      };
    }

    if (this.hasValidSessionPermission(request.origin, request.operation)) {
      this.logStep('operation:allowed:sessionGrant');
      return this.executeOperation<T>(request);
    }

    const level = this.resolvePermissionLevel(request.origin, request.operation);
    if (level === 'DENY') {
      this.logStep('operation:blocked:denied');
      return {
        success: false,
        error: 'Permission denied',
        errorCode: 'PERMISSION_DENIED',
      };
    }

    if (level === 'ASK_EVERYTIME' || level === 'ASK_PER_SESSION') {
      const requestId = this.createRequestId();
      this.logStep('operation:permissionRequired', { requestId });
      this.pendingPermissionRequests.set(requestId, {
        id: requestId,
        origin: request.origin,
        operation: request.operation,
        payload: request.payload,
        createdAt: this.now(),
      });

      return {
        success: false,
        error: 'Permission required',
        errorCode: 'PERMISSION_REQUIRED',
        requestId,
      };
    }

    this.logStep('operation:allowed');
    return this.executeOperation<T>(request);
  }

  async resolvePermission<T>(
    input: LiteResolvePermissionInput
  ): Promise<LiteOperationResult<T>> {
    this.logStep('permission:resolve:start', input);
    const pending = this.pendingPermissionRequests.get(input.requestId);
    if (!pending) {
      this.logStep('permission:resolve:notFound', { requestId: input.requestId });
      return {
        success: false,
        error: 'Pending permission request not found',
        errorCode: 'NOT_FOUND',
      };
    }

    this.pendingPermissionRequests.delete(input.requestId);

    if (!input.granted) {
      this.logStep('permission:resolve:denied');
      return {
        success: false,
        error: 'Permission denied',
        errorCode: 'PERMISSION_DENIED',
      };
    }

    if (input.remember) {
      const level = input.level ?? 'ALLOW';
      if (level === 'ASK_PER_SESSION') {
        const durationMinutes = Math.max(
          1,
          Math.floor(input.sessionDurationMinutes ?? DEFAULT_SESSION_PERMISSION_MINUTES)
        );
        const expiresAt = this.now() + durationMinutes * 60 * 1000;
        this.sessionPermissionGrants.set(
          this.permissionSessionKey(pending.origin, pending.operation),
          expiresAt
        );
        this.logStep('permission:resolve:sessionGrant', {
          origin: pending.origin,
          operation: pending.operation,
          expiresAt,
        });
      } else {
        this.assertSession();
        const originPermissions = this.session!.vaultPayload.permissions[pending.origin] ?? {};
        originPermissions[pending.operation] = level;
        this.session!.vaultPayload.permissions[pending.origin] = originPermissions;
        await this.persistVault();
        this.logStep('permission:resolve:remembered', {
          origin: pending.origin,
          operation: pending.operation,
          level,
        });
      }
    }

    this.logStep('permission:resolve:executing');
    return this.executeOperation<T>({
      origin: pending.origin,
      operation: pending.operation,
      payload: pending.payload,
    });
  }

  private async enroll(input: LiteEnrollInput): Promise<LiteSetupResult> {
    this.logStep('enroll:start', {
      authMethod: input.authMethod,
      identifier: input.identifier,
      byok: Boolean(input.privateKeyHex),
    });
    this.assertNonEmpty(input.identifier, 'Identifier is required');
    this.assertNonEmpty(input.authSecret, 'Auth secret is required');
    this.assertNonEmpty(input.pin, 'PIN is required');

    const now = this.now();
    const relays = input.relays ?? this.defaultRelays;
    const privateKeyHex =
      input.privateKeyHex ?? bytesToHex(generateSecretKey());
    const publicKey = derivePublicKey(privateKeyHex);

    const loginDTag = createLoginDTag(
      this.namespace,
      input.authMethod,
      input.identifier,
      this.environment
    );
    const vaultDTag = createVaultDTag(this.namespace, publicKey, this.environment);

    const existingLogin = await this.relayClient.getLatest({
      kinds: [KIND],
      dTags: [loginDTag],
      limit: 10,
    });
    if (existingLogin && !input.overwriteExistingLogin) {
      this.logStep('enroll:conflict:loginRecordExists');
      throw this.conflictError('Login record already exists');
    }

    const existingVault = await this.relayClient.getLatest({
      kinds: [KIND],
      dTags: [vaultDTag],
      limit: 10,
    });
    if (existingVault && !input.overwriteExistingVault) {
      this.logStep('enroll:conflict:vaultRecordExists');
      throw this.conflictError('Vault record already exists for this key');
    }

    const pinSalt = bytesToHex(randomBytes(16));
    const privateKeyEncrypted = encryptString(privateKeyHex, input.pin, pinSalt);
    const vaultPayload: LiteVaultPayload = {
      version: 1,
      publicKey,
      privateKeyEncrypted,
      pinSalt,
      permissions: {},
      createdAt: now,
      updatedAt: now,
    };

    const vaultSecret = bytesToHex(randomBytes(32));
    const encryptedVaultPayload = encryptString(
      JSON.stringify(vaultPayload),
      vaultSecret
    );

    const storagePrivateKey = bytesToHex(generateSecretKey());
    const storagePublicKey = getPublicKey(hexToBytes(storagePrivateKey));

    const vaultEventTemplate = {
      kind: KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', vaultDTag],
        ['client', this.namespace],
        ['schema', 'nostrpass-lite-v1'],
      ],
      content: encryptedVaultPayload,
    };
    const signedVaultEvent = finalizeEvent(
      vaultEventTemplate,
      hexToBytes(storagePrivateKey)
    );

    const vaultPublishes = await this.relayClient.publish(signedVaultEvent);
    if (!vaultPublishes.length && !this.allowOffline) {
      this.logStep('enroll:vaultPublishFailed');
      throw new Error('Failed to publish vault event to relays');
    }
    this.assertRelayDurability({
      operation: 'enroll.vault',
      relayCount: vaultPublishes.length,
      relayTarget: relays.length,
    });
    this.logStep('enroll:vaultPublished', {
      relayCount: vaultPublishes.length,
      offlineFallback: vaultPublishes.length === 0,
    });

    const loginPayload: LiteLoginPayload = {
      version: 1,
      authMethod: input.authMethod,
      identifier: input.identifier,
      publicKey,
      storagePublicKey,
      storagePrivateKeyEncrypted: encryptString(storagePrivateKey, input.authSecret),
      vaultSecretEncrypted: encryptString(vaultSecret, input.authSecret),
      vaultDTag,
      createdAt: now,
      updatedAt: now,
    };

    const encryptedLoginPayload = encryptString(
      JSON.stringify(loginPayload),
      input.authSecret
    );

    const loginSigner = generateSecretKey();
    const loginEventTemplate = {
      kind: KIND,
      created_at: Math.floor(now / 1000),
      tags: [
        ['d', loginDTag],
        ['client', this.namespace],
        ['schema', 'nostrpass-lite-v1'],
        ['auth', input.authMethod],
        ['identifier-hash', stableHash(input.identifier)],
      ],
      content: encryptedLoginPayload,
    };
    const signedLoginEvent = finalizeEvent(loginEventTemplate, loginSigner);

    const loginPublishes = await this.relayClient.publish(signedLoginEvent);
    if (!loginPublishes.length && !this.allowOffline) {
      this.logStep('enroll:loginPublishFailed');
      throw new Error('Failed to publish login event to relays');
    }
    this.assertRelayDurability({
      operation: 'enroll.login',
      relayCount: loginPublishes.length,
      relayTarget: relays.length,
    });
    this.logStep('enroll:loginPublished', {
      relayCount: loginPublishes.length,
      offlineFallback: loginPublishes.length === 0,
    });

    this.session = {
      authMethod: input.authMethod,
      identifier: input.identifier,
      authSecret: input.authSecret,
      relays,
      loginPayload,
      vaultSecret,
      storagePrivateKey,
      vaultPayload,
      unlockedPrivateKey: privateKeyHex,
    };
    this.sessionPermissionGrants.clear();

    this.authState = {
      initialized: true,
      isAuthenticated: true,
      isLocked: false,
      authMethod: input.authMethod,
      identifier: input.identifier,
      publicKey,
    };

    await this.cacheLoginAndVault(loginDTag, encryptedLoginPayload, publicKey, encryptedVaultPayload);
    await this.saveResumeToken(input.pin);
    await this.persistAuthState();
    this.logStep('enroll:done', this.authState);

    return {
      authState: this.getAuthState(),
      publicKey,
    };
  }

  private async fetchLoginRecord(
    loginDTag: string
  ): Promise<{ content: string; createdAt: number; pubkey: string } | null> {
    this.logStep('loginRecord:fetch:start', { loginDTag });
    const fromRelay = await this.relayClient.getLatest({
      kinds: [KIND],
      dTags: [loginDTag],
      limit: 20,
    });

    if (fromRelay) {
      this.logStep('loginRecord:fetch:relayHit');
      await this.storage.set(this.loginCacheKey(loginDTag), fromRelay);
      return fromRelay;
    }

    const cached = await this.storage.get<{ content: string; createdAt: number; pubkey: string }>(
      this.loginCacheKey(loginDTag)
    );
    this.logStep('loginRecord:fetch:cache', { hit: Boolean(cached) });
    return cached;
  }

  private async cacheLoginAndVault(
    loginDTag: string,
    loginContent: string,
    publicKey: string,
    vaultContent: string
  ): Promise<void> {
    await this.storage.set(this.loginCacheKey(loginDTag), {
      content: loginContent,
      createdAt: this.now(),
      pubkey: '',
    });

    await this.storage.set(this.vaultCacheKey(publicKey), {
      content: vaultContent,
      createdAt: this.now(),
      pubkey: this.session?.loginPayload.storagePublicKey ?? '',
    });
  }

  private resolvePermissionLevel(
    origin: string,
    operation: LiteOperationRequest['operation']
  ): 'ALLOW' | 'ASK_PER_SESSION' | 'ASK_EVERYTIME' | 'DENY' {
    this.assertSession();
    const originPermissions = this.session!.vaultPayload.permissions[origin];
    return originPermissions?.[operation] ?? 'ASK_EVERYTIME';
  }

  private hasValidSessionPermission(
    origin: string,
    operation: LiteOperationRequest['operation']
  ): boolean {
    const key = this.permissionSessionKey(origin, operation);
    const expiresAt = this.sessionPermissionGrants.get(key);
    if (!expiresAt) {
      return false;
    }
    if (this.now() > expiresAt) {
      this.sessionPermissionGrants.delete(key);
      return false;
    }
    return true;
  }

  private permissionSessionKey(
    origin: string,
    operation: LiteOperationRequest['operation']
  ): string {
    return `${origin}::${operation}`;
  }

  private async executeOperation<T>(
    request: LiteOperationRequest
  ): Promise<LiteOperationResult<T>> {
    this.assertSession();

    try {
      switch (request.operation) {
        case 'getPublicKey': {
          this.logStep('operation:execute:getPublicKey');
          return { success: true, data: this.session!.vaultPayload.publicKey as T };
        }
        case 'signEvent': {
          this.logStep('operation:execute:signEvent');
          const rawEvent = request.payload?.event as Record<string, unknown> | undefined;
          if (!rawEvent || typeof rawEvent !== 'object') {
            return {
              success: false,
              error: 'Missing event payload',
              errorCode: 'INVALID_INPUT',
            };
          }

          const unsigned = {
            kind: Number(rawEvent.kind ?? 1),
            created_at: Number(rawEvent.created_at ?? Math.floor(this.now() / 1000)),
            tags: (rawEvent.tags as string[][] | undefined) ?? [],
            content: String(rawEvent.content ?? ''),
          };

          const signed = finalizeEvent(unsigned, hexToBytes(this.session!.unlockedPrivateKey!));
          return { success: true, data: signed as T };
        }
        case 'nip04.encrypt': {
          this.logStep('operation:execute:nip04.encrypt');
          const pubkey = String(request.payload?.pubkey ?? '');
          const plaintext = String(request.payload?.plaintext ?? '');
          const encrypted = await nip04Encrypt(
            this.session!.unlockedPrivateKey!,
            pubkey,
            plaintext
          );
          return { success: true, data: encrypted as T };
        }
        case 'nip04.decrypt': {
          this.logStep('operation:execute:nip04.decrypt');
          const pubkey = String(request.payload?.pubkey ?? '');
          const ciphertext = String(request.payload?.ciphertext ?? '');
          const decrypted = await nip04Decrypt(
            this.session!.unlockedPrivateKey!,
            pubkey,
            ciphertext
          );
          return { success: true, data: decrypted as T };
        }
        case 'nip44.encrypt': {
          this.logStep('operation:execute:nip44.encrypt');
          const pubkey = String(request.payload?.pubkey ?? '');
          const plaintext = String(request.payload?.plaintext ?? '');
          const conversationKey = nip44.v2.utils.getConversationKey(
            hexToBytes(this.session!.unlockedPrivateKey!),
            pubkey
          );
          return {
            success: true,
            data: nip44.v2.encrypt(plaintext, conversationKey) as T,
          };
        }
        case 'nip44.decrypt': {
          this.logStep('operation:execute:nip44.decrypt');
          const pubkey = String(request.payload?.pubkey ?? '');
          const ciphertext = String(request.payload?.ciphertext ?? '');
          const conversationKey = nip44.v2.utils.getConversationKey(
            hexToBytes(this.session!.unlockedPrivateKey!),
            pubkey
          );
          return {
            success: true,
            data: nip44.v2.decrypt(ciphertext, conversationKey) as T,
          };
        }
        default:
          return {
            success: false,
            error: `Unsupported operation: ${request.operation}`,
            errorCode: 'INVALID_INPUT',
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  private async persistVault(): Promise<void> {
    this.logStep('vault:persist:start');
    this.assertSession();
    this.session!.vaultPayload.updatedAt = this.now();
    const encryptedVaultPayload = encryptString(
      JSON.stringify(this.session!.vaultPayload),
      this.session!.vaultSecret
    );

    const eventTemplate = {
      kind: KIND,
      created_at: Math.floor(this.now() / 1000),
      tags: [
        ['d', this.session!.loginPayload.vaultDTag],
        ['client', this.namespace],
        ['schema', 'nostrpass-lite-v1'],
      ],
      content: encryptedVaultPayload,
    };

    const signed = finalizeEvent(eventTemplate, hexToBytes(this.session!.storagePrivateKey));
    const published = await this.relayClient.publish(signed);
    if (!published.length && !this.allowOffline) {
      this.logStep('vault:persist:publishFailed');
      throw new Error('Failed to publish updated vault event to relays');
    }
    this.assertRelayDurability({
      operation: 'vault.persist',
      relayCount: published.length,
      relayTarget: this.session!.relays.length,
    });
    this.logStep('vault:persist:published', {
      relayCount: published.length,
      offlineFallback: published.length === 0,
    });

    await this.storage.set(this.vaultCacheKey(this.session!.vaultPayload.publicKey), {
      content: encryptedVaultPayload,
      createdAt: this.now(),
      pubkey: this.session!.loginPayload.storagePublicKey,
    });
  }

  private async saveResumeToken(pin: string): Promise<void> {
    if (!this.session) return;
    const payload: LiteResumePayload = {
      authMethod: this.session.authMethod,
      identifier: this.session.identifier,
      relays: this.session.relays,
      loginPayload: this.session.loginPayload,
      vaultSecret: this.session.vaultSecret,
      storagePrivateKey: this.session.storagePrivateKey,
      vaultPayload: this.session.vaultPayload,
    };
    await this.storage.set(RESUME_KEY, encryptString(JSON.stringify(payload), pin));
  }

  private async persistAuthState(): Promise<void> {
    await this.storage.set(AUTH_STATE_KEY, this.authState);
  }

  private createRequestId(): string {
    return `lite-pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private loginCacheKey(loginDTag: string): string {
    return `${LOGIN_CACHE_PREFIX}:${loginDTag}`;
  }

  private vaultCacheKey(publicKey: string): string {
    return `${VAULT_CACHE_PREFIX}:${stableHash(publicKey)}`;
  }

  private assertSession(): void {
    if (!this.session) {
      throw new Error('Not authenticated');
    }
  }

  private assertNonEmpty(value: string, message: string): void {
    if (!value.trim()) {
      throw new Error(message);
    }
  }

  private conflictError(message: string): Error {
    const err = new Error(message);
    (err as Error & { code?: string }).code = 'CONFLICT';
    return err;
  }

  private assertRelayDurability(input: {
    operation: string;
    relayCount: number;
    relayTarget: number;
  }): void {
    if (input.relayCount >= this.minRelayAcks) {
      return;
    }
    const err = new Error(
      `Durability check failed for ${input.operation}: published to ${input.relayCount}/${input.relayTarget} relays, requires at least ${this.minRelayAcks}.`
    );
    (err as Error & { code?: string }).code = 'RELAY_DURABILITY_FAILED';
    throw err;
  }

  private errorState(message: string, code: LiteOperationResult['errorCode']): never {
    this.logStep('errorState', { message, code });
    this.authState = {
      initialized: true,
      isAuthenticated: false,
      isLocked: true,
    };
    this.session = null;
    this.sessionPermissionGrants.clear();
    void this.persistAuthState();
    throw Object.assign(new Error(message), { code });
  }

  private logStep(step: string, data?: unknown): void {
    if (data === undefined) {
      console.info(`[LiteCore] ${step}`);
      return;
    }
    console.info(`[LiteCore] ${step}`, this.redactForLog(data));
  }

  private redactForLog(data: unknown): unknown {
    const secretKeys = new Set([
      'password',
      'pin',
      'authSecret',
      'privateKeyHex',
      'storagePrivateKey',
      'storagePrivateKeyEncrypted',
      'unlockedPrivateKey',
      'vaultSecret',
      'vaultPayload',
      'loginPayload',
      'encryptedNsec',
      'nsec',
      'xpriv',
      'xprivEncrypted',
      'salt',
      'pinSalt',
      'passwordSalt',
    ]);

    const walk = (value: unknown): unknown => {
      if (!value || typeof value !== 'object') {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map(walk);
      }
      const out: Record<string, unknown> = {};
      for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
        out[key] = secretKeys.has(key) ? '[REDACTED]' : walk(next);
      }
      return out;
    };

    return walk(data);
  }
}
