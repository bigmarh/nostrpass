import './style.css';

type RpcMethod = 'PING' | 'FOCUS_AUTH' | 'GET_AUTH_STATE' | 'GET_PUBLIC_KEY' | 'SIGN_EVENT' | 'LOGOUT';

interface RpcRequestMessage {
  channel: 'nostrpass-lite-rpc-v1';
  type: 'request';
  id: string;
  method: RpcMethod;
  params?: Record<string, unknown>;
}

interface RpcSuccessResponseMessage {
  channel: 'nostrpass-lite-rpc-v1';
  type: 'response';
  id: string;
  ok: true;
  result: unknown;
}

interface RpcErrorResponseMessage {
  channel: 'nostrpass-lite-rpc-v1';
  type: 'response';
  id: string;
  ok: false;
  error: string;
}

interface RpcEventMessage {
  channel: 'nostrpass-lite-rpc-v1';
  type: 'event';
  event: 'READY' | 'AUTH_STATE';
  auth?: {
    initialized: boolean;
    isAuthenticated: boolean;
    isLocked: boolean;
    identifier?: string;
    publicKey?: string;
  };
}

type RpcResponseMessage = RpcSuccessResponseMessage | RpcErrorResponseMessage;

function isRpcResponseMessage(value: unknown): value is RpcResponseMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Partial<RpcResponseMessage>;
  return (
    payload.channel === 'nostrpass-lite-rpc-v1' &&
    payload.type === 'response' &&
    typeof payload.id === 'string' &&
    typeof payload.ok === 'boolean'
  );
}

function isRpcEventMessage(value: unknown): value is RpcEventMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Partial<RpcEventMessage>;
  return (
    payload.channel === 'nostrpass-lite-rpc-v1' &&
    payload.type === 'event' &&
    (payload.event === 'READY' || payload.event === 'AUTH_STATE' || payload.event === 'NEEDS_INTERACTION')
  );
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

const DEFAULT_VAULT_URL = 'http://localhost:3411';
const statusLineEl = requireElement<HTMLParagraphElement>('status-line');
const statusEl = requireElement<HTMLPreElement>('status');
const vaultUrlInput = requireElement<HTMLInputElement>('vault-url');
const vaultOverlay = requireElement<HTMLDivElement>('vault-overlay');
const vaultFrame = requireElement<HTMLIFrameElement>('vault-frame');
const loginButton = requireElement<HTMLButtonElement>('login-with-nostrpass');
const refreshButton = requireElement<HTMLButtonElement>('refresh-auth');
const openVaultButton = requireElement<HTMLButtonElement>('open-vault');
const closeVaultButton = requireElement<HTMLButtonElement>('close-vault');
const closeShellButton = requireElement<HTMLButtonElement>('vault-shell-close');
const pubkeyButton = requireElement<HTMLButtonElement>('pubkey');
const signButton = requireElement<HTMLButtonElement>('sign');
const contentInput = requireElement<HTMLTextAreaElement>('content');

// NostrPass button widget elements
const nostrBtnIdle = loginButton.querySelector<HTMLElement>('.nostr-btn-idle')!;
const nostrBtnAuthed = loginButton.querySelector<HTMLElement>('.nostr-btn-authed')!;
const nostrBtnAvatar = document.getElementById('nostr-btn-avatar')!;
const nostrBtnAvatarLg = document.getElementById('nostr-btn-avatar-lg')!;
const nostrBtnName = document.getElementById('nostr-btn-name')!;
const nostrBtnDropdown = document.getElementById('nostr-btn-dropdown')!;
const nostrBtnDropdownName = document.getElementById('nostr-btn-dropdown-name')!;
const nostrBtnDropdownPubkey = document.getElementById('nostr-btn-dropdown-pubkey')!;
const nostrBtnSignout = document.getElementById('nostr-btn-signout')!;

let dropdownOpen = false;

function pubkeyToHue(pubkey: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(pubkey.length, 8); i++) {
    hash = (hash * 31 + pubkey.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

function setAvatarEl(el: HTMLElement, identifier: string, pubkey: string): void {
  const initial = (identifier || pubkey || '?')[0].toUpperCase();
  const hue = pubkeyToHue(pubkey || identifier);
  el.textContent = initial;
  el.style.background = `hsl(${hue}, 60%, 42%)`;
}

function setDropdownOpen(open: boolean): void {
  dropdownOpen = open;
  if (open) {
    nostrBtnDropdown.removeAttribute('hidden');
  } else {
    nostrBtnDropdown.setAttribute('hidden', '');
  }
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (dropdownOpen && !loginButton.contains(e.target as Node) && !nostrBtnDropdown.contains(e.target as Node)) {
    setDropdownOpen(false);
  }
});

const pending = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }
>();

let rpcCounter = 0;
let activeVaultOrigin: string | null = null;
let frameReady = false;
let frameReadyWaiters: Array<() => void> = [];
let rpcAvailable = false;

