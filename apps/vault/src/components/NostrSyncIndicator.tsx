import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useAuth } from '../providers/AuthProvider';
import NostrSyncService from '../services/nostrSyncService';

export const NostrSyncIndicator = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = createSignal<{
    needsSync: boolean;
    attemptCount: number;
    lastError?: string;
    requiresManualRetry?: boolean;
  } | null>(null);
  const [showDetails, setShowDetails] = createSignal(false);

  onMount(() => {
    const syncService = NostrSyncService.getInstance();

    // Check initial status
    const updateStatus = () => {
      const currentUser = user();
      if (!currentUser) {
        setSyncStatus(null);
        return;
      }

      const status = syncService.getSyncStatus(currentUser.profile.username);
      if (status) {
        setSyncStatus({
          needsSync: status.needsSync,
          attemptCount: status.attemptCount,
          lastError: status.lastError,
          requiresManualRetry: false
        });
      } else {
        setSyncStatus(null);
      }
    };

    updateStatus();

    // Listen for sync events
    const handleSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const currentUser = user();
      if (currentUser?.profile.username === detail.username) {
        setSyncStatus(null);
      }
    };

    const handleSyncError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const currentUser = user();
      if (currentUser?.profile.username === detail.username) {
        updateStatus();
      }
    };

    const handleSyncFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const currentUser = user();
      if (currentUser?.profile.username === detail.username) {
        setSyncStatus({
          needsSync: true,
          attemptCount: detail.attemptCount || 0,
          lastError: detail.error || 'Sync failed',
          requiresManualRetry: detail.requiresManualRetry || false
        });
      }
    };

    window.addEventListener('nostr-sync-complete', handleSyncComplete);
    window.addEventListener('nostr-sync-error', handleSyncError);
    window.addEventListener('nostr-sync-failed', handleSyncFailed);

    // Refresh status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    onCleanup(() => {
      window.removeEventListener('nostr-sync-complete', handleSyncComplete);
      window.removeEventListener('nostr-sync-error', handleSyncError);
      window.removeEventListener('nostr-sync-failed', handleSyncFailed);
      clearInterval(interval);
    });
  });

  return (
    <Show when={syncStatus()?.needsSync}>
      <div
        class="fixed bottom-4 right-4 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm"
        classList={{
          'bg-blue-600': !syncStatus()?.requiresManualRetry,
          'bg-red-600': syncStatus()?.requiresManualRetry
        }}
      >
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <Show when={!syncStatus()?.requiresManualRetry}>
              <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </Show>
            <Show when={syncStatus()?.requiresManualRetry}>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </Show>
          </div>
          <div class="flex-1">
            <Show when={!syncStatus()?.requiresManualRetry}>
              <p class="font-medium text-sm">Syncing to Nostr...</p>
              <Show when={syncStatus()?.lastError}>
                <p class="text-xs opacity-90 mt-1">
                  Retrying (attempt {syncStatus()?.attemptCount})
                </p>
              </Show>
            </Show>
            <Show when={syncStatus()?.requiresManualRetry}>
              <p class="font-medium text-sm">Sync Failed</p>
              <p class="text-xs opacity-90 mt-1">
                Max attempts reached. Check settings to retry.
              </p>
            </Show>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails())}
            class="text-xs underline opacity-90 hover:opacity-100"
          >
            {showDetails() ? 'Hide' : 'Details'}
          </button>
        </div>
        <Show when={showDetails() && syncStatus()?.lastError}>
          <div
            class="mt-2 pt-2 text-xs opacity-90"
            classList={{
              'border-t border-blue-500': !syncStatus()?.requiresManualRetry,
              'border-t border-red-500': syncStatus()?.requiresManualRetry
            }}
          >
            <p class="font-medium">Error details:</p>
            <p class="mt-1">{syncStatus()?.lastError}</p>
          </div>
        </Show>
      </div>
    </Show>
  );
};
