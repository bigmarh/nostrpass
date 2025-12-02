import { Component, createSignal, Show } from 'solid-js';
import PinPad from './PinPad';
import SecurityQuestionsSetup from './SecurityQuestionsSetup';
import type { PinSetupProps } from '../types';

const PinSetup: Component<PinSetupProps> = (props) => {
  const [step, setStep] = createSignal<'enter' | 'confirm' | 'recovery'>('enter');
  const [firstPin, setFirstPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [recoveryData, setRecoveryData] = createSignal<{questions: string[], answers: string[]} | null>(null);
  
  let pinPadRef: any;

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
    // Clear the pin pad for confirmation
    setTimeout(() => {
      if (pinPadRef) {
        pinPadRef.clearPin();
      }
    }, 100);
  };

  const handleConfirmPin = (pin: string) => {
    if (pin === firstPin()) {
      // PINs match
      if (props.skipRecovery) {
        // Skip recovery setup and complete immediately
        props.onPinSet(firstPin());
      } else {
        // Proceed to recovery setup
        setStep('recovery');
      }
    } else {
      // PINs don't match
      setError('PINs do not match. Please try again.');
      if (pinPadRef) {
        pinPadRef.shakeAndClear();
      }
      // Reset to first step after delay
      setTimeout(() => {
        setStep('enter');
        setFirstPin('');
        setError('');
      }, 1500);
    }
  };

  const handleRecoveryComplete = (questions: string[], answers: string[]) => {
    
    setRecoveryData({ questions, answers });
    // Complete PIN setup with recovery data
    if (props.onPinSetWithRecovery) {
      props.onPinSetWithRecovery(firstPin(), questions, answers);
    } else {
      props.onPinSet(firstPin());
    }
  };

  const handleRecoverySkip = () => {
    // Complete PIN setup without recovery
    props.onPinSet(firstPin());
  };

  const handleBack = () => {
    setStep('enter');
    setFirstPin('');
    setError('');
    if (pinPadRef) {
      pinPadRef.clearPin();
    }
  };

  return (
    <div class="flex flex-col items-center justify-center p-4 md:p-8 w-full md:min-w-[400px] bg-white dark:bg-gray-900 transition-all duration-300">
      <Show when={step() !== 'recovery'}>
        <div class="text-center mb-8 transition-all duration-300">
          <h2 class="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100 transition-colors">
            {step() === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
          </h2>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {step() === 'enter' 
              ? 'This PIN will protect your vault keys' 
              : 'Enter your PIN again to confirm'}
          </p>
          {/* Visual feedback for PIN length */}
          <Show when={step() === 'enter' && firstPin().length > 0}>
            <div class="mt-3 flex justify-center gap-1">
              <For each={Array.from({ length: 6 })}>
                {(_, i) => (
                  <div class={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    i() < firstPin().length 
                      ? 'bg-blue-600 dark:bg-blue-400 scale-125' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={error()}>
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4 max-w-md text-center animate-pulse">
            {error()}
          </div>
        </Show>

        <PinPad
          onComplete={step() === 'enter' ? handleFirstPin : handleConfirmPin}
          ref={(ref) => { pinPadRef = ref; }}
        />

        <div class="mt-6 space-y-2 text-center flex flex-col gap-3">
          <Show when={step() === 'confirm'}>
            <button
              onClick={handleBack}
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium"
            >
              ← Back to enter New PIN
            </button>
          </Show>
          <Show when={props.onCancel}>
            <button
              onClick={props.onCancel}
              class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </Show>
        </div>
      </Show>

      <Show when={step() === 'recovery'}>
        <SecurityQuestionsSetup
          onComplete={handleRecoveryComplete}
          onSkip={handleRecoverySkip}
        />
      </Show>
    </div>
  );
};

export default PinSetup;