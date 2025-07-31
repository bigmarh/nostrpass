import { Component, createSignal, Show, onMount } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PinVerification from './PinVerification';
import { useAuth, useMessenger } from '../providers';

export const PinUnlock: Component = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { user, logout, unlockVault } = useAuth();
    const { send } = useMessenger();
    const [error, setError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);

    onMount(() => {
        // If no user is logged in, redirect to login
        if (!user()) {
            navigate(`/${params.app}`);
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

    const desanitizeDomain = (domain: string) => {
        return domain.replace(/_/g, '.');
    };

    return (
        <div class="flex justify-center md:h-screen items-center">
            <div class="flex w-auto min-w-[600px] max-w-2xl h-auto bg-white black-outline flex-col rounded-lg">
                <div class="flex flex-col items-center justify-center p-8">
                    <div class="w-32 h-32 mb-6">
                        <img class="w-full h-full" src="/logo.svg" alt="NostrPass Logo" />
                    </div>
                    
                    <h1 class="text-2xl font-bold mb-2">Welcome back, {user()?.profile.username}!</h1>
                    <p class="text-gray-600 text-sm mb-6">
                        {params.app && `Connecting to ${desanitizeDomain(params.app)}`}
                    </p>

                    <Show when={error()}>
                        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm mb-4 max-w-md text-center">
                            {error()}
                        </div>
                    </Show>

                    <Show when={isUnlocking()}>
                        <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-md text-sm mb-4 flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Unlocking vault...
                        </div>
                    </Show>

                    <PinVerification
                        onSuccess={handlePinSuccess}
                        onFailed={handlePinFailed}
                        expectedPinHash={user()?.vaultPinHash}
                    />

                    <div class="mt-6 space-y-2 text-center">
                        <button
                            onClick={handleCancel}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <div>
                            <button
                                onClick={() => {
                                    logout();
                                    navigate(`/${params.app}`);
                                }}
                                class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
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