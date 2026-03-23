/**
 * Vault Picker Component
 *
 * Shown when a Google account has multiple vaults linked to it.
 * User selects which vault to unlock, then enters the password for that vault.
 */

import { Component, For, Show } from 'solid-js';
import type { GoogleVaultInfo } from '@nostrpass/nostrHelpers';

interface VaultPickerProps {
  googleUser: {
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  vaults: GoogleVaultInfo[];
  onSelect: (vault: GoogleVaultInfo) => void;
  onCancel: () => void;
}

const VaultPicker: Component<VaultPickerProps> = (props) => {
  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000); // Nostr timestamps are in seconds
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 w-full max-w-md md:rounded-lg md:shadow-xl md:border-2 md:border-black dark:md:border-gray-700 p-6">
        {/* Header with Google user info */}
        <div class="flex items-center gap-3 mb-6">
          <Show when={props.googleUser.photoURL && props.googleUser.photoURL.startsWith('http')} fallback={
            <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              {props.googleUser.displayName?.[0]?.toUpperCase() || props.googleUser.email?.[0]?.toUpperCase() || 'G'}
            </div>
          }>
            <img
              src={props.googleUser.photoURL!}
              alt="Profile"
              class="w-10 h-10 rounded-full"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Hide broken image - fallback will show
                e.currentTarget.style.display = 'none';
              }}
            />
          </Show>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {props.googleUser.displayName || props.googleUser.email}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {props.googleUser.email}
            </p>
          </div>
        </div>

        {/* Title */}
        <div class="text-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Select a Vault
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Multiple vaults are linked to this Google account
          </p>
        </div>

        {/* Vault list */}
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <For each={props.vaults}>
            {(vault) => (
              <button
                type="button"
                onClick={() => props.onSelect(vault)}
                class="w-full p-4 text-left rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div class="flex items-center gap-3">
                  {/* Vault avatar with initials */}
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span class="text-white text-sm font-bold">
                      {vault.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-white truncate">
                      {vault.displayName}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Created {formatDate(vault.createdAt)}
                    </p>
                  </div>
                  <svg
                    class="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            )}
          </For>
        </div>

        {/* Cancel button */}
        <div class="mt-6 text-center">
          <button
            type="button"
            onClick={props.onCancel}
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default VaultPicker;
