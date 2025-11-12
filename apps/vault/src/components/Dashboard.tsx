import { Component, Show, createSignal, onMount } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';

import { useAuth, useMessenger, useCryptoWorker, useDarkModeContext } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import { VaultTestConsole } from './VaultTestConsole';
import { useVaultData } from '../hooks/useVaultData';
import { IdentityManager } from './IdentityManager';
import { PinManager } from './PinManager';
import GlobalSettings from './GlobalSettings';
import { VaultSyncPanel } from './VaultSyncPanel';

export const Dashboard: Component = () => {
    const { user, logout, isVaultLocked, lockVault, unlockVault } = useAuth();
    const { send } = useMessenger();
    const params = useParams();
    const navigate = useNavigate();
    const { isDarkMode, toggleDarkMode } = useDarkModeContext();
    const [showGlobalSettings, setShowGlobalSettings] = createSignal(false);
    const [isRefreshing, setIsRefreshing] = createSignal(false);

    const cryptoWorker = useCryptoWorker();

    // Use the vault data hook
    const { vaultData, loadVaultData, syncToNostr, getVaultFromNostr, updateVaultData } = useVaultData({ autoLoad: true });

    // Listen for vault data refresh events
    onMount(() => {
        // Broadcast a session refresh so other tabs can restore state
        try {
            const current = user();
            if (current?.profile.username && typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('nostrpass-vault');
                bc.postMessage({
                    type: 'VAULT_BROADCAST',
                    data: {
                        broadcastType: 'SESSION_REFRESH',
                        username: current.profile.username,
                        timestamp: Date.now()
                    }
                });
                // Close the channel instance promptly to avoid leaks
                setTimeout(() => bc.close(), 0);
            }
        } catch (e) {
            console.warn('Failed to broadcast SESSION_REFRESH from dashboard:', e);
        }

        const handleVaultDataRefresh = () => {
            setIsRefreshing(true);
            // Show refresh indicator for 2 seconds
            setTimeout(() => setIsRefreshing(false), 2000);
        };

        window.addEventListener('vault-data-refresh', handleVaultDataRefresh);

        return () => {
            window.removeEventListener('vault-data-refresh', handleVaultDataRefresh);
        };
    });

    const handleLogout = async () => {
        try {
            await logout();
            // Small delay to ensure state is cleared before navigation
            await new Promise(resolve => setTimeout(resolve, 50));
            navigate(`/${params.app}`);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const toggleVaultLock = async () => {
        if (isVaultLocked()) {
            // If locked, the PinManager will handle showing the unlock modal
            // We just need to load vault data for recovery
            await loadVaultData();
        } else {
            // If unlocked, lock the vault
            await lockVault();
        }
    };

    const backToApp = () => {
        console.log('🔙 Back to app clicked, sending HIDE_VAULT message');
        console.log('📍 Current app:', params.app);

        try {
            // Use the send function that's already available from useMessenger
            send('HIDE_VAULT');
            console.log('✅ HIDE_VAULT message sent successfully');
        } catch (error) {
            console.error('❌ Failed to send HIDE_VAULT message:', error);
        }
    };

    return (
        <div class="w-full h-full bg-white dark:bg-gray-900">
            <div class="flex flex-col w-full md:max-w-2xl md:mx-auto gap-0 md:gap-4 min-h-screen md:min-h-0">
                <div class="bg-white dark:bg-gray-800 text-black dark:text-gray-100 border-0 md:border border-gray-700 dark:border-gray-600 md:rounded-lg md:shadow-2xl flex-1 md:flex-none">
                    <header>
                        {/* Top row - Action buttons */}
                        <div class={`flex justify-between p-2 ${isVaultLocked() ? 'bg-orange-100 dark:bg-orange-900 border-orange-200 dark:border-orange-700' : 'bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700'} rounded-t-lg p-4 items-center gap-2 border-b`}>
                            <div class="flex items-center gap-2">
                                {/* Back to App button - only show if app is defined */}
                                {params.app && (
                                    <button
                                        onClick={backToApp}
                                        class="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700 rounded-lg p-2 flex items-center gap-2 transition-all"
                                        title={`Back to ${desanitizeDomain(params.app)}`}
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        <span class="text-sm">{desanitizeDomain(params.app)}</span>
                                    </button>
                                )}
                            </div>

                            {/* Lock/Unlock vault slider toggle */}
                            <div class="flex items-center gap-2">
                                <span class={`text-sm hidden md:block ${isVaultLocked() ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>Lock</span>
                                <div
                                    onClick={toggleVaultLock}
                                    class="relative inline-flex items-center cursor-pointer"
                                >
                                    <div class={`w-16 h-8 rounded-full transition-colors duration-300 ${isVaultLocked()
                                        ? 'bg-red-200 dark:bg-red-900 border-2 border-red-300 dark:border-red-700'
                                        : 'bg-green-200 dark:bg-green-900 border-2 border-green-300 dark:border-green-700'
                                        }`}>
                                        <div class={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white dark:bg-gray-100 shadow-md transform transition-transform duration-300 flex items-center justify-center ${isVaultLocked() ? 'translate-x-0' : 'translate-x-7'
                                            }`}>
                                            <span class="w-5 h-5 text-gray-700">
                                                {isVaultLocked() ? (
                                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a5 5 0 0 1 5 5v2.005c.77.015 1.246.07 1.635.268a2.5 2.5 0 0 1 1.092 1.092C20 11.9 20 12.6 20 14v3c0 1.4 0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C18.1 21 17.4 21 16 21H8c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C4 19.1 4 18.4 4 17v-3c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.092c.389-.199.865-.253 1.635-.268V8a5 5 0 0 1 5-5m3 5v2H9V8a3 3 0 1 1 6 0" fill="currentColor" />
                                                    </svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M7 10.005V7a5 5 0 0 1 10 0 1 1 0 1 1-2 0 3 3 0 1 0-6 0v3h7c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.092 1.092C20 11.9 20 12.6 20 14v3c0 1.4 0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C18.1 21 17.4 21 16 21H8c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C4 19.1 4 18.4 4 17v-3c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.092c.389-.199.865-.253 1.635-.268" fill="currentColor" />
                                                    </svg>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <span class={`text-sm hidden md:block ${isVaultLocked() ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>Unlock</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <button
                                    onClick={handleLogout}
                                    class="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700 rounded-lg p-2 flex items-center gap-2 transition-all"
                                    title="Logout"
                                >
                                    <span class="text-sm">Logout</span>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="flex justify-between items-center gap-2 p-4">
                            <div class="flex flex-col gap-1 w-1/2 flex-2">
                                <div class="font-semibold text-md text-gray-900 dark:text-gray-100">{user()?.profile.username.toUpperCase()}</div>
                                <span class="text-xs text-gray-500 dark:text-gray-400">Digital Passport</span>
                            </div>
                        </div>
                    </header>

                    <hr class="border-gray-300 dark:border-gray-700" />

                    <main>
                        {/* Identity Manager - handles all identity-related UI and logic */}
                        <IdentityManager
                            appId={params.app}
                            vaultData={vaultData()}
                            isVaultLocked={isVaultLocked()}
                            username={user()?.profile.username || ''}
                            onUpdateVaultData={updateVaultData}
                            onSyncToNostr={syncToNostr}
                            onRefresh={() => loadVaultData(true)}
                            cryptoWorker={cryptoWorker}
                            onShowPinUnlock={() => {
                                // PinManager will handle this internally
                            }}
                        />

                        {/* Test Console - only in DEV mode */}
                        <Show when={import.meta.env.DEV}>
                            <VaultTestConsole />
                        </Show>
                    </main>

                    <footer class="text-sm py-4 px-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center relative">
                        <div class="flex items-center gap-4">
                            {/* Settings button */}
                            <button
                                onClick={() => setShowGlobalSettings(true)}
                                class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
                                title="Vault Settings"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span class="text-xs">Settings</span>
                            </button>
                        </div>

                        {/* Middle section - placeholder */}
                        <div class="text-gray-400 dark:text-gray-500">
                            {/* Empty - can be used for status messages */}
                        </div>

                        {/* Right side - Dark mode toggle and sync indicator */}
                        <div class="flex items-center gap-3">
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title={isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                <Show when={isDarkMode()} fallback={
                                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                }>
                                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                </Show>
                            </button>

                            {/* Sync indicator */}
                            <Show when={isRefreshing()}>
                                <div>
                                    <svg class="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                            </Show>
                        </div>
                    </footer>
                </div>
            </div>

            {/* PIN Manager - handles all PIN-related modals and logic */}
            <PinManager
                isVaultLocked={isVaultLocked()}
                vaultData={vaultData()}
                onUnlock={unlockVault}
                onLock={lockVault}
                username={user()?.profile.username || ''}
            />

            {/* Global Settings Panel */}
            <GlobalSettings
                isOpen={showGlobalSettings()}
                onClose={() => setShowGlobalSettings(false)}
                username={user()?.profile.username || ''}
                identityCount={vaultData()?.identities?.length || 0}
                syncPanel={
                    <VaultSyncPanel
                        username={user()?.profile.username || ''}
                        onSyncToNostr={syncToNostr}
                        onGetFromNostr={getVaultFromNostr}
                    />
                }
            />
        </div>
    );
};

export default Dashboard;
