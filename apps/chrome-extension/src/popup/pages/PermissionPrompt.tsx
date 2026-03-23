import { Component, createSignal } from 'solid-js';
import type { PendingRequest, PermissionLevel } from '@/shared/types';

interface PermissionPromptProps {
  request: PendingRequest;
  onResolved: () => void;
}

const PermissionPrompt: Component<PermissionPromptProps> = (props) => {
  const [savePreference, setSavePreference] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const getActionLabel = (type: string): string => {
    switch (type) {
      case 'getPublicKey':
        return 'View your public key';
      case 'signEvent':
        return 'Sign an event';
      case 'signData':
        return 'Sign data';
      case 'nip04.encrypt':
        return 'Encrypt a message (NIP-04)';
      case 'nip04.decrypt':
        return 'Decrypt a message (NIP-04)';
      case 'nip44.encrypt':
        return 'Encrypt a message (NIP-44)';
      case 'nip44.decrypt':
        return 'Decrypt a message (NIP-44)';
      case 'getRelays':
        return 'Get relay list';
      default:
        return type;
    }
  };

  const getActionIcon = (type: string): string => {
    switch (type) {
      case 'getPublicKey':
        return '👤';
      case 'signEvent':
      case 'signData':
        return '✍️';
      case 'nip04.encrypt':
      case 'nip44.encrypt':
        return '🔒';
      case 'nip04.decrypt':
      case 'nip44.decrypt':
        return '🔓';
      case 'getRelays':
        return '📡';
      default:
        return '❓';
    }
  };

  const handleResponse = async (granted: boolean) => {
    setLoading(true);
    try {
      const level: PermissionLevel = granted
        ? savePreference()
          ? 'ALLOW'
          : 'ASK_EVERYTIME'
        : savePreference()
          ? 'DENY'
          : 'ASK_EVERYTIME';

      await chrome.runtime.sendMessage({
        type: 'resolvePermission',
        data: {
          requestId: props.request.id,
          granted,
          level,
          savePreference: savePreference(),
        },
      });

      props.onResolved();
    } catch (error) {
      console.error('Failed to resolve permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatOrigin = (origin: string): string => {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return origin;
    }
  };

  return (
    <div class="flex h-[500px] flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-full bg-purple-500" />
          <span class="font-semibold text-gray-900 dark:text-white">
            Permission Request
          </span>
        </div>
      </header>

      {/* Content */}
      <main class="flex-1 overflow-auto p-4">
        {/* App Info */}
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl dark:bg-gray-800">
            {getActionIcon(props.request.type)}
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {formatOrigin(props.request.origin)}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            wants to {getActionLabel(props.request.type).toLowerCase()}
          </p>
        </div>

        {/* Request Details */}
        <div class="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Request Details
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Action</span>
              <span class="font-medium text-gray-900 dark:text-white">
                {getActionLabel(props.request.type)}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Origin</span>
              <span class="font-mono text-xs text-gray-900 dark:text-white">
                {props.request.origin}
              </span>
            </div>
          </div>

          {/* Event preview for signEvent */}
          {props.request.type === 'signEvent' && props.request.data.event && (
            <div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <div class="mb-1 text-xs font-medium text-gray-500">
                Event Preview
              </div>
              <pre class="max-h-24 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {JSON.stringify(props.request.data.event, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Remember preference */}
        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <input
            type="checkbox"
            checked={savePreference()}
            onChange={(e) => setSavePreference(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Remember my choice for this site
          </span>
        </label>
      </main>

      {/* Actions */}
      <footer class="border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex gap-3">
          <button
            onClick={() => handleResponse(false)}
            disabled={loading()}
            class="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Deny
          </button>
          <button
            onClick={() => handleResponse(true)}
            disabled={loading()}
            class="flex-1 rounded-xl bg-purple-600 py-3 font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
          >
            {loading() ? 'Processing...' : 'Allow'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PermissionPrompt;
