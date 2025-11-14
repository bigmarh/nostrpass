import { Component, Show, createSignal, For, createMemo, createEffect } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';
import { nip19 } from 'nostr-tools';
import { PermissionsSection } from './PermissionsSection';
import { PermissionService } from '../services/permissionService';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';
import type { VaultData } from '../workers/db';

interface IdentityManagerProps {
  appId: string | undefined;
  vaultData: VaultData | null;
  isVaultLocked: boolean;
  username: string;
  onUpdateVaultData: (updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>), options?: any) => Promise<void>;
  onSyncToNostr: () => Promise<void>;
  onRefresh: () => void;
  cryptoWorker: any;
  onShowPinUnlock: () => void;
}

export const IdentityManager: Component<IdentityManagerProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearch, setShowSearch] = createSignal(false);
  const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);
  const [newIdentityNickname, setNewIdentityNickname] = createSignal('');
  const [selectedIdentityKey, setSelectedIdentityKey] = createSignal<string | null>(null);
  const [showIdentitySelection, setShowIdentitySelection] = createSignal(false);
  const [identitySelectionCallback, setIdentitySelectionCallback] = createSignal<((identityIndex: number) => void) | null>(null);
  const [isConnectingIdentity, setIsConnectingIdentity] = createSignal(false);
  const [identityOperationError, setIdentityOperationError] = createSignal<string | null>(null);
  const [appPermissions, setAppPermissions] = createSignal<AppPermissions | null>(null);
  const [isSavingPermission, setIsSavingPermission] = createSignal(false);
  const [permissionSaveError, setPermissionSaveError] = createSignal<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  const permissionService = PermissionService.getInstance();

  // Create identities from vault data with proper app permission checking
  const identities = createMemo(() => {
    const vault = props.vaultData;

    if (!vault?.identities) {
      return [];
    }

    // Use real vault identities - this will now be reactive to vault data changes
    const activeIndex = props.appId ? (vault.activeIdentityByApp?.[props.appId] ?? null) : null;
    return vault.identities.map((identity: any, index: number) => {
      // Get npub from public key
      let npub = '';
      try {
        npub = nip19.npubEncode(identity.publicKey);
      } catch (e) {
        npub = identity.publicKey;
      }

      // Check if this identity has permissions for the current app (authorization)
      const hasAppPermissions = props.appId && identity.appPermissions?.[props.appId];
      const connectedApps = identity.appPermissions ? Object.keys(identity.appPermissions) : [];
      const otherConnectedApps = connectedApps.filter(app => app !== props.appId);

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
    if (!props.appId) return;

    console.log('🔄 Loading app permissions for:', props.appId);
    try {
      const idx = props.vaultData?.activeIdentityByApp?.[props.appId] ?? 0;
      const appPerm = await permissionService.getAppPermissions(
        props.username,
        props.appId,
        idx
      );
      if (appPerm) {
        console.log('🎯 App permissions details:', JSON.stringify(appPerm, null, 2));
        setAppPermissions(appPerm);
      } else {
        setAppPermissions(createDefaultPermissions(props.appId));
      }
    } catch (error) {
      console.error('❌ Error loading app permissions:', error);
      setAppPermissions(createDefaultPermissions(props.appId));
    }
  };

  // Load permissions when settings panel opens
  createEffect(() => {
    if (showSettingsPanel() && props.appId) {
      loadAppPermissions();
    }
  });

  // Handle permission change
  const handlePermissionChange = async (permissionType: string, newLevel: PermissionLevel) => {
    if (!props.appId || !appPermissions()) return;

    // Preflight: ensure worker has keys; if not, prompt for PIN and abort this attempt
    try {
      const crypto = props.cryptoWorker;
      if (!crypto) throw new Error('Crypto worker not ready');
      const status: any = await crypto.hasKeysInSession({ username: props.username });
      const hasSigningKey = !!(status?.hasPrivateKey || status?.hasXpriv);
      if (!hasSigningKey) {
        setPermissionSaveError('Unlock required to continue');
        props.onShowPinUnlock();
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
      console.log('📋 Current vault data before save:', JSON.stringify(props.vaultData, null, 2));
      console.log('🔧 Permission updates:', JSON.stringify(updates, null, 2));

      try {
        const identityIndex = props.vaultData?.activeIdentityByApp?.[props.appId] ?? undefined;
        await permissionService.saveAppPermissions(
          props.username,
          props.appId,
          updates,
          appPermissions()!.appName || props.appId,
          identityIndex
        );
        console.log('✅ App permissions saved locally');

        // Reload vault data to see the changes
        props.onRefresh();
        console.log('📋 Vault data after save:', JSON.stringify(props.vaultData, null, 2));
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
          const status: any = await props.cryptoWorker!.hasKeysInSession({ username: props.username });
          const hasStorageSigning = !!(status?.hasXpriv || status?.hasStorageKeypair);
          if (!hasStorageSigning) {
            setPermissionSaveError('Unlock required to sync to Nostr');
            props.onShowPinUnlock();
            return;
          }
          await props.onSyncToNostr();
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
          props.onShowPinUnlock();
        } else if (error.message?.includes('no xpriv') || error.message?.includes('No xpriv access')) {
          setPermissionSaveError('Session expired - please unlock with PIN');
          props.onShowPinUnlock();
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

  // Explicitly authorize an identity for this app by creating default permissions, and set it active
  const handleAuthorizeIdentityForApp = async (identityIndex: number) => {
    console.log('🔐 [Authorize] Starting authorization for identity:', identityIndex, 'app:', props.appId);

    if (!props.appId) {
      console.error('❌ [Authorize] No app parameter');
      return;
    }

    const currentVault = props.vaultData;
    if (!currentVault) {
      console.error('❌ [Authorize] No vault data');
      return;
    }

    try {
      console.log('✅ [Authorize] Creating default permissions for:', props.appId);
      const defaultPermissions = createDefaultPermissions(props.appId);

      console.log('📝 [Authorize] Updating identities...');
      const updatedIdentities = currentVault.identities.map((id: any, idx: number) => {
        if (idx !== identityIndex) return id;
        const updated = { ...id };
        if (!updated.appPermissions) updated.appPermissions = {};
        updated.appPermissions[props.appId!] = updated.appPermissions[props.appId!] || defaultPermissions;
        return updated;
      });

      const updatedActive = {
        ...(currentVault.activeIdentityByApp || {}),
        [props.appId]: identityIndex
      };

      console.log('💾 [Authorize] Saving vault data (will auto-sync to Nostr)...');
      console.log('💾 [Authorize] Updated data:', {
        identitiesCount: updatedIdentities.length,
        activeIdentityByApp: updatedActive,
        identitiesWithPermissions: updatedIdentities.map((id: any, idx: number) => ({
          index: idx,
          nickname: id.nickname,
          appKeys: id.appPermissions ? Object.keys(id.appPermissions) : []
        }))
      });

      // Save vault data - auto-syncs to Nostr in background by default
      await props.onUpdateVaultData({ identities: updatedIdentities, activeIdentityByApp: updatedActive });

      console.log('✅ [Authorize] Authorization complete (saved locally + syncing to Nostr)!');
    } catch (error) {
      console.error('❌ [Authorize] Failed to authorize identity for app:', error);
      // Show error to user
      alert(`Failed to authorize identity: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Handle connecting an identity to the current app
  const handleConnectIdentity = async (identityIndex: number) => {
    // Check if we have an active vault session
    if (!props.appId) {
      console.warn('Cannot connect identity: no active vault session or app parameter');
      return;
    }

    // Check if vault is locked before proceeding
    if (props.isVaultLocked) {
      console.warn('Cannot connect identity: vault is locked');
      return;
    }

    setIsConnectingIdentity(true);
    setIdentityOperationError(null);

    try {
      // Create default permissions for the new connection
      const defaultPermissions = createDefaultPermissions(props.appId);

      // Get current vault data
      const currentVault = props.vaultData;
      if (!currentVault) {
        console.warn('Cannot connect identity: no vault data available');
        return;
      }

      // Create updated identities array
      const updatedIdentities = [...currentVault.identities];
      if (!updatedIdentities[identityIndex].appPermissions) {
        updatedIdentities[identityIndex].appPermissions = {};
      }
      updatedIdentities[identityIndex].appPermissions[props.appId] = defaultPermissions;

      // Update vault data with the new identities
      await props.onUpdateVaultData({
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
    console.log('[DISCONNECT] Starting disconnect for identity:', identityIndex, 'app:', appId);

    // Check if vault is locked before proceeding
    if (props.isVaultLocked) {
      console.warn('[DISCONNECT] Cannot disconnect identity: vault is locked');
      return;
    }

    setIsConnectingIdentity(true);
    setIdentityOperationError(null);

    try {
      // Get current vault data
      const currentVault = props.vaultData;
      if (!currentVault) {
        console.warn('[DISCONNECT] Cannot disconnect identity: no vault data available');
        return;
      }

      // Create updated identities array - deep clone to avoid mutation issues
      const updatedIdentities = currentVault.identities.map((identity: any, idx: number) => {
        if (idx === identityIndex) {
          // Clone this identity and remove the app permissions
          const { appPermissions = {}, ...rest } = identity;
          const newAppPermissions = { ...appPermissions };
          delete newAppPermissions[appId];

          console.log('[DISCONNECT] Identity before:', {
            index: idx,
            appKeys: Object.keys(appPermissions)
          });
          console.log('[DISCONNECT] Identity after:', {
            index: idx,
            appKeys: Object.keys(newAppPermissions)
          });

          return {
            ...rest,
            appPermissions: newAppPermissions
          };
        }
        return identity;
      });

      // If this identity was active for this app, clear the active identity
      const updatedActiveIdentityByApp = { ...(currentVault.activeIdentityByApp || {}) };
      if (updatedActiveIdentityByApp[appId] === identityIndex) {
        console.log('[DISCONNECT] Clearing active identity for app:', appId);
        delete updatedActiveIdentityByApp[appId];
      }

      // Update vault data - auto-syncs to Nostr in background by default
      console.log('[DISCONNECT] Saving updated vault data (will auto-sync to Nostr)...');
      await props.onUpdateVaultData({
        identities: updatedIdentities,
        activeIdentityByApp: updatedActiveIdentityByApp
      });

      console.log('✅ [DISCONNECT] Identity disconnected successfully (syncing to Nostr)!');
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

  // Set active identity for this app (does not change authorization)
  const handleSetActiveIdentityForApp = async (identityIndex: number) => {
    console.log('🔄 [SetActive] Setting active identity:', identityIndex, 'for app:', props.appId);
    if (!props.appId) return;
    const currentVault = props.vaultData;
    if (!currentVault) return;

    try {
      const updatedActive = {
        ...(currentVault.activeIdentityByApp || {}),
        [props.appId]: identityIndex
      };
      console.log('💾 [SetActive] Updating vault data with:', updatedActive);
      // Save vault data - auto-syncs to Nostr in background by default
      await props.onUpdateVaultData({ activeIdentityByApp: updatedActive });
      console.log('✅ [SetActive] Active identity updated successfully');
    } catch (error) {
      console.error('❌ [SetActive] Failed to set active identity for app:', error);
    }
  };

  // Unset active identity for this app (keeps authorization intact)
  const handleUnsetActiveIdentityForApp = async () => {
    console.log('🔄 [UnsetActive] Unsetting active identity for app:', props.appId);
    if (!props.appId) return;
    const currentVault = props.vaultData;
    if (!currentVault) return;

    try {
      const updatedActive = {
        ...(currentVault.activeIdentityByApp || {}),
        [props.appId]: null
      };
      console.log('💾 [UnsetActive] Updating vault data with:', updatedActive);
      // Save vault data - auto-syncs to Nostr in background by default
      await props.onUpdateVaultData({ activeIdentityByApp: updatedActive });
      console.log('✅ [UnsetActive] Active identity cleared successfully');
    } catch (error) {
      console.error('Failed to unset active identity for app:', error);
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

  // Handle add identity
  const handleAddIdentity = async () => {
    try {
      if (props.isVaultLocked) {
        props.onShowPinUnlock();
        return;
      }

      // Check if we have xpriv in session before attempting to derive
      if (!props.cryptoWorker) {
        throw new Error('Crypto worker not ready');
      }

      const status: any = await props.cryptoWorker.hasKeysInSession({ username: props.username });
      if (!status?.hasXpriv) {
        console.warn('No xpriv in session, requesting unlock');
        props.onShowPinUnlock();
        return;
      }

      // Derive next identity index
      const current = props.vaultData;
      const nextIndex = (current?.identities?.length ?? 0);
      // Ask worker to derive publicKey for this index using xpriv in session
      const derived = await props.cryptoWorker.deriveIdentityFromSession({ username: props.username, index: nextIndex });
      // Build identity object
      const identity = {
        nickname: newIdentityNickname().trim(),
        path: derived.path,
        publicKey: derived.publicKey,
        index: nextIndex,
        createdAt: Date.now()
      } as any;
      // Save locally first (fast)
      await props.onUpdateVaultData((curr) => ({ identities: [...(curr.identities || []), identity] }), { syncToNostr: false });
      console.log('✅ [Add Identity] Saved locally');

      // Publish identity meta as PRE (non-blocking)
      try {
        await props.cryptoWorker.publishIdentityMeta({ username: props.username, nickname: identity.nickname, path: identity.path });
      } catch (e) {
        console.warn('⚠️ [Add Identity] Failed to publish identity PRE:', e);
      }

      setShowAddIdentityModal(false);
      setNewIdentityNickname('');

      // Sync to Nostr in background (non-blocking)
      (async () => {
        try {
          console.log('📡 [Add Identity] Starting background Nostr sync...');
          await props.onSyncToNostr();
          console.log('✅ [Add Identity] Synced to Nostr successfully');
        } catch (error) {
          console.error('❌ [Add Identity] Nostr sync failed:', error);
        }
      })();
    } catch (e) {
      console.error('Failed to add identity:', e);
    }
  };

  return (
    <>
      {/* Identity list */}
      <div class="flex flex-col gap-2 p-4 relative">
        <header class="flex justify-between items-center">
          <h4 class="text-gray-500 dark:text-gray-400 text-sm font-bold">Identities</h4>
          <div class="flex gap-2">
            <button
              class="text-gray-500 dark:text-gray-400 text-sm font-bold hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => {
                setIsRefreshing(true);
                props.onRefresh();
                setTimeout(() => setIsRefreshing(false), 2000);
              }}
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

        {/* Lock overlay when vault is locked */}
        <Show when={props.isVaultLocked}>
          <div class="absolute inset-0 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-10 p-8">
            <div class="flex flex-col items-center gap-4 text-center">
              <svg class="w-16 h-16 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a5 5 0 0 1 5 5v2.005c.77.015 1.246.07 1.635.268a2.5 2.5 0 0 1 1.092 1.092C20 11.9 20 12.6 20 14v3c0 1.4 0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C18.1 21 17.4 21 16 21H8c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C4 19.1 4 18.4 4 17v-3c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.092c.389-.199.865-.253 1.635-.268V8a5 5 0 0 1 5-5m3 5v2H9V8a3 3 0 1 1 6 0" />
              </svg>
              <div>
                <h3 class="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Vault Locked
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Unlock your vault to view and manage identities
                </p>
                <button
                  onClick={props.onShowPinUnlock}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Unlock Vault
                </button>
              </div>
            </div>
          </div>
        </Show>

        <For each={filteredIdentities()}>
          {(identity) => (
            <div
              class={`flex flex-col border rounded-lg p-4 justify-between items-center hover:shadow-md dark:hover:shadow-lg transition-all ${identity.isActive ? 'border-gray-700 dark:border-gray-500 bg-gray-200 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                    <Show when={!props.isVaultLocked}>
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
                    <Show when={props.isVaultLocked}>
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
                      Authorized for {desanitizeDomain(props.appId!)}
                    </span>
                  </Show>
                  <Show when={!identity.hasAppPermissions && props.appId && !props.isVaultLocked}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIdentityKey(identity.publicKey);
                        setShowSettingsPanel(true);
                      }}
                      class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      title={`Authorize ${identity.nickname} for ${desanitizeDomain(props.appId!)}`}
                    >
                      Use this ID with {desanitizeDomain(props.appId!)}

                    </button>
                  </Show>
                  <Show when={!identity.hasAppPermissions && props.appId && props.isVaultLocked}>
                    <span class="text-gray-400 dark:text-gray-500 text-xs">
                      Unlock vault to authorize
                    </span>
                  </Show>
                </div>
                <div>          {/* Settings button */}
                  <Show when={!props.isVaultLocked}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('⚙️ [Settings] Opening settings for identity:', identity.nickname, identity.publicKey);
                        setSelectedIdentityKey(identity.publicKey);
                        setShowSettingsPanel(true);
                        console.log('⚙️ [Settings] Panel should be open, showSettingsPanel:', showSettingsPanel());
                      }}
                      class="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      title="Settings"
                    >
                      <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </Show>
                  <Show when={props.isVaultLocked}>
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

      {/* Identity Selection Modal */}
      <Show when={showIdentitySelection()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-6 text-center relative max-w-md w-full mx-4">
            {/* Header */}
            <div class="text-center mb-6">
              <h2 class="text-xl font-semibold mb-2">Choose Identity</h2>
              <p class="text-gray-600">Select which identity to connect to {props.appId ? desanitizeDomain(props.appId) : 'this app'}</p>
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
                disabled={!newIdentityNickname() || props.isVaultLocked}
                onClick={handleAddIdentity}
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
            <Show when={props.isVaultLocked}>
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
                          This identity is not authorized for {desanitizeDomain(props.appId!)}.
                        </p>
                        <Show when={!props.isVaultLocked} fallback={
                          <p class="text-xs text-gray-500">Unlock your vault to authorize.</p>
                        }>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('🔘 [BUTTON CLICK] Authorize button clicked for identity:', identity().index);
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
                        appId={props.appId!}
                        appPermissions={appPermissions()}
                        isVaultLocked={props.isVaultLocked}
                        isSavingPermission={isSavingPermission()}
                        permissionSaveError={permissionSaveError()}
                        onPermissionChange={handlePermissionChange}
                        onDisconnect={() => handleDisconnectIdentity(identity().index, props.appId!)}
                      />
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
    </>
  );
};
