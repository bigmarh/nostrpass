/**
 * Vault Picker Component
 *
 * Shown when a Google account has multiple vaults linked to it.
 * User selects which vault to unlock, then enters the password for that vault.
 */

import { Component, For } from 'solid-js';
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
          {props.googleUser.photoURL ? (
            <img
              src={props.googleUser.photoURL}
              alt=""
              class="w-10 h-10 rounded-full"
            />
          ) : (
            <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
          )}
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
