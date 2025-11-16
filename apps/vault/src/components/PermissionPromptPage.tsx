import { Component, createSignal, onMount, Show } from 'solid-js';
import { useSearchParams, useNavigate } from '@solidjs/router';
import { SimpleAuthPrompt } from './SimpleAuthPrompt';
import { useAuth, useMessenger } from '../providers';
import { vaultDataService } from '../services/vaultDataService';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

/**
 * PermissionPromptPage - Dedicated page for permission authorization
 * Used after account selection to request permissions for an app
 *
 * Query params:
 * - appOrigin: The app requesting access
 * - appName: Display name of the app
 * - identityIndex: The identity to authorize
 * - requestId: Request tracking ID
 * - permissions: JSON-encoded app-requested permissions
 */
export const PermissionPromptPage: Component = () => {
  const auth = useAuth();
  const { send } = useMessenger();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identity, setIdentity] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const appOrigin = searchParams.appOrigin || window.location.origin;
  const appName = searchParams.appName || 'Unknown App';
  const identityIndex = parseInt(searchParams.identityIndex as string || '0', 10);
  const requestId = searchParams.requestId;

  // Parse app-requested permissions from query params
  const appPermissions = searchParams.permissions ? (() => {
    try {
      return JSON.parse(searchParams.permissions as string);
    } catch {
      return undefined;
    }
  })() : undefined;

  onMount(async () => {
    console.log('[PermissionPromptPage] Component mounted');
    console.log('[PermissionPromptPage] Query params:', { appOrigin, appName, identityIndex, requestId });
    await loadIdentity();
  });

  const loadIdentity = async () => {
    const currentUser = auth.user();
    console.log('[PermissionPromptPage] Current user:', currentUser);

    if (!currentUser) {
      console.error('[PermissionPromptPage] Not authenticated');
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Check if vault is locked
    const isLocked = auth.isVaultLocked();
    console.log('[PermissionPromptPage] Vault locked?', isLocked);

    if (isLocked) {
      console.error('[PermissionPromptPage] Vault is locked');
      setError('Vault is locked');
      setLoading(false);
      if (requestId) {
        window.dispatchEvent(new CustomEvent('permission-prompt-rejected', {
          detail: { requestId, error: 'Vault is locked' }
        }));
      }
      return;
    }

    try {
      console.log('[PermissionPromptPage] Fetching vault data for username:', currentUser.profile.username);
      const vaultData = await vaultDataService.getVaultData(currentUser.profile.username);
      console.log('[PermissionPromptPage] Vault data received:', vaultData);

      if (vaultData?.identities && vaultData.identities.length > identityIndex) {
        const identityData = vaultData.identities[identityIndex];
        setIdentity(identityData);
        setLoading(false);
      } else {
        console.error('[PermissionPromptPage] Identity not found at index:', identityIndex);
        setError('Identity not found');
        setLoading(false);
        if (requestId) {
          window.dispatchEvent(new CustomEvent('permission-prompt-rejected', {
            detail: { requestId, error: 'Identity not found' }
          }));
        }
      }
    } catch (err) {
      console.error('[PermissionPromptPage] Failed to load identity:', err);
      setError('Failed to load identity: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
      if (requestId) {
        window.dispatchEvent(new CustomEvent('permission-prompt-rejected', {
          detail: { requestId, error: 'Failed to load identity' }
        }));
      }
    }
  };

  const handleAuthorize = async () => {
    const currentUser = auth.user();
    if (!currentUser) {
      setError('Not authenticated');
      return;
    }

    let appKey = appOrigin;
    try {
      appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
    } catch {
      appKey = sanitizeDomain(appOrigin);
    }

    try {
      // Use app-requested permissions or fall back to safe defaults
      const permissionsToGrant = {
        getPublicKey: appPermissions?.getPublicKey || 'ALLOW',
        getRelays: appPermissions?.getRelays || 'ALLOW',
        signEvent: appPermissions?.signEvent || 'ASK_EVERYTIME',
        nip04: appPermissions?.nip04 || 'ASK_EVERYTIME',
        nip44: appPermissions?.nip44 || 'ASK_EVERYTIME',
        signData: appPermissions?.signData || 'ASK_EVERYTIME'
      };

      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        appKey,
        permissionsToGrant,
        appName,
        identityIndex
      );

      // Trigger vault data refresh event to notify embassy
      window.dispatchEvent(new CustomEvent('vault-data-updated', {
        detail: { username: currentUser.profile.username }
      }));

      // Send approval message
      if (requestId) {
        window.dispatchEvent(new CustomEvent('permission-prompt-approved', {
          detail: { requestId, identityIndex }
        }));
        // Send message to parent window (embassy/NostrPassButton)
        send('ACCOUNT_PICKER_SELECTED', { requestId, identityIndex });
      }

      // Close the modal
      send('HIDE_VAULT');
    } catch (err) {
      console.error('[PermissionPromptPage] Failed to grant permissions:', err);
      setError('Failed to grant permissions');
      if (requestId) {
        window.dispatchEvent(new CustomEvent('permission-prompt-rejected', {
          detail: { requestId, error: 'Failed to grant permissions' }
        }));
      }
    }
  };

  const handleDeny = () => {
    if (requestId) {
      window.dispatchEvent(new CustomEvent('permission-prompt-rejected', {
        detail: { requestId, error: 'User denied permission' }
      }));
    }
    // Close the modal
    send('HIDE_VAULT');
  };

  const handleCustomize = () => {
    // Navigate to dashboard for full permission control
    const currentPath = window.location.pathname;
    const appMatch = currentPath.match(/^\/([^\/]+)/);
    const app = appMatch ? appMatch[1] : 'vault';
    navigate(`/${app}/dashboard`);
  };

  return (
    <div class="flex items-center justify-center w-full h-full p-4">
      <Show when={loading()}>
        <div class="text-center">
          <div class="text-2xl mb-2">⏳</div>
          <div class="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="text-center">
          <div class="text-4xl mb-3">❌</div>
          <div class="text-red-600 dark:text-red-400 font-medium mb-2">Error</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">{error()}</div>
        </div>
      </Show>

      <Show when={!loading() && !error() && identity()}>
        <SimpleAuthPrompt
          appOrigin={appOrigin}
          appName={appName}
          identity={identity()!}
          identityIndex={identityIndex}
          permissions={appPermissions}
          onAuthorize={handleAuthorize}
          onDeny={handleDeny}
          onCustomize={handleCustomize}
        />
      </Show>
    </div>
  );
};

export default PermissionPromptPage;
