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
        <div class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <div class="min-h-screen flex items-center justify-center p-2 text-base bg-white dark:bg-gray-900">
        <div class="w-full max-w-xs bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 text-center relative">
          {/* Compact header with exit */}
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Enter PIN</div>
            <button
              onClick={handleCancel}
              class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              aria-label="Close"
              title="Close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* PIN Entry */}
          <div class="mb-1">
            <PinPad
              ref={(el: any) => pinPadRef = el}
              onPinChange={handlePinChange}
              disabled={isUnlocking()}
            />
          </div>

          {/* Messages */}
          {error() && (
            <div class="status-message error text-xs text-center mb-2 text-red-600 dark:text-red-400">
              {error()}
            </div>
          )}

          {success() && (
            <div class="status-message success text-xs text-center mb-2 text-green-600 dark:text-green-400">
              {success()}
            </div>
          )}

          {/* Action buttons */}
          {!success() && (
            <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-1">
              <button
                onClick={logout}
                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                disabled={isUnlocking()}
              >
                Can't remember your PIN? Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </Show>
  );
};

export default UnlockVaultOperation;