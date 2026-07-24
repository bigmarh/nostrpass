import { createSignal, onMount, Show } from 'solid-js';
import { LiteCore, BrowserLocalStorageStore, NostrRelayClient } from '@nostrpass/lite-core';
import type { LiteAuthState } from '@nostrpass/lite-core';
import { WorkerBridge } from './workerBridge';
import { createLiteNostrApi } from '@nostrpass/lite-api';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { SetupPinScreen } from './screens/SetupPinScreen';
import { PinScreen } from './screens/PinScreen';
import { PermissionScreen } from './screens/PermissionScreen';

// ── Constants ──────────────────────────────────────────────────────────────────
// Note: of the public relays, only nos.lol reliably retains kind-30078 app
// data — damus and nostr.band ACK writes but drop them. The bigsnap relays are
// operator-controlled and store 30078 durably, so login/vault records survive
// even if the public relays purge. Reads pick the newest record across all.
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://r1.bigsnap.ai',
  'wss://r2.bigsnap.ai',
];
const MIN_RELAY_ACKS = 1;
const RPC_CHANNEL = 'nostrpass-lite-rpc-v1';

// ── Types ──────────────────────────────────────────────────────────────────────
type RpcMethod = 'PING' | 'FOCUS_AUTH' | 'GET_AUTH_STATE' | 'GET_PUBLIC_KEY' | 'SIGN_EVENT' | 'SIGN_DATA' | 'NIP44_ENCRYPT' | 'NIP44_DECRYPT' | 'LOGOUT';

interface RpcRequestMessage {
  channel: typeof RPC_CHANNEL;
  type: 'request';
  id: string;
  method: RpcMethod;
  params?: Record<string, unknown>;
}

interface RpcResponseMessage {
  channel: typeof RPC_CHANNEL;
  type: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface RpcEventMessage {
  channel: typeof RPC_CHANNEL;
  type: 'event';
  event: 'READY' | 'AUTH_STATE' | 'NEEDS_INTERACTION' | 'CLOSE';
  auth: LiteAuthState;
}

interface LiteGoogleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// ── Crypto delegate (Web Worker) ──────────────────────────────────────────────
// The worker holds the raw private key in its own memory. The main thread only
// ever handles encrypted blobs and operation results — never the plaintext key.
const cryptoDelegate = new WorkerBridge();

// ── Core (singleton outside component) ────────────────────────────────────────
const core = new LiteCore({
  storage: new BrowserLocalStorageStore('nostrpass-lite-web'),
  relayClient: new NostrRelayClient(relays),
  namespace: 'nostrpass-lite',
  environment: 'production',
  relays,
  allowOffline: false,
  minRelayAcks: MIN_RELAY_ACKS,
  cryptoDelegate,
});

// ── URL query params ───────────────────────────────────────────────────────────
const parentOriginFromQuery = (() => {
  const raw = new URLSearchParams(window.location.search).get('parentOrigin');
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
})();
const query = new URLSearchParams(window.location.search);
const forceDevUi = query.get('dev') === '1';
const embedMode = !forceDevUi;

// ── Firebase config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function isGoogleAuthAvailable(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

function getFirebaseAuth(): Auth | null {
  if (!isGoogleAuthAvailable()) return null;
  if (firebaseAuth) return firebaseAuth;
  const existing = getApps();
  firebaseApp = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig as { apiKey: string; authDomain: string; projectId: string });
  firebaseAuth = getAuth(firebaseApp);
  return firebaseAuth;
}

function normalizeGoogleError(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Popup blocked. Please allow popups for this site.';
  if (code === 'auth/network-request-failed') return 'Network error during Google sign-in.';
  return formatError(error);
}

async function signInWithGooglePopup(): Promise<LiteGoogleUser> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Google Sign-In is unavailable. Configure Firebase env vars for lite-vault.');
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const result = await signInWithPopup(auth, provider);
  return { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName };
}

const GOOGLE_AUTH_MESSAGE_TYPE = 'nostrpass-lite-google-auth';
const GOOGLE_AUTH_TIMEOUT_MS = 3 * 60_000;

