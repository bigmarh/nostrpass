import { Component, createSignal, Show } from 'solid-js';
import PinPad from './PinPad';
import type { PinVerificationProps } from '../types';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const PinVerification: Component<PinVerificationProps> = (props) => {
  const [attempts, setAttempts] = createSignal(0);
  const [error, setError] = createSignal('');
  
  let pinPadRef: any;

  const hashPin = (pin: string): string => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = sha256(data);
    return bytesToHex(hash);
  };

  const handlePinComplete = (pin: string) => {
    // Hash the entered PIN
    const pinHash = hashPin(pin);
    
    // For now, if no expected hash is provided, just call onSuccess
    // In production, you'd compare against stored hash
    if (!props.expectedPinHash || pinHash === props.expectedPinHash) {
      props.onSuccess(pin);
    } else {
      // Wrong PIN
      const newAttempts = attempts() + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setError('Too many failed attempts. Please try logging in again.');
        if (props.onFailed) {
          props.onFailed();
        }
      } else {
        setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
        if (pinPadRef) {
          pinPadRef.shakeAndClear();
        }
      }
      
      // Clear error after delay
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  return (
    <div class="w-full mx-auto">
      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-md text-[10px] mb-1 text-center">
          {error()}
        </div>
      </Show>

      <PinPad
        onComplete={handlePinComplete}
        disabled={attempts() >= 3}
        ref={(ref) => { pinPadRef = ref; }}
      />
    </div>
  );
};

export default PinVerification;