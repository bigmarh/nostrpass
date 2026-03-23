import { Component, createSignal, onMount, Show } from 'solid-js';

const generateScrambledPinNumbers = (): string[] => {
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return [...numbers].sort(() => Math.random() - 0.5);
};

import type { PinPadProps } from '../types';

const PinPad: Component<PinPadProps> = (props) => {
  const [currentPin, setCurrentPin] = createSignal('');
  const [scrambledNumbers, setScrambledNumbers] = createSignal<string[]>([]);
  const [isShaking, setIsShaking] = createSignal(false);

  onMount(() => {
    // Generate scrambled numbers on mount
    setScrambledNumbers(generateScrambledPinNumbers());

    // Expose methods for parent components via ref
    if (props.ref) {
      props.ref({
        clearPin,
        shakeAndClear
      });
    }
  });

  const addDigit = (digit: string) => {
    if (currentPin().length >= 6) return;
    
    const newPin = currentPin() + digit;
    setCurrentPin(newPin);
    
    // Call onPinChange if provided
    if (props.onPinChange) props.onPinChange(newPin);
    
    // Call onComplete when PIN is exactly 6 digits
    if (newPin.length === 6) {
      setTimeout(() => {
        if (props.onComplete) {
          props.onComplete(newPin);
        }
      }, 500);
    }
  };

  const removeDigit = () => {
    if (props.disabled || currentPin().length === 0) return;

    const newPin = currentPin().slice(0, -1);
    setCurrentPin(newPin);
    
    if (props.onPinChange) props.onPinChange(newPin);
  };

  const clearPin = () => {
    setCurrentPin('');
    
    if (props.onPinChange) props.onPinChange('');
  };

  const shakeAndClear = () => {
    console.log('[PinPad] shakeAndClear called, current PIN length:', currentPin().length);
    setIsShaking(true);
    setTimeout(() => {
      console.log('[PinPad] Clearing PIN after shake animation');
      setIsShaking(false);
      clearPin();
    }, 500);
  };


  return (
    <div class="w-full flex flex-col items-center" data-testid="pin-pad">
      {/* PIN Display - Dark pill background */}
      <div class="bg-gray-700 dark:bg-gray-200 px-4 py-2.5 rounded-full mb-4">
        <div class={`flex justify-center gap-2.5 ${isShaking() ? 'shake-animation' : ''}`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div class={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${index < currentPin().length
              ? 'bg-white dark:bg-gray-900 scale-125'
              : 'bg-gray-500 dark:bg-gray-400'
              }`} />
          ))}
        </div>
      </div>

      {/* PIN Pad - Compact layout with white buttons */}
      <div class="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto">
        {scrambledNumbers().map((num) => (
          <button
            class="aspect-square bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl text-lg font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            onClick={() => addDigit(num)}
            disabled={currentPin().length >= 6}
          >
            {num}
          </button>
        ))}

        {/* Backspace button spans 2 columns */}
        <button
          class="col-span-2 aspect-[2/1] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          onClick={removeDigit}
          disabled={props.disabled}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
          Delete
        </button>

        {/* Empty cell for 3x4 grid layout */}
        <div />
      </div>
    </div>
  );
};

export default PinPad;