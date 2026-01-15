import { Component, Show, createSignal, For, createMemo, createEffect, onMount, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';
import { nip19 } from 'nostr-tools';
import { PermissionsSection } from './PermissionsSection';
import { PermissionService } from '../services/permissionService';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';
import type { VaultData } from '../workers/db';
import { getActiveIdentityIndex, setActiveIdentityIndex, clearActiveIdentityIndex } from '../stores/vaultStore';
import { useMessenger } from '../providers';

interface IdentityManagerProps {
  appId: string | undefined;
  vaultData: VaultData | null;
  isVaultLocked: boolean;
  username: string;
  storagePublicKey?: string; // Vault lookup key (different from username for Google login)
  onUpdateVaultData: (updates: Partial<VaultData> | ((current: VaultData) => Partial<VaultData>), options?: any) => Promise<void>;
  onSyncToNostr: () => Promise<void>;
  onRefresh: () => void;
  cryptoWorker: any;
  onShowPinUnlock: () => void;
  triggerAddIdentity?: number;
  hideHeader?: boolean;
  searchQuery?: string;
}

export const IdentityManager: Component<IdentityManagerProps> = (props) => {
  const navigate = useNavigate();
  const { send } = useMessenger();
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearch, setShowSearch] = createSignal(false);
  const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);
  const [newIdentityNickname, setNewIdentityNickname] = createSignal('');
  const [selectedIdentityKey, setSelectedIdentityKey] = createSignal<string | null>(null);
  const [showIdentitySelection, setShowIdentitySelection] = createSignal(false);
  const [identitySelectionCallback, setIdentitySelectionCallback] = createSignal<((identityIndex: number) => void) | null>(null);
  const [isConnectingIdentity, setIsConnectingIdentity] = createSignal(false);
  const [identityOperationError, setIdentityOperationError] = createSignal<string | null>(null);
  const [isSavingPermission, setIsSavingPermission] = createSignal(false);
  const [permissionSaveError, setPermissionSaveError] = createSignal<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = createSignal(false);
  const [identityToArchive, setIdentityToArchive] = createSignal<{index: number, nickname: string} | null>(null);
  // BYOK (Bring Your Own Key) state
  const [addIdentityMode, setAddIdentityMode] = createSignal<'generate' | 'import'>('generate');
  const [byokNsec, setByokNsec] = createSignal('');
  const [byokPin, setByokPin] = createSignal('');
  const [byokError, setByokError] = createSignal<string | null>(null);
  const [isImportingBYOK, setIsImportingBYOK] = createSignal(false);
  const [byokPreview, setByokPreview] = createSignal<{ npub: string } | null>(null);

  const permissionService = PermissionService.getInstance();

  // Signal to trigger re-render when active identity changes in localStorage
  // (localStorage is not reactive, so we need this signal to trigger memo recomputation)
  const [activeIdentityVersion, setActiveIdentityVersion] = createSignal(0);

  // Listen for active identity changes from localStorage
  onMount(() => {
    const handleActiveIdentityChanged = (e: Event) => {
      const event = e as CustomEvent<{ username: string; appKey: string; identityIndex: number }>;
      console.log('[IdentityManager] Active identity changed:', event.detail);
      // Increment version to trigger memo recomputation
      setActiveIdentityVersion(v => v + 1);
    };

    window.addEventListener('active-identity-changed', handleActiveIdentityChanged);

    onCleanup(() => {
      window.removeEventListener('active-identity-changed', handleActiveIdentityChanged);
    });
  });

  // Watch for trigger to show add identity modal
  createEffect(() => {
    const trigger = props.triggerAddIdentity;
    if (trigger && trigger > 0) {
      setShowAddIdentityModal(true);
    }
  });

  // Helper to get app key for active identity lookup
  // Returns appId as-is since it's already in sanitized format (e.g., "localhost-4000")
  // This matches how permissions are stored and how setActiveIdentityIndex stores keys
  const getAppOrigin = (appId: string): string => {
    return appId;
  };

  // Reactive permissions derived from vault data
  // This automatically updates when vault data changes (real-time cross-browser sync!)
  const appPermissions = createMemo(() => {
    const vault = props.vaultData;
    const appId = props.appId;

    if (!vault || !appId) return null;

    // Get active identity from vaultStore (per-browser, not synced)
    const appOrigin = getAppOrigin(appId);
    const identityIndex = getActiveIdentityIndex(appOrigin);
    const identity = vault.identities?.[identityIndex];

    if (!identity) return null;

    const permissions = identity.appPermissions?.[appId];

    // If no permissions exist, create default ones
    if (!permissions) {
      return {
        appId,
        appName: desanitizeDomain(appId),
        permissions: {
          social: 'ALLOW',
          messaging: 'ASK_EVERYTIME',
          signData: 'ASK_EVERYTIME',
          financial: 'ASK_EVERYTIME',
          zaps: 'ASK_EVERYTIME'
        },
        getPublicKey: 'ALLOW',
        grantedAt: Date.now(),
        lastUsedAt: Date.now()
      };
    }

    return permissions;
  });

  // Create identities from vault data with proper app permission checking
  const identities = createMemo(() => {
    const vault = props.vaultData;
    // Include activeIdentityVersion as a dependency to recompute when active identity changes
    // (activeIdentityVersion is updated when 'active-identity-changed' event fires)
    const _version = activeIdentityVersion();

    if (!vault?.identities) {
      return [];
    }

    // Use real vault identities - filter out archived ones and preserve original index
    // Get active identity from vaultStore (per-browser)
    const activeIndex = props.appId ? (() => {
      const appOrigin = getAppOrigin(props.appId);
      const idx = getActiveIdentityIndex(appOrigin);
      return idx > 0 ? idx : null;
    })() : null;
    return vault.identities
      .map((identity: any, originalIndex: number) => ({ identity, originalIndex }))
      .filter(({ identity }) => !identity.archived)
      .map(({ identity, originalIndex }) => {
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
          isActive: activeIndex === originalIndex,
          hasAppPermissions,
          connectedApps,
          otherConnectedApps,
          index: originalIndex,  // Use original index from full vault array
          isImported: identity.isImported || false  // BYOK flag
        };
      });
  });

  // Show search when there are more than 4 identities
  createEffect(() => {
    const shouldShowSearch = identities().length > 4;
    setShowSearch(shouldShowSearch);
    if (!shouldShowSearch) {
      setSearchQuery(''); // Clear search when not needed
    }
  });

  const filteredIdentities = createMemo(() => {
    const query = (props.searchQuery || searchQuery()).toLowerCase();
    let results = identities();

    if (query) {
      results = results.filter((identity: any) => {
        if (identity.nickname?.toLowerCase().includes(query)) return true;
        if (identity.publicKey?.toLowerCase().includes(query)) return true;
        if (identity.npub?.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // Sort: active first, then authorized, then others
    return results.sort((a: any, b: any) => {
      // Active identity always first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;

      // Among non-active, authorized identities come before unauthorized
      if (a.hasAppPermissions && !b.hasAppPermissions) return -1;
      if (!a.hasAppPermissions && b.hasAppPermissions) return 1;

      return 0;
    });
  });

  // Note: appPermissions is now a reactive createMemo() that automatically
  // updates when vault data changes. No manual loading needed!

  // Helper function to create default permissions for a new app
  const createDefaultPermissions = (appId: string): AppPermissions => ({
    appId,
    appName: desanitizeDomain(appId),
    permissions: {
      social: 'ALLOW',
      messaging: 'ASK_EVERYTIME',
      signData: 'ASK_EVERYTIME',
      financial: 'ASK_EVERYTIME',
      zaps: 'ASK_EVERYTIME'
    },
    getPublicKey: 'ALLOW',
    grantedAt: Date.now(),
    lastUsedAt: Date.now()
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
      // Build updates object based on permission type
      const updates: Partial<AppPermissions> = {};
      const currentPerms = appPermissions();

      if (!currentPerms) {
        console.error('❌ No current permissions available');
        return;
      }

      // Handle top-level permission (getPublicKey)
      if (permissionType === 'getPublicKey') {
        updates.getPublicKey = newLevel;
      }
      // Handle nested permissions (social, messaging, signData, zaps, financial)
      else if (['social', 'messaging', 'signData', 'zaps', 'financial'].includes(permissionType)) {
        updates.permissions = {
          ...currentPerms.permissions,
          [permissionType]: newLevel
        };
      }
      // Unknown permission type
      else {
        console.error('❌ Unknown permission type:', permissionType);
        return;
      }

      console.log('💾 Saving app permissions...');
      console.log('📋 Current vault data before save:', JSON.stringify(props.vaultData, null, 2));
      console.log('🔧 Permission updates:', JSON.stringify(updates, null, 2));

      try {
        // Get active identity from vaultStore (per-browser)
        const lookupKey = props.storagePublicKey || props.username;
        const appOrigin = props.appId ? getAppOrigin(props.appId) : undefined;
        const identityIndex = appOrigin ? getActiveIdentityIndex(appOrigin) : undefined;
        await permissionService.saveAppPermissions(
          lookupKey,
          props.appId,
          updates,
          appPermissions()!.appName || props.appId,
          identityIndex
        );
        console.log('✅ App permissions saved locally');

        // No need to manually refresh - worker broadcasts VAULT_DATA_UPDATED
        // which triggers VaultStore to reload automatically
        console.log('📋 Waiting for broadcast to trigger reactive update...');
      } catch (error) {
        console.error('❌ Error in saveAppPermissions:', error);
        throw error;
      }

      // Note: Nostr sync happens automatically via streamlined vault-operations path
      // appPermissions createMemo will automatically update when vault data changes
      // No manual reload needed - SolidJS reactivity handles it!
      console.log('✅ Permissions saved - automatic Nostr sync in progress via streamlined path');
      setPermissionSaveError('✅ Settings saved');
      setTimeout(() => setPermissionSaveError(null), 3000);

      // Clear saving state
      console.log('🏁 Clearing saving state...');
      setIsSavingPermission(false);

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

      // Set active identity in localStorage (per-browser, not synced)
      // Use storagePublicKey for vault lookup (critical for Google login where username is UID)
      const appOrigin = getAppOrigin(props.appId);
      await setActiveIdentityIndex(appOrigin, identityIndex);

      console.log('💾 [Authorize] Saving vault data (will auto-sync to Nostr)...');

      // Save vault data - auto-syncs to Nostr in background by default
      await props.onUpdateVaultData({ identities: updatedIdentities });

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

      // Update vault data - auto-syncs to Nostr in background by default
      console.log('[DISCONNECT] Saving updated vault data (will auto-sync to Nostr)...');
      await props.onUpdateVaultData({ identities: updatedIdentities });

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
      // Set active identity via vaultStore (updates localStorage + signal + notifies embassy)
      const appOrigin = getAppOrigin(props.appId);
      await setActiveIdentityIndex(appOrigin, identityIndex);
      console.log('💾 [SetActive] Updated active identity via vaultStore:', { appOrigin, identityIndex });

      console.log('✅ [SetActive] Active identity updated successfully');
    } catch (error) {
      console.error('❌ [SetActive] Failed to set active identity for app:', error);
    }
  };

  // Unset active identity for this app (keeps authorization intact)
  const handleUnsetActiveIdentityForApp = async () => {
    console.log('🔄 [UnsetActive] Unsetting active identity for app:', props.appId);
    if (!props.appId) return;

    try {
      const appOrigin = getAppOrigin(props.appId);
      clearActiveIdentityIndex(appOrigin);
      console.log('✅ [UnsetActive] Active identity cleared via vaultStore');
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

  // Show archive confirmation dialog
  const confirmArchiveIdentity = (identityIndex: number) => {
    const identity = props.vaultData?.identities[identityIndex];
    if (!identity) return;

    setIdentityToArchive({ index: identityIndex, nickname: identity.nickname });
    setShowArchiveConfirm(true);
  };

  // Handle archive identity (soft delete - keeps path and nickname for recovery)
  const handleArchiveIdentity = async () => {
    const toArchive = identityToArchive();
    if (!toArchive) return;

    if (props.isVaultLocked) {
      props.onShowPinUnlock();
      return;
    }

    setShowArchiveConfirm(false);

    try {
      const currentVault = props.vaultData;
      if (!currentVault) return;

      // Mark identity as archived (add archived flag and timestamp)
      const updatedIdentities = currentVault.identities.map((id: any, idx: number) => {
        if (idx === toArchive.index) {
          return {
            ...id,
            archived: true,
            archivedAt: Date.now()
          };
        }
        return id;
      });

      // Save (automatically syncs to Nostr)
      await props.onUpdateVaultData({ identities: updatedIdentities });

      console.log('✅ [Archive Identity] Identity archived and auto-synced to Nostr');
      setShowSettingsPanel(false);
      setIdentityToArchive(null);
    } catch (e) {
      console.error('Failed to archive identity:', e);
      const errorMsg = e instanceof Error ? e.message : String(e);

      // Check for rate limit errors
      if (errorMsg.includes('rate-limit') || errorMsg.includes('too much')) {
        setIdentityOperationError('✅ Archived locally. Syncing to Nostr in background...');
        setTimeout(() => setIdentityOperationError(null), 5000);
        setShowSettingsPanel(false);
        setIdentityToArchive(null);
      } else {
        setIdentityOperationError(`Failed to archive identity: ${errorMsg}`);
        setTimeout(() => setIdentityOperationError(null), 5000);
      }
    }
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
      // Save (automatically syncs to Nostr via full vault snapshot)
      await props.onUpdateVaultData((curr) => ({ identities: [...(curr.identities || []), identity] }));
      console.log('✅ [Add Identity] Saved and auto-synced to Nostr');

      // Note: PRE events removed in streamlined sync architecture
      // Full vault snapshot is published automatically above

      setShowAddIdentityModal(false);
      setNewIdentityNickname('');
    } catch (e) {
      console.error('Failed to add identity:', e);
    }
  };

  // Handle BYOK nsec input change - validate and preview
  const handleNsecInput = async (nsec: string) => {
    setByokNsec(nsec);
    setByokError(null);
    setByokPreview(null);

    if (!nsec.trim()) return;

    // Quick format validation
    if (!nsec.startsWith('nsec1')) {
      setByokError('Must start with nsec1');
      return;
    }

    try {
      // Validate and get pubkey preview
      const { publicKey } = await props.cryptoWorker.validateAndDecodeNsec({ nsec: nsec.trim() });
      const npub = nip19.npubEncode(publicKey);
      setByokPreview({ npub });
    } catch (e) {
      setByokError('Invalid nsec format');
    }
  };

  // Handle import BYOK identity
  const handleImportBYOK = async () => {
    try {
      setIsImportingBYOK(true);
      setByokError(null);

      if (props.isVaultLocked) {
        props.onShowPinUnlock();
        return;
      }

      const nsec = byokNsec().trim();
      if (!nsec) {
        setByokError('Please enter your nsec');
        return;
      }

      // Check crypto worker
      if (!props.cryptoWorker) {
        throw new Error('Crypto worker not ready');
      }

      // Check if vault is unlocked
      const status: any = await props.cryptoWorker.hasKeysInSession({ username: props.username });
      if (!status?.hasXpriv) {
        console.warn('No xpriv in session, requesting unlock');
        props.onShowPinUnlock();
        return;
      }

      // Validate nsec and get public key
      const { publicKey } = await props.cryptoWorker.validateAndDecodeNsec({ nsec });

      // Check if this pubkey already exists
      const existingIdentity = props.vaultData?.identities?.find((id: any) => id.publicKey === publicKey);
      if (existingIdentity) {
        setByokError(`This key already exists as "${existingIdentity.nickname || 'Unknown'}"`);
        return;
      }

      // Get vault salt for encryption
      const vaultSalt = props.vaultData?.salt;
      if (!vaultSalt) {
        throw new Error('Vault salt not found');
      }

      // PIN is required to encrypt the nsec
      const pin = byokPin().trim();
      if (!pin) {
        setByokError('Please enter your PIN to encrypt the key');
        return;
      }

      // Encrypt the nsec with the user's PIN (same salt as xpriv)
      const encryptedNsec = await props.cryptoWorker.encryptNsecForBYOK({
        nsec,
        pin,
        salt: vaultSalt
      });

      // Build BYOK identity object
      const nextIndex = (props.vaultData?.identities?.length ?? 0);
      const identity = {
        nickname: newIdentityNickname().trim() || 'Imported',
        publicKey,
        index: nextIndex,
        isImported: true,
        encryptedNsec,
        importedAt: Date.now(),
        createdAt: Date.now()
      } as any;

      // Save (automatically syncs to Nostr)
      await props.onUpdateVaultData((curr) => ({
        identities: [...(curr.identities || []), identity]
      }));

      console.log('✅ [Import BYOK] Identity imported and auto-synced to Nostr');

      // Reset modal state
      closeAddIdentityModal();
    } catch (e) {
      console.error('Failed to import BYOK identity:', e);
      setByokError(e instanceof Error ? e.message : 'Failed to import key');
    } finally {
      setIsImportingBYOK(false);
    }
  };

  // Reset modal state when closing
  const closeAddIdentityModal = () => {
    setShowAddIdentityModal(false);
    setNewIdentityNickname('');
    setByokNsec('');
    setByokPin('');
    setByokError(null);
    setByokPreview(null);
    setAddIdentityMode('generate');
  };

  return (
    <>
      {/* Identity list */}
      <div class="flex flex-col gap-2 relative">
        <Show when={!props.hideHeader}>
          <header class="flex justify-between items-center shrink-0">
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

          {/* Search input - only show when more than 4 identities */}
          <Show when={showSearch()}>
            <input
              type="text"
              placeholder="Search identities..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shrink-0"
            />
          </Show>
        </Show>

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

        {/* Identity list */}
        <div class="space-y-2 bg-gray-50 dark:bg-gray-950 px-4 py-3" style="padding-bottom: calc(6rem + env(safe-area-inset-bottom));">
          <For each={filteredIdentities()}>
          {(identity) => (
            <div
              class={`flex items-center justify-between border rounded-lg px-4 py-3.5 transition-all ${
                identity.isImported
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                  : identity.isActive
                    ? 'border-gray-700 dark:border-gray-500 bg-gray-200 dark:bg-gray-700'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              {/* Left: Identity name with key icon, profile picture and status */}
              <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  {/* Profile Picture or Initials */}
                  <Show when={identity.profile?.picture} fallback={
                    <div class="w-8 h-8 bg-gray-900 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                      <span class="text-white dark:text-gray-100 text-xs font-bold">
                        {(() => {
                          const name = identity.profile?.name || identity.nickname || 'ID';
                          return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                        })()}
                      </span>
                    </div>
                  }>
                    <img
                      src={identity.profile!.picture}
                      alt={identity.profile?.name || identity.nickname}
                      class="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-300 dark:border-gray-600"
                    />
                  </Show>

                  <Show when={identity.isImported}>
                    <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </Show>
                  <span class="font-medium text-gray-900 dark:text-gray-100 text-base truncate">
                    {identity.profile?.name || identity.nickname}
                  </span>
                </div>
                <Show when={identity.hasAppPermissions}>
                  <span class="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded self-start">
                    Authorized
                  </span>
                </Show>
                <Show when={!identity.hasAppPermissions && props.appId && !props.isVaultLocked}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIdentityKey(identity.publicKey);
                      setShowSettingsPanel(true);
                    }}
                    class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium self-start"
                  >
                    Connect to this app →
                  </button>
                </Show>
              </div>

              {/* Right: Actions */}
              <div class="flex items-center gap-2 shrink-0">
                {/* Edit Profile button */}
                <Show when={!props.isVaultLocked}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/${props.appId}/profile/${identity.publicKey}/edit`);
                    }}
                    class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="Edit Profile"
                  >
                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </Show>

                {/* Settings button */}
                <Show when={!props.isVaultLocked}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIdentityKey(identity.publicKey);
                      setShowSettingsPanel(true);
                    }}
                    class="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Settings"
                  >
                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </Show>

                {/* Toggle switch - furthest right */}
                <Show when={!props.isVaultLocked}>
                  <button
                    onClick={() => {
                      if (identity.isActive) {
                        handleUnsetActiveIdentityForApp();
                      } else if (identity.hasAppPermissions) {
                        handleSetActiveIdentityForApp(identity.index);
                      } else {
                        setSelectedIdentityKey(identity.publicKey);
                        setShowSettingsPanel(true);
                      }
                    }}
                    class={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${identity.isActive ? 'bg-gray-700 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
                      } hover:opacity-80`}
                    title={identity.isActive ? 'Active' : (identity.hasAppPermissions ? 'Make active' : 'Authorize first')}
                  >
                    <span class={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 transition-transform ${identity.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                  </button>
                </Show>
                <Show when={props.isVaultLocked}>
                  <div class="relative inline-flex h-7 w-12 items-center rounded-full bg-gray-200 dark:bg-gray-700 opacity-50">
                    <span class="inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 translate-x-1" />
                  </div>
                </Show>
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
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 p-6 relative max-w-md w-full mx-4">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 text-center">Add New Identity</h2>

            {/* Mode selector tabs */}
            <div class="flex mb-4 border-b border-gray-200 dark:border-gray-600">
              <button
                class={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  addIdentityMode() === 'generate'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                onClick={() => setAddIdentityMode('generate')}
              >
                Generate New
              </button>
              <button
                class={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  addIdentityMode() === 'import'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                onClick={() => setAddIdentityMode('import')}
              >
                Import Key (BYOK)
              </button>
            </div>

            {/* Generate mode */}
            <Show when={addIdentityMode() === 'generate'}>
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
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  onClick={closeAddIdentityModal}
                >
                  Cancel
                </button>
                <button
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                  disabled={!newIdentityNickname() || props.isVaultLocked}
                  onClick={handleAddIdentity}
                >
                  Generate
                </button>
              </div>
            </Show>

            {/* Import mode (BYOK) */}
            <Show when={addIdentityMode() === 'import'}>
              <div class="space-y-4 text-left">
                {/* BYOK Warning */}
                <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p class="text-xs text-amber-800 dark:text-amber-200">
                    <strong>BYOK (Bring Your Own Key):</strong> You are responsible for backing up this key. It will NOT be recoverable from your seed phrase.
                  </p>
                </div>

                {/* Nickname */}
                <div>
                  <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g., Legacy Key, Old Account"
                    value={newIdentityNickname()}
                    onInput={(e) => setNewIdentityNickname(e.currentTarget.value)}
                  />
                </div>

                {/* nsec input */}
                <div>
                  <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Private Key (nsec)</label>
                  <input
                    type="password"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm"
                    placeholder="nsec1..."
                    value={byokNsec()}
                    onInput={(e) => handleNsecInput(e.currentTarget.value)}
                  />
                </div>

                {/* Preview npub */}
                <Show when={byokPreview()}>
                  <div class="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p class="text-xs text-green-800 dark:text-green-200">
                      <span class="font-medium">Public Key:</span>{' '}
                      <span class="font-mono">{byokPreview()!.npub.slice(0, 20)}...</span>
                    </p>
                  </div>
                </Show>

                {/* PIN input */}
                <div>
                  <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Enter your PIN to encrypt the key"
                    value={byokPin()}
                    onInput={(e) => setByokPin(e.currentTarget.value)}
                  />
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your PIN encrypts the imported key for secure storage.
                  </p>
                </div>

                {/* Error message */}
                <Show when={byokError()}>
                  <div class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p class="text-xs text-red-700 dark:text-red-300">{byokError()}</p>
                  </div>
                </Show>
              </div>

              <div class="flex gap-3 mt-4">
                <button
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  onClick={closeAddIdentityModal}
                >
                  Cancel
                </button>
                <button
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                  disabled={!byokNsec() || !byokPin() || !byokPreview() || isImportingBYOK() || props.isVaultLocked}
                  onClick={handleImportBYOK}
                >
                  {isImportingBYOK() ? 'Importing...' : 'Import Key'}
                </button>
              </div>
            </Show>

            <Show when={props.isVaultLocked}>
              <p class="text-xs text-gray-500 mt-3 text-center">Unlock your vault to add a new identity.</p>
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
          <div class={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto ${showSettingsPanel() ? 'translate-x-0' : 'translate-x-full'}`}>
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

                      {/* Edit Profile Button */}
                      <button
                        onClick={() => {
                          navigate(`/${props.appId}/profile/${identity().publicKey}/edit`);
                        }}
                        class="w-full mt-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Nostr Profile
                      </button>
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

                    {/* Archive Identity Section */}
                    <div class="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Danger Zone</h3>
                      <Show when={!props.isVaultLocked} fallback={
                        <p class="text-xs text-gray-500 dark:text-gray-400">Unlock your vault to archive identities.</p>
                      }>
                        <button
                          onClick={() => confirmArchiveIdentity(identity().index)}
                          class="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                        >
                          Archive Identity
                        </button>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Archived identities are hidden but can be restored later with their path and nickname.
                        </p>
                      </Show>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Archive Confirmation Modal */}
      <Show when={showArchiveConfirm()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-gray-300 dark:border-gray-600 p-6 max-w-md w-full mx-4">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Archive Identity?</h2>
            <p class="text-gray-700 dark:text-gray-300 mb-2">
              Are you sure you want to archive <strong class="text-gray-900 dark:text-gray-100">{identityToArchive()?.nickname}</strong>?
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This identity will be hidden but can be restored later with its path and nickname.
            </p>
            <div class="flex gap-3">
              <button
                onClick={handleArchiveIdentity}
                class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
              >
                Archive
              </button>
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setIdentityToArchive(null);
                }}
                class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
