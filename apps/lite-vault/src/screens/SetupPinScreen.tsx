import { Show } from 'solid-js';
import { PinPad } from '../components/PinPad';
import { Spinner } from '../components/Spinner';

interface SetupPinScreenProps {
  identifier: string;
  onComplete: (pin: string) => void;
  onBack: () => void;
  isBusy: boolean;
  notice?: string;
}

export function SetupPinScreen(props: SetupPinScreenProps) {
  return (
    <div class="flex flex-col">
      {/* Hero */}
      <div class="flex flex-col items-center text-center px-8 pt-8 pb-6">
        <div class="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-5">
          <img src="/logo.svg" class="w-9 h-9" alt="NostrPass" />
        </div>
        <h2 class="text-xl font-bold text-gray-900">Create your PIN</h2>
        <p class="text-sm text-gray-500 mt-1">
          Used to unlock your vault as <strong class="text-gray-700">{props.identifier}</strong>
        </p>
      </div>

      {/* Notice banner */}
      <Show when={props.notice}>
        <div class="mx-6 mb-2 flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm">
          <svg class="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <span>{props.notice}</span>
        </div>
      </Show>

      {/* Body */}
      <div class="px-8 pb-8 flex flex-col items-center gap-6">
        <Show
          when={!props.isBusy}
          fallback={
            <div class="flex flex-col items-center gap-3 py-8">
              <Spinner size="w-8 h-8" color="border-gray-900" />
              <p class="text-sm text-gray-500">Creating your vault…</p>
            </div>
          }
        >
          <PinPad onComplete={props.onComplete} />
        </Show>

        <button
          type="button"
          class="w-full py-2.5 px-4 bg-transparent border border-gray-200 hover:bg-gray-50 text-gray-500 font-medium text-sm rounded-xl transition-colors"
          onClick={props.onBack}
          disabled={props.isBusy}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
