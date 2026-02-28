import { Show } from 'solid-js';
import { PinPad } from '../components/PinPad';
import { Spinner } from '../components/Spinner';

interface PinScreenProps {
  identifier: string | undefined;
  onUnlock: (pin: string) => void;
  onLock: () => void;
  isBusy: boolean;
  onShakeRequest?: (shaker: () => void) => void;
}

export function PinScreen(props: PinScreenProps) {
  const handlePinComplete = (pin: string) => {
    props.onUnlock(pin);
  };

  return (
    <div class="flex flex-col">
      {/* Hero */}
      <div class="flex flex-col items-center text-center px-8 pt-8 pb-6">
        <div class="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-5">
          <img src="/logo.svg" class="w-9 h-9" alt="NostrPass" />
        </div>
        <h2 class="text-xl font-bold text-gray-900">Enter your PIN</h2>
        <p class="text-sm text-gray-500 mt-1">
          {props.identifier ? `Unlock vault for ${props.identifier}` : 'Unlock your vault to continue'}
        </p>
      </div>

      {/* Body */}
      <div class="px-8 pb-8 flex flex-col items-center gap-6">
        <Show
          when={!props.isBusy}
          fallback={
            <div class="flex flex-col items-center gap-3 py-8">
              <Spinner size="w-8 h-8" color="border-gray-900" />
              <p class="text-sm text-gray-500">Unlocking vault…</p>
            </div>
          }
        >
          <PinPad
            onComplete={handlePinComplete}
            onShakeRequest={props.onShakeRequest}
          />
        </Show>

        <button
          type="button"
          class="w-full py-2.5 px-4 bg-transparent border border-gray-200 hover:bg-gray-50 text-gray-500 font-medium text-sm rounded-xl transition-colors"
          onClick={props.onLock}
          disabled={props.isBusy}
        >
          Use a different account
        </button>
      </div>
    </div>
  );
}
