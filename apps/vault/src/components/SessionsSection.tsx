import { Component, createSignal, onMount, Show } from 'solid-js';
import { useAuth, useCryptoWorker } from '../providers';

export const SessionsSection: Component = () => {
  const { user } = useAuth();
  const cryptoWorker = useCryptoWorker();
  const [isUnlocked, setIsUnlocked] = createSignal<boolean>(false);
  const [lastActivity, setLastActivity] = createSignal<string>('');

  const refresh = async () => {
    const current = user();
    if (!current || !cryptoWorker) return;
    try {
      const status = await cryptoWorker.getSession({ username: current.profile.username });
      setIsUnlocked(!!status?.isUnlocked);
      setLastActivity(new Date().toLocaleString());
    } catch {}
  };

  onMount(() => { void refresh(); });

  const lockNow = async () => {
    const current = user();
    if (!current || !cryptoWorker) return;
    try {
      await cryptoWorker.clearSession({ username: current.profile.username });
      await refresh();
    } catch {}
  };

  return (
    <div class="space-y-3">
      <h3 class="font-medium text-gray-900 dark:text-white">Session</h3>
      <div class="flex items-center justify-between p-3 rounded border border-gray-200 dark:border-gray-700">
        <div>
          <div class="text-sm text-gray-900 dark:text-white">Status: {isUnlocked() ? 'Unlocked' : 'Locked'}</div>
          <div class="text-xs text-gray-600 dark:text-gray-400">Last check: {lastActivity()}</div>
        </div>
        <div class="flex gap-2">
          <button
            onClick={refresh}
            class="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Refresh
          </button>
          <Show when={isUnlocked()}>
            <button
              onClick={lockNow}
              class="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Lock Now
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SessionsSection;


