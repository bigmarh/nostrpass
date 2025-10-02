import { Component, Show, createSignal, For, createMemo, onMount, createEffect } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';

import { useAuth, useMessenger, useCryptoWorker, useDarkModeContext } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import { nip19 } from 'nostr-tools';
import { VaultTestConsole } from './VaultTestConsole';
import PinPad from './PinPad';
import PINRecovery from './PINRecovery';
import PinSetup from './PinSetup';
import { PermissionsSection } from './PermissionsSection';
import { PermissionService } from '../services/permissionService';
import { useVaultData } from '../hooks/useVaultData';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';
import RelaySettings from './RelaySettings';

export const Dashboard: Component = () => {
    const { user, logout, isVaultLocked, lockVault, unlockVault } = useAuth();
    const { send } = useMessenger();
    const params = useParams();
    const navigate = useNavigate();
    const { isDarkMode, toggleDarkMode } = useDarkModeContext();
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);
  const [newIdentityNickname, setNewIdentityNickname] = createSignal('');
    const [showSearch, setShowSearch] = createSignal(false);
    const [showPinUnlock, setShowPinUnlock] = createSignal(false);
    const [pinUnlockError, setPinUnlockError] = createSignal('');
    const [isUnlocking, setIsUnlocking] = createSignal(false);
    const [showRecovery, setShowRecovery] = createSignal(false);
    const [showPinReset, setShowPinReset] = createSignal(false);
    const [recoverySessionToken, setRecoverySessionToken] = createSignal<string | null>(null);
    const [tempNewPin, setTempNewPin] = createSignal<string>('');
    const [showPasswordPrompt, setShowPasswordPrompt] = createSignal(false);
    const [passwordForReset, setPasswordForReset] = createSignal('');
    const [showSettingsPanel, setShowSettingsPanel] = createSignal(false);
    const [selectedIdentityKey, setSelectedIdentityKey] = createSignal<string | null>(null);
    const [showGlobalSettings, setShowGlobalSettings] = createSignal(false);
    const [appPermissions, setAppPermissions] = createSignal<AppPermissions | null>(null);
    const [isRefreshing, setIsRefreshing] = createSignal(false);
    const [isSavingPermission, setIsSavingPermission] = createSignal(false);
    const [permissionSaveError, setPermissionSaveError] = createSignal<string | null>(null);
    const [syncQueueStatus, setSyncQueueStatus] = createSignal({ length: 0, isProcessing: false });
    const [showIdentitySelection, setShowIdentitySelection] = createSignal(false);
    const [identitySelectionCallback, setIdentitySelectionCallback] = createSignal<((identityIndex: number) => void) | null>(null);
    const [isConnectingIdentity, setIsConnectingIdentity] = createSignal(false);
    const [identityOperationError, setIdentityOperationError] = createSignal<string | null>(null);
    const [isSyncing, setIsSyncing] = createSignal(false);
    const [isGettingFromNostr, setIsGettingFromNostr] = createSignal(false);
    const [syncMessage, setSyncMessage] = createSignal<string | null>(null);
    const [syncStatus, setSyncStatus] = createSignal<'success' | 'error' | null>(null);

    const cryptoWorker = useCryptoWorker();
    const permissionService = PermissionService.getInstance();

    // Use the vault data hook
    const { vaultData, loadVaultData, syncToNostr, getVaultFromNostr, updateVaultData, switchIdentity } = useVaultData({ autoLoad: true });

    // Active identity is now tracked separately per app via vaultData.activeIdentityByApp.
    // We no longer prune permissions to enforce exclusivity.

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
            // Clean up sync queue on unmount
            clearSyncQueue();
        };
    });

    // Sync to Nostr immediately (no debouncing)

    // Queuing system for Nostr sync operations
    let syncQueue: Array<() => Promise<void>> = [];
    let isProcessingQueue = false;

    const processSyncQueue = async () => {
        if (isProcessingQueue || syncQueue.length === 0) return;

        isProcessingQueue = true;
        setSyncQueueStatus({ length: syncQueue.length, isProcessing: true });
        console.log('🔄 Processing sync queue, items:', syncQueue.length);

        try {
            while (syncQueue.length > 0) {
                const syncOperation = syncQueue.shift();
                if (syncOperation) {
                    try {
                        console.log('🔄 Executing sync operation...');
                        await syncOperation();
                        console.log('✅ Sync operation completed');
                    } catch (error) {
                        console.error('❌ Sync operation failed:', error);
                        // Continue processing other items in queue
                    }
                }
                // Update status after each operation
                setSyncQueueStatus({ length: syncQueue.length, isProcessing: true });
            }
        } catch (error) {
            console.error('❌ Queue processing error:', error);
        } finally {
            isProcessingQueue = false;
            setSyncQueueStatus({ length: 0, isProcessing: false });
            console.log('✅ Sync queue processing complete');
        }
    };

    const queueSyncToNostr = async () => {
        return new Promise<void>((resolve, reject) => {
            const syncOperation = async () => {
                try {
                    await syncToNostr();
                    console.log('✅ Queued Nostr sync completed successfully');
                    setPermissionSaveError('✅ Settings saved to Nostr');
                    setTimeout(() => setPermissionSaveError(null), 3000);
                    resolve(); // Resolve the promise when sync completes
                } catch (error: any) {
                    console.error('❌ Queued Nostr sync failed:', error);
                    if (error.message?.includes('Vault is locked')) {
                        setPermissionSaveError('Please unlock your vault with PIN first');
                    } else if (error.message?.includes('no xpriv')) {
                        setPermissionSaveError('Session expired - please unlock with PIN');
                    } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
                        setPermissionSaveError('Nostr sync timed out - settings saved locally but may not be synced to all relays');
                    } else if (error.message?.includes('Failed to publish to any relay')) {
                        setPermissionSaveError('Failed to sync to Nostr relays - settings saved locally');
                    } else {
                        setPermissionSaveError(error.message || 'Failed to save to Nostr');
                    }
                    reject(error); // Reject the promise when sync fails
                }
            };

            // Add to queue
            syncQueue.push(syncOperation);
            setSyncQueueStatus({ length: syncQueue.length, isProcessing: isProcessingQueue });
            console.log('📋 Added sync operation to queue, queue length:', syncQueue.length);

            // Limit queue size to prevent memory issues
            if (syncQueue.length > 10) {
                console.log('⚠️ Queue too long, removing oldest items');
                syncQueue = syncQueue.slice(-5); // Keep only the 5 most recent
                setSyncQueueStatus({ length: syncQueue.length, isProcessing: isProcessingQueue });
            }

            // Start processing if not already running
            processSyncQueue().catch(error => {
                console.error('❌ Queue processing failed:', error);
                reject(error);
            });
        });
    };

    const clearSyncQueue = () => {
        console.log('🧹 Clearing sync queue, items:', syncQueue.length);
        syncQueue = [];
        isProcessingQueue = false;
        setSyncQueueStatus({ length: 0, isProcessing: false });
    };

    // Load vault data when user changes
    createEffect(() => {
        if (user()) {
            loadVaultData();
        }
    });

    // Create identities from vault data with proper app permission checking
    const identities = createMemo(() => {
        const currentUser = user();
        const vault = vaultData();

        if (!currentUser || !vault?.identities) {
            // Fallback to basic identity from user data
            let npub = '';
            try {
                npub = nip19.npubEncode(currentUser?.publicKey || '');
            } catch (e) {
                npub = currentUser?.publicKey || '';
            }

            return currentUser ? [{
                nickname: 'Personal',
                publicKey: currentUser.publicKey,
                npub: npub,
                createdAt: new Date(currentUser.profile.createdAt).toISOString(),
                isActive: true,
                hasAppPermissions: false,
                connectedApps: [],
                otherConnectedApps: [],
                index: 0
            }] : [];
        }

        // Use real vault identities - this will now be reactive to vault data changes
            const activeIndex = params.app ? (vault.activeIdentityByApp?.[params.app] ?? null) : null;
            return vault.identities.map((identity: any, index: number) => {
            // Get npub from public key
            let npub = '';
            try {
                npub = nip19.npubEncode(identity.publicKey);
            } catch (e) {
                npub = identity.publicKey;
            }

            // Check if this identity has permissions for the current app (authorization)
            const hasAppPermissions = params.app && identity.appPermissions?.[params.app];
            const connectedApps = identity.appPermissions ? Object.keys(identity.appPermissions) : [];
            const otherConnectedApps = connectedApps.filter(app => app !== params.app);

            return {
                nickname: identity.nickname || 'Personal',
                publicKey: identity.publicKey,
                npub: npub,
                createdAt: identity.createdAt || new Date().toISOString(),
                isActive: activeIndex === index,
                hasAppPermissions,
                connectedApps,
                otherConnectedApps,
                index
            };
        });
    });

    const filteredIdentities = createMemo(() => {
        const query = searchQuery().toLowerCase();
        let results = identities();

        if (query) {
            results = results.filter((identity: any) => {
                if (identity.nickname?.toLowerCase().includes(query)) return true;
                if (identity.publicKey?.toLowerCase().includes(query)) return true;
                if (identity.npub?.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        return results;
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

    const handleHideVault = () => {
        send('HIDE_VAULT');
    };

    const toggleVaultLock = async () => {
        if (isVaultLocked()) {
            // If locked, show PIN unlock modal

            // Load vault data for recovery
            await loadVaultData();

            setShowPinUnlock(true);
            setPinUnlockError('');
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
            } else {
                setPinUnlockError('Incorrect PIN. Please try again.');
            }
        } catch (error) {

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

    // Create default permissions for a new app
    const createDefaultPermissions = (appId: string): AppPermissions => ({
        appId,
        appName: desanitizeDomain(appId),
        permissions: {
            social: 'ALLOW',
            messaging: 'ASK_EVERYTIME',
            signData: 'ASK_EVERYTIME',
            financial: 'ASK_EVERYTIME'
        },
        getPublicKey: 'ALLOW',
        grantedAt: Date.now(),
        lastUsedAt: Date.now()
    });

    // Load permissions for the current app and identity
    const loadAppPermissions = async () => {
        const currentUser = user();
        if (!currentUser || !params.app) return;

        console.log('🔄 Loading app permissions for:', params.app);
        try {
            const idx = vaultData()?.activeIdentityByApp?.[params.app] ?? 0;
            const appPerm = await permissionService.getAppPermissions(
                currentUser.profile.username,
                params.app,
                idx
            );
            if (appPerm) {
                console.log('🎯 App permissions details:', JSON.stringify(appPerm, null, 2));
                setAppPermissions(appPerm);
            } else {
                setAppPermissions(createDefaultPermissions(params.app));
            }
        } catch (error) {
            console.error('❌ Error loading app permissions:', error);
            setAppPermissions(createDefaultPermissions(params.app));
        }
    };



    // Manual sync function for user-triggered sync
    const handleManualSync = async () => {
        const currentUser = user();
        if (!currentUser) return;

        setIsSyncing(true);
        setSyncMessage(null);
        setSyncStatus(null);

        try {
            console.log('🔄 Manual sync triggered...');
            await syncToNostr();
            console.log('✅ Manual sync completed successfully');
            setSyncStatus('success');
            setSyncMessage('Vault synced to Nostr successfully!');
            // Clear message after 3 seconds
            setTimeout(() => {
                setSyncMessage(null);
                setSyncStatus(null);
            }, 3000);
        } catch (error: any) {
            console.error('❌ Manual sync failed:', error);
            setSyncStatus('error');
            setSyncMessage(error.message || 'Failed to sync to Nostr');
            // Clear message after 5 seconds
            setTimeout(() => {
                setSyncMessage(null);
                setSyncStatus(null);
            }, 5000);
        } finally {
            setIsSyncing(false);
        }
    };

    // Test queue function for debugging
    const handleTestQueue = async () => {
        console.log('🧪 Testing queue system...');
        console.log('Current queue status:', syncQueueStatus());
        console.log('Queue length:', syncQueue.length);
        console.log('Is processing:', isProcessingQueue);

        // Add a test operation to the queue
        const testOperation = async () => {
            console.log('🧪 Test operation executing...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate 1 second work
            console.log('🧪 Test operation completed');
        };

        syncQueue.push(testOperation);
        setSyncQueueStatus({ length: syncQueue.length, isProcessing: isProcessingQueue });
        processSyncQueue();
    };

    // Test permission save/load cycle
    const handleTestPermissionCycle = async () => {
        const currentUser = user();
        if (!currentUser || !params.app) return;

        console.log('🧪 Testing permission save/load cycle...');

        // 1. Load current permissions
        console.log('📋 Step 1: Loading current permissions...');
        await loadAppPermissions();
        const currentPerms = appPermissions();
        console.log('📋 Current permissions:', JSON.stringify(currentPerms, null, 2));

        // 2. Save a test permission
        console.log('📋 Step 2: Saving test permission...');
        const testUpdates: any = {
            permissions: {
                social: 'ALLOW',
                messaging: currentPerms?.permissions?.messaging || 'ASK_EVERYTIME',
                signData: currentPerms?.permissions?.signData || 'ASK_EVERYTIME',
                financial: currentPerms?.permissions?.financial || 'ASK_EVERYTIME'
            }
        };

        await permissionService.saveAppPermissions(
            currentUser.profile.username,
            params.app,
            testUpdates,
            currentPerms?.appName || params.app
        );
        console.log('✅ Test permission saved');

        // 3. Load permissions again
        console.log('📋 Step 3: Loading permissions again...');
        await loadAppPermissions();
        const newPerms = appPermissions();
        console.log('📋 New permissions:', JSON.stringify(newPerms, null, 2));

        // 4. Check if they match
        console.log('📋 Step 4: Comparing permissions...');
        const socialPermission = newPerms?.permissions?.social;
        console.log('🎯 Social permission is now:', socialPermission);

        if (socialPermission === 'ALLOW') {
            console.log('✅ Test PASSED - permission persisted correctly');
        } else {
            console.log('❌ Test FAILED - permission did not persist');
        }
    };

    // Get vault from Nostr function
    const handleGetFromNostr = async () => {
        const currentUser = user();
        if (!currentUser) return;

        setIsGettingFromNostr(true);
        setSyncMessage(null);
        setSyncStatus(null);

        try {
            console.log('🔄 Getting vault from Nostr...');
            const result = await getVaultFromNostr();
            if (result) {
                console.log('✅ Vault retrieved from Nostr:', {
                    eventId: result.eventId,
                    timestamp: new Date(result.timestamp).toISOString(),
                    identitiesCount: result.vaultData.identities?.length || 0
                });
                setSyncStatus('success');
                setSyncMessage(`Retrieved vault from Nostr (${result.vaultData.identities?.length || 0} identities)`);
                // Clear message after 3 seconds
                setTimeout(() => {
                    setSyncMessage(null);
                    setSyncStatus(null);
                }, 3000);
            } else {
                console.log('ℹ️ No vault found on Nostr');
                setSyncStatus('error');
                setSyncMessage('No vault data found on Nostr relays');
                setTimeout(() => {
                    setSyncMessage(null);
                    setSyncStatus(null);
                }, 5000);
            }
        } catch (error: any) {
            console.error('❌ Failed to get vault from Nostr:', error);
            setSyncStatus('error');
            setSyncMessage(error.message || 'Failed to retrieve vault from Nostr');
            setTimeout(() => {
                setSyncMessage(null);
                setSyncStatus(null);
            }, 5000);
        } finally {
            setIsGettingFromNostr(false);
        }
    };

    // Handle permission change
    const handlePermissionChange = async (permissionType: string, newLevel: PermissionLevel) => {
        const currentUser = user();
        if (!currentUser || !params.app || !appPermissions()) return;

        // Preflight: ensure worker has keys; if not, prompt for PIN and abort this attempt
        try {
            const crypto = cryptoWorker;
            if (!crypto) throw new Error('Crypto worker not ready');
            const status: any = await crypto.hasKeysInSession({ username: currentUser.profile.username });
            const hasSigningKey = !!(status?.hasPrivateKey || status?.hasXpriv);
            if (!hasSigningKey) {
                setPermissionSaveError('Unlock required to continue');
                setShowPinUnlock(true);
                return;
            }
        } catch (e) {
            console.warn('Preflight key check failed:', e);
        }

        console.log('🔄 Starting permission change...');
        setIsSavingPermission(true);
        setPermissionSaveError(null);

        try {
            // Update local permission
            const updates: Partial<AppPermissions> = {};

            if (permissionType === 'getPublicKey') {
                updates.getPublicKey = newLevel;
            } else if (permissionType === 'social') {
                updates.permissions = {
                    ...appPermissions()!.permissions,
                    social: newLevel
                };
            } else if (permissionType === 'messaging') {
                updates.permissions = {
                    ...appPermissions()!.permissions,
                    messaging: newLevel
                };
            } else if (permissionType === 'signData') {
                updates.permissions = {
                    ...appPermissions()!.permissions,
                    signData: newLevel
                };
            } else if (permissionType === 'financial') {
                updates.permissions = {
                    ...appPermissions()!.permissions,
                    financial: newLevel
                };
            }

            console.log('💾 Saving app permissions...');
            console.log('📋 Current vault data before save:', JSON.stringify(vaultData(), null, 2));
            console.log('🔧 Permission updates:', JSON.stringify(updates, null, 2));

            try {
                const identityIndex = vaultData()?.activeIdentityByApp?.[params.app] ?? undefined;
                await permissionService.saveAppPermissions(
                    currentUser.profile.username,
                    params.app,
                    updates,
                    appPermissions()!.appName || params.app,
                    identityIndex
                );
                console.log('✅ App permissions saved locally');

                // Reload vault data to see the changes
                await loadVaultData();
                console.log('📋 Vault data after save:', JSON.stringify(vaultData(), null, 2));
            } catch (error) {
                console.error('❌ Error in saveAppPermissions:', error);
                throw error;
            }

            // Reload permissions to get updated state
            console.log('🔄 Reloading permissions...');
            await loadAppPermissions();
            console.log('✅ Permissions reloaded');

            // Clear saving state immediately after local save
            console.log('🏁 Clearing saving state...');
            setIsSavingPermission(false);

            // Sync to Nostr in background (don't await)
            console.log('🔄 Starting Nostr sync in background...');
            const sync = async () => {
                try {
                    const status: any = await cryptoWorker!.hasKeysInSession({ username: currentUser.profile.username });
                    const hasStorageSigning = !!(status?.hasXpriv || status?.hasStorageKeypair);
                    if (!hasStorageSigning) {
                        setPermissionSaveError('Unlock required to sync to Nostr');
                        setShowPinUnlock(true);
                        return;
                    }
                    await syncToNostr();
                    console.log('✅ Nostr sync completed successfully');
                    setPermissionSaveError('✅ Settings saved');
                    setTimeout(() => setPermissionSaveError(null), 3000);
                } catch (error: any) {
                    throw error;
                }
            };
            sync().catch((error: any) => {
                console.error('❌ Nostr sync failed:', error);
                if (error.message?.includes('Vault is locked')) {
                    setPermissionSaveError('Please unlock your vault with PIN first');
                    setShowPinUnlock(true);
                } else if (error.message?.includes('no xpriv') || error.message?.includes('No xpriv access')) {
                    setPermissionSaveError('Session expired - please unlock with PIN');
                    setShowPinUnlock(true);
                } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
                    setPermissionSaveError('Nostr sync timed out - settings saved locally but may not be synced to all relays');
                } else if (error.message?.includes('Failed to publish to any relay')) {
                    setPermissionSaveError('Failed to sync to Nostr relays - settings saved locally');
                } else {
                    setPermissionSaveError(error.message || 'Failed to save to Nostr');
                }
            });

        } catch (error) {
            console.error('❌ Permission save failed:', error);
            setPermissionSaveError('Failed to save permission');
            setIsSavingPermission(false);
        }
    };

    const handlePasswordVerification = async () => {
        if (!cryptoWorker || !recoverySessionToken() || !tempNewPin() || !passwordForReset()) {
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

    // Show identity selection modal
    const showIdentitySelectionModal = (callback: (identityIndex: number) => void) => {
        setIdentitySelectionCallback(() => callback);
        setShowIdentitySelection(true);
    };

    // Handle identity selection
    const handleIdentitySelection = (identityIndex: number) => {
        const callback = identitySelectionCallback();
        if (callback) {
            callback(identityIndex);
        }
        setShowIdentitySelection(false);
        setIdentitySelectionCallback(null);
    };

    // Handle identity switching (local to this tab/app only)
    const handleIdentitySwitch = async (identityIndex: number) => {
        try {
            await switchIdentity(identityIndex);
        } catch (error) {
            console.error('Failed to switch identity:', error);
        }
    };

    // Set active identity for this app (does not change authorization)
    const handleSetActiveIdentityForApp = async (identityIndex: number) => {
        if (!params.app) return;
        const currentVault = vaultData();
        if (!currentVault) return;

        try {
            const updatedActive = {
                ...(currentVault.activeIdentityByApp || {}),
                [params.app]: identityIndex
            };
            // Save locally first (fast, non-blocking)
            await updateVaultData({ activeIdentityByApp: updatedActive }, { syncToNostr: false });
            
            // Sync to Nostr in background (non-blocking)
            (async () => {
                try {
                    await syncToNostr();
                } catch (error) {
                    console.warn('Background sync failed (non-critical):', error);
                }
            })();
        } catch (error) {
            console.error('Failed to set active identity for app:', error);
        }
    };

    // Unset active identity for this app (keeps authorization intact)
    const handleUnsetActiveIdentityForApp = async () => {
        if (!params.app) return;
        const currentVault = vaultData();
        if (!currentVault) return;

        try {
            const updatedActive = {
                ...(currentVault.activeIdentityByApp || {}),
                [params.app]: null
            };
            // Save locally first (fast, non-blocking)
            await updateVaultData({ activeIdentityByApp: updatedActive }, { syncToNostr: false });
            
            // Sync to Nostr in background (non-blocking)
            (async () => {
                try {
                    await syncToNostr();
                } catch (error) {
                    console.warn('Background sync failed (non-critical):', error);
                }
            })();
        } catch (error) {
            console.error('Failed to unset active identity for app:', error);
        }
    };

    // Explicitly authorize an identity for this app by creating default permissions, and set it active
    const handleAuthorizeIdentityForApp = async (identityIndex: number) => {
        console.log('🔐 [Authorize] Starting authorization for identity:', identityIndex, 'app:', params.app);
        
        if (!params.app) {
            console.error('❌ [Authorize] No app parameter');
            return;
        }
        
        const currentVault = vaultData();
        if (!currentVault) {
            console.error('❌ [Authorize] No vault data');
            return;
        }

        try {
            console.log('✅ [Authorize] Creating default permissions for:', params.app);
            const defaultPermissions = createDefaultPermissions(params.app);
            
            console.log('📝 [Authorize] Updating identities...');
            const updatedIdentities = currentVault.identities.map((id: any, idx: number) => {
                if (idx !== identityIndex) return id;
                const updated = { ...id };
                if (!updated.appPermissions) updated.appPermissions = {};
                updated.appPermissions[params.app] = updated.appPermissions[params.app] || defaultPermissions;
                return updated;
            });
            
            const updatedActive = {
                ...(currentVault.activeIdentityByApp || {}),
                [params.app]: identityIndex
            };
            
            console.log('💾 [Authorize] Saving to vault data...');
            
            // Add timeout to prevent hanging
            const savePromise = updateVaultData({ identities: updatedIdentities, activeIdentityByApp: updatedActive }, { syncToNostr: false });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Save timeout after 5s')), 5000)
            );
            
            await Promise.race([savePromise, timeoutPromise]);
            console.log('✅ [Authorize] Authorization complete (saved locally)!');
            
            // Sync to Nostr in background (non-blocking)
            (async () => {
                try {
                    console.log('📡 [Authorize] Syncing to Nostr in background...');
                    await syncToNostr();
                    console.log('✅ [Authorize] Synced to Nostr');
                } catch (error) {
                    console.warn('⚠️ [Authorize] Nostr sync failed (non-critical):', error);
                }
            })();
        } catch (error) {
            console.error('❌ [Authorize] Failed to authorize identity for app:', error);
            // Show error to user
            alert(`Failed to authorize identity: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    // Handle connecting an identity to the current app
    const handleConnectIdentity = async (identityIndex: number) => {
        // Check if we have an active vault session
        if (!user() || !params.app) {
            console.warn('Cannot connect identity: no active vault session or app parameter');
            return;
        }

        // Check if vault is locked before proceeding
        if (isVaultLocked()) {
            console.warn('Cannot connect identity: vault is locked');
            return;
        }

        setIsConnectingIdentity(true);
        setIdentityOperationError(null);

        try {
            // Create default permissions for the new connection
            const defaultPermissions = createDefaultPermissions(params.app);

            // Get current vault data
            const currentVault = vaultData();
            if (!currentVault) {
                console.warn('Cannot connect identity: no vault data available');
                return;
            }

            // Create updated identities array
            const updatedIdentities = [...currentVault.identities];
            if (!updatedIdentities[identityIndex].appPermissions) {
                updatedIdentities[identityIndex].appPermissions = {};
            }
            updatedIdentities[identityIndex].appPermissions[params.app] = defaultPermissions;

            // Update vault data with the new identities
            await updateVaultData({
                identities: updatedIdentities
            });

            console.log('✅ Identity connected successfully');
        } catch (error: any) {
            console.error('Failed to connect identity:', error);

            // Check if it's a timeout error and provide user feedback
            if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
                const errorMsg = 'Nostr sync timed out - identity saved locally but may not be synced to all relays';
                console.warn(errorMsg);
                setIdentityOperationError(errorMsg);
            } else if (error.message?.includes('Failed to publish to any relay')) {
                const errorMsg = 'Failed to sync to Nostr relays - identity saved locally only';
                console.warn(errorMsg);
                setIdentityOperationError(errorMsg);
            } else {
                setIdentityOperationError(error.message || 'Failed to connect identity');
            }

            // Clear error after 5 seconds
            setTimeout(() => setIdentityOperationError(null), 5000);

            // Re-throw the error so the UI can handle it appropriately
            throw error;
        } finally {
            setIsConnectingIdentity(false);
        }
    };

    // Handle disconnecting an identity from an app
    const handleDisconnectIdentity = async (identityIndex: number, appId: string) => {
        // Check if we have an active vault session
        if (!user()) {
            console.warn('Cannot disconnect identity: no active vault session');
            return;
        }

        // Check if vault is locked before proceeding
        if (isVaultLocked()) {
            console.warn('Cannot disconnect identity: vault is locked');
            return;
        }

        setIsConnectingIdentity(true);
        setIdentityOperationError(null);

        try {
            // Get current vault data
            const currentVault = vaultData();
            if (!currentVault) {
                console.warn('Cannot disconnect identity: no vault data available');
                return;
            }

            // Create updated identities array
            const updatedIdentities = [...currentVault.identities];
            if (updatedIdentities[identityIndex].appPermissions) {
                delete updatedIdentities[identityIndex].appPermissions[appId];
            }

            // Update vault data with the new identities
            await updateVaultData({
                identities: updatedIdentities
            });

            console.log('✅ Identity disconnected successfully');
        } catch (error: any) {
            console.error('Failed to disconnect identity:', error);

            // Check if it's a timeout error and provide user feedback
            if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
                const errorMsg = 'Nostr sync timed out - identity saved locally but may not be synced to all relays';
                console.warn(errorMsg);
                setIdentityOperationError(errorMsg);
            } else if (error.message?.includes('Failed to publish to any relay')) {
                const errorMsg = 'Failed to sync to Nostr relays - identity saved locally only';
                console.warn(errorMsg);
                setIdentityOperationError(errorMsg);
            } else {
                setIdentityOperationError(error.message || 'Failed to disconnect identity');
            }

            // Clear error after 5 seconds
            setTimeout(() => setIdentityOperationError(null), 5000);

            // Re-throw the error so the UI can handle it appropriately
            throw error;
        } finally {
            setIsConnectingIdentity(false);
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

                                {/* Sync indicators removed from header */}
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

                            <div class="flex items-center">
                                {/* Search */}
                                <div class={`relative ${showSearch() ? 'w-64 md:w-80' : 'w-10'} transition-all duration-200`}>
                                    <button
                                        onClick={() => setShowSearch(s => !s)}
                                        class={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-md transition-colors ${showSearch() ? 'text-gray-600 dark:text-gray-300 hover:bg-transparent' : 'text-white bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                                        title="Search"
                                    >
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Search identities (name, npub, pubkey)"
                                        class={`pl-9 pr-8 py-2 rounded-md border text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${showSearch() ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity
                                            bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400`}
                                        value={searchQuery()}
                                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                        onBlur={() => {
                                            if (!searchQuery()) setShowSearch(false);
                                        }}
                                        autofocus
                                    />
                                    <Show when={searchQuery()}>
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 p-1"
                                            title="Clear"
                                        >
                                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </Show>
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
                    <hr class="border-gray-300 dark:border-gray-700" />
                    <main>
                        {/* Identity list */}
                        <div class="flex flex-col gap-2 p-4">
                            <header class="flex justify-between items-center">
                                <h4 class="text-gray-500 dark:text-gray-400 text-sm font-bold">Identities</h4>
                                <div class="flex gap-2">
                                    <button 
                                        class="text-gray-500 dark:text-gray-400 text-sm font-bold hover:text-gray-700 dark:hover:text-gray-300" 
                                        onClick={() => loadVaultData(true)} 
                                        title="Refresh vault data"
                                    >
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button class="text-gray-500 dark:text-gray-400 text-sm font-bold hover:text-gray-700 dark:hover:text-gray-300" onClick={() => setShowAddIdentityModal(true)} title="Add Identity">
                                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </header>

                            <For each={filteredIdentities()}>
                                {(identity) => (
                                    <div
                                        class={`flex flex-col cursor-pointer border rounded-lg p-4 justify-between items-center hover:shadow-md dark:hover:shadow-lg transition-all ${identity.isActive ? 'border-gray-700 dark:border-gray-500 bg-gray-200 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <div class="flex flex-row justify-between w-full items-center ">
                                            <div class="flex flex-col justify-start gap-2">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-medium text-gray-900 dark:text-gray-100">{identity.nickname}</span>
                                                    <Show when={identity.isActive}>
                                                        <span class="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                                                            Active
                                                        </span>
                                                    </Show>
                                                </div>
                                                <span class="text-gray-500 dark:text-gray-400 text-xs font-mono">
                                                    ({identity.npub.substring(0, 8)}...)
                                                </span>
                                            </div>

                                            <div class="flex flex-col justify-end items-end gap-3">
                                                <div class="flex items-center gap-2">
                                                    {/* Slide switch */}
                                                    <Show when={!isVaultLocked()}>
                                                        <button
                                                            onClick={() => {
                                                                if (identity.isActive) {
                                                                    // Toggle off = just unset active; keep authorization
                                                                    handleUnsetActiveIdentityForApp();
                                                                } else if (identity.hasAppPermissions) {
                                                                    // Toggle on = set as active if authorized
                                                                    handleSetActiveIdentityForApp(identity.index);
                                                                } else {
                                                                    // Not authorized: open settings to authorize first
                                                                    setSelectedIdentityKey(identity.publicKey);
                                                                    setShowSettingsPanel(true);
                                                                }
                                                            }}
                                                            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${identity.isActive ? 'bg-gray-700 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
                                                                } hover:opacity-80`}
                                                            title={identity.isActive ? 'Active identity for this app' : (identity.hasAppPermissions ? 'Make active for this app' : 'Authorize before making active')}
                                                        >
                                                            <span class={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 transition-transform ${identity.isActive ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                        </button>
                                                    </Show>
                                                    <Show when={isVaultLocked()}>
                                                        <div class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 opacity-50">
                                                            <span class="inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 translate-x-1" />
                                                        </div>
                                                    </Show>


                                                </div>

                                            </div>
                                        </div>
                                        {/* Connected to */}
                                        <div class="flex flex-row justify-between w-full mt-4 items-center">
                                            <div>
                                                <Show when={identity.hasAppPermissions}>
                                                    <span class="text-green-600 dark:text-green-400 text-xs font-medium">
                                                        Authorized for {desanitizeDomain(params.app)}
                                                    </span>
                                                </Show>
                                                <Show when={!identity.hasAppPermissions && params.app && !isVaultLocked()}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedIdentityKey(identity.publicKey);
                                                            setShowSettingsPanel(true);
                                                        }}
                                                        class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                        title={`Authorize ${identity.nickname} for ${desanitizeDomain(params.app)}`}
                                                    >
                                                        Use this ID with {desanitizeDomain(params.app)}

                                                    </button>
                                                </Show>
                                                <Show when={!identity.hasAppPermissions && params.app && isVaultLocked()}>
                                                    <span class="text-gray-400 dark:text-gray-500 text-xs">
                                                        Unlock vault to authorize
                                                    </span>
                                                </Show>
                                            </div>
                                            <div>          {/* Settings button */}
                                                <Show when={!isVaultLocked()}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedIdentityKey(identity.publicKey);
                                                            setShowSettingsPanel(true);
                                                        }}
                                                        class="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                                        title="Settings"
                                                    >
                                                        <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </Show>
                                                <Show when={isVaultLocked()}>
                                                    <div class="p-1 rounded border border-gray-200 opacity-50">
                                                        <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </Show>
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
                        
                        {/* Middle section - Search results */}
                        <div class="text-gray-400 dark:text-gray-500">
                            {searchQuery() && (
                                <span>
                                    Found {filteredIdentities().length} of {identities().length} Identities
                                </span>
                            )}
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
                            <Show when={isRefreshing() || syncQueueStatus().isProcessing}>
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

                        <Show when={showRecovery() && vaultData()}>
                            <PINRecovery
                                vaultData={vaultData()!}
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

            {/* Identity Selection Modal */}
            <Show when={showIdentitySelection()}>
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-6 text-center relative max-w-md w-full mx-4">
                        {/* Header */}
                        <div class="text-center mb-6">
                            <h2 class="text-xl font-semibold mb-2">Choose Identity</h2>
                            <p class="text-gray-600">Select which identity to connect to {params.app ? desanitizeDomain(params.app) : 'this app'}</p>
                        </div>

                        {/* Identity List */}
                        <div class="space-y-3 mb-6">
                            <For each={identities()}>
                                {(identity) => (
                                    <button
                                        onClick={() => handleIdentitySelection(identity.index)}
                                        disabled={isConnectingIdentity()}
                                        class="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div class="flex items-center justify-between">
                                            <div class="flex flex-col items-start">
                                                <span class="font-medium text-gray-900">{identity.nickname}</span>
                                                <span class="text-gray-500 text-xs font-mono">
                                                    ({identity.npub.substring(0, 8)}...)
                                                </span>
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <Show when={identity.hasAppPermissions}>
                                                    <span class="text-green-600 text-xs font-medium">
                                                        Already connected
                                                    </span>
                                                </Show>
                                                <Show when={identity.isActive}>
                                                    <span class="text-blue-600 text-xs font-medium">
                                                        Active
                                                    </span>
                                                </Show>
                                                <Show when={isConnectingIdentity()}>
                                                    <div class="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                                </Show>
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>

                        {/* Error Message */}
                        <Show when={identityOperationError()}>
                            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p class="text-sm text-red-700">{identityOperationError()}</p>
                            </div>
                        </Show>

                        {/* Action Buttons */}
                        <div class="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowIdentitySelection(false);
                                    setIdentitySelectionCallback(null);
                                }}
                                class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Add Identity Modal */}
            <Show when={showAddIdentityModal()}>
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 p-6 text-center relative max-w-md w-full mx-4">
                        <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Add New Identity</h2>
                        <div class="mb-4 text-left">
                            <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Nickname</label>
                            <input
                                type="text"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="e.g., Work, Social, Trading"
                                value={newIdentityNickname()}
                                onInput={(e) => setNewIdentityNickname(e.currentTarget.value)}
                            />
                        </div>
                        <div class="flex gap-3">
                            <button
                                class="flex-1 px-4 py-2 bg-black dark:bg-gray-700 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                                disabled={!newIdentityNickname() || isVaultLocked()}
                                onClick={async () => {
                                    try {
                                        const currentUser = user();
                                        if (!currentUser) return;
                                        if (isVaultLocked()) {
                                            setShowPinUnlock(true);
                                            return;
                                        }
                                        // Derive next identity index
                                        const current = vaultData();
                                        const nextIndex = (current?.identities?.length ?? 0);
                                        // Ask worker to derive publicKey for this index using xpriv in session
                                        if (!cryptoWorker) {
                                            throw new Error('Crypto worker not ready');
                                        }
                                        const derived = await cryptoWorker!.deriveIdentityFromSession({ username: currentUser.profile.username, index: nextIndex });
                                        // Build identity object
                                        const identity = {
                                            nickname: newIdentityNickname().trim(),
                                            path: derived.path,
                                            publicKey: derived.publicKey,
                                            index: nextIndex,
                                            createdAt: Date.now()
                                        } as any;
                                        // Save locally first (fast)
                                        await updateVaultData((curr) => ({ identities: [...(curr.identities || []), identity] }), { syncToNostr: false });
                                        console.log('✅ [Add Identity] Saved locally');
                                        
                                        setShowAddIdentityModal(false);
                                        setNewIdentityNickname('');
                                        
                                        // Sync to Nostr in background (non-blocking)
                                        (async () => {
                                            try {
                                                console.log('📡 [Add Identity] Starting background Nostr sync...');
                                                console.log('📡 [Add Identity] syncToNostr function:', typeof syncToNostr);
                                                await syncToNostr();
                                                console.log('✅ [Add Identity] Synced to Nostr successfully');
                                            } catch (error) {
                                                console.error('❌ [Add Identity] Nostr sync failed:', error);
                                                console.error('❌ [Add Identity] Error details:', {
                                                    message: error instanceof Error ? error.message : String(error),
                                                    stack: error instanceof Error ? error.stack : undefined
                                                });
                                            }
                                        })();
                                    } catch (e) {
                                        console.error('Failed to add identity:', e);
                                    }
                                }}
                            >
                                Add Identity
                            </button>
                            <button
                                class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                                onClick={() => {
                                    setShowAddIdentityModal(false);
                                    setNewIdentityNickname('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                        <Show when={isVaultLocked()}>
                            <p class="text-xs text-gray-500 mt-3">Unlock your vault to add a new identity.</p>
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
                    <div class="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto">
                        {/* Panel Header */}
                        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Identity Settings</h2>
                            <button
                                onClick={() => setShowSettingsPanel(false)}
                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div class="p-6">
                            <Show when={(() => {
                                const identity = identities().find((id: any) => id.publicKey === selectedIdentityKey());
                                return identity;
                            })()}>
                                {(identity) => (
                                    <div class="space-y-6">
                                        {/* Identity Information Section */}
                                        <div>
                                            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Identity</h3>
                                            <div class="space-y-3">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-4">
                                                        <span class="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                                                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{identity().nickname}</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                                                        <span class="text-sm text-gray-900 dark:text-gray-100">{new Date(identity().createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between gap-2">
                                                    <span class="text-sm text-gray-600 dark:text-gray-400">Public Key</span>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{identity().publicKey.slice(0, 8)}...</span>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(identity().publicKey)}
                                                            class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between gap-2">
                                                    <span class="text-sm text-gray-600 dark:text-gray-400">Npub</span>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{identity().npub.slice(0, 16)}...</span>
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



                                        {/* App Permissions Section or Connect Prompt */}
                                                <Show when={identity().hasAppPermissions} fallback={
                                            <div class="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                                <p class="text-sm text-gray-700 mb-2">
                                                    This identity is not authorized for {desanitizeDomain(params.app!)}.
                                                </p>
                                                <Show when={!isVaultLocked()} fallback={
                                                    <p class="text-xs text-gray-500">Unlock your vault to authorize.</p>
                                                }>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                                handleAuthorizeIdentityForApp(identity().index);
                                                        }}
                                                        class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                    >
                                                        Authorize app to use this identity
                                                    </button>
                                                </Show>
                                            </div>
                                        }>
                                            <PermissionsSection
                                                appId={params.app!}
                                                appPermissions={appPermissions()}
                                                isVaultLocked={isVaultLocked()}
                                                isSavingPermission={isSavingPermission()}
                                                permissionSaveError={permissionSaveError()}
                                                onPermissionChange={handlePermissionChange}
                                                onDisconnect={() => handleDisconnectIdentity(identity().index, params.app!)}
                                            />
                                        </Show>

                                        {/* Sync Queue Status Indicator */}
                                        <Show when={syncQueueStatus().length > 0 || syncQueueStatus().isProcessing}>
                                            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div class="flex items-center gap-2">
                                                    <div class="flex items-center gap-1">
                                                        <Show when={syncQueueStatus().isProcessing}>
                                                            <div class="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                                                        </Show>
                                                        <span class="text-sm font-medium text-blue-700">
                                                            {syncQueueStatus().isProcessing ? 'Syncing to Nostr...' : 'Queued for sync'}
                                                        </span>
                                                    </div>
                                                    <span class="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                                        {syncQueueStatus().length} pending
                                                    </span>
                                                </div>
                                                <p class="text-xs text-blue-600 mt-1">
                                                    {syncQueueStatus().isProcessing
                                                        ? 'Saving your changes to Nostr relays...'
                                                        : 'Changes will be synced shortly'}
                                                </p>
                                            </div>
                                        </Show>

                                        {/* Identity Operation Error */}
                                        <Show when={identityOperationError()}>
                                            <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <p class="text-sm text-red-700">{identityOperationError()}</p>
                                            </div>
                                        </Show>

                                    </div>
                                )}
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Global Settings Panel */}
            <Show when={showGlobalSettings()}>
                <div class="fixed inset-0 z-50 overflow-hidden">
                    {/* Backdrop */}
                    <div
                        class="fixed inset-0 bg-black/50 transition-opacity"
                        onClick={() => setShowGlobalSettings(false)}
                    />

                    {/* Side Panel */}
                    <div class="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto">
                        {/* Panel Header */}
                        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Vault Settings</h2>
                            <button
                                onClick={() => setShowGlobalSettings(false)}
                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div class="p-6 space-y-6">
                            {/* Account Info */}
                            <div>
                                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Account</h3>
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm text-gray-600 dark:text-gray-400">Username:</span>
                                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{user()?.profile.username}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm text-gray-600 dark:text-gray-400">Identities:</span>
                                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{identities().length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Nostr Sync Actions */}
                            <div>
                                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Nostr Sync</h3>
                                <div class="space-y-3">
                                    <button
                                        onClick={handleManualSync}
                                        disabled={isSyncing() || isGettingFromNostr()}
                                        class={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                            isSyncing() || isGettingFromNostr()
                                                ? 'bg-blue-400 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        } text-white`}
                                        title="Sync your vault data to Nostr relays"
                                    >
                                        <Show when={isSyncing()} fallback={
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        }>
                                            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </Show>
                                        <span>{isSyncing() ? 'Syncing...' : 'Sync to Nostr'}</span>
                                    </button>
                                    <button
                                        onClick={handleGetFromNostr}
                                        disabled={isSyncing() || isGettingFromNostr()}
                                        class={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                            isSyncing() || isGettingFromNostr()
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-gray-600 hover:bg-gray-700'
                                        } text-white`}
                                        title="Get latest vault data from Nostr relays"
                                    >
                                        <Show when={isGettingFromNostr()} fallback={
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                        }>
                                            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </Show>
                                        <span>{isGettingFromNostr() ? 'Getting...' : 'Get from Nostr'}</span>
                                    </button>
                                    
                                    {/* Success/Error Message */}
                                    <Show when={syncMessage()}>
                                        <div class={`p-3 rounded-lg ${
                                            syncStatus() === 'success' 
                                                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' 
                                                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
                                        }`}>
                                            <p class={`text-sm ${
                                                syncStatus() === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                            }`}>
                                                {syncMessage()}
                                            </p>
                                        </div>
                                    </Show>
                                    
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Use these to manually sync your vault data with Nostr relays. Auto-sync happens on changes.
                                    </p>
                                </div>
                            </div>

                            {/* Relay Settings */}
                            <div>
                                <RelaySettings />
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

        </div>
    );
};