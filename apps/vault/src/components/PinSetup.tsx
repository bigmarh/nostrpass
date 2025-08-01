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
    console.log('🔄 PinSetup handleRecoveryComplete received:');
    console.log('Questions:', questions);
    console.log('Answers:', answers);
    answers.forEach((answer, index) => {
        console.log(`PinSetup Answer ${index}:`, answer);
        console.log(`PinSetup Answer ${index} JSON:`, JSON.stringify(answer));
    });
    
    setRecoveryData({ questions, answers });
    // Complete PIN setup with recovery data
    if (props.onPinSetWithRecovery) {
      console.log('🔄 Calling onPinSetWithRecovery with PIN:', firstPin());
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
    <div class="flex flex-col items-center justify-center p-4 md:p-8 w-full md:min-w-[400px]">
      <Show when={step() !== 'recovery'}>
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold mb-2">
            {step() === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
          </h2>
          <p class="text-gray-600 text-sm">
            {step() === 'enter' 
              ? 'This PIN will protect your vault keys' 
              : 'Enter your PIN again to confirm'}
          </p>
        </div>

        <Show when={error()}>
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm mb-4 max-w-md text-center">
            {error()}
          </div>
        </Show>

        <PinPad
          onComplete={step() === 'enter' ? handleFirstPin : handleConfirmPin}
          ref={(ref) => { pinPadRef = ref; }}
        />

        <div class="mt-2 space-y-2 text-center flex flex-col gap-2">
          <Show when={step() === 'confirm'}>
            <button
              onClick={handleBack}
              class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Back to enter New PIN
            </button>
          </Show>
          <Show when={props.onCancel}>
            <button
              onClick={props.onCancel}
              class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
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