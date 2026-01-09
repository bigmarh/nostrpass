import { Component, createSignal, onMount, batch, Show } from 'solid-js';
import { useSearchParams, useNavigate } from '@solidjs/router';
import { AccountPicker } from './AccountPicker';
import { useAuth, useMessenger } from '../providers';
import { vaultDataService } from '../services/vaultDataService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { setActiveIdentity } from '../utils/activeIdentityManager';

/**
 * AccountPickerPage - Dedicated page for account/identity selection
 * Used in minimal mode for app authorization flows
 *
 * Query params:
 * - appOrigin: The app requesting access
 * - appName: Display name of the app
 * - requestId: Request tracking ID
 */
export const AccountPickerPage: Component = () => {
  const auth = useAuth();
  const { send } = useMessenger();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identities, setIdentities] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const appOrigin: string = (Array.isArray(searchParams.appOrigin) ? searchParams.appOrigin[0] : searchParams.appOrigin) || window.location.origin;
  const appName: string = (Array.isArray(searchParams.appName) ? searchParams.appName[0] : searchParams.appName) || 'Unknown App';
  const requestId: string | undefined = Array.isArray(searchParams.requestId) ? searchParams.requestId[0] : searchParams.requestId;

  // Parse app-requested permissions from query params
  const appPermissions = searchParams.permissions ? (() => {
    try {
      const permStr = Array.isArray(searchParams.permissions) ? searchParams.permissions[0] : searchParams.permissions;
      return JSON.parse(permStr);
    } catch {
      return undefined;
    }
  })() : undefined;

  onMount(async () => {
    console.log('[AccountPickerPage] Component mounted, loading identities...');
    console.log('[AccountPickerPage] Query params:', { appOrigin, appName, requestId });
    // Small delay to ensure vault unlock has fully propagated
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadIdentities();
  });

  const loadIdentities = async () => {
    const currentUser = auth.user();
    console.log('[AccountPickerPage] Current user:', currentUser);

    if (!currentUser) {
      console.error('[AccountPickerPage] Not authenticated');
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Check if vault is locked
    const isLocked = auth.isVaultLocked();
    console.log('[AccountPickerPage] Vault locked?', isLocked);

    if (isLocked) {
      console.error('[AccountPickerPage] Vault is locked - this should not happen after unlock!');
      setError('Vault is locked');
      setLoading(false);
      // Dispatch rejection if there's a request ID
      if (requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId, error: 'Vault is locked' }
        }));
      }
      return;
    }

    let appKey = appOrigin;
    try {
      appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
    } catch {
      appKey = sanitizeDomain(appOrigin);
    }

    console.log('[AccountPickerPage] Sanitized appKey:', appKey);

    try {
      console.log('[AccountPickerPage] Fetching vault data for username:', currentUser.username);
      const vaultData = await vaultDataService.getVaultData(currentUser.username);
      console.log('[AccountPickerPage] Vault data received:', vaultData);

      if (vaultData?.identities && vaultData.identities.length > 0) {
        console.log('[AccountPickerPage] Found', vaultData.identities.length, 'identities');
        // Filter out archived identities and map with their original indices
        const allIdentities = vaultData.identities
          .map((identity: any, index: number) => ({
            identity,
            index,
            isAuthorized: !!(identity?.appPermissions && identity.appPermissions[appKey])
          }))
          .filter(({ identity }) => !identity.archived);

        console.log('[AccountPickerPage] Processed identities:', allIdentities);
        // Use batch to ensure both updates happen together
        batch(() => {
          setIdentities(allIdentities);
          setLoading(false);
        });
        console.log('[AccountPickerPage] Identities set successfully, loading set to false in batch');
        return; // Early return to skip finally block
      } else {
        console.error('[AccountPickerPage] No identities in vault data');
        setError('No identities available');
        if (requestId) {
          window.dispatchEvent(new CustomEvent('account-picker-rejected', {
            detail: { requestId, error: 'No identities available' }
          }));
        }
      }
    } catch (err) {
      console.error('[AccountPickerPage] Failed to load identities:', err);
      console.error('[AccountPickerPage] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      setError('Failed to load identities: ' + (err instanceof Error ? err.message : String(err)));
      if (requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId, error: 'Failed to load identities' }
        }));
      }
    } finally {
      console.log('[AccountPickerPage] Loading complete, setting loading to false');
      setLoading(false);
      // Force a check of the loading state
      setTimeout(() => {
        console.log('[AccountPickerPage] After setTimeout - loading():', loading(), 'identities().length:', identities().length);
      }, 0);
    }
  };

  const handleSelect = async (identityIndex: number) => {
    const currentUser = auth.user();
    if (!currentUser) return;

    let appKey = appOrigin;
    try {
      appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
    } catch {
      appKey = sanitizeDomain(appOrigin);
    }

    const selectedIdentityData = identities().find((item: any) => item.index === identityIndex);
    const isAuthorized = selectedIdentityData?.isAuthorized || false;
    const selectedPublicKey = selectedIdentityData?.identity?.publicKey;

    console.log('[AccountPickerPage] handleSelect called:', { identityIndex, selectedPublicKey, isAuthorized, selectedIdentityData });

    if (!selectedPublicKey) {
      console.error('[AccountPickerPage] ❌ No publicKey found for selected identity');
      return;
    }

    try {
      // Update active identity in localStorage (per-browser, for UI hints)
      await setActiveIdentity(currentUser.username, appOrigin, identityIndex);

      // SECURITY: Update vault data with new active identity (source of truth)
      // Changed to store publicKey instead of index for stability across identity reordering/deletion
      console.log('[AccountPickerPage] Updating vault data with active identity:', { appKey, publicKey: selectedPublicKey });
      const vaultData = await vaultDataService.getVaultData(currentUser.username);
      if (vaultData) {
        const updatedActiveIdentityByApp = {
          ...(vaultData.activeIdentityByApp || {}),
          [appKey]: selectedPublicKey
        };
        console.log('[AccountPickerPage] Updated activeIdentityByApp:', updatedActiveIdentityByApp);
        await vaultDataService.updateVaultData(
          currentUser.username,
          { activeIdentityByApp: updatedActiveIdentityByApp },
          { updateTimestamp: true }
        );
        console.log('[AccountPickerPage] ✅ Vault data updated successfully');

        // Small delay to ensure vault data is fully persisted to IndexedDB
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        console.error('[AccountPickerPage] ❌ No vault data found to update');
      }

      // Notify embassy of identity change so NostrPassButton can update
      send('VAULT_DATA_UPDATED', {
        username: currentUser.username,
        timestamp: Date.now(),
        activeIdentityIndex: identityIndex,
        activePublicKey: selectedPublicKey,
        appKey
      });

      // Dispatch event for vault components to refresh and show active identity change
      window.dispatchEvent(new CustomEvent('vault-data-refresh', {
        detail: {
          username: currentUser.username,
          source: 'account-picker',
          activeIdentityIndex: identityIndex,
          activePublicKey: selectedPublicKey
        }
      }));

      if (isAuthorized) {
        // Identity is already authorized - send message to parent and close
        if (requestId) {
          // Dispatch event for internal vault listeners
          window.dispatchEvent(new CustomEvent('account-picker-selected', {
            detail: { requestId, identityIndex, identity: selectedIdentityData?.identity }
          }));
          // Send message to parent window (embassy/NostrPassButton)
          send('ACCOUNT_PICKER_SELECTED', {
            requestId,
            identityIndex,
            identity: {
              publicKey: selectedIdentityData?.identity?.publicKey,
              npub: selectedIdentityData?.identity?.npub,
              nickname: selectedIdentityData?.identity?.nickname,
              authorized: true,
              avatar: selectedIdentityData?.identity?.avatar
            }
          });
        }
        // Close the modal
        send('HIDE_VAULT');
      } else {
        // Identity not authorized - show simple auth prompt overlay
        console.log('[AccountPickerPage] Identity not authorized, showing auth prompt');
        const authRequestId = `simple-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Set up listeners for the auth prompt response
        const handleApproved = async (e: Event) => {
          const ce = e as CustomEvent;
          if (ce.detail.requestId === authRequestId) {
            cleanup();
            // After approval, dispatch success from original request
            if (requestId) {
              // Dispatch event for internal vault listeners
              window.dispatchEvent(new CustomEvent('account-picker-selected', {
                detail: { requestId, identityIndex, identity: selectedIdentityData }
              }));
              // Send message to parent window (embassy/NostrPassButton)
              send('ACCOUNT_PICKER_SELECTED', {
                requestId,
                identityIndex,
                identity: {
                  publicKey: selectedIdentityData?.identity?.publicKey,
                  npub: selectedIdentityData?.identity?.npub,
                  nickname: selectedIdentityData?.identity?.nickname,
                  authorized: true,
                  avatar: selectedIdentityData?.identity?.avatar
                }
              });
            }

            // Wait for button to update before closing (auth prompt already waited, this is extra safety)
            console.log('[AccountPickerPage] Waiting for button to process authorization...');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Close the modal
            console.log('[AccountPickerPage] Closing vault after authorization');
            send('HIDE_VAULT');
          }
        };

        const handleRejected = (e: Event) => {
          const ce = e as CustomEvent;
          if (ce.detail.requestId === authRequestId) {
            cleanup();
            // Propagate rejection to original request
            if (requestId) {
              window.dispatchEvent(new CustomEvent('account-picker-rejected', {
                detail: { requestId, error: ce.detail.error }
              }));
            }
            // Close the modal
            send('HIDE_VAULT');
          }
        };

        const cleanup = () => {
          window.removeEventListener('simple-auth-approved', handleApproved as EventListener);
          window.removeEventListener('simple-auth-rejected', handleRejected as EventListener);
        };

        window.addEventListener('simple-auth-approved', handleApproved as EventListener);
        window.addEventListener('simple-auth-rejected', handleRejected as EventListener);

        // Trigger simple auth prompt with app-requested permissions
        window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
          detail: {
            appOrigin,
            appName,
            identityIndex,
            requestId: authRequestId,
            permissions: appPermissions // Pass app-requested permissions
          }
        }));
      }
    } catch (err) {
      console.error('Failed to set active identity:', err);
      setError('Failed to select identity');
      if (requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId, error: 'Failed to set active identity' }
        }));
      }
    }
  };

  const handleCancel = () => {
    if (requestId) {
      window.dispatchEvent(new CustomEvent('account-picker-rejected', {
        detail: { requestId, error: 'User cancelled' }
      }));
    }
    send('HIDE_VAULT');
  };

  return (
    <div class="h-screen w-full overflow-hidden">
      <Show when={loading()}>
        <div class="flex items-center justify-center w-full h-full p-8 bg-white dark:bg-gray-900">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">Loading identities...</p>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="flex items-center justify-center w-full h-full p-8 bg-white dark:bg-gray-900">
          <div class="text-center max-w-md">
            <div class="text-5xl mb-4">⚠️</div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">{error()}</p>
            <button
              onClick={handleCancel}
              class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !error() && identities().length > 0}>
        <AccountPicker
          appOrigin={appOrigin}
          appName={appName}
          identities={identities()}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      </Show>

      <Show when={!loading() && !error() && identities().length === 0}>
        <div class="flex items-center justify-center w-full h-full p-8 bg-white dark:bg-gray-900">
          <div class="text-center max-w-md">
            <div class="text-5xl mb-4">👤</div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">No Identities Available</h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              You don't have any identities set up yet. Please create an identity in your vault first.
            </p>
            <button
              onClick={handleCancel}
              class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AccountPickerPage;
