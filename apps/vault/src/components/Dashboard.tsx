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
    const [triggerAddIdentity, setTriggerAddIdentity] = createSignal(0);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showMenu, setShowMenu] = createSignal(false);

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
        <div class="flex flex-col h-[100dvh] bg-gray-50 dark:bg-gray-950">
            <div class="max-w-2xl mx-auto w-full flex flex-col h-full">
                {/* Header - Fixed hero section on mobile */}
                <header class="md:relative shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" style="padding-top: env(safe-area-inset-top);">
                    {/* Top bar - Logo and Menu */}
                    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <div class="flex items-center justify-between">
                            {/* Close X Button - Left */}
                            <Show when={params.app} fallback={<div class="w-10"></div>}>
                                <button
                                    onClick={backToApp}
                                    class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </Show>

                            {/* Logo and Title - Center */}
                            <div class="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
                                <img src="/logo.svg" alt="NostrPass" class="w-6 h-6" />
                                <div class="text-gray-900 dark:text-white text-sm font-bold">NOSTRPASS</div>
                            </div>

                            {/* Hamburger Menu Button - Right */}
                            <button
                                onClick={() => setShowMenu(!showMenu())}
                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                aria-label="Menu"
                            >
                                <Show when={!showMenu()} fallback={
                                    <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                }>
                                    <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </Show>
                            </button>
                        </div>

                        {/* Dropdown Menu */}
                        <Show when={showMenu()}>
                            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                                {/* Settings */}
                                <button
                                    onClick={() => {
                                        setShowGlobalSettings(true);
                                        setShowMenu(false);
                                    }}
                                    class="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span class="text-base text-gray-900 dark:text-white">Settings</span>
                                </button>

                                {/* Lock/Unlock */}
                                <button
                                    onClick={() => {
                                        toggleVaultLock();
                                        setShowMenu(false);
                                    }}
                                    class="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <Show when={isVaultLocked()} fallback={
                                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    }>
                                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        </svg>
                                    </Show>
                                    <span class="text-base text-gray-900 dark:text-white">{isVaultLocked() ? 'Unlock Vault' : 'Lock Vault'}</span>
                                </button>

                                {/* Dark Mode */}
                                <button
                                    onClick={() => {
                                        toggleDarkMode();
                                        setShowMenu(false);
                                    }}
                                    class="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <Show when={isDarkMode()} fallback={
                                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    }>
                                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                    </Show>
                                    <span class="text-base text-gray-900 dark:text-white">{isDarkMode() ? 'Light Mode' : 'Dark Mode'}</span>
                                </button>

                                {/* Divider */}
                                <div class="border-t border-gray-200 dark:border-gray-800 my-2"></div>

                                {/* Logout */}
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setShowMenu(false);
                                    }}
                                    class="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span class="text-base font-medium">Logout</span>
                                </button>
                            </div>
                        </Show>
                    </div>

                    <div class="px-4 py-4">
                        {/* Digital ID Card */}
                        <div class="relative bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                            {/* Background watermark logo */}
                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 dark:opacity-10 z-0">
                                <img src="/logo.svg" alt="" class="w-32 h-32" />
                            </div>

                            <Show when={vaultData()?.identities && params.app} fallback={
                                <div class="flex items-start gap-3 p-4">
                                    {/* Fallback when no active identity */}
                                    <div class="w-16 h-16 bg-gray-900 dark:bg-gray-700 rounded-full border-2 border-gray-900 dark:border-gray-600 flex items-center justify-center shadow-sm">
                                        <span class="text-white dark:text-gray-100 text-2xl font-bold">
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
                                            {/* Header spanning full card width */}
                                            <div class="px-4 pt-3 pb-2 flex justify-end border-b-2 border-gray-900 dark:border-gray-600">
                                                <div class="text-xs uppercase tracking-wide font-semibold text-gray-600 dark:text-gray-400">Digital Passport</div>
                                            </div>

                                            {/* Card content - Main layout with grid */}
                                            <div class="grid grid-cols-[1fr_auto] gap-0 relative z-10">
                                                {/* Left section: Two columns (profile + details) over footer */}
                                                <div class="flex flex-col">

                                                    {/* Top: Profile and Details */}
                                                    <div class="flex items-center gap-3 px-4 pt-3 pb-2">
                                                        {/* Column 1: Profile photo only */}
                                                        <div class="flex flex-col items-center justify-center shrink-0 border-r border-gray-300 dark:border-gray-700 pr-3">
                                                            <Show when={activeIdentity.profile?.picture} fallback={
                                                                <div class="w-20 h-20 bg-gray-900 dark:bg-gray-700 rounded-full border-2 border-gray-900 dark:border-gray-600 flex items-center justify-center shadow-sm">
                                                                    <span class="text-white dark:text-gray-100 text-3xl font-bold">
                                                                        {identityInitials}
                                                                    </span>
                                                                </div>
                                                            }>
                                                                <img
                                                                    src={activeIdentity.profile!.picture}
                                                                    alt={activeIdentity.nickname || 'Profile'}
                                                                    class="w-20 h-20 rounded-full object-cover border-2 border-gray-900 dark:border-gray-600 shadow-sm"
                                                                />
                                                            </Show>
                                                        </div>

                                                        {/* Column 2: Name and ID Details */}
                                                        <div class="flex-1 flex flex-col gap-2">
                                                            {/* Name section */}
                                                            <div>
                                                                <h1 class="text-base font-bold tracking-tight text-gray-900 dark:text-white break-words">
                                                                    {activeIdentity.profile?.name || activeIdentity.nickname || 'Personal'}
                                                                </h1>
                                                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                                                    {user()?.profile.username}
                                                                </div>
                                                            </div>

                                                            {/* ID Details - 2x2 Grid */}
                                                            <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                                            <div>
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Issued</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold">
                                                                    {(() => {
                                                                        const timestamp = activeIdentity.isImported ? activeIdentity.importedAt : activeIdentity.createdAt;
                                                                        if (!timestamp) return 'N/A';
                                                                        const date = new Date(timestamp);
                                                                        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Type</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold">
                                                                    {activeIdentity.isImported ? 'BYOK' : 'HD'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">ID No.</div>
                                                                <div class="text-gray-900 dark:text-gray-100 font-semibold font-mono">
                                                                    #{activeIdentity.index.toString().padStart(3, '0')}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div class="text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] mb-0.5">Status</div>
                                                                <div class="text-green-600 dark:text-green-400 font-semibold">
                                                                    ACTIVE
                                                                </div>
                                                            </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bottom: Passport npub */}
                                                    <div class="px-4 pb-3 pt-2 border-t border-gray-300 dark:border-gray-700">
                                                        <div class="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">Passport npub</div>
                                                        <div class="text-[7px] font-mono text-gray-900 dark:text-gray-100 break-all leading-tight">
                                                            {nip19.npubEncode(activeIdentity.publicKey)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right section: VISA column spanning full height */}
                                                <Show when={params.app}>
                                                    <div class="flex items-center justify-center border-l border-gray-300 dark:border-gray-700 w-16 bg-green-50 dark:bg-green-950">
                                                        <div class="transform -rotate-90 whitespace-nowrap text-center">
                                                            <div class="text-[11px] uppercase text-gray-600 dark:text-gray-400 tracking-wider">
                                                                VISA FOR
                                                            </div>
                                                            <div class="text-[11px] font-bold text-gray-900 dark:text-gray-100 mt-1">
                                                                {desanitizeDomain(params.app!).toUpperCase()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>
                                        </>
                                    );
                                })()}
                            </Show>
                        </div>
                    </div>

                    {/* Identities Section Header */}
                    <div class="px-4 pt-3 pb-0 border-t border-gray-200 dark:border-gray-800">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-gray-500 dark:text-gray-400 text-sm font-bold">Identities</h4>
                            <div class="flex gap-2">
                                <button
                                    class="text-gray-500 dark:text-gray-400 text-sm font-bold hover:text-gray-700 dark:hover:text-gray-300 p-2"
                                    onClick={() => {
                                        setIsRefreshing(true);
                                        loadVaultData(true);
                                        setTimeout(() => setIsRefreshing(false), 2000);
                                    }}
                                    title="Refresh vault data"
                                >
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                                <button
                                    class="text-gray-500 dark:text-gray-400 text-sm font-bold hover:text-gray-700 dark:hover:text-gray-300 p-2"
                                    onClick={() => setTriggerAddIdentity(prev => prev + 1)}
                                    title="Add Identity"
                                >
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Search input - only show when more than 4 identities */}
                        <Show when={vaultData()?.identities && vaultData()!.identities.filter((id: any) => !id.archived).length > 4}>
                            <input
                                type="text"
                                placeholder="Search identities..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </Show>
                    </div>
                </header>

                {/* Main Content - Scrollable on mobile */}
                <main class="flex-1 overflow-y-auto md:overflow-visible px-0 py-6">
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
                        triggerAddIdentity={triggerAddIdentity()}
                        hideHeader={true}
                        searchQuery={searchQuery()}
                    />
                </main>

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
