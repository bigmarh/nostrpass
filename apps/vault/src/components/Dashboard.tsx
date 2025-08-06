import { Component, Show, createSignal, For, createMemo, onMount, createEffect } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';

import { useAuth, useMessenger, useCryptoWorker, useEnvironment } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import { nip19 } from 'nostr-tools';
import { VaultTestConsole } from './VaultTestConsole';
import PinPad from './PinPad';
import PINRecovery from './PINRecovery';
import PinSetup from './PinSetup';
import { PermissionService } from '../services/permissionService';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';

export const Dashboard: Component = () => {
    const { user, logout, isVaultLocked, lockVault, unlockVault } = useAuth();
    const { send } = useMessenger();
    const params = useParams();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);
    const [showSearch, setShowSearch] = createSignal(false);
    const [showPinUnlock, setShowPinUnlock] = createSignal(false);
    const [pinUnlockError, setPinUnlockError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);
    const [showRecovery, setShowRecovery] = createSignal(false);
    const [showPinReset, setShowPinReset] = createSignal(false);
    const [recoverySessionToken, setRecoverySessionToken] = createSignal<string | null>(null);
    const [vaultData, setVaultData] = createSignal<any>(null);
    const [tempNewPin, setTempNewPin] = createSignal<string>('');
    const [showPasswordPrompt, setShowPasswordPrompt] = createSignal(false);
    const [passwordForReset, setPasswordForReset] = createSignal('');
    const [showSettingsPanel, setShowSettingsPanel] = createSignal(false);
    const [selectedIdentityKey, setSelectedIdentityKey] = createSignal<string | null>(null);
    const [appPermissions, setAppPermissions] = createSignal<AppPermissions | null>(null);
    const [isSavingPermission, setIsSavingPermission] = createSignal(false);
    const [permissionSaveError, setPermissionSaveError] = createSignal<string | null>(null);
    const cryptoWorker = useCryptoWorker();
    const env = useEnvironment();
    const permissionService = PermissionService.getInstance();
    
    // Debounced sync to Nostr
    let syncTimeout: NodeJS.Timeout | null = null;
    const SYNC_DELAY = 3000; // 3 seconds
    // For now, we'll create a single identity from the user's data
    // In the future, this can be expanded to support multiple identities
    const identities = createMemo(() => {
        const currentUser = user();
        if (!currentUser) return [];

        // Get npub from public key
        let npub = '';
        try {
            npub = nip19.npubEncode(currentUser.publicKey);
        } catch (e) {
            npub = currentUser.publicKey;
        }

        return [{
            nickname: 'Personal',
            publicKey: currentUser.publicKey,
            npub: npub,
            createdAt: new Date(currentUser.profile.createdAt).toISOString(),
            isActive: true
        }];
    });

    const filteredIdentities = createMemo(() => {
        const query = searchQuery().toLowerCase();
        let results = identities();

        if (query) {
            results = results.filter(identity => {
                if (identity.nickname?.toLowerCase().includes(query)) return true;
                if (identity.publicKey?.toLowerCase().includes(query)) return true;
                if (identity.npub?.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        return results;
    });

    const handleLogout = async () => {
        await logout();
        navigate(`/${params.app}`);
    };

    const handleHideVault = () => {
        send('HIDE_VAULT');
    };

    const toggleVaultLock = async () => {
        console.log('🔄 toggleVaultLock called, current lock state:', isVaultLocked());
        
        if (isVaultLocked()) {
            // If locked, show PIN unlock modal
            console.log('🔓 Vault is locked, showing unlock modal');
            
            // Load vault data for recovery
            const currentUser = user();
            if (currentUser?.profile?.username && cryptoWorker) {
                try {
                    const data = await cryptoWorker.getVaultData({ 
                        username: currentUser.profile.username 
                    });
                    setVaultData(data);
                } catch (err) {
                    console.error('Failed to load vault data:', err);
                }
            }
            
            setShowPinUnlock(true);
            setPinUnlockError('');
        } else {
            // If unlocked, lock the vault
            console.log('🔒 Vault is unlocked, attempting to lock...');
            await lockVault();
            console.log('✅ Lock vault completed');
        }
    };

    const backToApp = () => {
        send('HIDE_VAULT');
    };
    
    // Load permissions when settings panel opens
    createEffect(() => {
        if (showSettingsPanel() && params.app) {
            loadAppPermissions();
        }
    });

    const handlePinUnlock = async (pin: string) => {
        setIsUnlocking(true);
        setPinUnlockError('');

        try {
            const success = await unlockVault(pin);
            if (success) {
                setShowPinUnlock(false);
                console.log('✅ Vault unlocked successfully');
            } else {
                setPinUnlockError('Incorrect PIN. Please try again.');
            }
        } catch (error) {
            console.error('Failed to unlock vault:', error);
            
            // Check if the error indicates we need to login again
            if (error instanceof Error && error.message.includes('login with password')) {
                setPinUnlockError('Session expired. Please login with your password.');
                // Close the PIN modal and redirect to login
                setTimeout(() => {
                    setShowPinUnlock(false);
                    navigate(`/${params.app}/login`);
                }, 2000);
            } else {
                setPinUnlockError('Failed to unlock vault. Please try again.');
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    // Load permissions for the current app
    const loadAppPermissions = async () => {
        const currentUser = user();
        if (!currentUser || !params.app) return;
        
        console.log('Loading permissions for app:', params.app);
        
        try {
            const permissions = await permissionService.getAllAppPermissions(currentUser.profile.username);
            console.log('All permissions loaded:', permissions);
            
            const appPerm = permissions.find(p => p.appId === params.app);
            console.log('App permissions found:', appPerm);
            
            if (!appPerm) {
                // Initialize default permissions for new app
                const defaultPermissions: AppPermissions = {
                    appId: params.app,
                    appName: desanitizeDomain(params.app),
                    getPublicKey: 'ASK_EVERYTIME',
                    signData: 'ASK_EVERYTIME',
                    nip04: 'ASK_EVERYTIME',
                    getRelays: 'ASK_EVERYTIME',
                    kinds: {},
                    grantedAt: Date.now(),
                    lastUsedAt: Date.now()
                };
                setAppPermissions(defaultPermissions);
            } else {
                setAppPermissions(appPerm);
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
            // Set default permissions on error
            const defaultPermissions: AppPermissions = {
                appId: params.app,
                appName: desanitizeDomain(params.app),
                getPublicKey: 'ASK_EVERYTIME',
                signData: 'ASK_EVERYTIME',
                nip04: 'ASK_EVERYTIME',
                getRelays: 'ASK_EVERYTIME',
                kinds: {},
                grantedAt: Date.now(),
                lastUsedAt: Date.now()
            };
            setAppPermissions(defaultPermissions);
        }
    };
    
    // Sync permissions to Nostr (debounced)
    const syncPermissionsToNostr = async () => {
        const currentUser = user();
        if (!currentUser || !cryptoWorker) return;
        
        setIsSavingPermission(true);
        setPermissionSaveError(null);
        
        try {
            console.log('Syncing permissions to Nostr...');
            const vaultEvent = await cryptoWorker.saveVaultToNostr({ 
                username: currentUser.profile.username 
            });
            const { publishEvent } = await import('@nostrpass/nostrHelpers');
            await publishEvent(vaultEvent.event, env.getRelays());
            console.log('✅ Permissions synced to Nostr');
            
            // Show success message briefly  
            setPermissionSaveError('✅ Successfully encrypted and saved to Nostr!');
            setTimeout(() => setPermissionSaveError(null), 3000);
        } catch (error: any) {
            console.error('Failed to sync to Nostr:', error);
            if (error.message?.includes('Vault is locked')) {
                setPermissionSaveError('Please unlock your vault with PIN first');
            } else if (error.message?.includes('no xpriv')) {
                setPermissionSaveError('Session expired - please unlock with PIN');
            } else {
                setPermissionSaveError(error.message || 'Failed to save to Nostr');
            }
        } finally {
            setIsSavingPermission(false);
        }
    };
    
    // Handle permission change
    const handlePermissionChange = async (permissionType: string, newLevel: PermissionLevel) => {
        const currentUser = user();
        if (!currentUser || !params.app || !appPermissions()) return;
        
        setIsSavingPermission(true);
        setPermissionSaveError(null);
        
        try {
            // Update local permission
            const updates: Partial<AppPermissions> = {};
            
            if (permissionType === 'getPublicKey') {
                updates.getPublicKey = newLevel;
            } else if (permissionType === 'signEvent') {
                updates.kinds = { ...appPermissions()!.kinds, 1: newLevel }; // Default to kind 1
            } else if (permissionType === 'signData') {
                updates.signData = newLevel;
            } else if (permissionType === 'nip04_encrypt') {
                updates.nip04 = newLevel;
            } else if (permissionType === 'nip04_decrypt') {
                updates.nip04 = newLevel;
            } else if (permissionType === 'getRelays') {
                updates.getRelays = newLevel;
            }
            
            await permissionService.saveAppPermissions(
                currentUser.profile.username,
                params.app,
                updates,
                appPermissions()!.appName || params.app
            );
            
            // Reload permissions to get updated state
            await loadAppPermissions();
            
            // Clear existing sync timeout
            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }
            
            // Schedule sync to Nostr (debounced)
            syncTimeout = setTimeout(() => {
                syncPermissionsToNostr();
            }, SYNC_DELAY);
            
        } catch (error) {
            console.error('Failed to update permission:', error);
            setPermissionSaveError('Failed to save permission');
        } finally {
            setIsSavingPermission(false);
        }
    };
    
    const handlePasswordVerification = async () => {
        if (!cryptoWorker || !recoverySessionToken() || !tempNewPin() || !passwordForReset()) {
            console.error('Missing required data for password verification');
            return;
        }
        
        setIsUnlocking(true);
        setPinUnlockError('');
        
        try {
            // Complete PIN reset in worker
            const result = await cryptoWorker.completePinReset({
                sessionToken: recoverySessionToken()!,
                newPin: tempNewPin(),
                password: passwordForReset()
            });
            
            if (result.success) {
                // Success! Unlock with new PIN
                await handlePinUnlock(tempNewPin());
                
                // Reset the recovery flow state
                setShowRecovery(false);
                setShowPinReset(false);
                setRecoverySessionToken(null);
                setPasswordForReset('');
                setShowPasswordPrompt(false);
            } else {
                throw new Error('Failed to reset PIN');
            }
        } catch (err) {
            setPinUnlockError(err instanceof Error ? err.message : 'Failed to reset PIN');
        } finally {
            setIsUnlocking(false);
            setPasswordForReset('');
        }
    };


    return (
        <div class="min-h-screen bg-gray-100 p-4">
            <div class=" flex flex-col max-w-2xl mx-auto gap-4">
                <div class="bg-white text-black border border-gray-700 rounded-lg">
                    <header>
                        {/* Top row - Action buttons */}
                        <div class={`flex justify-between p-2 ${isVaultLocked() ? 'bg-orange-100 border-orange-200' : 'bg-green-100 border-green-200'} rounded-t-lg p-4 items-center gap-2 border-b`}>
                            <div class="flex items-center gap-2">

                                {/* Back to App button - only show if app is defined */}
                                {params.app && (
                                    <button
                                        onClick={backToApp}
                                        class="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white rounded-lg p-2 flex items-center gap-2 transition-all"
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
                                <span class={`text-sm hidden md:block ${isVaultLocked() ? 'text-orange-700' : 'text-green-700'}`}>Lock</span>
                                <div
                                    onClick={toggleVaultLock}
                                    class="relative inline-flex items-center cursor-pointer"
                                >
                                    <div class={`w-16 h-8 rounded-full transition-colors duration-300 ${isVaultLocked()
                                        ? 'bg-red-200 border-2 border-red-300'
                                        : 'bg-green-200 border-2 border-green-300'
                                        }`}>
                                        <div class={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isVaultLocked() ? 'translate-x-0' : 'translate-x-7'
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
                                <span class={`text-sm hidden md:block ${isVaultLocked() ? 'text-orange-700' : 'text-green-700'}`}>Unlock</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    onClick={handleLogout}
                                    class="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white rounded-lg p-2 flex items-center gap-2 transition-all"
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
                                <div class="font-semibold text-md">{user()?.profile.username.toUpperCase()}</div>
                                <span class="text-xs text-gray-500">Digital Passport</span>
                            </div>

                            <div class="flex items-center">
                                <button
                                    onClick={() => setShowSearch(!showSearch())}
                                    class={`${showSearch() ? 'border-none bg-gray-200 text-black rounded-l-lg   ' : "bg-gray-800 text-white rounded"}  p-3 transition-colors border-none`}
                                    title="Search"
                                >
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <div class={`flex justify-between items-center rounded-r-lg  ${showSearch() ? 'block' : 'hidden'}`}>
                                    <div class="relative ">
                                        <input
                                            type="text"
                                            placeholder="Search by name or public key..."
                                            class="w-full bg-white rounded-r-lg text-sm p-2 pr-2  border border-gray-300 focus:outline-none focus:border-gray-700 transition-colors"
                                            value={searchQuery()}
                                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                        />
                                        {searchQuery() && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                </div>

                            </div>
                        </div>

                        {/* Bottom row - Search */}

                        {/*  <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                            <p class="text-sm text-blue-800">
                                🔒 Your vault is secured with your password. Your private keys are encrypted and stored locally.
                            </p>
                        </div> */}
                    </header>
                    <hr class="border-gray-300" />
                    <main>
                        {/* Identity list */}
                        <div class="flex flex-col gap-2 p-4">
                            <header class="flex justify-between items-center">
                                <h4 class="text-gray-500 text-sm font-bold">Identities</h4>
                                <button class="text-gray-500 text-sm font-bold">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </header>

                            <For each={filteredIdentities()}>
                                {(identity) => (
                                    <div
                                        class={`flex cursor-pointer border rounded-lg p-4 justify-between items-center hover:shadow-md transition-all ${identity.isActive ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'
                                            }`}
                                    >
                                        <div class="flex flex-col justify-start gap-2">
                                            <span class="font-medium text-gray-900">{identity.nickname}</span>
                                            <span class="text-gray-500 text-xs font-mono">
                                                ({identity.npub.substring(0, 8)}...)
                                            </span>
                                        </div>

                                        <div class="flex flex-col justify-end items-end gap-3">
                                            <div class="flex items-center gap-2">
                                                {/* Slide switch */}
                                                <button
                                                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${identity.isActive ? 'bg-gray-700' : 'bg-gray-300'
                                                        } hover:opacity-80`}
                                                    title={identity.isActive ? 'Active identity' : 'Click to activate'}
                                                    disabled
                                                >
                                                    <span class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${identity.isActive ? 'translate-x-6' : 'translate-x-1'
                                                        }`} />
                                                </button>

                                                {/* Settings button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedIdentityKey(identity.publicKey);
                                                        setShowSettingsPanel(true);
                                                    }}
                                                    class="p-1 hover:bg-gray-100 rounded transition-colors border border-gray-200 hover:border-gray-300"
                                                    title="Settings"
                                                >
                                                    <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div class="flex gap-2 items-center">
                                                {params.app && (
                                                    <span class="text-gray-800 text-xs font-medium">
                                                        Connected to {desanitizeDomain(params.app)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>

                            {/* Empty state */}
                            {filteredIdentities().length === 0 && (
                                <div class="text-center py-8 text-gray-500">
                                    {searchQuery()
                                        ? `No identities found matching "${searchQuery()}"`
                                        : 'No identities yet'
                                    }
                                </div>
                            )}
                        </div>



                        {/* Test Console for Development */}
                        <Show when={import.meta.env.DEV}>
                            <VaultTestConsole />
                        </Show>
                        {/* Results count */}

                    </main>

                    {searchQuery() && (
                        <footer class="text-sm py-4 text-right mr-4 text-gray-400">
                            Found {filteredIdentities().length} of {identities().length} Identities
                        </footer>
                    )}
                </div>
            </div>

            {/* PIN Unlock Modal */}
            <Show when={showPinUnlock()}>
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-8 text-center relative max-w-md w-full mx-4">
                        <Show when={!showRecovery() && !showPinReset()}>
                            {/* Header */}
                            <div class="text-center mb-6">
                                <h2 class="text-xl font-semibold mb-2">Unlock Vault</h2>
                                <p class="text-gray-600">Enter your PIN to unlock your vault</p>
                            </div>

                            {/* PIN Entry */}
                            <div class="mb-6">
                                <PinPad
                                    onComplete={handlePinUnlock}
                                    disabled={isUnlocking()}
                                />
                            </div>

                            {/* Error Message */}
                            <Show when={pinUnlockError()}>
                                <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm mb-4">
                                    {pinUnlockError()}
                                </div>
                            </Show>

                            {/* Action Buttons */}
                            <div class="space-y-2 text-center">
                                <button
                                    onClick={() => setShowRecovery(true)}
                                    class="text-sm text-blue-600 hover:text-blue-800 transition-colors block w-full"
                                    disabled={isUnlocking()}
                                >
                                    Forgot PIN?
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPinUnlock(false);
                                        setPinUnlockError('');
                                    }}
                                    class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                    disabled={isUnlocking()}
                                >
                                    Cancel
                                </button>
                            </div>
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
                                    <div class="mt-4 p-4 border-t">
                                        <h3 class="text-lg font-semibold mb-2">Verify Your Password</h3>
                                        <p class="text-sm text-gray-600 mb-4">
                                            Please enter your password to complete the PIN reset.
                                        </p>
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            value={passwordForReset()}
                                            onInput={(e) => setPasswordForReset(e.currentTarget.value)}
                                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') handlePasswordVerification();
                                            }}
                                        />
                                        <div class="flex gap-2">
                                            <button
                                                onClick={handlePasswordVerification}
                                                disabled={!passwordForReset() || isUnlocking()}
                                                class="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400"
                                            >
                                                {isUnlocking() ? 'Resetting PIN...' : 'Complete Reset'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowPasswordPrompt(false);
                                                    setPasswordForReset('');
                                                }}
                                                class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* Settings Side Panel */}
            <Show when={showSettingsPanel()}>
                <div class="fixed inset-0 z-50 overflow-hidden">
                    {/* Backdrop */}
                    <div 
                        class="fixed inset-0 bg-black/50 transition-opacity"
                        onClick={() => setShowSettingsPanel(false)}
                    />
                    
                    {/* Side Panel */}
                    <div class="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto">
                        {/* Panel Header */}
                        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-gray-900">Identity Settings</h2>
                            <button
                                onClick={() => setShowSettingsPanel(false)}
                                class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div class="p-6">
                            <Show when={(() => {
                                const identity = identities().find(id => id.publicKey === selectedIdentityKey());
                                return identity;
                            })()}>
                                {(identity) => (
                                    <div class="space-y-6">
                                        {/* Identity Information Section */}
                                        <div>
                                            <h3 class="text-lg font-medium text-gray-900 mb-3">Identity</h3>
                                            <div class="space-y-3">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-4">
                                                        <span class="text-sm text-gray-600">Name:</span>
                                                        <span class="text-sm font-medium text-gray-900">{identity().nickname}</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-sm text-gray-600">Created:</span>
                                                        <span class="text-sm text-gray-900">{new Date(identity().createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                
                                                <div class="flex items-center justify-between gap-2">
                                                    <span class="text-sm text-gray-600">Public Key</span>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-mono text-gray-500">{identity().publicKey.slice(0, 8)}...</span>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(identity().publicKey)}
                                                            class="text-xs text-blue-600 hover:text-blue-700"
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between gap-2">
                                                    <span class="text-sm text-gray-600">Npub</span>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-mono text-gray-500">{identity().npub.slice(0, 16)}...</span>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(identity().npub)}
                                                            class="text-xs text-blue-600 hover:text-blue-700"
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* App Permissions Section */}
                                        <div class="border-t pt-6">
                                            <h3 class="text-lg font-medium text-gray-900 mb-2">Permissions</h3>
                                            <Show 
                                                when={params.app}
                                                fallback={
                                                    <p class="text-sm text-gray-500">
                                                        No app currently connected
                                                    </p>
                                                }
                                            >
                                                <div class="space-y-3">
                                                    <p class="text-xs text-gray-600">
                                                        What {desanitizeDomain(params.app!)} can do with this identity:
                                                    </p>
                                                    
                                                    {/* Simple Permission List */}
                                                    <div class="divide-y divide-gray-100">
                                                        <Show when={appPermissions()} fallback={
                                                            <p class="text-xs text-gray-500 py-2">Loading permissions...</p>
                                                        }>
                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 hover:bg-gray-50 transition-colors">
                                                                <span class="text-sm text-gray-700">Read Public Key</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.getPublicKey || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('getPublicKey', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>

                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                                                <span class="text-sm text-gray-700">Sign Events</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.kinds?.[1] || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('signEvent', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>

                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 hover:bg-gray-50 transition-colors">
                                                                <span class="text-sm text-gray-700">Sign Data</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.signData || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('signData', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>

                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                                                <span class="text-sm text-gray-700">Encrypt Messages (NIP-04)</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.nip04 || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('nip04_encrypt', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>

                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 hover:bg-gray-50 transition-colors">
                                                                <span class="text-sm text-gray-700">Decrypt Messages (NIP-04)</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.nip04 || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('nip04_decrypt', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>

                                                            <div class="flex items-center justify-between py-2.5 px-3 -mx-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                                                <span class="text-sm text-gray-700">Access Relay List</span>
                                                                <select 
                                                                    class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                                                    value={appPermissions()?.getRelays || 'ASK_EVERYTIME'}
                                                                    onChange={(e) => handlePermissionChange('getRelays', e.currentTarget.value as PermissionLevel)}
                                                                    disabled={isSavingPermission()}
                                                                >
                                                                    <option value="ALLOW">Allowed</option>
                                                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                                                    <option value="DENY">Blocked</option>
                                                                </select>
                                                            </div>
                                                        </Show>
                                                        
                                                        <Show when={permissionSaveError()}>
                                                            <p class={`text-xs mt-2 ${permissionSaveError()?.includes('Successfully') ? 'text-green-600' : 'text-red-600'}`}>
                                                                {permissionSaveError()}
                                                            </p>
                                                        </Show>
                                                        
                                                        <Show when={isSavingPermission()}>
                                                            <p class="text-xs text-gray-500 mt-2">Saving...</p>
                                                        </Show>
                                                        
                                                        <div class="mt-4 pt-4 border-t border-gray-200">
                                                            <button
                                                                onClick={syncPermissionsToNostr}
                                                                class="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={isSavingPermission()}
                                                            >
                                                                {isSavingPermission() ? 'Saving...' : 'Save to Nostr'}
                                                            </button>
                                                            <p class="text-xs text-gray-500 mt-2">
                                                                Backup your settings to Nostr for cross-device sync
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>

                                    </div>
                                )}
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};