import { Component, Show, JSX, For, createSignal } from 'solid-js';
import { nip19 } from 'nostr-tools';
import RelaySettings from './RelaySettings';
import type { VaultData } from '../workers/db';

interface GlobalSettingsProps {
  username: string;
  identityCount: number;
  isOpen: boolean;
  onClose: () => void;
  vaultData: VaultData | null;
  onUpdateVaultData: (updates: Partial<VaultData>, options?: any) => Promise<void>;
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
  const [showRestoreConfirm, setShowRestoreConfirm] = createSignal(false);
  const [identityToRestore, setIdentityToRestore] = createSignal<{index: number, nickname: string} | null>(null);

  const archivedIdentities = () => {
    if (!props.vaultData?.identities) return [];
    return props.vaultData.identities
      .map((identity: any, index: number) => ({ identity, index }))
      .filter(({ identity }) => identity.archived);
  };

  const confirmRestoreIdentity = (index: number, nickname: string) => {
    setIdentityToRestore({ index, nickname });
    setShowRestoreConfirm(true);
  };

  const handleRestoreIdentity = async () => {
    const toRestore = identityToRestore();
    if (!toRestore) return;

    setShowRestoreConfirm(false);

    try {
      const currentVault = props.vaultData;
      if (!currentVault) return;

      // Remove archived flag
      const updatedIdentities = currentVault.identities.map((id: any, idx: number) => {
        if (idx === toRestore.index) {
          const { archived, archivedAt, ...rest } = id;
          return rest;
        }
        return id;
      });

      await props.onUpdateVaultData({
        identities: updatedIdentities
      }, { syncToNostr: true });

      console.log('✅ [Restore Identity] Identity restored');
      setIdentityToRestore(null);
    } catch (e) {
      console.error('Failed to restore identity:', e);
    }
  };

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

            {/* Archived Identities */}
            <Show when={archivedIdentities().length > 0}>
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Archived Identities</h3>
                <div class="space-y-2">
                  <For each={archivedIdentities()}>
                    {({ identity, index }) => {
                      let npub = '';
                      try {
                        npub = nip19.npubEncode(identity.publicKey);
                      } catch (e) {
                        npub = identity.publicKey;
                      }

                      return (
                        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-gray-900 dark:text-gray-100">
                              {identity.nickname || 'Personal'}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                              {npub.substring(0, 16)}...
                            </div>
                            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Archived {new Date(identity.archivedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => confirmRestoreIdentity(index, identity.nickname)}
                            class="ml-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Restore
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Restore Confirmation Modal */}
        <Show when={showRestoreConfirm()}>
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 p-6 max-w-md w-full mx-4">
              <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Restore Identity?</h2>
              <p class="text-gray-700 dark:text-gray-300 mb-2">
                Are you sure you want to restore <strong class="text-gray-900 dark:text-gray-100">{identityToRestore()?.nickname}</strong>?
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This identity will be restored and visible in your identity list.
              </p>
              <div class="flex gap-3">
                <button
                  onClick={() => {
                    setShowRestoreConfirm(false);
                    setIdentityToRestore(null);
                  }}
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreIdentity}
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default GlobalSettings;
