import { Component, createSignal, For, Show } from 'solid-js';
import type { VaultData } from '../workers/db';
import { useCryptoWorker } from '../providers';

interface PINRecoveryProps {
  vaultData: VaultData;
  onSuccess: (sessionToken: string) => void;
  onCancel: () => void;
}

const PINRecovery: Component<PINRecoveryProps> = (props) => {
  const [answers, setAnswers] = createSignal<Record<number, string>>({});
  const [error, setError] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [attempts, setAttempts] = createSignal(0);
  const maxAttempts = 5;
  const cryptoWorker = useCryptoWorker();

  const updateAnswer = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
    setError('');
  };

  const handleRecover = async () => {
    const recovery = props.vaultData.recovery;
    
    if (!recovery) {
      setError('No recovery data found');
      return;
    }

    // Check all questions answered
    const allAnswered = recovery.questions.every((_, i) => answers()[i]?.trim());
    if (!allAnswered) {
      setError('Please answer all questions');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get ordered answers - NEED TO TRIM AND REMOVE QUOTES!
      const orderedAnswers = recovery.questions.map((_, i) => 
        answers()[i]
          .trim()
          .replace(/^["']|["']$/g, '') // Remove quotes from start/end
          .trim() // Trim again after removing quotes
      );

      // Check if crypto worker is available
      if (!cryptoWorker) {
        throw new Error('Crypto worker not initialized');
      }

      
      // Start recovery session in worker
      const result = await cryptoWorker.startPinRecovery({
        username: props.vaultData.username || '',
        answers: orderedAnswers,
        vaultData: props.vaultData
      });

      if (result.success && result.sessionToken) {
        // Success!
        props.onSuccess(result.sessionToken);
      } else {
        // Wrong answers
        const newAttempts = attempts() + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= maxAttempts) {
          setError(`Maximum attempts (${maxAttempts}) reached. Please try again later.`);
        } else {
          setError(`Incorrect answers. ${maxAttempts - newAttempts} attempts remaining.`);
        }
      }
    } catch (error) {
      setError('Recovery failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const recovery = props.vaultData.recovery;
  if (!recovery) {
    return (
      <div class="p-6 text-center bg-white dark:bg-gray-900">
        <p class="text-red-600 dark:text-red-400">No recovery questions set up for this account.</p>
        <button
          onClick={props.onCancel}
          class="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div class="max-w-md mx-auto p-6 bg-white dark:bg-gray-900">
      <div class="mb-6">
        <h2 class="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Recover PIN Access</h2>
        <p class="text-gray-600 dark:text-gray-400">
          Answer your security questions to reset your PIN.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Answers are case-insensitive.
        </p>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4">
          {error()}
        </div>
      </Show>

      <Show when={attempts() > 0 && attempts() < maxAttempts}>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-2 rounded-md text-sm mb-4">
          Attempt {attempts()} of {maxAttempts}
        </div>
      </Show>

      <div class="space-y-4 mb-6">
        <For each={recovery.questions}>
          {(question, index) => (
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {question}
              </label>
              <input
                type="text"
                value={answers()[index()] || ''}
                onInput={(e) => updateAnswer(index(), e.currentTarget.value)}
                placeholder="Your answer"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                autocomplete="off"
                disabled={isLoading() || attempts() >= maxAttempts}
              />
            </div>
          )}
        </For>
      </div>

      <div class="flex gap-3">
        <button
          onClick={handleRecover}
          disabled={isLoading() || attempts() >= maxAttempts}
          class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading() ? 'Recovering...' : 'Recover Access'}
        </button>
        <button
          onClick={props.onCancel}
          disabled={isLoading()}
          class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PINRecovery;