/**
 * Google sign-in via a top-level popup on this same origin (auth.html).
 * Used when the vault runs inside a cross-origin iframe: Firebase's popup
 * handshake needs first-party storage with the auth domain, which WebKit
 * (iOS Safari) denies to third-party iframes — signInWithPopup never resolves
 * and the UI spins forever. The top-level popup has first-party storage and
 * hands the result back through window.opener.postMessage, which is not
 * subject to storage partitioning.
 */
function signInWithGoogleTopLevel(): Promise<LiteGoogleUser> {
  return new Promise<LiteGoogleUser>((resolve, reject) => {
    const authUrl = new URL('auth.html', window.location.href).toString();
    const popup = window.open(authUrl, 'nostrpass-google-auth', 'width=480,height=640,popup=yes');
    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      clearInterval(closePollId);
      window.removeEventListener('message', onMessage);
      fn();
    };

    const timeoutId = setTimeout(
      () => finish(() => reject(new Error('Google sign-in timed out.'))),
      GOOGLE_AUTH_TIMEOUT_MS
    );

    // If the user closes the popup, reject — but give a short grace period so
    // a success message posted just before close still wins the race.
    const closePollId = setInterval(() => {
      if (popup.closed) {
        setTimeout(
          () => finish(() => reject(new Error('Google sign-in was cancelled.'))),
          400
        );
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        user?: LiteGoogleUser;
        error?: string;
      };
      if (data?.type !== GOOGLE_AUTH_MESSAGE_TYPE) return;
      try {
        popup.close();
      } catch {
        /* already closed */
      }
      if (data.ok && data.user) {
        const user = data.user;
        finish(() => resolve(user));
      } else {
        finish(() => reject(new Error(data.error || 'Google sign-in failed.')));
      }
    };
    window.addEventListener('message', onMessage);
  });
}

/** Iframe-aware Google sign-in: direct popup when top-level, auth.html popup when embedded. */
async function googleSignIn(): Promise<LiteGoogleUser> {
  const embedded = window.self !== window.top;
  return embedded ? signInWithGoogleTopLevel() : signInWithGooglePopup();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code =
      typeof (error as Error & { code?: string }).code === 'string'
        ? (error as Error & { code?: string }).code
        : null;
    return code ? `${error.message} (${code})` : error.message;
  }
  return String(error);
}

function isMissingLoginError(error: unknown): boolean {
  return formatError(error).toLowerCase().includes('no login record found');
}

function isRpcRequestMessage(value: unknown): value is RpcRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<RpcRequestMessage>;
  return (
    payload.channel === RPC_CHANNEL &&
    payload.type === 'request' &&
    typeof payload.id === 'string' &&
    typeof payload.method === 'string'
  );
}

