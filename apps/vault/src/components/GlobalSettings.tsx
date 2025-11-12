import { Component, Show, JSX } from 'solid-js';
import RelaySettings from './RelaySettings';

interface GlobalSettingsProps {
  username: string;
  identityCount: number;
  isOpen: boolean;
  onClose: () => void;
  // Sync panel as a slot
  syncPanel?: JSX.Element;
}

/**
 * GlobalSettings Component
 *
 * A side panel that slides in from the right displaying vault settings.
 * Includes account information, Nostr sync actions, and relay settings.
 */
const GlobalSettings: Component<GlobalSettingsProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-black/50 transition-opacity"
          onClick={props.onClose}
        />

        {/* Side Panel */}
        <div class="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto">
          {/* Panel Header */}
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Vault Settings</h2>
            <button
              onClick={props.onClose}
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Panel Content */}
          <div class="p-6 space-y-6">
            {/* Account Info */}
            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Account</h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Username:</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{props.username}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Identities:</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{props.identityCount}</span>
                </div>
              </div>
            </div>

            {/* Nostr Sync Section - rendered as a slot */}
            <Show when={props.syncPanel}>
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Nostr Sync</h3>
                {props.syncPanel}
              </div>
            </Show>

            {/* Relay Settings */}
            <div>
              <RelaySettings />
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default GlobalSettings;
