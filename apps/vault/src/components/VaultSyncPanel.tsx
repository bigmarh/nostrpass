import { Component, Show, createSignal } from 'solid-js';

interface VaultSyncPanelProps {
  username: string;
  onSyncToNostr: () => Promise<void>;
  onGetFromNostr: () => Promise<any>;
}

export interface SyncQueueStatus {
  length: number;
  isProcessing: boolean;
}

/**
 * VaultSyncPanel - Component for managing Nostr sync operations
 *
 * Provides UI for:
 * - Manual sync to Nostr with loading state
 * - Get vault from Nostr with loading state
 * - Success/error message display
 * - Sync queue management
 */
export const VaultSyncPanel: Component<VaultSyncPanelProps> = (props) => {
  // Signals for sync state
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [isGettingFromNostr, setIsGettingFromNostr] = createSignal(false);
  const [syncMessage, setSyncMessage] = createSignal<string | null>(null);
  const [syncStatus, setSyncStatus] = createSignal<'success' | 'error' | null>(null);

  // Manual sync function for user-triggered sync
  const handleManualSync = async () => {
    if (!props.username) return;

    setIsSyncing(true);
    setSyncMessage(null);
    setSyncStatus(null);

    try {
      console.log('🔄 Manual sync triggered...');
      await props.onSyncToNostr();
      console.log('✅ Manual sync completed successfully');
      setSyncStatus('success');
      setSyncMessage('Vault synced to Nostr successfully!');
      // Clear message after 3 seconds
      setTimeout(() => {
        setSyncMessage(null);
        setSyncStatus(null);
      }, 3000);
    } catch (error: any) {
      console.error('❌ Manual sync failed:', error);
      setSyncStatus('error');
      setSyncMessage(error.message || 'Failed to sync to Nostr');
      // Clear message after 5 seconds
      setTimeout(() => {
        setSyncMessage(null);
        setSyncStatus(null);
      }, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Get vault from Nostr function
  const handleGetFromNostr = async () => {
    if (!props.username) return;

    setIsGettingFromNostr(true);
    setSyncMessage(null);
    setSyncStatus(null);

    try {
      console.log('🔄 Getting vault from Nostr...');
      const result = await props.onGetFromNostr();
      if (result) {
        console.log('✅ Vault retrieved from Nostr:', {
          eventId: result.eventId,
          timestamp: new Date(result.timestamp).toISOString(),
          identitiesCount: result.vaultData.identities?.length || 0
        });
        setSyncStatus('success');
        setSyncMessage(`Retrieved vault from Nostr (${result.vaultData.identities?.length || 0} identities)`);
        // Clear message after 3 seconds
        setTimeout(() => {
          setSyncMessage(null);
          setSyncStatus(null);
        }, 3000);
      } else {
        console.log('ℹ️ No vault found on Nostr');
        setSyncStatus('error');
        setSyncMessage('No vault data found on Nostr relays');
        setTimeout(() => {
          setSyncMessage(null);
          setSyncStatus(null);
        }, 5000);
      }
    } catch (error: any) {
      console.error('❌ Failed to get vault from Nostr:', error);
      setSyncStatus('error');
      setSyncMessage(error.message || 'Failed to retrieve vault from Nostr');
      setTimeout(() => {
        setSyncMessage(null);
        setSyncStatus(null);
      }, 5000);
    } finally {
      setIsGettingFromNostr(false);
    }
  };

  return (
    <div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Nostr Sync</h3>
      <div class="space-y-3">
        <button
          onClick={handleManualSync}
          disabled={isSyncing() || isGettingFromNostr()}
          class={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            isSyncing() || isGettingFromNostr()
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
          title="Sync your vault data to Nostr relays"
        >
          <Show when={isSyncing()} fallback={
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          }>
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </Show>
          <span>{isSyncing() ? 'Syncing...' : 'Sync to Nostr'}</span>
        </button>
        <button
          onClick={handleGetFromNostr}
          disabled={isSyncing() || isGettingFromNostr()}
          class={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            isSyncing() || isGettingFromNostr()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white`}
          title="Get latest vault data from Nostr relays"
        >
          <Show when={isGettingFromNostr()} fallback={
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          }>
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </Show>
          <span>{isGettingFromNostr() ? 'Getting...' : 'Get from Nostr'}</span>
        </button>

        {/* Success/Error Message */}
        <Show when={syncMessage()}>
          <div class={`p-3 rounded-lg ${
            syncStatus() === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
          }`}>
            <p class={`text-sm ${
              syncStatus() === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {syncMessage()}
            </p>
          </div>
        </Show>

        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Use these to manually sync your vault data with Nostr relays. Auto-sync happens on changes.
        </p>
      </div>
    </div>
  );
};

/**
 * Sync Queue Management Utilities
 *
 * These utilities are used by the Dashboard to manage queued sync operations.
 * Exported for use in the parent component that manages the sync queue.
 */

export interface SyncQueueManager {
  queue: Array<() => Promise<void>>;
  isProcessing: boolean;
}

/**
 * Creates a sync queue manager instance
 */
export function createSyncQueueManager(): SyncQueueManager {
  return {
    queue: [],
    isProcessing: false
  };
}

/**
 * Process the sync queue
 * @param manager The sync queue manager instance
 * @param setSyncQueueStatus Callback to update queue status
 * @returns Promise that resolves when queue processing is complete
 */
export async function processSyncQueue(
  manager: SyncQueueManager,
  setSyncQueueStatus: (status: SyncQueueStatus) => void
): Promise<void> {
  if (manager.isProcessing || manager.queue.length === 0) return;

  manager.isProcessing = true;
  setSyncQueueStatus({ length: manager.queue.length, isProcessing: true });
  console.log('🔄 Processing sync queue, items:', manager.queue.length);

  try {
    while (manager.queue.length > 0) {
      const syncOperation = manager.queue.shift();
      if (syncOperation) {
        try {
          console.log('🔄 Executing sync operation...');
          await syncOperation();
          console.log('✅ Sync operation completed');
        } catch (error) {
          console.error('❌ Sync operation failed:', error);
          // Continue processing other items in queue
        }
      }
      // Update status after each operation
      setSyncQueueStatus({ length: manager.queue.length, isProcessing: true });
    }
  } catch (error) {
    console.error('❌ Queue processing error:', error);
  } finally {
    manager.isProcessing = false;
    setSyncQueueStatus({ length: 0, isProcessing: false });
    console.log('✅ Sync queue processing complete');
  }
}

/**
 * Queue a sync operation to Nostr
 * @param manager The sync queue manager instance
 * @param syncToNostr The sync function to call
 * @param setSyncQueueStatus Callback to update queue status
 * @param setPermissionSaveError Callback to set error/success messages
 * @returns Promise that resolves when sync completes or rejects on error
 */
export async function queueSyncToNostr(
  manager: SyncQueueManager,
  syncToNostr: () => Promise<void>,
  setSyncQueueStatus: (status: SyncQueueStatus) => void,
  setPermissionSaveError: (error: string | null) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const syncOperation = async () => {
      try {
        await syncToNostr();
        console.log('✅ Queued Nostr sync completed successfully');
        setPermissionSaveError('✅ Settings saved to Nostr');
        setTimeout(() => setPermissionSaveError(null), 3000);
        resolve(); // Resolve the promise when sync completes
      } catch (error: any) {
        console.error('❌ Queued Nostr sync failed:', error);
        if (error.message?.includes('Vault is locked')) {
          setPermissionSaveError('Please unlock your vault with PIN first');
        } else if (error.message?.includes('no xpriv')) {
          setPermissionSaveError('Session expired - please unlock with PIN');
        } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
          setPermissionSaveError('Nostr sync timed out - settings saved locally but may not be synced to all relays');
        } else if (error.message?.includes('Failed to publish to any relay')) {
          setPermissionSaveError('Failed to sync to Nostr relays - settings saved locally');
        } else {
          setPermissionSaveError(error.message || 'Failed to save to Nostr');
        }
        reject(error); // Reject the promise when sync fails
      }
    };

    // Add to queue
    manager.queue.push(syncOperation);
    setSyncQueueStatus({ length: manager.queue.length, isProcessing: manager.isProcessing });
    console.log('📋 Added sync operation to queue, queue length:', manager.queue.length);

    // Limit queue size to prevent memory issues
    if (manager.queue.length > 10) {
      console.log('⚠️ Queue too long, removing oldest items');
      manager.queue = manager.queue.slice(-5); // Keep only the 5 most recent
      setSyncQueueStatus({ length: manager.queue.length, isProcessing: manager.isProcessing });
    }

    // Start processing if not already running
    processSyncQueue(manager, setSyncQueueStatus).catch(error => {
      console.error('❌ Queue processing failed:', error);
      reject(error);
    });
  });
}

/**
 * Clear the sync queue
 * @param manager The sync queue manager instance
 * @param setSyncQueueStatus Callback to update queue status
 */
export function clearSyncQueue(
  manager: SyncQueueManager,
  setSyncQueueStatus: (status: SyncQueueStatus) => void
): void {
  console.log('🧹 Clearing sync queue, items:', manager.queue.length);
  manager.queue = [];
  manager.isProcessing = false;
  setSyncQueueStatus({ length: 0, isProcessing: false });
}

/**
 * Test function for debugging the queue system
 * @param manager The sync queue manager instance
 * @param setSyncQueueStatus Callback to update queue status
 */
export async function testSyncQueue(
  manager: SyncQueueManager,
  syncQueueStatus: SyncQueueStatus,
  setSyncQueueStatus: (status: SyncQueueStatus) => void
): Promise<void> {
  console.log('🧪 Testing queue system...');
  console.log('Current queue status:', syncQueueStatus);
  console.log('Queue length:', manager.queue.length);
  console.log('Is processing:', manager.isProcessing);

  // Add a test operation to the queue
  const testOperation = async () => {
    console.log('🧪 Test operation executing...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate 1 second work
    console.log('🧪 Test operation completed');
  };

  manager.queue.push(testOperation);
  setSyncQueueStatus({ length: manager.queue.length, isProcessing: manager.isProcessing });
  processSyncQueue(manager, setSyncQueueStatus);
}

export default VaultSyncPanel;
