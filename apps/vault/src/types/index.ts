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
  onCancel?: () => void;
}

export interface PinVerificationProps {
  onSuccess: (pin: string) => void;
  onFailed?: () => void;
  expectedPinHash?: string;
}