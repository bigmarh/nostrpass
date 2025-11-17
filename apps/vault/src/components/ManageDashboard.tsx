import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { useMessenger, useCryptoWorker, useAuth } from '../providers';
import { useParams } from '@solidjs/router';

/**
 * ManageDashboard - Simplified account management interface
 *
 * Gets auth status directly from vault's AuthProvider, then displays a simple UI.
 * No auth guards, no redirects - just direct state access.
 *
 * Waits for auth provider to restore session before showing UI.
 */
export const ManageDashboard: Component = () => {
  const { send } = useMessenger();
  const cryptoWorker = useCryptoWorker();
  const { user, isAuthenticated, isVaultLocked } = useAuth();
  const params = useParams();

  const [vaultData, setVaultData] = createSignal<any>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = createSignal(false);

  // Wait for initial auth check to complete
  createEffect(() => {
    // Once we have cryptoWorker, wait a moment for auth restore to complete
    if (cryptoWorker) {
      setTimeout(() => {
        setHasCheckedAuth(true);
        console.log('[ManageDashboard] Auth check complete');
      }, 200);
    }
  });

  // Reactively load vault data when user becomes available
  createEffect(async () => {
    const currentUser = user();
    console.log('[ManageDashboard] Effect triggered - user:', currentUser?.profile?.username);

    if (isAuthenticated() && currentUser?.profile.username && cryptoWorker) {
      console.log('[ManageDashboard] Loading vault data...');
      try {
        const data = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
        console.log('[ManageDashboard] Loaded vault data:', data);
        setVaultData(data);
      } catch (error) {
        console.error('[ManageDashboard] Failed to load vault data:', error);
      }
    }
  });

  const handleClose = () => {
    console.log('[ManageDashboard] Close clicked, sending HIDE_VAULT');
    send('HIDE_VAULT');
  };

  console.log('[ManageDashboard] RENDER - hasCheckedAuth:', hasCheckedAuth());
  console.log('[ManageDashboard] RENDER - isAuthenticated:', isAuthenticated());
  console.log('[ManageDashboard] RENDER - user:', user());

  return (
    <Show
      when={hasCheckedAuth()}
      fallback={
        <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
          <div class="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      }
    >
      <Show
        when={isAuthenticated() && user()}
        fallback={
        <div class="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
          <div class="text-center space-y-4">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Not Authenticated</h1>
            <p class="text-gray-600 dark:text-gray-400">Please log in to manage your account.</p>
            <div class="text-xs text-gray-500 mt-2">
              Auth: {String(isAuthenticated())} | User: {String(!!user())}
            </div>
            <button
              onClick={handleClose}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      {(() => {
        const identities = vaultData()?.identities || [];
        const username = user()?.profile.username || '';
        const locked = isVaultLocked();

        console.log('[ManageDashboard] RENDER - Showing main dashboard');

        return (
          <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div class="max-w-2xl mx-auto">
              {/* Header */}
              <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <div class="px-6 py-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                        {username.toUpperCase()}
                      </h1>
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Account Management</p>
                    </div>

                    <button
                      onClick={handleClose}
                      class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      <span>Close</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main class="p-6">
                {/* Lock Status */}
                <Show when={locked}>
                  <div class="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div class="text-sm text-yellow-900 dark:text-yellow-100">
                      🔒 Vault is currently locked. Some features may be unavailable.
                    </div>
                  </div>
                </Show>

                <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Identities</h2>

                  <Show when={identities.length > 0} fallback={
                    <p class="text-gray-500 dark:text-gray-400 text-sm">No identities found.</p>
                  }>
                    <div class="space-y-3">
                      <For each={identities}>
                        {(identity: any, index) => (
                          <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div class="flex items-center justify-between">
                              <div>
                                <div class="font-medium text-gray-900 dark:text-white">
                                  {identity.nickname || `Identity ${index() + 1}`}
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {identity.publicKey?.slice(0, 16)}...
                                </div>
                              </div>
                              <div class="text-xs text-gray-400 dark:text-gray-500">
                                Index: {index()}
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* App Info */}
                <Show when={params.app}>
                  <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div class="text-sm text-blue-900 dark:text-blue-100">
                      <strong>App:</strong> {params.app.replace(/-/g, '.')}
                    </div>
                  </div>
                </Show>
              </main>
            </div>
          </div>
        );
      })()}
      </Show>
    </Show>
  );
};

export default ManageDashboard;
