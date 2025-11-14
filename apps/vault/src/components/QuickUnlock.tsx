import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import PinVerification from './PinVerification';
import { useAuth, useMessenger } from '../providers';

/**
 * QuickUnlock - Just unlocks the vault and closes, no navigation
 * Used for embedded unlock flows like account switcher
 */
export const QuickUnlock: Component = () => {
    console.log('[QuickUnlock] Component mounted');

    const { user, unlockVault, isVaultLocked } = useAuth();
    const { send } = useMessenger();
    const [error, setError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);

    // Listen for vault unlock from PinManager
    createEffect(() => {
        const locked = isVaultLocked();
        console.log('[QuickUnlock] Vault lock status changed:', locked);

        if (!locked) {
            // Vault was unlocked!
            console.log('[QuickUnlock] Vault unlocked detected, sending messages...');
            handleUnlockSuccess();
        }
    });

    const handleUnlockSuccess = async () => {
        console.log('[QuickUnlock] Vault unlocked successfully!');
        setIsUnlocking(true);

        // Wait a moment to ensure session is fully saved
        await new Promise(resolve => setTimeout(resolve, 150));

        // Send unlock message to parent window via messenger
        try {
            send('nostrpass:unlocked', {
                unlocked: true,
                timestamp: Date.now(),
                forOperation: true
            });
            console.log('[QuickUnlock] Unlock event sent to parent');
        } catch (e) {
            console.error('[QuickUnlock] Failed to send unlock event:', e);
        }

        // Don't send HIDE_VAULT - let the parent handle closing after operation completes
        console.log('[QuickUnlock] Unlock complete, waiting for parent to close modal');

        setIsUnlocking(false);
    };

    const handlePinSuccess = async (pin: string) => {
        console.log('[QuickUnlock] PIN success, attempting unlock...');
        try {
            setIsUnlocking(true);
            setError('');

            // Unlock the vault with the PIN
            const success = await unlockVault(pin);
            console.log('[QuickUnlock] Unlock result:', success);

            if (!success) {
                setError('Failed to unlock vault. Please try again.');
                setIsUnlocking(false);
            }
            // Success is handled by the createEffect watching isVaultLocked
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unlock vault');
            setIsUnlocking(false);
        }
    };

    const handlePinFailed = () => {
        setError('Too many failed attempts');
    };

    const handleCancel = () => {
        send('HIDE_VAULT');
    };

    return (
        <div class="flex flex-col items-center justify-center w-full h-full dark:bg-gray-800 p-2 rounded-2xl overflow-hidden">
            {error() && (
                <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-lg text-[10px] mb-0.5 text-center max-w-[260px]">
                    {error()}
                </div>
            )}

            {isUnlocking() && (
                <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-lg text-[10px] mb-0.5 flex items-center justify-center gap-1">
                    <svg class="animate-spin h-3 w-3 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Unlocking...
                </div>
            )}

            <PinVerification
                onSuccess={handlePinSuccess}
                onFailed={handlePinFailed}
                expectedPinHash={user()?.vaultPinHash}
            />
        </div>
    );
};
