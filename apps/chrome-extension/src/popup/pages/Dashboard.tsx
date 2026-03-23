import { Component, createSignal } from 'solid-js';
import type { AuthState } from '@/shared/types';

interface DashboardProps {
  authState: AuthState;
  onLock: () => void;
}

const Dashboard: Component<DashboardProps> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const truncateKey = (key: string) => {
    if (!key) return '';
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const copyPublicKey = async () => {
    if (props.authState.publicKey) {
      await navigator.clipboard.writeText(props.authState.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div class="flex h-[500px] flex-col">
      {/* Header */}
      <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-full bg-purple-500" />
          <span class="font-semibold text-gray-900 dark:text-white">
            NostrPass
          </span>
        </div>
        <button
          onClick={props.onLock}
          class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Lock
        </button>
      </header>

      {/* Main content */}
      <main class="flex-1 overflow-auto p-4">
        {/* Active Identity */}
        <div class="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div class="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Active Identity
          </div>
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-lg font-bold text-white">
              {props.authState.activeIdentityIndex ?? 0}
            </div>
            <div class="flex-1">
              <div class="font-medium text-gray-900 dark:text-white">
                Identity #{(props.authState.activeIdentityIndex ?? 0) + 1}
              </div>
              <button
                onClick={copyPublicKey}
                class="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                <span class="font-mono">
                  {truncateKey(props.authState.publicKey || '')}
                </span>
                <span class="text-xs">{copied() ? '✓' : '📋'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status */}
        <div class="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div class="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Status
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-gray-700 dark:text-gray-300">Vault</span>
              <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                Unlocked
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-700 dark:text-gray-300">NIP-07</span>
              <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                Active
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="border-t border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        NostrPass v1.0.0
      </footer>
    </div>
  );
};

export default Dashboard;
