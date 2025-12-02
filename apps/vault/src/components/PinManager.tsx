import { Component, Show, createSignal, createEffect } from 'solid-js';
import type { VaultData } from '@nostrpass/nostrHelpers';
import { useCryptoWorker } from '../providers';
import PinPad from './PinPad';
import PINRecovery from './PINRecovery';
import PinSetup from './PinSetup';
import { useNavigate, useParams } from '@solidjs/router';

export interface PinManagerProps {
  isVaultLocked: boolean;
  vaultData: VaultData | null;
  onUnlock: (pin: string) => Promise<boolean>;
  onLock: () => Promise<void>;
  username: string;
}

export const PinManager: Component<PinManagerProps> = (props) => {
  const cryptoWorker = useCryptoWorker();
  const navigate = useNavigate();
  const params = useParams();

  // Internal state signals
  const [showPinUnlock, setShowPinUnlock] = createSignal(false);

  // Automatically show PIN unlock when vault becomes locked
  createEffect(() => {
    if (props.isVaultLocked && props.username) {
      console.log('[PinManager] Vault is locked, showing PIN unlock modal');
      setShowPinUnlock(true);
    }
  });
  const [pinUnlockError, setPinUnlockError] = createSignal('');
  const [isUnlocking, setIsUnlocking] = createSignal(false);
  const [showRecovery, setShowRecovery] = createSignal(false);
  const [showPinReset, setShowPinReset] = createSignal(false);
  const [recoverySessionToken, setRecoverySessionToken] = createSignal<string | null>(null);
  const [tempNewPin, setTempNewPin] = createSignal<string>('');
  const [showPasswordPrompt, setShowPasswordPrompt] = createSignal(false);
  const [passwordForReset, setPasswordForReset] = createSignal('');

  // Handle PIN unlock
  const handlePinUnlock = async (pin: string) => {
    setIsUnlocking(true);
    setPinUnlockError('');

    try {
      const success = await props.onUnlock(pin);
      if (success) {
        setShowPinUnlock(false);
        // Reset recovery flow state
        setShowRecovery(false);
        setShowPinReset(false);
        setRecoverySessionToken(null);
        setPasswordForReset('');
        setShowPasswordPrompt(false);
        setTempNewPin('');
      } else {
        setPinUnlockError('Incorrect PIN. Please try again.');
      }
    } catch (error) {
      // Check if the error indicates we need to login again
      if (error instanceof Error && error.message.includes('login with password')) {
        setPinUnlockError('Session expired. Please login with your password.');
        // Close the PIN modal and redirect to login
        setTimeout(() => {
          setShowPinUnlock(false);
          navigate(`/${params.app}/login`);
        }, 2000);
      } else {
        setPinUnlockError('Failed to unlock vault. Please try again.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle password verification for PIN reset
  const handlePasswordVerification = async () => {
    if (!cryptoWorker || !recoverySessionToken() || !tempNewPin() || !passwordForReset()) {
      return;
    }

    setIsUnlocking(true);
    setPinUnlockError('');

    try {
      // Complete PIN reset in worker
      const result = await cryptoWorker.completePinReset({
        sessionToken: recoverySessionToken()!,
        newPin: tempNewPin(),
        password: passwordForReset()
      });

      if (result.success) {
        // Success! Unlock with new PIN
        await handlePinUnlock(tempNewPin());

        // Reset the recovery flow state
        setShowRecovery(false);
        setShowPinReset(false);
        setRecoverySessionToken(null);
        setPasswordForReset('');
        setShowPasswordPrompt(false);
      } else {
        throw new Error('Failed to reset PIN');
      }
    } catch (err) {
      setPinUnlockError(err instanceof Error ? err.message : 'Failed to reset PIN');
    } finally {
      setIsUnlocking(false);
      setPasswordForReset('');
    }
  };

  // Public method to show unlock modal
  const showUnlockModal = () => {
    setShowPinUnlock(true);
    setPinUnlockError('');
  };

  // Public method to hide unlock modal
  const hideUnlockModal = () => {
    setShowPinUnlock(false);
    setPinUnlockError('');
    setShowRecovery(false);
    setShowPinReset(false);
    setRecoverySessionToken(null);
    setPasswordForReset('');
    setShowPasswordPrompt(false);
    setTempNewPin('');
  };

  // Handle cancel action
  const handleCancel = () => {
    hideUnlockModal();
  };

  // Expose methods via props if needed (optional pattern)
  // This allows parent components to trigger the modal programmatically
  if (typeof (props as any).ref === 'function') {
    (props as any).ref({ showUnlockModal, hideUnlockModal });
  }

  return (
    <>
      {/* PIN Unlock Modal */}
      <Show when={showPinUnlock()}>
        <div class="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50 p-0 rounded-[16px] overflow-hidden">
          <div class="bg-white dark:bg-gray-800 px-6 py-8 text-center relative w-full h-full flex flex-col justify-center">
            <Show when={!showRecovery() && !showPinReset()}>
              {/* Header */}
              <div class="text-center mb-7">
                <h2 class="text-lg font-semibold mb-1.5 text-gray-900 dark:text-gray-100">Unlock Vault</h2>
                <p class="text-gray-600 dark:text-gray-400">Enter your PIN to unlock your vault</p>
              </div>

              {/* PIN Entry */}
              <div class="mb-6">
                <PinPad
                  onComplete={handlePinUnlock}
                  disabled={isUnlocking()}
                />
              </div>

              {/* Error Message */}
              <Show when={pinUnlockError()}>
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4">
                  {pinUnlockError()}
                </div>
              </Show>

              {/* Action Buttons */}
              <div class="space-y-2 text-center">
                <button
                  onClick={() => setShowRecovery(true)}
                  class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors block w-full"
                  disabled={isUnlocking()}
                >
                  Forgot PIN?
                </button>
                <button
                  onClick={handleCancel}
                  class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  disabled={isUnlocking()}
                >
                  Cancel
                </button>
              </div>
            </Show>

            <Show when={showRecovery() && props.vaultData}>
              <PINRecovery
                vaultData={props.vaultData!}
                onSuccess={(sessionToken: string) => {
                  setRecoverySessionToken(sessionToken);
                  setShowRecovery(false);
                  setShowPinReset(true);
                }}
                onCancel={() => setShowRecovery(false)}
              />
            </Show>

            <Show when={showPinReset()}>
              <div class="space-y-4">
                <PinSetup
                  skipRecovery={true}
                  onPinSet={async (newPin) => {
                    setTempNewPin(newPin);
                    setShowPasswordPrompt(true);
                  }}
                  onCancel={() => {
                    setShowPinReset(false);
                    setRecoverySessionToken(null);
                  }}
                />

                <Show when={showPasswordPrompt()}>
                  <div class="mt-4 p-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Verify Your Password</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Please enter your password to complete the PIN reset.
                    </p>
                    <input
                      type="password"
                      placeholder="Password"
                      value={passwordForReset()}
                      onInput={(e) => setPasswordForReset(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handlePasswordVerification();
                      }}
                    />
                    <div class="flex gap-2">
                      <button
                        onClick={handlePasswordVerification}
                        disabled={!passwordForReset() || isUnlocking()}
                        class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors font-medium"
                      >
                        {isUnlocking() ? 'Resetting PIN...' : 'Complete Reset'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordPrompt(false);
                          setPasswordForReset('');
                        }}
                        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </>
  );
};

// Export helper functions for external use
export const createPinManager = () => {
  let showUnlockModal: (() => void) | undefined;
  let hideUnlockModal: (() => void) | undefined;

  const setRef = (ref: { showUnlockModal: () => void; hideUnlockModal: () => void }) => {
    showUnlockModal = ref.showUnlockModal;
    hideUnlockModal = ref.hideUnlockModal;
  };

  return {
    showUnlockModal: () => showUnlockModal?.(),
    hideUnlockModal: () => hideUnlockModal?.(),
    setRef
  };
};

export default PinManager;
