import { Component, createEffect, createSignal, Show, onMount } from 'solid-js';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from '@solidjs/router';
import PinPad from './PinPad';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('UnlockVaultIdentity');

const UnlockVaultIdentity: Component = () => {
  const { unlockVault, loading, backToApp, handleLogout, isVaultLocked } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [isUnlocking, setIsUnlocking] = createSignal(false);
  let pinPadRef: any;

  // Check if vault is already unlocked on mount
  onMount(() => {
    if (!isVaultLocked()) {
      logger.info('Vault is already unlocked, redirecting to passport');
      navigate('/passport');
    }
  });

  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    setError('');

    // Auto-submit when PIN is complete (assuming 6 digits)
    if (newPin.length === 6) {
      handleUnlock(newPin);
    }
  };


  const handleUnlock = async (pinToTry: string) => {
    console.log('🔓 [UnlockVaultIdentity] handleUnlock called');
    setIsUnlocking(true);
    setError('');

    try {
      const success = await unlockVault(pinToTry);
      if (success) {

        console.log('✅ [UnlockVaultIdentity] Unlock success');
        setSuccess('Vault unlocked successfully!');
        
        // For identity management, show navigation options
        // Don't auto-navigate - set flag to prevent AuthContext from navigating
        sessionStorage.setItem('nostrpass_skip_auto_nav', 'true');
      } else {
        console.log('❌ [UnlockVaultIdentity] Unlock failed - incorrect PIN');
        setError('Incorrect PIN. Please try again.');
        setPin('');
        // Shake and clear the pin pad
        if (pinPadRef && pinPadRef.shakeAndClear) {
          pinPadRef.shakeAndClear();
        }
      }
    } catch (error) {
      console.error('💥 [UnlockVaultIdentity] Failed to unlock vault:', error);
      logger.error('Failed to unlock vault:', error);
      setError('Failed to unlock vault. Please try again.');
      setPin('');
      if (pinPadRef && pinPadRef.shakeAndClear) {
        pinPadRef.shakeAndClear();
      }
    } finally {
      //setIsUnlocking(false);
    }
  };

  return (
    <Show when={!loading()}
      fallback={
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >

      <div class="flex justify-center w-full p-4 text-base">
        
        <div class="bg-white black-outline box-shadow rounded-lg w-full shadow-default p-4 text-center relative">
         {/* Navigation buttons - only show after successful unlock */}
         {success() && (
            <div class="flex gap-2 text-md mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={backToApp}
                class="flex-1 px-2 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to App
              </button>
              <button
                onClick={() => navigate('/passport')}
                class="flex-1 px-2 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                To Passport
              </button>
            </div>
          )}

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

         
          {/* Logout button - shown only when not successfully unlocked */}
          {!success() && (
            <div class="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
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

export default UnlockVaultIdentity;