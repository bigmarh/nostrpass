export interface PinPadProps {
  onComplete?: (pin: string) => void;
  onPinChange?: (pin: string) => void;
  onChange?: (pin: string) => void;
  disabled?: boolean;
  ref?: (ref: {
    clearPin: () => void;
    shakeAndClear: () => void;
  }) => void;
}

export interface PinSetupProps {
  onPinSet: (pin: string) => void;
  onPinSetWithRecovery?: (pin: string, questions: string[], answers: string[]) => void;
  onCancel?: () => void;
  skipRecovery?: boolean; // Skip recovery setup (e.g., during PIN reset)
}

export interface PinVerificationProps {
  onSuccess: (pin: string) => void;
  onFailed?: () => void;
  expectedPinHash?: string;
}