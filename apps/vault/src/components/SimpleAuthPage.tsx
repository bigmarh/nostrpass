import { Component, createSignal, onMount, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { SimpleAuthPrompt } from './SimpleAuthPrompt';
import { useAuth, useMessenger } from '../providers';
import { vaultDataService } from '../services/vaultDataService';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

/**
 * SimpleAuthPage - Dedicated page for simple authorization flow
 * Shown after account signup or when an app needs initial authorization
 *
 * Query params:
 * - appOrigin: The app requesting authorization
 * - appName: Display name of the app (optional, defaults to origin)
 * - identityIndex: Which identity to use (defaults to 0)
 * - afterSignup: Whether this is shown after account creation (optional)
 */
export const SimpleAuthPage: Component = () => {
  const auth = useAuth();
  const { send } = useMessenger();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [identity, setIdentity] = createSignal<any>(null);

  const appOrigin: string = (Array.isArray(searchParams.appOrigin) ? searchParams.appOrigin[0] : searchParams.appOrigin) || window.location.origin;
  const appName: string = (Array.isArray(searchParams.appName) ? searchParams.appName[0] : searchParams.appName) || appOrigin;
  const identityIndexStr = Array.isArray(searchParams.identityIndex) ? searchParams.identityIndex[0] : searchParams.identityIndex;
  const identityIndex = identityIndexStr ? parseInt(identityIndexStr, 10) : 0;

  onMount(async () => {
    const currentUser = auth.user();
    if (!currentUser) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    if (auth.isVaultLocked()) {
      setError('Vault is locked');
      setLoading(false);
      return;
    }

    try {
      // Load the identity
      const vaultData = await vaultDataService.getVaultData(currentUser.profile.username);
      const identityData = vaultData?.identities?.[identityIndex];

      if (identityData) {
        setIdentity(identityData);
      } else {
        setError('Identity not found');
      }
    } catch (err) {
      console.error('Failed to load identity:', err);
      setError('Failed to load identity');
    } finally {
      setLoading(false);
    }
  });

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
      // Grant safe default permissions
      const permissionsToGrant = {
        getPublicKey: 'ALLOW' as const,
        getRelays: 'ALLOW' as const,
        signEvent: 'ASK_EVERYTIME' as const,
        nip04: 'ASK_EVERYTIME' as const,
        nip44: 'ASK_EVERYTIME' as const,
        signData: 'ASK_EVERYTIME' as const
      };

      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        appKey,
        permissionsToGrant,
        appName,
        identityIndex
      );

      // Set this identity as the active identity for this app
      await vaultDataService.updateVaultData(currentUser.profile.username, (current) => ({
        activeIdentityByApp: {
          ...(current.activeIdentityByApp || {}),
          [appKey]: identityIndex
        }
      }), { syncToNostr: false });

      // Trigger vault data refresh event to notify embassy
      window.dispatchEvent(new CustomEvent('vault-data-refresh', {
        detail: { username: currentUser.profile.username }
      }));

      // Close the vault modal and return to the app
      send('HIDE_VAULT');
    } catch (err) {
      console.error('Failed to authorize app:', err);
      setError('Failed to authorize app');
    }
  };

  const handleDeny = () => {
    // User denied - just close the vault
    send('HIDE_VAULT');
  };

  const handleCustomize = () => {
    // Open vault dashboard for full permissions control
    const currentPath = window.location.pathname;
    const appMatch = currentPath.match(/^\/([^\/]+)/);
    const app = appMatch ? appMatch[1] : 'vault';

    // Navigate to dashboard
    window.location.href = `/${app}/dashboard`;
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
          onAuthorize={handleAuthorize}
          onDeny={handleDeny}
          onCustomize={handleCustomize}
        />
      </Show>
    </div>
  );
};

export default SimpleAuthPage;
