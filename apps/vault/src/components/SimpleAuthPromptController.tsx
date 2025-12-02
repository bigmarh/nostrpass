import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { SimpleAuthPrompt } from './SimpleAuthPrompt';
import { useAuth } from '../providers/AuthProvider';
import { useMessenger } from '../providers/MessengerProvider';
import { vaultDataService } from '../services/vaultDataService';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

interface SimpleAuthPromptEventDetail {
  appOrigin: string;
  appName?: string;
  identityIndex: number;
  requestId?: string;
  afterSignup?: boolean;
  permissions?: {
    getPublicKey?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    getRelays?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signEvent?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip04?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip44?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signData?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
  };
}

export const SimpleAuthPromptController: Component = () => {
  const auth = useAuth();
  const { send } = useMessenger();
  const [visible, setVisible] = createSignal(false);
  const [detail, setDetail] = createSignal<SimpleAuthPromptEventDetail | null>(null);
  const [identity, setIdentity] = createSignal<any>(null);

  const onEvent = async (e: Event) => {
    const ce = e as CustomEvent<SimpleAuthPromptEventDetail>;
    const currentUser = auth.user();

    if (!currentUser) {
      setVisible(false);
      return;
    }

    // Don't show auth prompt if vault is locked
    if (auth.isVaultLocked()) {
      console.warn('Cannot show auth prompt: vault is locked');
      if (ce.detail.requestId) {
        window.dispatchEvent(new CustomEvent('simple-auth-rejected', {
          detail: { requestId: ce.detail.requestId, error: 'Vault is locked' }
        }));
      }
      return;
    }

    // Load the specific identity
    try {
      const vaultData = await vaultDataService.getVaultData(currentUser.profile.username);
      const identityData = vaultData?.identities?.[ce.detail.identityIndex];

      if (identityData) {
        setIdentity(identityData);
        setDetail(ce.detail);

        // Auto-approve if this is after signup and there's only one identity
        if (ce.detail.afterSignup && vaultData?.identities?.length === 1) {
          console.log('[SimpleAuthPromptController] Auto-approving single identity after signup');

          // Automatically authorize without showing prompt
          let appKey = ce.detail.appOrigin;
          try {
            appKey = sanitizeDomain(new URL(ce.detail.appOrigin).host || ce.detail.appOrigin);
          } catch {
            appKey = sanitizeDomain(ce.detail.appOrigin);
          }

          // Use app-requested permissions or fall back to safe defaults
          const permissionsToGrant = {
            getPublicKey: ce.detail.permissions?.getPublicKey || 'ALLOW',
            getRelays: ce.detail.permissions?.getRelays || 'ALLOW',
            signEvent: ce.detail.permissions?.signEvent || 'ASK_EVERYTIME',
            nip04: ce.detail.permissions?.nip04 || 'ASK_EVERYTIME',
            nip44: ce.detail.permissions?.nip44 || 'ASK_EVERYTIME',
            signData: ce.detail.permissions?.signData || 'ASK_EVERYTIME'
          };

          await permissionService.saveAppPermissions(
            currentUser.profile.username,
            appKey,
            permissionsToGrant,
            ce.detail.appName,
            ce.detail.identityIndex
          );

          // Set this identity as the active identity for this app
          await vaultDataService.updateVaultData(currentUser.profile.username, (current) => ({
            activeIdentityByApp: {
              ...(current.activeIdentityByApp || {}),
              [appKey]: ce.detail.identityIndex
            }
          }));

          // Trigger vault data refresh event to notify embassy
          console.log('[SimpleAuthPromptController] 📤 Sending VAULT_DATA_UPDATED to embassy');
          send('VAULT_DATA_UPDATED', {
            username: currentUser.profile.username,
            timestamp: Date.now()
          });

          // Also dispatch window event for components within the vault iframe
          window.dispatchEvent(new CustomEvent('vault-data-refresh', {
            detail: { username: currentUser.profile.username }
          }));

          // Notify success
          if (ce.detail.requestId) {
            window.dispatchEvent(new CustomEvent('simple-auth-approved', {
              detail: {
                requestId: ce.detail.requestId,
                identityIndex: ce.detail.identityIndex,
                appKey
              }
            }));
          }

          // Hide vault after auto-approval
          console.log('[SimpleAuthPromptController] Hiding vault after auto-approval');
          send('HIDE_VAULT');

          return; // Don't show the prompt
        }

        // Show prompt for manual approval
        setVisible(true);
      } else {
        console.error('Identity not found');
        if (ce.detail.requestId) {
          window.dispatchEvent(new CustomEvent('simple-auth-rejected', {
            detail: { requestId: ce.detail.requestId, error: 'Identity not found' }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load identity:', error);
      if (ce.detail.requestId) {
        window.dispatchEvent(new CustomEvent('simple-auth-rejected', {
          detail: { requestId: ce.detail.requestId, error: 'Failed to load identity' }
        }));
      }
    }
  };

  onMount(() => {
    window.addEventListener('vault-simple-auth-prompt', onEvent as EventListener);
  });

  onCleanup(() => {
    window.removeEventListener('vault-simple-auth-prompt', onEvent as EventListener);
  });

  const handleAuthorize = async () => {
    const d = detail();
    const currentUser = auth.user();
    if (!d || !currentUser) {
      setVisible(false);
      return;
    }

    let appKey = d.appOrigin;
    try {
      appKey = sanitizeDomain(new URL(d.appOrigin).host || d.appOrigin);
    } catch {
      appKey = sanitizeDomain(d.appOrigin);
    }

    try {
      // Use app-requested permissions or fall back to safe defaults
      const permissionsToGrant = {
        getPublicKey: d.permissions?.getPublicKey || 'ALLOW',
        getRelays: d.permissions?.getRelays || 'ALLOW',
        signEvent: d.permissions?.signEvent || 'ASK_EVERYTIME',
        nip04: d.permissions?.nip04 || 'ASK_EVERYTIME',
        nip44: d.permissions?.nip44 || 'ASK_EVERYTIME',
        signData: d.permissions?.signData || 'ASK_EVERYTIME'
      };

      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        appKey,
        permissionsToGrant,
        d.appName,
        d.identityIndex
      );

      // Set this identity as the active identity for this app
      await vaultDataService.updateVaultData(currentUser.profile.username, (current) => ({
        activeIdentityByApp: {
          ...(current.activeIdentityByApp || {}),
          [appKey]: d.identityIndex
        }
      }));

      // Trigger vault data refresh event to notify embassy
      console.log('[SimpleAuthPromptController] 📤 Sending VAULT_DATA_UPDATED to embassy');
      send('VAULT_DATA_UPDATED', {
        username: currentUser.profile.username,
        timestamp: Date.now()
      });

      // Also dispatch window event for components within the vault iframe
      window.dispatchEvent(new CustomEvent('vault-data-refresh', {
        detail: { username: currentUser.profile.username }
      }));

      // Dispatch success event
      if (d.requestId) {
        window.dispatchEvent(new CustomEvent('simple-auth-approved', {
          detail: { requestId: d.requestId, identityIndex: d.identityIndex }
        }));
      }

      // Close the vault modal and return to the app
      send('HIDE_VAULT');
    } catch (error) {
      console.error('Failed to authorize app:', error);
      if (d.requestId) {
        window.dispatchEvent(new CustomEvent('simple-auth-rejected', {
          detail: { requestId: d.requestId, error: 'Failed to authorize app' }
        }));
      }
    } finally {
      setVisible(false);
      setDetail(null);
    }
  };

  const handleDeny = () => {
    const d = detail();
    if (d?.requestId) {
      window.dispatchEvent(new CustomEvent('simple-auth-rejected', {
        detail: { requestId: d.requestId, error: 'User denied authorization' }
      }));
    }
    setVisible(false);
    setDetail(null);
  };

  const handleCustomize = () => {
    const d = detail();
    setVisible(false);
    setDetail(null);

    // Open vault dashboard in same window for full permissions control
    // Get the current app from the URL
    const currentPath = window.location.pathname;
    const appMatch = currentPath.match(/^\/([^\/]+)/);
    const app = appMatch ? appMatch[1] : 'vault';

    // Navigate to dashboard
    window.location.href = `/${app}/dashboard`;

    // The user can set up permissions in the dashboard and come back to the app when ready
  };

  return (
    <Show when={visible() && detail() && identity()}>
      <SimpleAuthPrompt
        appOrigin={detail()!.appOrigin}
        appName={detail()!.appName}
        identity={identity()!}
        identityIndex={detail()!.identityIndex}
        permissions={detail()!.permissions}
        onAuthorize={handleAuthorize}
        onDeny={handleDeny}
        onCustomize={handleCustomize}
      />
    </Show>
  );
};

export default SimpleAuthPromptController;
