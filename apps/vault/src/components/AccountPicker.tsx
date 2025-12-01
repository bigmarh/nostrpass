import { Component, createSignal, For, Show, createMemo } from 'solid-js';
import type { Identity } from '@nostrpass/types';
import { nip19 } from 'nostr-tools';

interface IdentityWithIndex {
  identity: Identity;
  index: number;
  isAuthorized?: boolean;
}

interface AccountPickerProps {
  appOrigin: string;
  appName?: string;
  identities: IdentityWithIndex[];
  onSelect: (identityIndex: number) => void;
  onCancel: () => void;
}

export const AccountPicker: Component<AccountPickerProps> = (props) => {
  // Default to first identity's original index
  const [selectedIndex, setSelectedIndex] = createSignal<number>(props.identities[0]?.index || 0);
  const [searchQuery, setSearchQuery] = createSignal('');

  // Show search when there are more than 4 identities
  const showSearch = () => props.identities.length > 4;

  // Filter identities based on search query
  const filteredIdentities = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.identities;

    return props.identities.filter(item => {
      const name = getDisplayName(item.identity, item.index).toLowerCase();
      const npub = getNpub(item.identity).toLowerCase();
      return name.includes(query) || npub.includes(query);
    });
  });

  const handleSelect = () => {
    props.onSelect(selectedIndex());
  };

  const getDisplayName = (identity: Identity, originalIndex: number) => {
    return identity.nickname || `Identity ${originalIndex + 1}`;
  };

  const getNpub = (identity: Identity) => {
    try {
      return nip19.npubEncode(identity.publicKey);
    } catch {
      return identity.publicKey.slice(0, 16) + '...';
    }
  };

  return (
    <div class="flex items-center justify-center w-full h-full p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          {/* Header */}
          <div class="mb-6">
            <div class="text-3xl mb-2">🔑</div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Select Account
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <strong>{props.appName || props.appOrigin}</strong> needs you to select which identity to use.
              {props.identities.some(i => !i.isAuthorized) && (
                <span class="block mt-1 text-xs">
                  You'll be asked to authorize new identities.
                </span>
              )}
            </p>
          </div>

          {/* Search input - only show when more than 4 identities */}
          <Show when={showSearch()}>
            <input
              type="text"
              placeholder="Search identities..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </Show>

          {/* Identity List - scrollable with max 3 visible */}
          <div class="space-y-2 mb-6 max-h-[calc(3*88px)] overflow-y-auto">
            <For each={filteredIdentities()}>
              {(item) => (
                <button
                  onClick={() => setSelectedIndex(item.index)}
                  class={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedIndex() === item.index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div class="flex items-center gap-3">
                    <div class={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      selectedIndex() === item.index
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedIndex() === item.index && (
                        <div class="w-full h-full rounded-full bg-white transform scale-50" />
                      )}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <div class="font-medium text-gray-900 dark:text-white">
                          {getDisplayName(item.identity, item.index)}
                        </div>
                        {item.isAuthorized && (
                          <span class="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                            ✓ Connected
                          </span>
                        )}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {getNpub(item.identity)}
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </For>

            {/* Empty state */}
            <Show when={filteredIdentities().length === 0}>
              <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                No identities found matching "{searchQuery()}"
              </div>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex gap-3">
            <button
              onClick={props.onCancel}
              class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPicker;
