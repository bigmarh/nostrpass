import { Component, createSignal } from 'solid-js';

interface UnlockProps {
  onUnlock: () => void;
}

const Unlock: Component<UnlockProps> = (props) => {
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!pin() || loading()) return;

    setLoading(true);
    setError('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'unlock',
        data: { pin: pin() },
      });

      if (response?.success) {
        props.onUnlock();
      } else {
        setError(response?.error || 'Invalid PIN');
        setPin('');
      }
    } catch (err) {
      setError('Failed to unlock');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin().length < 6) {
      setPin(pin() + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin().slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div class="flex h-[500px] flex-col bg-gradient-to-b from-purple-600 to-purple-800">
      {/* Header */}
      <div class="px-4 pt-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <span class="text-3xl">🔐</span>
        </div>
        <h1 class="text-xl font-bold text-white">Unlock NostrPass</h1>
        <p class="mt-2 text-sm text-white/70">Enter your PIN to continue</p>
      </div>

      {/* PIN Display */}
      <div class="mt-8 flex justify-center gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            class={`h-3 w-3 rounded-full transition-all ${
              i < pin().length ? 'bg-white scale-110' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error() && (
        <div class="mt-4 px-4 text-center text-sm text-red-300">{error()}</div>
      )}

      {/* PIN Pad */}
      <div class="mt-auto px-8 pb-8">
        <form onSubmit={handleSubmit}>
          <div class="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                type="button"
                onClick={() => handlePinInput(digit)}
                class="flex h-14 items-center justify-center rounded-xl bg-white/10 text-xl font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              class="flex h-14 items-center justify-center rounded-xl bg-white/10 text-sm text-white/70 transition-all hover:bg-white/20"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinInput('0')}
              class="flex h-14 items-center justify-center rounded-xl bg-white/10 text-xl font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              class="flex h-14 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-all hover:bg-white/20"
            >
              ⌫
            </button>
          </div>

          {/* Submit button (auto-submit when 6 digits) */}
          {pin().length === 6 && (
            <button
              type="submit"
              disabled={loading()}
              class="mt-4 w-full rounded-xl bg-white py-3 font-semibold text-purple-700 transition-all hover:bg-white/90 disabled:opacity-50"
            >
              {loading() ? 'Unlocking...' : 'Unlock'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Unlock;
