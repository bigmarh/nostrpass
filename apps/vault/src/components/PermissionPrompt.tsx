import { Component, createSignal, Show, For } from 'solid-js';
import type { PermissionLevel } from '@nostrpass/types';
import type { PermissionRequest } from '../services/permissionService';

interface PermissionPromptProps {
  appOrigin: string;
  appName?: string;
  request: PermissionRequest;
  onApprove: (level: PermissionLevel) => void;
  onDeny: () => void;
}

export const PermissionPrompt: Component<PermissionPromptProps> = (props) => {
  const [selectedLevel, setSelectedLevel] = createSignal<PermissionLevel>('ASK_EVERYTIME');

  const handleApprove = () => {
    props.onApprove(selectedLevel());
  };

  const getActionDescription = () => {
    switch (props.request.action) {
      case 'getPublicKey':
        return {
          title: 'Read Public Key',
          description: 'View your public Nostr identity',
          icon: '👤'
        };
      case 'signEvent':
        return {
          title: `Sign Event${props.request.eventKind !== undefined ? ` (Kind ${props.request.eventKind})` : ''}`,
          description: 'Create and sign Nostr events on your behalf',
          icon: '✍️'
        };
      case 'signData':
        return {
          title: 'Sign Data',
          description: 'Sign arbitrary data with your private key',
          icon: '📝'
        };
      case 'nip04':
        return {
          title: 'Encrypt/Decrypt Messages',
          description: 'Send and receive encrypted direct messages',
          icon: '🔐'
        };
      case 'getRelays':
        return {
          title: 'Access Relay List',
          description: 'View your configured Nostr relay servers',
          icon: '📡'
        };
      default:
        return {
          title: 'Unknown Action',
          description: 'Unknown permission request',
          icon: '❓'
        };
    }
  };

  const permissionLevels: { value: PermissionLevel; label: string; description: string }[] = [
    {
      value: 'ALLOW',
      label: 'Always Allow',
      description: 'Grant permanent permission for this action'
    },
    {
      value: 'ASK_PER_SESSION',
      label: 'Allow for Session',
      description: 'Allow until you close the app or browser'
    },
    {
      value: 'ASK_EVERYTIME',
      label: 'Ask Every Time',
      description: 'Prompt for permission on each request'
    },
    {
      value: 'DENY',
      label: 'Always Deny',
      description: 'Block this action permanently'
    }
  ];

  const actionInfo = getActionDescription();

  return (
    <div class="flex items-center justify-center w-full h-full p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="text-2xl">{actionInfo.icon}</span>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Permission Request
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {props.appName || props.appOrigin} wants to:
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
            {props.appOrigin}
          </p>
        </div>

        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <h3 class="font-medium text-gray-900 dark:text-white mb-1">
            {actionInfo.title}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {actionInfo.description}
          </p>

          {/* Show request details */}
          <Show when={props.request.action === 'signEvent' && props.request.event}>
            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
                Event to Sign:
              </div>
              <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono max-h-32 overflow-y-auto">
                <div><span class="text-gray-500">Kind:</span> {props.request.event.kind}</div>
                <Show when={props.request.event.content}>
                  <div class="mt-1"><span class="text-gray-500">Content:</span> {props.request.event.content}</div>
                </Show>
                <Show when={props.request.event.tags && props.request.event.tags.length > 0}>
                  <div class="mt-1"><span class="text-gray-500">Tags:</span> {JSON.stringify(props.request.event.tags)}</div>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={props.request.action === 'signData' && props.request.data}>
            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
                Data to Sign:
              </div>
              <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono break-all max-h-32 overflow-y-auto">
                {props.request.data}
              </div>
            </div>
          </Show>

          <Show when={props.request.action === 'nip04' && (props.request.plaintext || props.request.ciphertext)}>
            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
                {props.request.plaintext ? 'Message to Encrypt:' : 'Encrypted Message:'}
              </div>
              <Show when={props.request.pubkey}>
                <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {props.request.plaintext ? 'To: ' : 'From: '}{props.request.pubkey.substring(0, 16)}...
                </div>
              </Show>
              <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono break-all max-h-32 overflow-y-auto">
                {props.request.plaintext || props.request.ciphertext}
              </div>
            </div>
          </Show>
        </div>

        <div class="space-y-2 mb-6">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Choose permission level:
          </label>
          <For each={permissionLevels}>
            {(level) => (
              <label 
                class={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLevel() === level.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input
                  type="radio"
                  name="permission-level"
                  value={level.value}
                  checked={selectedLevel() === level.value}
                  onChange={() => setSelectedLevel(level.value)}
                  class="mt-1 mr-3"
                />
                <div class="flex-1">
                  <div class="font-medium text-gray-900 dark:text-white">
                    {level.label}
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {level.description}
                  </p>
                </div>
              </label>
            )}
          </For>
        </div>

        <div class="flex gap-3">
          <button
            onClick={props.onDeny}
            class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            class={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedLevel() === 'DENY'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {selectedLevel() === 'DENY' ? 'Block' : 'Approve'}
          </button>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
          You can change this later in your settings
        </p>
      </div>
    </div>
  );
};