import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useAuth } from '../providers/AuthProvider';
import NostrSyncService from '../services/nostrSyncService';

export const NostrSyncIndicator = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = createSignal<{
    needsSync: boolean;
    attemptCount: number;
    lastError?: string;
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
          lastError: status.lastError
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

    window.addEventListener('nostr-sync-complete', handleSyncComplete);
    window.addEventListener('nostr-sync-error', handleSyncError);

    // Refresh status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    onCleanup(() => {
      window.removeEventListener('nostr-sync-complete', handleSyncComplete);
      window.removeEventListener('nostr-sync-error', handleSyncError);
      clearInterval(interval);
    });
  });

  return (
    <Show when={syncStatus()?.needsSync}>
      <div class="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <p class="font-medium text-sm">Syncing to Nostr...</p>
            <Show when={syncStatus()?.lastError}>
              <p class="text-xs opacity-90 mt-1">
                Retrying (attempt {syncStatus()?.attemptCount})
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
          <div class="mt-2 pt-2 border-t border-blue-500 text-xs opacity-90">
            <p class="font-medium">Last error:</p>
            <p class="mt-1">{syncStatus()?.lastError}</p>
          </div>
        </Show>
      </div>
    </Show>
  );
};
