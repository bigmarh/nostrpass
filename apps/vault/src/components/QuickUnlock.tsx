import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import PinVerification from './PinVerification';
import { useAuth, useMessenger } from '../providers';

/**
 * QuickUnlock - Smart unlock component with continuation support
 * After unlocking, can:
 * - Trigger account picker (?next=account-picker)
 * - Trigger permission prompt (?next=permission-prompt)
 * - Just notify parent (default)
 */
export const QuickUnlock: Component = () => {
    console.log('[QuickUnlock] Component mounted');

    const { user, unlockVault, isVaultLocked, logout } = useAuth();
    const { send } = useMessenger();
    const [searchParams] = useSearchParams();
    const [error, setError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);
    const [pinResetKey, setPinResetKey] = createSignal(0); // Key to force PinVerification remount

    // Listen for vault unlock from PinManager
    createEffect(() => {
        const locked = isVaultLocked();
        console.log('[QuickUnlock] Vault lock status changed:', locked);

        if (!locked) {
            // Vault was unlocked!
            console.log('[QuickUnlock] Vault unlocked detected, executing next action...');
            handleUnlockSuccess();
        }
    });

    const handleUnlockSuccess = async () => {
        console.log('[QuickUnlock] Vault unlocked successfully!');
        setIsUnlocking(true);

        // Wait a moment to ensure session is fully saved
        await new Promise(resolve => setTimeout(resolve, 150));

        // Execute next action based on query params
        const nextAction = searchParams.next;
        console.log('[QuickUnlock] Next action:', nextAction);

        // Send unlock message to parent window via messenger
        try {
            const unlockData: any = {
                unlocked: true,
                timestamp: Date.now(),
                forOperation: true,
                nextAction: nextAction || 'close' // Tell parent what happens next
            };

            // Pass along query params for continuation flows
            if (nextAction === 'account-picker') {
                unlockData.appOrigin = searchParams.appOrigin;
                unlockData.appName = searchParams.appName;
                unlockData.requestId = searchParams.requestId;
                unlockData.permissions = searchParams.permissions; // Pass permissions through
            } else if (nextAction === 'permission-prompt') {
                unlockData.requestId = searchParams.requestId;
            }

            send('nostrpass:unlocked', unlockData);
            console.log('[QuickUnlock] Unlock event sent to parent with nextAction:', nextAction);
        } catch (e) {
            console.error('[QuickUnlock] Failed to send unlock event:', e);
        }

        // Embassy will handle navigation to account-picker page
        // No need to dispatch events here anymore

        if (nextAction === 'permission-prompt') {
            // Trigger permission prompt
            const requestId = searchParams.requestId;
            console.log('[QuickUnlock] Triggering permission prompt for request:', requestId);

            if (requestId) {
                // Dispatch permission ready event
                window.dispatchEvent(new CustomEvent('vault-unlocked-for-permission', {
                    detail: { requestId }
                }));
            }
        }

        // Default: Just notify parent, let them handle next steps
        console.log('[QuickUnlock] Unlock complete, waiting for parent to handle next action');

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
            } else {
                // Clear PIN pad after successful unlock
                setPinResetKey(prev => prev + 1);
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

    const handleLogout = async () => {
        console.log('[QuickUnlock] Logout clicked');
        try {
            await logout();

            // Send logout message to parent window (crosses iframe boundary)
            send('nostrpass:logout', {
                timestamp: Date.now()
            });

            send('HIDE_VAULT');
        } catch (error) {
            console.error('[QuickUnlock] Logout failed:', error);
            setError('Logout failed. Please try again.');
        }
    };

    return (
        <div class="flex bg-gradient-to-br from-gray-50 h-full to-gray-100 dark:from-gray-900 dark:to-gray-800 flex-col items-center justify-center w-full h-full p-2 rounded-2xl overflow-hidden">
            {error() && (
                <div class="bg-red-50 mb-2 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-lg text-[10px] mb-0.5 text-center max-w-[260px]">
                    {error()}
                </div>
            )}

            {isUnlocking() && (
                <div>
                    <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-lg text-[10px] mb-0.5 flex items-center justify-center gap-1">
                        <svg class="animate-spin h-3 w-3 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Unlocking...
                    </div></div>
            )}
             <PinVerification
                key={pinResetKey()}
                onSuccess={handlePinSuccess}
                onFailed={handlePinFailed}
                expectedPinHash={user()?.vaultPinHash}
            />
                {/**Logout button */}
                <button
                    onClick={handleLogout}
                    class="bg-white dark:bg-gray-800 p-2 rounded-md text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 shadow-sm"
                >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign out</span>
                </button>
        </div>
    );
};