// ── App component ──────────────────────────────────────────────────────────────
export function App() {
  // Reactive state
  const [authState, setAuthState] = createSignal<LiteAuthState>({
    initialized: false,
    isAuthenticated: false,
    isLocked: true,
  });
  const [view, setView] = createSignal<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = createSignal<'form' | 'pin'>('form');
  const [pendingSignup, setPendingSignup] = createSignal<{
    identifier: string;
    authSecret: string;
    usingGoogle: boolean;
    isNewAccount?: boolean;
  } | null>(null);
  const [pendingPermission, setPendingPermission] = createSignal<{
    origin: string;
    operation: string;
  } | null>(null);
  const [formError, setFormError] = createSignal('');
  const [isBusy, setIsBusy] = createSignal(false);
  const [googleState, setGoogleState] = createSignal<string | null>(null);
  const [selectedGoogleUser, setSelectedGoogleUser] = createSignal<LiteGoogleUser | null>(null);

  // Permission promise resolver
  let resolvePermission: ((result: { granted: boolean }) => void) | null = null;

  // PIN screen shake ref
  let pinShakeFn: (() => void) | undefined;

  // Active parent origin (settable from RPC messages)
  let activeParentOrigin: string | null = parentOriginFromQuery;

  // Cached login credentials — used to restore session after a wrong-PIN attempt
  // (core.errorState() nukes the session on any unlock failure)
  let cachedLogin: { identifier: string; authSecret: string; usingGoogle: boolean } | null = null;

  const appOriginLabel = parentOriginFromQuery ?? '';

  // ── RPC messaging ────────────────────────────────────────────────────────────
  function postRpcMessage(message: RpcResponseMessage | RpcEventMessage, targetOrigin?: string): void {
    if (window.parent === window) return;
    const destination = targetOrigin ?? activeParentOrigin ?? '*';
    window.parent.postMessage(message, destination);
  }

  function notifyParentAuthState(event: RpcEventMessage['event'] = 'AUTH_STATE'): void {
    postRpcMessage({
      channel: RPC_CHANNEL,
      type: 'event',
      event,
      auth: core.getAuthState(),
    });
  }

  function isAllowedParentOrigin(origin: string): boolean {
    if (!activeParentOrigin) return true;
    return origin === activeParentOrigin;
  }

  // ── nostrApi ─────────────────────────────────────────────────────────────────
  const nostrApi = createLiteNostrApi(core, {
    originResolver: () => activeParentOrigin ?? parentOriginFromQuery ?? window.location.origin,
    onPermissionPrompt: async (ctx) => {
      setPendingPermission({ origin: ctx.origin, operation: ctx.operation });
      // Tell the parent to show the vault so the user can see the permission prompt
      postRpcMessage({ channel: RPC_CHANNEL, type: 'event', event: 'NEEDS_INTERACTION', auth: core.getAuthState() });

      const result = await new Promise<{ granted: boolean }>((resolve) => {
        resolvePermission = resolve;
      });

      setPendingPermission(null);
      // Close the overlay immediately — don't wait for the async op to finish
      notifyParentAuthState('AUTH_STATE');

      if (!result.granted) {
        return { granted: false };
      }

      return { granted: true, remember: true, level: 'ALLOW' };
    },
  });

  // ── RPC handler ──────────────────────────────────────────────────────────────
  const handleRpcRequest = async (request: RpcRequestMessage): Promise<unknown> => {
    switch (request.method) {
      case 'PING':
        return { ready: true, auth: core.getAuthState() };

      case 'FOCUS_AUTH':
        setView('login');
        return { focused: true, auth: core.getAuthState() };

      case 'LOGOUT': {
        const loggedOut = await core.logout();
        cachedLogin = null;
        setAuthState({ ...loggedOut });
        setView('login');
        notifyParentAuthState('AUTH_STATE');
        return { ok: true };
      }

      case 'GET_AUTH_STATE':
        return core.getAuthState();

      case 'GET_PUBLIC_KEY':
        return nostrApi.getPublicKey();

      case 'SIGN_EVENT': {
        const eventParam = request.params?.event as
          | { kind?: unknown; tags?: unknown; content?: unknown; created_at?: unknown }
          | undefined;

        if (!eventParam || typeof eventParam !== 'object') {
          throw new Error('SIGN_EVENT requires params.event');
        }

        const kind = typeof eventParam.kind === 'number' ? eventParam.kind : 1;
        const tags = Array.isArray(eventParam.tags) ? (eventParam.tags as string[][]) : [];
        const content = typeof eventParam.content === 'string' ? eventParam.content : '';
        const createdAt =
          typeof eventParam.created_at === 'number'
            ? eventParam.created_at
            : Math.floor(Date.now() / 1000);

        return nostrApi.signEvent({ kind, tags, content, created_at: createdAt });
      }

      case 'SIGN_DATA': {
        const message = request.params?.message;
        if (typeof message !== 'string') throw new Error('SIGN_DATA requires params.message (hex string)');
        return nostrApi.signData(message);
      }

      case 'NIP04_ENCRYPT': {
        const pubkey = String(request.params?.pubkey ?? '');
        const plaintext = String(request.params?.plaintext ?? '');
        return nostrApi.nip04.encrypt(pubkey, plaintext);
      }

      case 'NIP04_DECRYPT': {
        const pubkey = String(request.params?.pubkey ?? '');
        const ciphertext = String(request.params?.ciphertext ?? '');
        return nostrApi.nip04.decrypt(pubkey, ciphertext);
      }

      case 'NIP44_ENCRYPT': {
        const pubkey = String(request.params?.pubkey ?? '');
        const plaintext = String(request.params?.plaintext ?? '');
        return nostrApi.nip44.encrypt(pubkey, plaintext);
      }

      case 'NIP44_DECRYPT': {
        const pubkey = String(request.params?.pubkey ?? '');
        const ciphertext = String(request.params?.ciphertext ?? '');
        return nostrApi.nip44.decrypt(pubkey, ciphertext);
      }

      default:
        throw new Error(`Unsupported RPC method: ${request.method}`);
    }
  };

  // ── Action runner ─────────────────────────────────────────────────────────────
  async function runAction<T>(
    operation: () => Promise<T>,
    opts?: { onError?: () => void },
  ): Promise<void> {
    setFormError('');
    setIsBusy(true);
    try {
      await operation();
      const auth = core.getAuthState();
      setAuthState({ ...auth });
      notifyParentAuthState('AUTH_STATE');
    } catch (error) {
      opts?.onError?.();
      setFormError(formatError(error));
      const auth = core.getAuthState();
      setAuthState({ ...auth });
      notifyParentAuthState('AUTH_STATE');

      if (embedMode && isMissingLoginError(error)) {
        setView('signup');
        setSignupStep('form');
        setPendingSignup(null);
      }
    } finally {
      setIsBusy(false);
    }
  }

  // ── Google helpers ────────────────────────────────────────────────────────────
  function clearGoogleSelection(): void {
    setSelectedGoogleUser(null);
    setGoogleState(null);
  }

  async function handleGoogleConnect(mode: 'login' | 'signup'): Promise<void> {
    setFormError('');
    setIsBusy(true);
    try {
      const user = await googleSignIn();
      setSelectedGoogleUser(user);
      const accountLabel = user.email ?? user.displayName ?? `${user.uid.slice(0, 10)}...`;
      setGoogleState(`Google account: ${accountLabel}`);

      // identifier = email (human-readable, shown in UI); authSecret = uid (stable, used for crypto)
      const identifier = user.email ?? user.uid;
      const authSecret = user.uid;

      if (mode === 'login') {
        cachedLogin = { identifier, authSecret, usingGoogle: true };
        try {
          const newState = await core.loginWithGoogle({ identifier, authSecret });
          setAuthState({ ...newState });
          notifyParentAuthState('AUTH_STATE');
        } catch (loginError) {
          if (isMissingLoginError(loginError)) {
            // No account yet — skip signup form, go straight to PIN creation
            setPendingSignup({ identifier, authSecret, usingGoogle: true, isNewAccount: true });
            setView('signup');
            setSignupStep('pin');
          } else {
            setFormError(formatError(loginError));
          }
        }
      } else {
        // signup: skip the form entirely, jump straight to PIN
        setPendingSignup({ identifier, authSecret, usingGoogle: true });
        setSignupStep('pin');
      }
    } catch (error) {
      setFormError(normalizeGoogleError(error));
    } finally {
      setIsBusy(false);
    }
  }

  // ── Login handler ─────────────────────────────────────────────────────────────
  function handleLogin(identifier: string, authSecret: string): void {
    const googleUser = selectedGoogleUser();
    const usingGoogle = Boolean(googleUser);
    const finalIdentifier = usingGoogle ? (googleUser!.email ?? googleUser!.uid) : identifier;
    const finalAuthSecret = usingGoogle ? googleUser!.uid : authSecret;
    cachedLogin = { identifier: finalIdentifier, authSecret: finalAuthSecret, usingGoogle };

    void runAction(() =>
      usingGoogle
        ? core.loginWithGoogle({ identifier: finalIdentifier, authSecret: finalAuthSecret })
        : core.login({ authMethod: 'password', identifier: finalIdentifier, authSecret: finalAuthSecret }),
    );
  }

  // ── Signup step 1: validate form, advance to PIN ──────────────────────────────
  function handleSignupContinue(identifier: string, authSecret: string, confirmSecret: string): void {
    setFormError('');
    const googleUser = selectedGoogleUser();
    const usingGoogle = Boolean(googleUser);

    if (usingGoogle) {
      // Google signup: use uid as authSecret, email/identifier as display name
      const finalIdentifier = identifier.trim() || googleUser!.email || googleUser!.uid;
      setPendingSignup({ identifier: finalIdentifier, authSecret: googleUser!.uid, usingGoogle: true });
      setSignupStep('pin');
      return;
    }

    if (!identifier) { setFormError('Username is required'); return; }
    if (!authSecret) { setFormError('Password is required'); return; }
    if (authSecret !== confirmSecret) {
      setFormError('Passwords do not match');
      return;
    }
    setPendingSignup({ identifier, authSecret, usingGoogle: false });
    setSignupStep('pin');
  }

  // ── Signup step 2: PIN entered, complete enrollment ───────────────────────────
  function handleSignupPinComplete(pin: string): void {
    const pending = pendingSignup();
    if (!pending) return;
    void runAction(() =>
      pending.usingGoogle
        ? core.enrollWithGoogle({ identifier: pending.identifier, authSecret: pending.authSecret, pin })
        : core.enrollWithPassword({ identifier: pending.identifier, authSecret: pending.authSecret, pin }),
    );
  }

  function handleSignupBack(): void {
    setSignupStep('form');
    setPendingSignup(null);
    setFormError('');
  }

  // ── PIN unlock handler ────────────────────────────────────────────────────────
  // core.unlock() calls errorState() on any wrong PIN which nukes the session.
  // We silently re-login with cached credentials so the user can try again.
  function handleUnlock(pin: string): void {
    setFormError('');
    setIsBusy(true);
    core.unlock({ pin }).then(
      (newState) => {
        cachedLogin = null; // no longer needed once unlocked
        setAuthState({ ...newState });
        notifyParentAuthState('AUTH_STATE');
      },
      async (error) => {
        pinShakeFn?.();
        setFormError(formatError(error));
        // Session was destroyed — silently restore it so the user can retry.
        // core.login() uses locally cached relay data so this is fast.
        if (cachedLogin) {
          try {
            const { identifier, authSecret, usingGoogle } = cachedLogin;
            await (usingGoogle
              ? core.loginWithGoogle({ identifier, authSecret })
              : core.login({ authMethod: 'password', identifier, authSecret }));
          } catch {
            // Cache miss or offline — fall back to login form
            setAuthState({ ...core.getAuthState() });
            notifyParentAuthState('AUTH_STATE');
          }
        }
      },
    ).finally(() => setIsBusy(false));
  }

  // ── Lock handler ──────────────────────────────────────────────────────────────
  function handleLock(): void {
    void runAction(() => core.lock());
  }

  // ── Permission handlers ───────────────────────────────────────────────────────
  function handlePermissionAllow(_remember: boolean): void {
    resolvePermission?.({ granted: true });
    resolvePermission = null;
  }

  function handlePermissionDeny(): void {
    resolvePermission?.({ granted: false });
    resolvePermission = null;
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────
  onMount(async () => {
    // Set up RPC message listener
    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (window.parent !== window && event.source !== window.parent) return;
      if (!isRpcRequestMessage(event.data)) return;
      if (!isAllowedParentOrigin(event.origin)) return;

      if (!activeParentOrigin && event.origin && event.origin !== 'null') {
        activeParentOrigin = event.origin;
      }

      const request = event.data;
      const targetOrigin = event.origin === 'null' ? undefined : event.origin;

      void (async () => {
        try {
          const result = await handleRpcRequest(request);
          const response: RpcResponseMessage = {
            channel: RPC_CHANNEL,
            type: 'response',
            id: request.id,
            ok: true,
            result,
          };
          postRpcMessage(response, targetOrigin);
        } catch (error) {
          const response: RpcResponseMessage = {
            channel: RPC_CHANNEL,
            type: 'response',
            id: request.id,
            ok: false,
            error: formatError(error),
          };
          postRpcMessage(response, targetOrigin);
        }
      })();
    });

    // Initialize core
    const initialState = await core.initialize();
    setAuthState({ ...initialState });

    // Notify parent we are ready
    notifyParentAuthState('READY');
  });

  // ── Derived state ─────────────────────────────────────────────────────────────
  const auth = () => authState();
  const showPermission = () => pendingPermission() !== null;
  const showPin = () => auth().initialized && auth().isAuthenticated && auth().isLocked;
  const showLogin = () => auth().initialized && !auth().isAuthenticated && view() === 'login';
  const showSignup = () => auth().initialized && !auth().isAuthenticated && view() === 'signup';

  // ── Close handler — tells parent to dismiss the vault overlay ─────────────────
  function handleBackdropClick(): void {
    if (window.parent !== window) {
      postRpcMessage({ channel: RPC_CHANNEL, type: 'event', event: 'CLOSE' as RpcEventMessage['event'], auth: core.getAuthState() });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div
      class={embedMode
        ? 'w-full min-h-dvh overflow-y-auto flex items-start justify-center bg-transparent px-4 py-6 sm:items-center sm:px-6 sm:py-10'
        : 'min-h-dvh flex items-center justify-center bg-slate-100 px-4 py-6 sm:px-6'}
      onClick={handleBackdropClick}
    >
      <div
        class="w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_32px_90px_rgba(2,6,23,0.38)] ring-1 ring-slate-950/8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

      {/* Permission screen overlays all others */}
      <Show when={showPermission()}>
        <PermissionScreen
          origin={pendingPermission()!.origin}
          operation={pendingPermission()!.operation}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
        />
      </Show>

      <Show when={!showPermission()}>
        <Show when={showLogin()}>
          <LoginScreen
            onLogin={handleLogin}
            onGoogleLogin={() => handleGoogleConnect('login')}
            onClearGoogle={clearGoogleSelection}
            onSwitchToSignup={() => { setView('signup'); setSignupStep('form'); setPendingSignup(null); setFormError(''); }}
            googleState={googleState()}
            formError={formError()}
            isBusy={isBusy()}
            appOriginLabel={appOriginLabel}
            googleAvailable={isGoogleAuthAvailable()}
          />
        </Show>

        <Show when={showSignup() && signupStep() === 'form'}>
          <SignupScreen
            onContinue={handleSignupContinue}
            onGoogleSignup={() => handleGoogleConnect('signup')}
            onClearGoogle={clearGoogleSelection}
            onSwitchToLogin={() => { setView('login'); setSignupStep('form'); setPendingSignup(null); setFormError(''); }}
            googleState={googleState()}
            formError={formError()}
            isBusy={isBusy()}
            googleAvailable={isGoogleAuthAvailable()}
          />
        </Show>

        <Show when={showSignup() && signupStep() === 'pin'}>
          <SetupPinScreen
            identifier={pendingSignup()?.identifier ?? ''}
            onComplete={handleSignupPinComplete}
            onBack={handleSignupBack}
            isBusy={isBusy()}
            notice={pendingSignup()?.isNewAccount
              ? "No existing account found for this Google account — we're creating a new one for you."
              : undefined}
          />
        </Show>

        <Show when={showPin()}>
          <PinScreen
            identifier={auth().identifier ?? undefined}
            onUnlock={handleUnlock}
            onLock={handleLock}
            isBusy={isBusy()}
            onShakeRequest={(s) => { pinShakeFn = s; }}
          />
        </Show>

        <Show when={!auth().initialized}>
          <div class="flex flex-col items-center text-center px-8 py-12">
            <div class="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-5">
              <img src="/logo.svg" class="w-9 h-9" alt="NostrPass" />
            </div>
            <p class="text-sm text-gray-500">Initializing vault...</p>
          </div>
        </Show>
      </Show>

      </div>
    </div>
  );
}
