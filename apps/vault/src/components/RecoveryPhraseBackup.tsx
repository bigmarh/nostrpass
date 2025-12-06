import { Component, createSignal, Show, onMount } from 'solid-js';
import { useCryptoWorker } from '../providers';

interface RecoveryPhraseBackupProps {
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * RecoveryPhraseBackup Component
 *
 * Displays a 12-word recovery phrase for the user to write down.
 * Compact design to fit in modal with tabbed interface.
 */
const RecoveryPhraseBackup: Component<RecoveryPhraseBackupProps> = (props) => {
  const [recoveryPhrase, setRecoveryPhrase] = createSignal<string[]>([]);
  const [confirmed, setConfirmed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(true);

  const cryptoWorker = useCryptoWorker();

  // Generate recovery phrase on mount
  onMount(async () => {
    try {
      if (!cryptoWorker) {
        throw new Error('Crypto worker not initialized');
      }

      // Generate new recovery phrase
      const result = await cryptoWorker.generateRecoveryPhrase();
      const words = result.mnemonic.split(' ');
      setRecoveryPhrase(words);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recovery phrase');
    } finally {
      setIsLoading(false);
    }
  });

  const handleCopyToClipboard = async () => {
    try {
      const phrase = recoveryPhrase().join(' ');
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleComplete = () => {
    if (!confirmed()) {
      setError('Please confirm that you have saved your recovery phrase');
      return;
    }
    props.onComplete();
  };

  return (
    <div class="w-full max-w-lg mx-auto p-6 bg-white dark:bg-gray-900">
      <div class="text-center mb-4">
        <h2 class="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Backup Recovery Phrase</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Write down these 12 words to restore your account
        </p>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-xs mb-4">
          {error()}
        </div>
      </Show>

      <Show when={isLoading()}>
        <div class="flex items-center justify-center p-8">
          <div class="text-sm text-gray-600 dark:text-gray-400">Generating...</div>
        </div>
      </Show>

      <Show when={!isLoading()}>
        <div class="space-y-4">
          {/* Recovery Phrase Display */}
          <div class="bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <p class="text-base font-mono leading-relaxed text-gray-900 dark:text-gray-100 mb-3 break-words">
              {recoveryPhrase().join(' ')}
            </p>
            <button
              onClick={handleCopyToClipboard}
              class="w-full px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              {copied() ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          </div>

          {/* Security Warning */}
          <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p class="text-xs text-yellow-800 dark:text-yellow-400">
              <strong>⚠️ Security:</strong> Never share these words. Write them on paper and store safely offline.
            </p>
          </div>

          {/* Confirmation */}
          <label class="flex items-start gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={confirmed()}
              onChange={(e) => setConfirmed(e.currentTarget.checked)}
              class="mt-0.5 accent-blue-600 dark:accent-blue-400"
            />
            <span class="text-xs text-gray-900 dark:text-gray-100">
              I've saved my recovery phrase and understand I need it to restore my account.
            </span>
          </label>

          {/* Actions */}
          <div class="flex gap-2">
            <button
              onClick={props.onSkip}
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm"
            >
              Skip
            </button>
            <button
              onClick={handleComplete}
              disabled={!confirmed()}
              class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RecoveryPhraseBackup;
