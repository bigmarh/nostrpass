import { Component, createSignal, Show, onMount } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PinVerification from './PinVerification';
import PINRecovery from './PINRecovery';
import PinSetup from './PinSetup';
import { useAuth, useMessenger, useCryptoWorker } from '../providers';

export const PinUnlock: Component = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { user, logout, unlockVault } = useAuth();
    const { send } = useMessenger();
    const [error, setError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);
    const [showRecovery, setShowRecovery] = createSignal(false);
    const [showPinReset, setShowPinReset] = createSignal(false);
    const [recoverySessionToken, setRecoverySessionToken] = createSignal<string | null>(null);
    const [vaultData, setVaultData] = createSignal<any>(null);
    const [tempNewPin, setTempNewPin] = createSignal<string>('');
    const [showPasswordPrompt, setShowPasswordPrompt] = createSignal(false);
    const [passwordForReset, setPasswordForReset] = createSignal('');
    const cryptoWorker = useCryptoWorker();

    onMount(async () => {
        // If no user is logged in, redirect to login
        if (!user()) {
            navigate(`/${params.app}`);
            return;
        }
        // If recovery query param present, open recovery flow
        try {
            const sp = new URLSearchParams(window.location.search);
            if (sp.get('recovery') === '1') {
                setShowRecovery(true);
            }
        } catch {}
        
        // Load vault data
        const username = user()?.profile.username;
        if (username && cryptoWorker) {
            try {
                const data = await cryptoWorker.getVaultData({ username });
                setVaultData(data);
            } catch (err) {
            }
        }
    });

    const handlePinSuccess = async (pin: string) => {
        try {
            setIsUnlocking(true);
            setError('');
            
            // Unlock the vault with the PIN
            const success = await unlockVault(pin);
            
            if (success) {
                // Navigate to dashboard
                navigate(`/${params.app}/dashboard`);
            } else {
                setError('Failed to unlock vault. Please try again.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unlock vault');
        } finally {
            setIsUnlocking(false);
        }
    };

    const handlePinFailed = () => {
        // Too many failed attempts, logout
        logout();
        navigate(`/${params.app}`);
    };

    const handleCancel = () => {
        send('HIDE_VAULT');
    };

    const handlePasswordVerification = async () => {
        if (!cryptoWorker || !recoverySessionToken() || !tempNewPin() || !passwordForReset()) {
            return;
        }
        
        setIsUnlocking(true);
        setError('');
        
        try {
            // Complete PIN reset in worker (all crypto operations happen there)
            const result = await cryptoWorker.completePinReset({
                sessionToken: recoverySessionToken()!,
                newPin: tempNewPin(),
                password: passwordForReset()
            });
            
            if (result.success) {
                // Success! Unlock with new PIN - this will create the session
                // The vault will be saved to Nostr during the unlock process
                await handlePinSuccess(tempNewPin());
            } else {
                throw new Error('Failed to reset PIN');
            }
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset PIN');
        } finally {
            setIsUnlocking(false);
            setPasswordForReset('');
            setRecoverySessionToken(null);
        }
    };


    return (
        <div class="flex justify-center md:h-screen items-center bg-white dark:bg-gray-900">
            <div class="flex min-w-[400px] w-full max-w-2xl h-auto bg-white dark:bg-gray-800 black-outline flex-col rounded-lg">
                <div class="flex flex-col items-center justify-center p-8">
                  
                    <Show when={error()}>
                        <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4 max-w-md text-center">
                            {error()}
                        </div>
                    </Show>

                    <Show when={isUnlocking()}>
                        <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-md text-sm mb-4 flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Unlocking vault...
                        </div>
                    </Show>

                    <Show when={!showRecovery() && !showPinReset()}>
                        <PinVerification
                            onSuccess={handlePinSuccess}
                            onFailed={handlePinFailed}
                            expectedPinHash={user()?.vaultPinHash}
                        />
                    </Show>

                    <Show when={showRecovery()}>
                        <PINRecovery
                            vaultData={vaultData() || {}}
                            onSuccess={(sessionToken: string) => {
                                setRecoverySessionToken(sessionToken);
                                setShowRecovery(false);
                                setShowPinReset(true);
                            }}
                            onCancel={() => setShowRecovery(false)}
                        />
                    </Show>

                    <Show when={showPinReset()}>
                        <div class="space-y-4">
                            <PinSetup
                                skipRecovery={true}
                                onPinSet={async (newPin) => {
                                    setTempNewPin(newPin);
                                    setShowPasswordPrompt(true);
                                }}
                                onCancel={() => {
                                    setShowPinReset(false);
                                    setRecoverySessionToken(null);
                                }}
                            />
                            
                            <Show when={showPasswordPrompt()}>
                                <div class="mt-4 p-4 border-t border-gray-200 dark:border-gray-700">
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Verify Your Password</h3>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Please enter your password to complete the PIN reset.
                                    </p>
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={passwordForReset()}
                                        onInput={(e) => setPasswordForReset(e.currentTarget.value)}
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') handlePasswordVerification();
                                        }}
                                    />
                                    <div class="flex gap-2">
                                        <button
                                            onClick={handlePasswordVerification}
                                            disabled={!passwordForReset() || isUnlocking()}
                                            class="flex-1 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                                        >
                                            {isUnlocking() ? 'Resetting PIN...' : 'Complete Reset'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPasswordPrompt(false);
                                                setPasswordForReset('');
                                            }}
                                            class="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    <div class="mt-6 space-y-2 text-center flex flex-col gap-2">
                        <Show when={!showRecovery() && !showPinReset()}>
                            <button
                                onClick={() => setShowRecovery(true)}
                                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                                Forgot PIN?
                            </button>
                        </Show>
                        <button
                            onClick={handleCancel}
                            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <div>
                            <button
                                onClick={() => {
                                    logout();
                                    navigate(`/${params.app}`);
                                }}
                                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                                Use a different account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};