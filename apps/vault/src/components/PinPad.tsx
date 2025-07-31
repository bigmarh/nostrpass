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
    if (newPin.length === 6 && props.onComplete) {
      props.onComplete(newPin);
    }
  };

  const removeDigit = () => {
    if (props.disabled || currentPin().length === 0) return;

    const newPin = currentPin().slice(0, -1);
    setCurrentPin(newPin);
    
    // Call both onChange and onPinChange for compatibility
    if (props.onChange) props.onChange(newPin);
    if (props.onPinChange) props.onPinChange(newPin);
  };

  const clearPin = () => {
    setCurrentPin('');
    
    // Call both onChange and onPinChange for compatibility
    if (props.onChange) props.onChange('');
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
    <div class="my-8">
      {/* PIN Display */}
      <div class={`flex justify-center gap-3 mb-6 ${isShaking() ? 'shake-animation' : ''}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div class={`w-4 h-4 rounded-full border-2 transition-all duration-400 ${index < currentPin().length
            ? 'bg-gray-900 border-gray-900'
            : 'bg-gray-200 border-gray-300'
            }`} />
        ))}
      </div>

      {/* PIN Pad */}
      <div class="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">

        {scrambledNumbers().map((num) => (
          <button
            class="w-16 h-16 border border-gray-300 bg-white text-gray-900 rounded-default text-lg font-semibold cursor-pointer transition-all duration-150 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-px active:translate-y-0 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => addDigit(num)}
            disabled={currentPin().length >= 6}
          >
            {num}
          </button>
          ))}
        

        {/* Backspace button spans 2 columns */}
        <button
          class="col-span-2 w-full h-16 border border-gray-300 bg-white text-gray-900 rounded-default text-base font-medium cursor-pointer transition-all duration-150 flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-px active:translate-y-0 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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