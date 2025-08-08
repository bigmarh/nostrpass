import { Component, Show, createSignal, For, createMemo, onMount, createEffect } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';

import { useAuth, useMessenger, useCryptoWorker } from '../providers';
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

export const Dashboard: Component = () => {
    const { user, logout, isVaultLocked, lockVault, unlockVault } = useAuth();
    const { send } = useMessenger();
    const params = useParams();
    const navigate = useNavigate();
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
    const [appPermissions, setAppPermissions] = createSignal<AppPermissions | null>(null);
    const [isRefreshing, setIsRefreshing] = createSignal(false);
    const [isSavingPermission, setIsSavingPermission] = createSignal(false);
    const [permissionSaveError, setPermissionSaveError] = createSignal<string | null>(null);
    const [syncQueueStatus, setSyncQueueStatus] = createSignal({ length: 0, isProcessing: false });
    const [showIdentitySelection, setShowIdentitySelection] = createSignal(false);
    const [identitySelectionCallback, setIdentitySelectionCallback] = createSignal<((identityIndex: number) => void) | null>(null);
    const [isConnectingIdentity, setIsConnectingIdentity] = createSignal(false);
    const [identityOperationError, setIdentityOperationError] = createSignal<string | null>(null);

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
        await logout();
        navigate(`/${params.app}`);
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

    // Load permissions for the current app
    const loadAppPermissions = async () => {
        const currentUser = user();
        if (!currentUser || !params.app) return;

        console.log('🔄 Loading app permissions for:', params.app);
        try {
            const permissions = await permissionService.getAllAppPermissions(currentUser.profile.username);
            console.log('📋 Retrieved permissions:', permissions.length, 'total');
            console.log('📋 All permissions:', JSON.stringify(permissions, null, 2));
            const appPerm = permissions.find(p => p.appId === params.app);
            console.log('🎯 Found app permissions:', !!appPerm);
            if (appPerm) {
                console.log('🎯 App permissions details:', JSON.stringify(appPerm, null, 2));
            }

            setAppPermissions(appPerm || createDefaultPermissions(params.app));
        } catch (error) {
            console.error('❌ Error loading app permissions:', error);
            setAppPermissions(createDefaultPermissions(params.app));
        }
    };



    // Manual sync function for user-triggered sync
    const handleManualSync = async () => {
        const currentUser = user();
        if (!currentUser) return;

        try {
            console.log('🔄 Manual sync triggered...');
            await syncToNostr();
            console.log('✅ Manual sync completed successfully');
            // Could show a success toast here
        } catch (error: any) {
            console.error('❌ Manual sync failed:', error);
            // Could show an error toast here
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

        try {
            console.log('🔄 Getting vault from Nostr...');
            const result = await getVaultFromNostr();
            if (result) {
                console.log('✅ Vault retrieved from Nostr:', {
                    eventId: result.eventId,
                    timestamp: new Date(result.timestamp).toISOString(),
                    identitiesCount: result.vaultData.identities?.length || 0
                });
                // Could show a success toast here
            } else {
                console.log('ℹ️ No vault found on Nostr');
                // Could show an info toast here
            }
        } catch (error: any) {
            console.error('❌ Failed to get vault from Nostr:', error);
            // Could show an error toast here
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
                await permissionService.saveAppPermissions(
                    currentUser.profile.username,
                    params.app,
                    updates,
                    appPermissions()!.appName || params.app
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
            await updateVaultData({ activeIdentityByApp: updatedActive }, { syncToNostr: true });
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
            await updateVaultData({ activeIdentityByApp: updatedActive }, { syncToNostr: true });
        } catch (error) {
            console.error('Failed to unset active identity for app:', error);
        }
    };

    // Explicitly authorize an identity for this app by creating default permissions, and set it active
    const handleAuthorizeIdentityForApp = async (identityIndex: number) => {
        if (!params.app) return;
        const currentVault = vaultData();
        if (!currentVault) return;

        try {
            const defaultPermissions = createDefaultPermissions(params.app);
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
            await updateVaultData({ identities: updatedIdentities, activeIdentityByApp: updatedActive }, { syncToNostr: true });
        } catch (error) {
            console.error('Failed to authorize identity for app:', error);
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

                                {/* Sync indicators removed from header */}
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
                                <button class="text-gray-500 text-sm font-bold" onClick={() => setShowAddIdentityModal(true)} title="Add Identity">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </header>

                            <For each={filteredIdentities()}>
                                {(identity) => (
                                    <div
                                        class={`flex flex-col  cursor-pointer border rounded-lg p-4 justify-between items-center hover:shadow-md transition-all ${identity.isActive ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'
                                            }`}
                                    >
                                        <div class="flex flex-row justify-between w-full items-center ">
                                            <div class="flex flex-col justify-start gap-2">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-medium text-gray-900">{identity.nickname}</span>
                                                    <Show when={identity.isActive}>
                                                        <span class="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                                            Active
                                                        </span>
                                                    </Show>
                                                </div>
                                                <span class="text-gray-500 text-xs font-mono">
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
                                                            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${identity.isActive ? 'bg-gray-700' : 'bg-gray-300'
                                                                } hover:opacity-80`}
                                                            title={identity.isActive ? 'Active identity for this app' : (identity.hasAppPermissions ? 'Make active for this app' : 'Authorize before making active')}
                                                        >
                                                            <span class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${identity.isActive ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                        </button>
                                                    </Show>
                                                    <Show when={isVaultLocked()}>
                                                        <div class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 opacity-50">
                                                            <span class="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                                                        </div>
                                                    </Show>


                                                </div>

                                            </div>
                                        </div>
                                        {/* Connected to */}
                                        <div class="flex flex-row justify-between w-full mt-4 items-center">
                                            <div>
                                                <Show when={identity.hasAppPermissions}>
                                                    <span class="text-green-600 text-xs font-medium">
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
                                                    <span class="text-gray-400 text-xs">
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
                                                        class="p-1 hover:bg-gray-100 rounded transition-colors border border-gray-200 hover:border-gray-300"
                                                        title="Settings"
                                                    >
                                                        <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
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

                    <footer class="text-sm py-4 px-4 border-t border-gray-200 flex justify-between items-center relative">
                        <div class="flex items-center gap-4">
                            {/* Manual sync buttons - only show in development */}
                            <Show when={import.meta.env.DEV}>
                                <button
                                    onClick={handleManualSync}
                                    class="text-gray-500 hover:text-gray-700 text-xs transition-colors"
                                    title="Sync to Nostr (Dev only)"
                                >
                                    Sync to Nostr
                                </button>
                                <button
                                    onClick={handleGetFromNostr}
                                    class="text-gray-500 hover:text-gray-700 text-xs transition-colors"
                                    title="Get from Nostr (Dev only)"
                                >
                                    Get from Nostr
                                </button>
                            </Show>
                        </div>
                        <div class="text-gray-400">
                            {searchQuery() && (
                                <span>
                                    Found {filteredIdentities().length} of {identities().length} Identities
                                </span>
                            )}
                        </div>
                        {/* Spinner-only sync indicator at bottom-right */}
                        <Show when={isRefreshing() || syncQueueStatus().isProcessing}>
                            <div class="absolute right-4 bottom-3">
                                <svg class="w-4 h-4 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                        </Show>
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
                    <div class="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-6 text-center relative max-w-md w-full mx-4">
                        <h2 class="text-xl font-semibold mb-4">Add New Identity</h2>
                        <div class="mb-4 text-left">
                            <label class="block text-sm text-gray-600 mb-1">Nickname</label>
                            <input
                                type="text"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Work, Social, Trading"
                                value={newIdentityNickname()}
                                onInput={(e) => setNewIdentityNickname(e.currentTarget.value)}
                            />
                        </div>
                        <div class="flex gap-3">
                            <button
                                class="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400"
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
                                        await updateVaultData((curr) => ({ identities: [...(curr.identities || []), identity] }), { syncToNostr: true });
                                        setShowAddIdentityModal(false);
                                        setNewIdentityNickname('');
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
                                const identity = identities().find((id: any) => id.publicKey === selectedIdentityKey());
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

        </div>
    );
};