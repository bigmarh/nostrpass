import { Component, Show, createSignal, onMount } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';
import { nip19 } from 'nostr-tools';

import { useAuth, useMessenger, useCryptoWorker, useDarkModeContext } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import { useVaultData } from '../hooks/useVaultData';
import { IdentityManager } from './IdentityManager';
import { PinManager } from './PinManager';
import GlobalSettings from './GlobalSettings';
import { getActiveIdentity } from '../utils/activeIdentityManager';

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
            // Don't navigate - PinManager will show modal automatically
            return;
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
        <div class="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
            <div class="max-w-2xl mx-auto flex-1 flex flex-col w-full min-h-0">
                {/* Header */}
                <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shrink-0">
                    <div class="px-4 py-2.5">
                        {/* Top row - Back to app and logout */}
                        <div class="flex items-center justify-between mb-2">
                            {/* Back to App button */}
                            {params.app && (
                                <button
                                    onClick={backToApp}
                                    class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                    </svg>
                                    <span>{desanitizeDomain(params.app)}</span>
                                </button>
                            )}

                            {/* Logout button */}
                            <button
                                onClick={handleLogout}
                                class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                            >
                                <span>Logout</span>
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>

                        {/* Digital ID Card */}
                        <div class="relative bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-gray-100 rounded-lg shadow-lg overflow-hidden">
                            {/* Card content - Main layout with grid */}
                            <div class="grid grid-cols-[1fr_auto] gap-0 relative z-10">
                                <Show when={vaultData()?.identities && params.app} fallback={
                                    <div class="flex items-start gap-3 p-4 col-span-2">
                                        {/* Fallback when no active identity */}
                                        <div class="w-16 h-16 bg-gray-900 dark:bg-white rounded-full border-2 border-gray-900 dark:border-gray-100 flex items-center justify-center shadow-sm">
                                            <span class="text-white dark:text-gray-900 text-2xl font-bold">
                                                {user()?.profile.username.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div class="flex-1 text-gray-900 dark:text-white">
                                            <div class="text-[10px] uppercase tracking-wide font-semibold text-gray-600 dark:text-gray-400 mb-1">Digital Passport</div>
                                            <h1 class="text-lg font-bold tracking-tight">{user()?.profile.username.toUpperCase()}</h1>
                                        </div>
                                    </div>
                                }>
                                    {(() => {
                                        const vault = vaultData();
                                        if (!vault?.identities) return null;

                                        // Get active identity from localStorage (per-browser) or fallback to vault data
                                        const appOrigin = params.app ? (() => {
                                            try {
                                                const domain = desanitizeDomain(params.app);
                                                if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
                                                    return `http://${domain}`;
                                                }
                                                return `https://${domain}`;
                                            } catch {
                                                return params.app.startsWith('http') ? params.app : `https://${params.app}`;
                                            }
                                        })() : null;

                                        const activeIndex = appOrigin
                                            ? (getActiveIdentity(user()?.profile.username || '', appOrigin) ?? vault.activeIdentityByApp?.[params.app!] ?? 0)
                                            : 0;

                                        const activeIdentity = vault.identities[activeIndex];

                                        if (!activeIdentity) return null;

                                        // Get initials from identity nickname
                                        // For multi-word names, use first letter of each word (e.g., "John Smith" -> "JS")
                                        // For single-word names, use first two letters (e.g., "Personal" -> "PE")
                                        const nickname = activeIdentity.nickname || 'Personal';
                                        const words = nickname.trim().split(/\s+/);
                                        const identityInitials = words.length > 1
                                            ? (words[0][0] + words[1][0]).toUpperCase()
                                            : nickname.substring(0, 2).toUpperCase();

                                        return (
                                            <>
                                                {/* Left section: Two columns (profile + details) over footer */}
                                                <div class="flex flex-col">
                                                    {/* Top: Profile and Details */}
                                                    <div class="flex items-stretch gap-4 p-4">
                                                        {/* Column 1: Profile photo and name */}
                                                        <div class="flex flex-col items-center gap-2 shrink-0 w-32">
                                                            <div class="w-16 h-16 bg-gray-900 dark:bg-white rounded-full border-2 border-gray-900 dark:border-gray-100 flex items-center justify-center shadow-sm">
                                                                <span class="text-white dark:text-gray-900 text-2xl font-bold">
                                                                    {identityInitials}
                                                                </span>
                                                            </div>
                                                            <div class="text-center">
                                                                <div class="text-[10px] uppercase tracking-wide font-semibold text-gray-600 dark:text-gray-400 mb-0.5">Digital Passport</div>
                                                                <div class="flex items-center gap-1 justify-center">
                                                                    <h1 class="text-sm font-bold tracking-tight text-gray-900 dark:text-white break-words">{activeIdentity.nickname || 'Personal'}</h1>
                                                                    <Show when={activeIdentity.isImported}>
                                                                        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                                                                        </svg>
                                                                    </Show>
                                                                </div>
                                                                <div class="text-[9px] text-gray-600 dark:text-gray-400">
                                                                    {user()?.profile.username}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Column 2: ID Details - 2x2 Grid */}
                                                        <div class="grid grid-cols-2 gap-1 text-[11px] flex-1 border-l border-gray-300 dark:border-gray-700 pl-4">
                                                            <div class="text-center">
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[8px]">Issued</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold">
                                                                    {(() => {
                                                                        const timestamp = activeIdentity.isImported ? activeIdentity.importedAt : activeIdentity.createdAt;
                                                                        if (!timestamp) return 'N/A';
                                                                        const date = new Date(timestamp);
                                                                        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div class="text-center">
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[8px]">Type</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold">
                                                                    {activeIdentity.isImported ? 'BYOK' : 'HD'}
                                                                </div>
                                                            </div>
                                                            <div class="text-center">
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[8px]">ID No.</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold font-mono">
                                                                    #{activeIdentity.index.toString().padStart(3, '0')}
                                                                </div>
                                                            </div>
                                                            <div class="text-center">
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[8px]">Status</div>
                                                                <div class="text-green-600 dark:text-green-400 font-semibold">
                                                                    ACTIVE
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bottom: Passport Number (npub) */}
                                                    <div class="px-4 pb-4 pt-2 border-t border-gray-300 dark:border-gray-700">
                                                        <div class="text-[8px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">Passport Number</div>
                                                        <div class="text-[10px] font-mono text-gray-900 dark:text-gray-100 break-all leading-tight">
                                                            {nip19.npubEncode(activeIdentity.publicKey)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right section: VISA column spanning full height */}
                                                <Show when={params.app}>
                                                    <div class="flex items-center justify-center border-l border-gray-300 dark:border-gray-700 w-12 bg-green-50 dark:bg-green-950 row-span-2">
                                                        <div class="transform -rotate-90 whitespace-nowrap text-center">
                                                            <div class="text-[10px] uppercase text-gray-600 dark:text-gray-400 tracking-wider">
                                                                VISA FOR
                                                            </div>
                                                            <div class="text-[9px] font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                                                {desanitizeDomain(params.app!).toUpperCase()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Show>
                                            </>
                                        );
                                    })()}
                                </Show>

                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main class="p-6 flex-1 flex flex-col min-h-0">
                    {/* Identity Manager */}
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
                </main>

                {/* Footer */}
                <footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0 mt-auto">
                    <div class="px-6 py-4 flex items-center justify-between">
                        {/* Left side - Logo and Settings */}
                        <div class="flex items-center gap-4">
                            {/* NostrPass Logo with Egg */}
                            <div class="flex items-center gap-2">
                                <img src="/logo.svg" alt="NostrPass" class="w-5 h-5" />
                                <div class="text-gray-900 dark:text-white text-xs font-bold">NOSTRPASS</div>
                            </div>

                            {/* Settings button */}
                            <button
                                onClick={() => {
                                    console.log('⚙️ [Dashboard] Settings button clicked');
                                    setShowGlobalSettings(true);
                                    console.log('⚙️ [Dashboard] showGlobalSettings set to:', showGlobalSettings());
                                }}
                                class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Settings</span>
                            </button>
                        </div>

                        {/* Right side - Lock/Unlock, Dark mode, and sync */}
                        <div class="flex items-center gap-3">
                            {/* Sync indicator */}
                            <Show when={isRefreshing()}>
                                <svg class="w-4 h-4 animate-spin text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </Show>

                            {/* Lock/Unlock Toggle */}
                            <div class="flex items-center gap-2">
                                {/* Locked icon (left side) - shows when unlocked, indicating you can lock */}
                                <Show when={!isVaultLocked()}>
                                    <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </Show>
                                <button
                                    onClick={toggleVaultLock}
                                    class={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${
                                        isVaultLocked()
                                            ? 'bg-gray-300 dark:bg-gray-700'
                                            : 'bg-gray-900 dark:bg-white'
                                    }`}
                                >
                                    <span
                                        class={`inline-block w-3.5 h-3.5 transform rounded-full transition-transform ${
                                            isVaultLocked()
                                                ? 'translate-x-0.5 bg-white dark:bg-gray-900'
                                                : 'translate-x-5 bg-white dark:bg-gray-900'
                                        }`}
                                    />
                                </button>
                                {/* Unlocked icon (right side) - shows when locked, indicating you can unlock */}
                                <Show when={isVaultLocked()}>
                                    <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                    </svg>
                                </Show>
                            </div>

                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                title={isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                <Show when={isDarkMode()} fallback={
                                    <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                }>
                                    <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                </Show>
                            </button>
                        </div>
                    </div>
                </footer>
            </div>

            {/* PIN Manager - handles all PIN-related modals and logic */}
            <PinManager
                isVaultLocked={isVaultLocked()}
                vaultData={vaultData()}
                onUnlock={unlockVault}
                onLock={lockVault}
                username={user()?.profile.username || ''}
            />

            {/* Global Settings Modal */}
            <Show when={showGlobalSettings()}>
                <GlobalSettings
                    username={user()?.profile.username || ''}
                    identityCount={vaultData()?.identities?.filter((id: any) => !id.archived).length || 0}
                    isOpen={showGlobalSettings()}
                    onClose={() => setShowGlobalSettings(false)}
                    vaultData={vaultData()}
                    onUpdateVaultData={updateVaultData}
                />
            </Show>
        </div>
    );
};
