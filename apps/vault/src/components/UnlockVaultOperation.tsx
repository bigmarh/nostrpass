import { Component, createSignal, Show } from 'solid-js';
import { useAuth, useMessenger } from '../providers';
import { useNavigate, useParams } from '@solidjs/router';
import PinPad from './PinPad';

const UnlockVaultOperation: Component = () => {
  const { unlockVault, isLoading, logout } = useAuth();
  const { send } = useMessenger();
  const navigate = useNavigate();
  const params = useParams();
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [isUnlocking, setIsUnlocking] = createSignal(false);
  let pinPadRef: any;

  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    setError('');

    // Auto-submit when PIN is complete (assuming 6 digits)
    if (newPin.length === 6) {
      handleUnlock(newPin);
    }
  };

  const handleUnlock = async (pinToTry: string) => {
    console.log('🔓 [UnlockVaultOperation] handleUnlock called');
    setIsUnlocking(true);
    setError('');

    try {
      const success = await unlockVault(pinToTry);
      if (success) {
        console.log('✅ [UnlockVaultOperation] Unlock success - notifying embassy');
        setSuccess('Vault unlocked successfully!');
        
        // Send unlock message to parent window - embassy will handle the rest
        try {
          send('nostrpass:unlocked', {
            unlocked: true,
            forOperation: true
          });
        } catch (err) {
          console.error('Failed to send unlock notification:', err);
        }
        
        // Navigate back to dashboard
        setTimeout(() => {
          const appSegment = params.app || '';
          navigate(`/${appSegment}`);
        }, 500); // Small delay to show success message
      } else {
        console.log('❌ [UnlockVaultOperation] Unlock failed - incorrect PIN');
        setError('Incorrect PIN. Please try again.');
        setPin('');
        // Shake and clear the pin pad
        if (pinPadRef && pinPadRef.shakeAndClear) {
          pinPadRef.shakeAndClear();
        }
      }
    } catch (error) {
      console.error('💥 [UnlockVaultOperation] Failed to unlock vault:', error);
      setError('Failed to unlock vault. Please try again.');
      setPin('');
      if (pinPadRef && pinPadRef.shakeAndClear) {
        pinPadRef.shakeAndClear();
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCancel = () => {
    send('HIDE_VAULT');
  };

  return (
    <Show when={!isLoading()}
      fallback={
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <div class="flex justify-center p-4 text-base">
        <div class="bg-white black-outline box-shadow rounded-lg shadow-default p-8 text-center relative">
          {/* Header */}
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold mb-2">Unlock to Continue</h2>
            <p class="text-gray-600">Enter your PIN to complete the operation</p>
          </div>

          {/* PIN Entry */}
          <div class="mb-6">
            <PinPad
              ref={(el: any) => pinPadRef = el}
              onPinChange={handlePinChange}
              disabled={isUnlocking()}
            />
          </div>

          {/* Messages */}
          {error() && (
            <div class="status-message error text-sm text-center mb-4">
              {error()}
            </div>
          )}

          {success() && (
            <div class="status-message success text-sm text-center mb-4 text-green-600">
              {success()}
            </div>
          )}

          {/* Action buttons */}
          {!success() && (
            <div class="mt-6 pt-4 border-t border-gray-200 flex flex-col gap-2">
              <button
                onClick={logout}
                class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isUnlocking()}
              >
                Can't remember your PIN? Logout
              </button>
              <button
                onClick={handleCancel}
                class="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </Show>
  );
};

export default UnlockVaultOperation;