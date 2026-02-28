import type { LiteMessage, LiteResponse } from '../shared/messages';

type JsonValue = Record<string, unknown> | string | number | boolean | null;

const statusEl = document.getElementById('status') as HTMLPreElement;
const formErrorEl = document.getElementById('form-error') as HTMLParagraphElement;
const permissionSection = document.getElementById('permission-section') as HTMLElement;
const permissionText = document.getElementById('permission-text') as HTMLElement;
const rememberPermission = document.getElementById('remember-permission') as HTMLInputElement;

let currentPendingRequestId: string | null = null;

function readValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  return el.value;
}

function setStatus(value: JsonValue): void {
  statusEl.textContent =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

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

function clearFormError(): void {
  formErrorEl.hidden = true;
  formErrorEl.textContent = '';
}

function showFormError(action: string, error: unknown): void {
  formErrorEl.hidden = false;
  formErrorEl.textContent = `${action} failed: ${formatError(error)}`;
}

async function send<T = unknown>(
  type: LiteMessage['type'],
  data?: Record<string, unknown>,
  origin?: string
): Promise<T> {
  const response = (await chrome.runtime.sendMessage({
    type,
    data,
    origin,
  } as LiteMessage)) as LiteResponse<T>;

  if (!response?.success) {
    const error = new Error(response?.error ?? 'Unknown error') as Error & { code?: string; requestId?: string };
    error.code = response?.errorCode;
    error.requestId = response?.requestId;
    throw error;
  }

  return response.data as T;
}

async function activeOrigin(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      return new URL(tab.url).origin;
    }
  } catch {
    // ignore
  }
  return 'extension';
}

async function refreshStatus(): Promise<void> {
  try {
    const authState = await send('lite.authState');
    setStatus(authState as JsonValue);

    const pending = await send<Record<string, unknown> | null>('lite.pendingRequest');
    if (pending?.id) {
      currentPendingRequestId = String(pending.id);
      permissionSection.hidden = false;
      permissionText.textContent = `${pending.origin} requests ${pending.operation}`;
    } else {
      currentPendingRequestId = null;
      permissionSection.hidden = true;
      permissionText.textContent = '';
    }
  } catch (error) {
    showFormError('Refresh status', error);
    setStatus(formatError(error));
  }
}

async function runOperation(type: LiteMessage['type'], data?: Record<string, unknown>) {
  try {
    clearFormError();
    const result = await send(type, data);
    setStatus(result as JsonValue);
    await refreshStatus();
  } catch (error) {
    showFormError(type, error);
    setStatus(formatError(error));
    await refreshStatus();
  }
}

function wireEvents(): void {
  document.getElementById('enroll-button')?.addEventListener('click', () => {
    void runOperation('lite.enrollPassword', {
      identifier: readValue('enroll-identifier'),
      authSecret: readValue('enroll-secret'),
      pin: readValue('enroll-pin'),
    });
  });

  document.getElementById('import-button')?.addEventListener('click', () => {
    void runOperation('lite.importKey', {
      format: readValue('import-format'),
      value: readValue('import-value'),
      identifier: readValue('import-identifier'),
      authSecret: readValue('import-secret'),
      pin: readValue('import-pin'),
    });
  });

  document.getElementById('login-button')?.addEventListener('click', () => {
    void runOperation('lite.loginPassword', {
      identifier: readValue('login-identifier'),
      authSecret: readValue('login-secret'),
    });
  });

  document.getElementById('unlock-button')?.addEventListener('click', () => {
    void runOperation('lite.unlock', {
      pin: readValue('unlock-pin'),
    });
  });

  document.getElementById('lock-button')?.addEventListener('click', () => {
    void runOperation('lite.lock');
  });

  document.getElementById('allow-permission')?.addEventListener('click', () => {
    if (!currentPendingRequestId) {
      return;
    }

    void runOperation('lite.resolvePermission', {
      requestId: currentPendingRequestId,
      granted: true,
      remember: rememberPermission.checked,
      level: 'ALLOW',
    });
  });

  document.getElementById('deny-permission')?.addEventListener('click', () => {
    if (!currentPendingRequestId) {
      return;
    }

    void runOperation('lite.resolvePermission', {
      requestId: currentPendingRequestId,
      granted: false,
      remember: false,
      level: 'DENY',
    });
  });

  document.getElementById('test-get-pubkey')?.addEventListener('click', async () => {
    const origin = await activeOrigin();
    try {
      clearFormError();
      const result = await send('getPublicKey', {}, origin);
      setStatus(result as JsonValue);
      await refreshStatus();
    } catch (error) {
      showFormError('getPublicKey', error);
      setStatus(formatError(error));
      await refreshStatus();
    }
  });

  document.getElementById('test-sign-event')?.addEventListener('click', async () => {
    const origin = await activeOrigin();
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: readValue('test-content'),
    };

    try {
      clearFormError();
      const response = await chrome.runtime.sendMessage({
        type: 'signEvent',
        origin,
        data: { event },
      } as LiteMessage);

      if (!response?.success) {
        throw new Error(response?.error ?? 'signEvent failed');
      }

      setStatus(response.data as JsonValue);
      await refreshStatus();
    } catch (error) {
      showFormError('signEvent', error);
      setStatus(formatError(error));
      await refreshStatus();
    }
  });
}

wireEvents();
clearFormError();
void refreshStatus();
setInterval(() => {
  void refreshStatus();
}, 2000);