function setStatusLine(message: string): void {
  statusLineEl.textContent = message;
}

function setStatus(value: unknown): void {
  statusEl.textContent =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseVaultUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    // Allow `localhost:5174` shorthand during local demos.
    return new URL(`http://${raw}`);
  }
}

function buildVaultFrameUrl(vaultBaseUrl: URL): string {
  const url = new URL(vaultBaseUrl.toString());
  // Main vault expects "/:app" routes (e.g. /localhost-3420 for this host app).
  const appSegment = window.location.host.replace(/[:.]/g, '-');
  const isLikelyMainVault = url.port === '3001' || url.protocol === 'https:';
  if (isLikelyMainVault && (!url.pathname || url.pathname === '/')) {
    url.pathname = `/${appSegment}`;
  }

  url.searchParams.set('embed', '1');
  url.searchParams.set('parentOrigin', window.location.origin);
  return url.toString();
}

function getConfiguredVaultUrl(): URL {
  const raw = vaultUrlInput.value.trim();
  if (!raw) {
    const fallback = new URL(DEFAULT_VAULT_URL);
    vaultUrlInput.value = fallback.toString();
    return fallback;
  }
  return parseVaultUrl(raw);
}

function openVaultShell(): void {
  vaultOverlay.classList.add('open');
  vaultOverlay.setAttribute('aria-hidden', 'false');
}

function closeVaultShell(): void {
  vaultOverlay.classList.remove('open');
  vaultOverlay.setAttribute('aria-hidden', 'true');
}

function updateLoginButton(auth?: RpcEventMessage['auth']): void {
  const connected = auth?.isAuthenticated && !auth.isLocked;

  if (connected) {
    const id = auth!.identifier ?? 'Nostr User';
    const pk = auth!.publicKey ?? '';
    setAvatarEl(nostrBtnAvatar, id, pk);
    setAvatarEl(nostrBtnAvatarLg, id, pk);
    nostrBtnName.textContent = id;
    nostrBtnDropdownName.textContent = id;
    nostrBtnDropdownPubkey.textContent = pk ? `${pk.slice(0, 12)}…${pk.slice(-6)}` : '';
    nostrBtnIdle.setAttribute('hidden', '');
    nostrBtnAuthed.removeAttribute('hidden');
  } else {
    nostrBtnAuthed.setAttribute('hidden', '');
    nostrBtnIdle.removeAttribute('hidden');
    setDropdownOpen(false);
  }
}

function syncVaultFrameSource(): URL {
  const vaultUrl = getConfiguredVaultUrl();
  const frameUrl = buildVaultFrameUrl(vaultUrl);
  if (vaultFrame.src !== frameUrl) {
    frameReady = false;
    frameReadyWaiters = [];
    vaultFrame.src = frameUrl;
  }
  activeVaultOrigin = vaultUrl.origin;
  return vaultUrl;
}

function markFrameReady(): void {
  if (frameReady) {
    return;
  }
  frameReady = true;
  const waiters = frameReadyWaiters;
  frameReadyWaiters = [];
  for (const resolve of waiters) {
    resolve();
  }
}

async function waitForFrameReady(timeoutMs = 12000): Promise<void> {
  if (frameReady) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      frameReadyWaiters = frameReadyWaiters.filter((item) => item !== onReady);
      reject(
        new Error(
          'Vault frame did not become ready. Check vault URL and ensure the lite-vault app is running.'
        )
      );
    }, timeoutMs);

    const onReady = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    frameReadyWaiters.push(onReady);
  });
}

