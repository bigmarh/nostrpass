import { Component, createSignal, createMemo, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { SimpleAuthPrompt } from './SimpleAuthPrompt';
import { useAuth, useMessenger } from '../providers';
import { useVaultData } from '../hooks/useVaultData';
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
  const { vaultData, isLoading } = useVaultData();

  const appOrigin: string = (Array.isArray(searchParams.appOrigin) ? searchParams.appOrigin[0] : searchParams.appOrigin) || window.location.origin;
  const appName: string = (Array.isArray(searchParams.appName) ? searchParams.appName[0] : searchParams.appName) || appOrigin;
  const identityIndexStr = Array.isArray(searchParams.identityIndex) ? searchParams.identityIndex[0] : searchParams.identityIndex;
  const identityIndex = identityIndexStr ? parseInt(identityIndexStr, 10) : 0;

  // Derive identity and error state from vault data
  const identity = createMemo(() => {
    const data = vaultData();
    return data?.identities?.[identityIndex] || null;
  });

  const error = createMemo(() => {
    if (!auth.user()) return 'Not authenticated';
    if (auth.isVaultLocked()) return 'Vault is locked';
    if (!isLoading() && !identity()) return 'Identity not found';
    return '';
  });

  const handleAuthorize = async () => {
    const currentUser = auth.user();
    if (!currentUser) return;

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

      // Trigger vault data refresh event to notify embassy
      window.dispatchEvent(new CustomEvent('vault-data-refresh', {
        detail: { username: currentUser.profile.username }
      }));

      // Close the vault modal and return to the app
      send('HIDE_VAULT');
    } catch (err) {
      console.error('Failed to authorize app:', err);
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
      <Show when={isLoading()}>
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

      <Show when={!isLoading() && !error() && identity()}>
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
