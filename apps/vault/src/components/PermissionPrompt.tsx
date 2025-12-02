import { Component, createSignal, Show, For, createMemo, createEffect } from 'solid-js';
import type { PermissionLevel } from '@nostrpass/types';
import type { PermissionRequest } from '../services/permissionService';
import { getPermissionCategoryForKind } from '@nostrpass/types';

interface PermissionPromptProps {
  appOrigin: string;
  appName?: string;
  request: PermissionRequest;
  onApprove: (level: PermissionLevel) => void;
  onDeny: () => void;
}

export const PermissionPrompt: Component<PermissionPromptProps> = (props) => {
  const [selectedLevel, setSelectedLevel] = createSignal<PermissionLevel>('ASK_EVERYTIME');

  // Reset selected level when request changes
  createEffect(() => {
    const action = props.request.action;
    setSelectedLevel('ASK_EVERYTIME');
  });

  const handleApprove = () => {
    props.onApprove(selectedLevel());
  };

  const actionInfo = createMemo(() => {
    switch (props.request.action) {
      case 'getPublicKey':
        return {
          title: 'Read Public Key',
          description: 'View your public Nostr identity',
          icon: '👤',
          category: null
        };
      case 'signEvent':
        {
          // Determine the category for this event kind
          const category = props.request.eventKind !== undefined
            ? getPermissionCategoryForKind(props.request.eventKind)
            : null;

          const categoryInfo = {
            social: { label: 'Social Event', emoji: '💬', desc: 'posts, profiles, reactions, reposts' },
            messaging: { label: 'Private Message', emoji: '🔐', desc: 'encrypted messages and DMs' },
            signData: { label: 'Data Signing', emoji: '📝', desc: 'authentication and app-specific data' },
            zaps: { label: 'Zap/Tip', emoji: '⚡', desc: 'lightning payments and tips' },
            financial: { label: 'Wallet Config', emoji: '💰', desc: 'wallet settings and financial metadata' }
          };

          const info = category ? categoryInfo[category] : null;

          return {
            title: info
              ? `Sign ${info.label} (Kind ${props.request.eventKind})`
              : `Sign Event${props.request.eventKind !== undefined ? ` (Kind ${props.request.eventKind})` : ''}`,
            description: info
              ? `Sign ${info.desc} on your behalf`
              : 'Create and sign Nostr events on your behalf',
            icon: info?.emoji || '✍️',
            category
          };
        }
      case 'signData':
        return {
          title: 'Sign Arbitrary Data',
          description: 'Sign arbitrary data with your private key (not a Nostr event)',
          icon: '📝',
          category: null
        };
      case 'nip04':
        return {
          title: 'Encrypt/Decrypt Messages',
          description: 'Send and receive encrypted direct messages',
          icon: '🔐',
          category: null
        };
      case 'getRelays':
        return {
          title: 'Access Relay List',
          description: 'View your configured Nostr relay servers',
          icon: '📡',
          category: null
        };
      default:
        return {
          title: 'Unknown Action',
          description: 'Unknown permission request',
          icon: '❓',
          category: null
        };
    }
  });

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

  return (
    <div class="flex flex-col w-full h-full bg-white dark:bg-gray-800 max-w-[395px] mx-auto">
      {/* Header - Fixed */}
      <div class="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <span class="text-xl">{actionInfo().icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Permission Request
            </h2>
            <p class="text-xs text-gray-600 dark:text-gray-400 truncate">
              {props.appName || props.appOrigin}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-500 font-mono truncate">
              {props.appOrigin}
            </p>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <h3 class="font-medium text-gray-900 dark:text-white text-sm mb-1">
            {actionInfo().title}
          </h3>
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {actionInfo().description}
          </p>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div class="flex-1 overflow-y-auto p-4">

        {/* Show request details */}
        <Show when={props.request.action === 'signEvent' && props.request.event}>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
              Event to Sign:
            </div>
            <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono overflow-y-auto text-gray-900 dark:text-gray-100 max-h-[40vh]">
              <div><span class="text-gray-500 dark:text-gray-400">Kind:</span> {props.request.event.kind}</div>
              <Show when={props.request.event.content}>
                <div class="mt-2">
                  <span class="text-gray-500 dark:text-gray-400">Content:</span>
                  <div class="mt-1 whitespace-pre-wrap break-words">{props.request.event.content}</div>
                </div>
              </Show>
              <Show when={props.request.event.tags && props.request.event.tags.length > 0}>
                <div class="mt-2">
                  <span class="text-gray-500 dark:text-gray-400">Tags:</span>
                  <div class="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(props.request.event.tags, null, 2)}</div>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={props.request.action === 'signData' && props.request.data}>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
              Data to Sign:
            </div>
            <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono break-all overflow-y-auto text-gray-900 dark:text-gray-100 max-h-[40vh]">
              {props.request.data}
            </div>
          </div>
        </Show>

        <Show when={props.request.action === 'nip04' && (props.request.plaintext || props.request.ciphertext)}>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
              {props.request.plaintext ? 'Message to Encrypt:' : 'Encrypted Message:'}
            </div>
            <Show when={props.request.pubkey}>
              <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {props.request.plaintext ? 'To: ' : 'From: '}{props.request.pubkey!.substring(0, 16)}...
              </div>
            </Show>
            <div class="bg-white dark:bg-gray-800 rounded p-2 text-xs font-mono break-all overflow-y-auto text-gray-900 dark:text-gray-100 max-h-[40vh]">
              {props.request.plaintext || props.request.ciphertext}
            </div>
          </div>
        </Show>
      </div>

      {/* Footer - Fixed */}
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Permission level:
          </label>
          <select
            value={selectedLevel()}
            onChange={(e) => setSelectedLevel(e.target.value as PermissionLevel)}
            class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <For each={permissionLevels}>
              {(level) => (
                <option value={level.value}>
                  {level.label} - {level.description}
                </option>
              )}
            </For>
          </select>
        </div>

        <div class="flex gap-2">
          <button
            onClick={props.onDeny}
            class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            class={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedLevel() === 'DENY'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {selectedLevel() === 'DENY' ? 'Block' : 'Approve'}
          </button>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-500 text-center mt-3">
          You can change this later in your settings
        </p>
      </div>
    </div>
  );
};