async function requestRpc(method: RpcMethod, params?: Record<string, unknown>): Promise<unknown> {
  await waitForFrameReady();

  const targetWindow = vaultFrame.contentWindow;
  if (!targetWindow || !activeVaultOrigin) {
    throw new Error('Vault frame is not ready. Open the vault frame first.');
  }
  const targetOrigin = activeVaultOrigin;

  const id = `rpc-${Date.now()}-${++rpcCounter}`;
  const payload: RpcRequestMessage = {
    channel: 'nostrpass-lite-rpc-v1',
    type: 'request',
    id,
    method,
    params,
  };

  return new Promise<unknown>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC timeout for ${method}`));
    }, 12000);

    pending.set(id, { resolve, reject, timeoutId });
    targetWindow.postMessage(payload, targetOrigin);
  });
}

function handleRpcEvent(eventMessage: RpcEventMessage): void {
  rpcAvailable = true;
  if (eventMessage.event === 'READY') {
    markFrameReady();
    setStatusLine('Vault frame ready.');
  } else if (eventMessage.event === 'AUTH_STATE') {
    markFrameReady();
    const auth = eventMessage.auth;
    if (!auth?.isAuthenticated) {
      setStatusLine('Vault session: signed out');
    } else if (auth.isLocked) {
      setStatusLine('Vault session: signed in, locked');
    } else {
      setStatusLine(auth.identifier
        ? `Signed in as ${auth.identifier}`
        : 'Vault session: signed in, unlocked');
      closeVaultShell();
    }
  } else if (eventMessage.event === 'NEEDS_INTERACTION') {
    openVaultShell();
  }

  updateLoginButton(eventMessage.auth);
  setStatus({ event: eventMessage.event, auth: eventMessage.auth });
}

function setupMessageBridge(): void {
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.source !== vaultFrame.contentWindow) {
      return;
    }
    if (activeVaultOrigin && event.origin !== activeVaultOrigin) {
      return;
    }

    if (isRpcResponseMessage(event.data)) {
      const entry = pending.get(event.data.id);
      if (!entry) {
        return;
      }
      pending.delete(event.data.id);
      clearTimeout(entry.timeoutId);
      if (event.data.ok) {
        entry.resolve(event.data.result);
      } else {
        entry.reject(new Error(event.data.error));
      }
      return;
    }

    if (isRpcEventMessage(event.data)) {
      handleRpcEvent(event.data);
    }
  });
}

async function withStatus(
  label: string,
  operation: () => Promise<unknown>
): Promise<void> {
  setStatusLine(`${label} in progress...`);
  try {
    const result = await operation();
    setStatusLine(`${label} completed.`);
    setStatus(result);
  } catch (error) {
    const message = formatError(error);
    setStatusLine(`${label} failed: ${message}`);
    setStatus({ error: message });
  }
}

function ensureRpcAvailable(operationName: string): boolean {
  if (rpcAvailable) {
    return true;
  }
  setStatusLine(
    `${operationName} is unavailable: current vault UI does not expose lite RPC (login/signup UI mode only).`
  );
  setStatus({
    mode: 'ui-only',
    operation: operationName,
    hint: 'Use the embedded vault UI to login/signup. Switch vault URL to lite-vault to test RPC.',
  });
  return false;
}

function wireUi(): void {
  vaultFrame.addEventListener('load', () => {
    if (!frameReady) {
      setStatusLine('Vault frame loaded. Waiting for secure handshake...');
    }
  });

  loginButton.addEventListener('click', () => {
    // If connected, toggle the dropdown
    if (!nostrBtnAuthed.hasAttribute('hidden')) {
      setDropdownOpen(!dropdownOpen);
      return;
    }
    // Otherwise open the vault for auth
    const vaultUrl = syncVaultFrameSource();
    openVaultShell();
    setStatusLine(`Open secure vault at ${vaultUrl.origin} to login/unlock.`);
    if (rpcAvailable) {
      void withStatus('Focus auth', () => requestRpc('FOCUS_AUTH'));
    }
  });

  nostrBtnSignout.addEventListener('click', () => {
    setDropdownOpen(false);
    updateLoginButton(undefined); // optimistic reset
    setStatusLine('Signing out…');
    void withStatus('Sign out', () => requestRpc('LOGOUT'));
  });

  refreshButton.addEventListener('click', () => {
    if (!ensureRpcAvailable('Refresh auth')) {
      return;
    }
    void withStatus('Refresh auth', () => requestRpc('GET_AUTH_STATE'));
  });

  openVaultButton.addEventListener('click', () => {
    const vaultUrl = syncVaultFrameSource();
    openVaultShell();
    setStatusLine(`Vault frame opened (${vaultUrl.origin}).`);
    if (rpcAvailable) {
      void withStatus('Ping vault', () => requestRpc('PING'));
    } else {
      setStatus({
        mode: 'ui-only',
        message: 'Vault opened for main login/signup UI.',
      });
    }
  });

  closeVaultButton.addEventListener('click', () => {
    closeVaultShell();
    setStatusLine('Vault frame closed.');
  });

  closeShellButton.addEventListener('click', () => {
    closeVaultShell();
    setStatusLine('Vault frame closed.');
  });

  pubkeyButton.addEventListener('click', () => {
    if (!ensureRpcAvailable('getPublicKey')) {
      return;
    }
    void withStatus('getPublicKey', () => requestRpc('GET_PUBLIC_KEY'));
  });

  signButton.addEventListener('click', () => {
    if (!ensureRpcAvailable('signEvent')) {
      return;
    }
    const event = {
      kind: 1,
      tags: [] as string[][],
      content: contentInput.value,
      created_at: Math.floor(Date.now() / 1000),
    };
    void withStatus('signEvent', () => requestRpc('SIGN_EVENT', { event }));
  });
}

function readInitialConfig(): void {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('vaultUrl');
  vaultUrlInput.value = fromQuery?.trim() || DEFAULT_VAULT_URL;
  syncVaultFrameSource();
}

function wire(): void {
  readInitialConfig();
  setupMessageBridge();
  wireUi();
  setStatusLine('Host ready. Use "Login with NostrPass" to authenticate in secure frame.');
  setStatus({
    mode: 'third-party-host',
    message: 'Credentials are collected only inside the vault frame.',
    defaultVaultUrl: DEFAULT_VAULT_URL,
  });
}

wire();
