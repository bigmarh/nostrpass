import { Component, createSignal, For, Show } from 'solid-js';
import { useVaultData } from '../hooks/useVaultData';
import { getRelays } from '../providers/EnvironmentProvider';

const RelaySettings: Component = () => {
  const { vaultData, updateVaultData } = useVaultData();
  const [newRelay, setNewRelay] = createSignal('');
  const [isAdding, setIsAdding] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);

  const currentRelays = () => {
    const customRelays = vaultData()?.customRelays;
    return customRelays && customRelays.length > 0 ? customRelays : getRelays();
  };

  const isCustom = () => {
    return vaultData()?.customRelays && vaultData()!.customRelays!.length > 0;
  };

  const handleAddRelay = async () => {
    const relay = newRelay().trim();
    if (!relay) return;

    // Validate relay URL
    if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
      alert('Relay URL must start with wss:// or ws://');
      return;
    }

    setIsSaving(true);
    try {
      const current = currentRelays();
      if (current.includes(relay)) {
        alert('Relay already in list');
        return;
      }

      await updateVaultData({ 
        customRelays: [...current, relay] 
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
    <div class="relay-settings">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Nostr Relays</h3>
        <Show when={isCustom()}>
          <button
            onClick={handleResetToDefaults}
            disabled={isSaving()}
            style="padding: 0.5rem 1rem; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;"
          >
            Reset to Defaults
          </button>
        </Show>
      </div>

      <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
        {isCustom() 
          ? 'Using custom relays (your vault data is published to these relays)'
          : 'Using default relays (configure custom relays below)'}
      </p>

      <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <For each={currentRelays()}>
          {(relay) => (
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; margin-bottom: 0.5rem; border-radius: 4px;">
              <span style="font-family: monospace; font-size: 0.9rem; word-break: break-all;">
                {relay}
              </span>
              <Show when={isCustom()}>
                <button
                  onClick={() => handleRemoveRelay(relay)}
                  disabled={isSaving()}
                  style="padding: 0.25rem 0.5rem; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;"
                >
                  Remove
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show
        when={!isAdding()}
        fallback={
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <input
              type="text"
              value={newRelay()}
              onInput={(e) => setNewRelay(e.currentTarget.value)}
              placeholder="wss://relay.example.com"
              style="flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
              disabled={isSaving()}
            />
            <button
              onClick={handleAddRelay}
              disabled={isSaving() || !newRelay().trim()}
              style="padding: 0.5rem 1rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewRelay('');
              }}
              disabled={isSaving()}
              style="padding: 0.5rem 1rem; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Cancel
            </button>
          </div>
        }
      >
        <button
          onClick={() => setIsAdding(true)}
          style="padding: 0.5rem 1rem; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
        >
          + Add Custom Relay
        </button>
      </Show>
    </div>
  );
};

export default RelaySettings;

