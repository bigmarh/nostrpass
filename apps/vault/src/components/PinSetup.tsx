import { Component, createSignal, Show } from 'solid-js';
import PinPad from './PinPad';
import type { PinSetupProps } from '../types';

const PinSetup: Component<PinSetupProps> = (props) => {
  const [step, setStep] = createSignal<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = createSignal('');
  const [error, setError] = createSignal('');
  
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
      // PINs match, proceed
      props.onPinSet(pin);
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

  const handleBack = () => {
    setStep('enter');
    setFirstPin('');
    setError('');
    if (pinPadRef) {
      pinPadRef.clearPin();
    }
  };

  return (
    <div class="w-full max-w-md mx-auto p-6">
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
        <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mb-4 text-center">
          {error()}
        </div>
      </Show>

      <PinPad
        onComplete={step() === 'enter' ? handleFirstPin : handleConfirmPin}
        ref={(ref) => { pinPadRef = ref; }}
      />

      <div class="flex gap-3 mt-6">
        <Show when={step() === 'confirm'}>
          <button
            onClick={handleBack}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </Show>
        <Show when={props.onCancel}>
          <button
            onClick={props.onCancel}
            class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </Show>
      </div>
    </div>
  );
};

export default PinSetup;