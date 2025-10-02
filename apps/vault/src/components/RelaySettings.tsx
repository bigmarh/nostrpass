import { Component, createSignal, For, Show, createEffect } from 'solid-js';
import { useVaultData } from '../hooks/useVaultData';
import { getRelays as getDefaultRelays } from '../providers/EnvironmentProvider';

const RelaySettings: Component = () => {
  const { vaultData, updateVaultData } = useVaultData();
  const [newRelay, setNewRelay] = createSignal('');
  const [isAdding, setIsAdding] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [currentRelays, setCurrentRelays] = createSignal<string[]>([]);

  const defaultRelays = getDefaultRelays();

  // Sync currentRelays with vaultData
  createEffect(() => {
    const custom = vaultData()?.customRelays;
    if (custom && custom.length > 0) {
      setCurrentRelays(custom);
    } else {
      setCurrentRelays(defaultRelays);
    }
  });

  const isCustom = () => {
    const custom = vaultData()?.customRelays;
    return custom && custom.length > 0;
  };

  const handleAddRelay = async () => {
    const url = newRelay().trim();
    if (!url) return;

    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      alert('Relay URL must start with wss:// or ws://');
      return;
    }

    if (currentRelays().includes(url)) {
      alert('This relay is already in your list');
      return;
    }

    setIsSaving(true);
    try {
      const current = vaultData()?.customRelays || [];
      const updated = [...current, url];
      
      await updateVaultData({ 
        customRelays: updated 
      });
      
      setNewRelay('');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add relay:', error);
      alert('Failed to add relay');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveRelay = async (relay: string) => {
    if (!confirm(`Remove ${relay}?`)) return;

    setIsSaving(true);
    try {
      const current = currentRelays();
      const updated = current.filter(r => r !== relay);
      
      await updateVaultData({ 
        customRelays: updated.length > 0 ? updated : undefined 
      });
    } catch (error) {
      console.error('Failed to remove relay:', error);
      alert('Failed to remove relay');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Reset to default relays? Your custom relays will be removed.')) return;

    setIsSaving(true);
    try {
      await updateVaultData({ customRelays: undefined });
    } catch (error) {
      console.error('Failed to reset relays:', error);
      alert('Failed to reset relays');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="space-y-4">
      {/* Header with Reset Button */}
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Nostr Relays</h3>
        <Show when={isCustom()}>
          <button
            onClick={handleResetToDefaults}
            disabled={isSaving()}
            class="px-3 py-1.5 text-sm bg-gray-600 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset to Defaults
          </button>
        </Show>
      </div>

      {/* Status Text */}
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {isCustom() 
          ? 'Using custom relays (your vault data is published to these relays)'
          : 'Using default relays (add custom relays below to override)'}
      </p>

      {/* Relays List */}
      <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
        <For each={currentRelays()}>
          {(relay) => (
            <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
              <span class="font-mono text-xs text-gray-800 dark:text-gray-200 break-all flex-1 mr-2">
                {relay}
              </span>
              <Show when={isCustom()}>
                <button
                  onClick={() => handleRemoveRelay(relay)}
                  disabled={isSaving()}
                  class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Remove
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Add Relay Section */}
      <Show
        when={!isAdding()}
        fallback={
          <div class="space-y-2">
            <input
              type="text"
              value={newRelay()}
              onInput={(e) => setNewRelay(e.currentTarget.value)}
              placeholder="wss://relay.example.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSaving()}
              autofocus
            />
            <div class="flex gap-2">
              <button
                onClick={handleAddRelay}
                disabled={isSaving() || !newRelay().trim()}
                class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSaving() ? 'Adding...' : 'Add Relay'}
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewRelay('');
                }}
                disabled={isSaving()}
                class="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        }
      >
        <button
          onClick={() => setIsAdding(true)}
          class="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-colors font-medium"
        >
          + Add Custom Relay
        </button>
      </Show>

      {/* Info Text */}
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Custom relays will be used for all vault operations (backup and sync). If not set, default relays are used.
      </p>
    </div>
  );
};

export default RelaySettings;
