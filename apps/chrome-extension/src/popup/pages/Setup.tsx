import { Component, createSignal } from 'solid-js';
import { generateXpriv, encryptData, getPublicKey, deriveKeypairFromXpriv } from '@/background/crypto';

interface SetupProps {
  onComplete: () => void;
}

const Setup: Component<SetupProps> = (props) => {
  const [step, setStep] = createSignal<'welcome' | 'create-pin' | 'confirm-pin'>('welcome');
  const [pin, setPin] = createSignal('');
  const [confirmPin, setConfirmPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handlePinInput = (digit: string, isConfirm = false) => {
    const currentPin = isConfirm ? confirmPin() : pin();
    if (currentPin.length < 6) {
      if (isConfirm) {
        setConfirmPin(currentPin + digit);
      } else {
        setPin(currentPin + digit);
      }
      setError('');
    }
  };

  const handleBackspace = (isConfirm = false) => {
    if (isConfirm) {
      setConfirmPin(confirmPin().slice(0, -1));
    } else {
      setPin(pin().slice(0, -1));
    }
    setError('');
  };

  const handleCreatePin = () => {
    if (pin().length === 6) {
      setStep('confirm-pin');
    }
  };

  const handleConfirmPin = async () => {
    if (confirmPin() !== pin()) {
      setError('PINs do not match');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      // Generate new vault
      const xpriv = generateXpriv();
      const xprivEncrypted = encryptData(xpriv, pin());

      // Derive first identity
      const firstIdentity = deriveKeypairFromXpriv(xpriv, 0);

      // Create vault data
      const vaultData = {
        xprivEncrypted,
        salt: '', // Salt is embedded in encrypted data
        storagePublicKey: firstIdentity.publicKey,
        identities: [{
          publicKey: firstIdentity.publicKey,
          nickname: 'Default',
          derivationPath: firstIdentity.path,
        }],
        version: 1,
        updatedAt: Date.now(),
      };

      // Save to storage
      await chrome.storage.local.set({ vaultData });

      // Auto-unlock
      await chrome.runtime.sendMessage({
        type: 'unlock',
        data: { pin: pin() },
      });

      props.onComplete();
    } catch (err) {
      setError('Failed to create vault');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const PinPad = (props: { value: string; isConfirm?: boolean; onComplete: () => void }) => (
    <div class="px-8">
      {/* PIN Display */}
      <div class="mb-6 flex justify-center gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            class={`h-3 w-3 rounded-full transition-all ${
              i < props.value.length ? 'bg-purple-600 scale-110' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error() && (
        <div class="mb-4 text-center text-sm text-red-500">{error()}</div>
      )}

      {/* Keypad */}
      <div class="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            type="button"
            onClick={() => handlePinInput(digit, props.isConfirm)}
            class="flex h-14 items-center justify-center rounded-xl bg-gray-100 text-xl font-semibold text-gray-800 transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-white"
          >
            {digit}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => handlePinInput('0', props.isConfirm)}
          class="flex h-14 items-center justify-center rounded-xl bg-gray-100 text-xl font-semibold text-gray-800 transition-all hover:bg-gray-200 active:scale-95 dark:bg-gray-700 dark:text-white"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleBackspace(props.isConfirm)}
          class="flex h-14 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-all hover:bg-gray-200 dark:bg-gray-700"
        >
          ⌫
        </button>
      </div>

      {/* Continue button */}
      {props.value.length === 6 && (
        <button
          onClick={props.onComplete}
          disabled={loading()}
          class="mt-6 w-full rounded-xl bg-purple-600 py-3 font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
        >
          {loading() ? 'Creating...' : 'Continue'}
        </button>
      )}
    </div>
  );

  return (
    <div class="flex h-[500px] flex-col bg-white dark:bg-gray-900">
      {/* Welcome */}
      {step() === 'welcome' && (
        <div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
            <span class="text-4xl">🔐</span>
          </div>
          <h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Welcome to NostrPass
          </h1>
          <p class="mb-8 text-gray-500 dark:text-gray-400">
            Secure Nostr identity management with NIP-07 support
          </p>
          <button
            onClick={() => setStep('create-pin')}
            class="w-full rounded-xl bg-purple-600 py-3 font-semibold text-white transition-all hover:bg-purple-700"
          >
            Create New Vault
          </button>
          <button class="mt-3 w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            Import Existing
          </button>
        </div>
      )}

      {/* Create PIN */}
      {step() === 'create-pin' && (
        <div class="flex flex-1 flex-col pt-8">
          <div class="mb-8 text-center">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              Create a PIN
            </h2>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This PIN will be used to unlock your vault
            </p>
          </div>
          <PinPad value={pin()} onComplete={handleCreatePin} />
        </div>
      )}

      {/* Confirm PIN */}
      {step() === 'confirm-pin' && (
        <div class="flex flex-1 flex-col pt-8">
          <div class="mb-8 text-center">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              Confirm PIN
            </h2>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter your PIN again to confirm
            </p>
          </div>
          <PinPad value={confirmPin()} isConfirm onComplete={handleConfirmPin} />
        </div>
      )}
    </div>
  );
};

export default Setup;
