import { Component, For } from 'solid-js';
import { useEnvironment } from '../providers';

export const RelaysSection: Component = () => {
  const env = useEnvironment();
  const relays = env.getRelays ? env.getRelays() : [];

  return (
    <div class="space-y-3">
      <h3 class="font-medium text-gray-900 dark:text-white">Relays</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">These relays are used for Nostr operations (lookup/sync).</p>
      <div class="grid gap-2">
        <For each={relays}>
          {(r) => (
            <div class="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 font-mono">
              {r}
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default RelaysSection;


