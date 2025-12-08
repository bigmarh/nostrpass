import { Component, createSignal, For, Show, onMount, onCleanup, createEffect } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useCryptoWorker, useCryptoWorkerReady, useEnvironment } from '../providers';
import { getVaultFromNostr } from '@nostrpass/nostrHelpers';

/**
 * RecoveryPhraseRestore Component
 *
 * Allows users to restore their account by entering a 12-word recovery phrase.
 * Starts with paste mode, animates header collapse when switching to manual entry.
 */
const RecoveryPhraseRestore: Component = () => {
  const [inputWords, setInputWords] = createSignal<string[]>(Array(12).fill(''));
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [pasteMode, setPasteMode] = createSignal(true); // Start in paste mode
  const [pasteText, setPasteText] = createSignal('');
  const [headerOpacity, setHeaderOpacity] = createSignal(1);
  const [headerHeight, setHeaderHeight] = createSignal('12rem');
  const [headerPadding, setHeaderPadding] = createSignal('2rem');
  const [hasAnimated, setHasAnimated] = createSignal(false);

  const params = useParams();
  const navigate = useNavigate();
  const cryptoReady = useCryptoWorkerReady();
  const cryptoWorker = useCryptoWorker();
  const { getRelays } = useEnvironment();

  let scrollContainerRef: HTMLDivElement | undefined;

  // Initial subtle animation on mount for paste mode
  onMount(() => {
    // Small delay then subtle compact for paste mode
    setTimeout(() => {
      setHeaderOpacity(0.6);
      setHeaderHeight('8rem');
      setHeaderPadding('1rem');
      setHasAnimated(true);
    }, 100);
  });

  // Watch for mode changes and trigger animations
  createEffect(() => {
    if (!hasAnimated()) return; // Don't trigger on initial mount

    if (!pasteMode()) {
      // User clicked "Enter Manually" - full collapse
      setTimeout(() => {
        setHeaderOpacity(0);
        setHeaderHeight('0rem');
        setHeaderPadding('0rem');
      }, 50);
    } else {
      // User clicked "Back to paste mode" - return to compact state
      setTimeout(() => {
        setHeaderOpacity(0.6);
        setHeaderHeight('8rem');
        setHeaderPadding('1rem');
      }, 50);
    }
  });

  const updateWord = (index: number, value: string) => {
    const words = [...inputWords()];
    words[index] = value.trim().toLowerCase();
    setInputWords(words);
    setError('');
  };

  const handlePaste = () => {
    const text = pasteText().trim();
    const words = text.split(/\s+/);

    if (words.length !== 12) {
      setError('Please paste exactly 12 words separated by spaces');
      return;
    }

    setInputWords(words);
    setPasteMode(false);
    setPasteText('');
    setError('');
  };

  const handleRestore = async () => {
    const phrase = inputWords().join(' ').trim();

    if (inputWords().some(w => !w.trim())) {
      setError('Please enter all 12 words');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!cryptoReady() || !cryptoWorker) {
        throw new Error('Crypto module not ready');
      }

      // Validate recovery phrase
      const isValid = await cryptoWorker.validateRecoveryPhrase({ mnemonic: phrase });
      if (!isValid) {
        throw new Error('Invalid recovery phrase. Please check the words and try again.');
      }

      // Convert recovery phrase to xpriv
      const xpriv = await cryptoWorker.recoveryPhraseToXpriv({ mnemonic: phrase });

      // Derive storage keypair from xpriv
      const storageKeypair = await cryptoWorker.deriveStorageKeypairFromXpriv({ xpriv });

      // Query Nostr for vault data
      const relays = getRelays();
      console.log('[RecoveryPhraseRestore] Querying Nostr for vault data...');
      const vaultData = await getVaultFromNostr(
        storageKeypair.publicKey,
        relays,
        storageKeypair.privateKey
      );

      if (!vaultData) {
        throw new Error('No vault found for this recovery phrase. Make sure this is the correct phrase for your account.');
      }

      console.log('[RecoveryPhraseRestore] Vault found! Identities:', vaultData.identities?.length || 0);

      // TODO: Prompt for new PIN and restore account
      // For now, navigate to login with a success message
      navigate(`/${params.app}?restored=true`);

    } catch (err) {
      console.error('[RecoveryPhraseRestore] Restore failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/${params.app}`);
  };

  // Random background index (same as Login)
  const getTimeBasedBackground = () => {
    const timeOfDay = new Date().getHours();
    if (timeOfDay < 6 || timeOfDay > 20) return 3;
    else if (timeOfDay < 15) return 1;
    else if (timeOfDay < 18) return 2;
    else return 0;
  };

  const [backgroundIndex] = createSignal(getTimeBasedBackground());

  return (
    <div class="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <div class="flex w-full h-full bg-white dark:bg-gray-800 flex-col md:flex-row">
        {/* Left panel - Logo (collapses when switching to manual mode) */}
        <div
          style={{
            'background-image': `url('/egg_background_${backgroundIndex()}.png')`,
            'opacity': headerOpacity(),
            'height': headerHeight(),
            'min-height': headerHeight(),
            'padding-top': headerPadding(),
          }}
          class="md:flex flex-col items-center md:rounded-l-lg bg-top bg-cover bg-no-repeat justify-center pb-2 px-4 md:p-4 md:w-48 md:min-w-[12rem] transition-all duration-700 ease-out overflow-hidden md:opacity-100 md:h-auto md:pt-8"
        >
          <div class="w-32 h-32">
            <img class="w-full h-full" src="/logo.svg" alt="NostrPass Logo" />
          </div>
        </div>

        {/* Right panel - Form */}
        <div
          ref={scrollContainerRef}
          class="flex flex-1 flex-col items-center justify-start min-w-0 pt-4 pb-6 px-6 md:p-6 overflow-y-auto"
        >
          <div class="w-full max-w-md space-y-3">
            <div class="text-center">
              <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Restore Account</h1>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enter your 12-word recovery phrase
              </p>
            </div>

            <Show when={error()}>
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-xs">
                {error()}
              </div>
            </Show>

            <Show when={pasteMode()}>
              <div class="space-y-3">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Paste your 12-word recovery phrase
                </label>
                <textarea
                  value={pasteText()}
                  onInput={(e) => setPasteText(e.currentTarget.value)}
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                  class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  rows="3"
                  autofocus
                />
                <div class="flex gap-2">
                  <button
                    onClick={handlePaste}
                    class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    type="button"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => setPasteMode(false)}
                    class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-sm"
                    type="button"
                  >
                    Enter Manually
                  </button>
                </div>
              </div>
            </Show>

            <Show when={!pasteMode()}>
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <For each={inputWords()}>
                    {(word, index) => (
                      <input
                        type="text"
                        value={word}
                        onInput={(e) => updateWord(index(), e.currentTarget.value)}
                        placeholder={`${index() + 1}. word`}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        autocomplete="off"
                        disabled={isLoading()}
                      />
                    )}
                  </For>
                </div>

                <button
                  onClick={() => setPasteMode(true)}
                  class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  type="button"
                >
                  ← Back to paste mode
                </button>
              </div>
            </Show>

            <div class="p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p class="text-xs text-yellow-800 dark:text-yellow-400">
                <strong>Note:</strong> Words are case-insensitive. Enter in order (1-12).
              </p>
            </div>

            <div class="flex gap-2 pt-1">
              <button
                onClick={handleCancel}
                class="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm"
                disabled={isLoading()}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 font-medium text-sm"
                disabled={isLoading()}
                type="button"
              >
                {isLoading() ? 'Restoring...' : 'Restore'}
              </button>
            </div>

            <div class="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p class="text-xs text-blue-800 dark:text-blue-400">
                🔒 Your recovery phrase is never sent to any server. All restoration happens locally.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPhraseRestore;
