/**
 * GooglePasswordPrompt Component
 *
 * Modal for entering vault password after Google Sign-In.
 * Shows Google account info and prompts for the vault password.
 */

import { Component, createSignal, Show } from 'solid-js';
import type { GoogleUser } from '../providers/GoogleAuthProvider';

interface GooglePasswordPromptProps {
  googleUser: GoogleUser;
  mode: 'login' | 'signup';
  onSubmit: (password: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  namespace?: string;
  environment?: string;
  errorMessage?: string; // External error to display (e.g., wrong password)
}

const GooglePasswordPrompt: Component<GooglePasswordPromptProps> = (props) => {
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setError('');

    if (!password().trim()) {
      setError('Password is required');
      return;
    }

    if (props.mode === 'signup') {
      if (password().length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password() !== confirmPassword()) {
        setError('Passwords do not match');
        return;
      }
    }

    props.onSubmit(password());
  };

  return (
    <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header with Google account info */}
        <div class="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <Show when={props.googleUser.photoURL && props.googleUser.photoURL.startsWith('http')} fallback={
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                {props.googleUser.displayName?.[0]?.toUpperCase() || props.googleUser.email?.[0]?.toUpperCase() || 'G'}
              </div>
            }>
              <img
                src={props.googleUser.photoURL!}
                alt="Profile"
                class="w-8 h-8 rounded-full"
                onError={(e) => {
                  // Hide broken image and show fallback
                  e.currentTarget.style.display = 'none';
                }}
              />
            </Show>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {props.googleUser.displayName || props.googleUser.email}
              </p>
            </div>
            <svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div class="px-4 py-3">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {props.mode === 'signup' ? 'Create a vault password (Google cannot access it)' : 'Enter your vault password'}
          </p>

          <form onSubmit={handleSubmit} class="space-y-2.5">
            <input
              type="password"
              id="vault-password"
              placeholder={props.mode === 'signup' ? 'Create password (8+ chars)' : 'Vault password'}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
              autocomplete={props.mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={props.isLoading}
              autofocus
            />

            <Show when={props.mode === 'signup'}>
              <input
                type="password"
                id="confirm-vault-password"
                placeholder="Confirm password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                autocomplete="new-password"
                disabled={props.isLoading}
              />
            </Show>

            <Show when={error() || props.errorMessage}>
              <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-2 py-1.5 rounded text-xs">
                {error() || props.errorMessage}
              </div>
            </Show>

            <div class="flex gap-2 pt-1">
              <button
                type="button"
                onClick={props.onCancel}
                disabled={props.isLoading}
                class="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={props.isLoading || !password().trim()}
                class="flex-1 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors font-medium text-sm disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Show when={props.isLoading}>
                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </Show>
                {props.mode === 'signup' ? 'Continue' : 'Unlock'}
              </button>
            </div>

            {/* Storage location info */}
            <Show when={props.namespace && props.environment}>
              <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono text-center pt-2">
                {props.mode === 'signup' ? 'Will store to' : 'Looking up'}: {props.namespace} / {props.environment}
              </p>
            </Show>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GooglePasswordPrompt;
