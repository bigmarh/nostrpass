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
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      clearPin();
    }, 500);
  };


  return (
    <div class="w-full flex flex-col items-center">
      {/* PIN Display - Clerk style */}
      <div class={`flex justify-center gap-1.5 mb-4 ${isShaking() ? 'shake-animation' : ''}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div class={`w-2 h-2 rounded-full transition-all duration-200 ${index < currentPin().length
            ? 'bg-gray-900 dark:bg-gray-100 scale-110'
            : 'bg-gray-300 dark:bg-gray-600'
            }`} />
        ))}
      </div>

      {/* PIN Pad - Fits perfectly in 395x395 */}
      <div class="grid grid-cols-3 gap-1.5 w-full max-w-[240px] mx-auto">
        {scrambledNumbers().map((num) => (
          <button
            class="aspect-square border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md text-base font-semibold cursor-pointer transition-all flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            onClick={() => addDigit(num)}
            disabled={currentPin().length >= 6}
          >
            {num}
          </button>
        ))}

        {/* Backspace button spans 2 columns */}
        <button
          class="col-span-2 aspect-[2/1] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md text-xs font-medium cursor-pointer transition-all flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          onClick={removeDigit}
          disabled={props.disabled}
        >
          ← Delete
        </button>

        {/* Empty cell for 3x4 grid layout */}
        <div />
      </div>
    </div>
  );
};

export default PinPad;