import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { AccountPicker } from './AccountPicker';
import { useAuth } from '../providers/AuthProvider';
import { vaultDataService } from '../services/vaultDataService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { setActiveIdentity } from '../utils/activeIdentityManager';

interface AccountPickerEventDetail {
  appOrigin: string;
  appName?: string;
  requestId?: string;
  action?: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
}

export const AccountPickerController: Component = () => {
  const auth = useAuth();
  const [visible, setVisible] = createSignal(false);
  const [detail, setDetail] = createSignal<AccountPickerEventDetail | null>(null);
  const [identities, setIdentities] = createSignal<any[]>([]);

  // Helper function to load and set identities
  const loadIdentities = async (appOrigin: string, currentDetail?: AccountPickerEventDetail | null) => {
    const currentUser = auth.user();
    if (!currentUser) {
      return;
    }

    let appKey = appOrigin;
    try {
      appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
    } catch {
      appKey = sanitizeDomain(appOrigin);
    }

    // Use storagePublicKey for vault lookup (critical for Google login)
    try {
      const lookupKey = currentUser.profile.storagePublicKey || currentUser.profile.username;
      const vaultData = await vaultDataService.getVaultData(lookupKey);
      if (vaultData?.identities && vaultData.identities.length > 0) {
        // Show ALL identities with their indices
        // Mark which ones are already authorized for UI indication
        const allIdentities = vaultData.identities.map((identity: any, index: number) => ({
          identity,
          index,
          isAuthorized: !!(identity?.appPermissions && identity.appPermissions[appKey])
        }));

        setIdentities(allIdentities);

        // If there's only one identity, auto-select it instead of showing the picker
        if (allIdentities.length === 1 && currentDetail) {
          console.log('🔵 [AccountPicker] Only one identity - auto-selecting index 0');

          // Update active identity in localStorage (per-browser, not synced)
          await setActiveIdentity(currentUser.profile.username, appOrigin, 0);

          const isAuthorized = allIdentities[0].isAuthorized;

          if (isAuthorized) {
            // Already authorized - just dispatch success
            if (currentDetail.requestId) {
              window.dispatchEvent(new CustomEvent('account-picker-selected', {
                detail: { requestId: currentDetail.requestId, identityIndex: 0 }
              }));
            }
          } else {
            // Not authorized - show simple auth prompt
            const authRequestId = `simple-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;

            const handleApproved = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === authRequestId) {
                cleanup();
                if (currentDetail.requestId) {
                  window.dispatchEvent(new CustomEvent('account-picker-selected', {
                    detail: { requestId: currentDetail.requestId, identityIndex: 0 }
                  }));
                }
              }
            };

            const handleRejected = (e: Event) => {
              const ce = e as CustomEvent;
              if (ce.detail.requestId === authRequestId) {
                cleanup();
                if (currentDetail.requestId) {
                  window.dispatchEvent(new CustomEvent('account-picker-rejected', {
                    detail: { requestId: currentDetail.requestId, error: ce.detail.error }
                  }));
                }
              }
            };

            const cleanup = () => {
              window.removeEventListener('simple-auth-approved', handleApproved as EventListener);
              window.removeEventListener('simple-auth-rejected', handleRejected as EventListener);
            };

            window.addEventListener('simple-auth-approved', handleApproved as EventListener);
            window.addEventListener('simple-auth-rejected', handleRejected as EventListener);

            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
              detail: {
                appOrigin: currentDetail.appOrigin,
                appName: currentDetail.appName,
                identityIndex: 0,
                requestId: authRequestId
              }
            }));
          }
          return; // Don't show the picker
        }

        // Multiple identities - show picker
        if (currentDetail) {
          setDetail(currentDetail);
          setVisible(true);
        }
      } else {
        console.error('No identities available for selection');
        // Dispatch rejection event only if we have a request ID
        if (currentDetail?.requestId) {
          window.dispatchEvent(new CustomEvent('account-picker-rejected', {
            detail: { requestId: currentDetail.requestId, error: 'No identities available' }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load identities:', error);
      if (currentDetail?.requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId: currentDetail.requestId, error: 'Failed to load identities' }
        }));
      }
    }
  };

  const onEvent = async (e: Event) => {
    const ce = e as CustomEvent<AccountPickerEventDetail>;
    const currentUser = auth.user();

    if (!currentUser) {
      setVisible(false);
      return;
    }

    // Don't show account picker if vault is locked
    if (auth.isVaultLocked()) {
      console.warn('Cannot show account picker: vault is locked');
      if (ce.detail.requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId: ce.detail.requestId, error: 'Vault is locked' }
        }));
      }
      return;
    }

    await loadIdentities(ce.detail.appOrigin, ce.detail);
  };

  // Handle vault data refresh - reload identities if picker is visible
  const onVaultDataRefresh = async (e: Event) => {
    const currentDetail = detail();
    if (visible() && currentDetail) {
      // Reload identities when vault data changes and picker is open
      await loadIdentities(currentDetail.appOrigin, null);
    }
  };

  onMount(() => {
    window.addEventListener('vault-account-picker', onEvent as EventListener);
    window.addEventListener('vault-data-refresh', onVaultDataRefresh as EventListener);
  });

  onCleanup(() => {
    window.removeEventListener('vault-account-picker', onEvent as EventListener);
    window.removeEventListener('vault-data-refresh', onVaultDataRefresh as EventListener);
  });

  const handleSelect = async (identityIndex: number) => {
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

    // Check if this identity is already authorized
    const selectedIdentityData = identities().find((item: any) => item.index === identityIndex);
    const isAuthorized = selectedIdentityData?.isAuthorized || false;

    try {
      // Update active identity in localStorage (per-browser, not synced)
      await setActiveIdentity(currentUser.profile.username, d.appOrigin, identityIndex);

      if (isAuthorized) {
        // Identity is already authorized - just dispatch success
        if (d.requestId) {
          window.dispatchEvent(new CustomEvent('account-picker-selected', {
            detail: { requestId: d.requestId, identityIndex }
          }));
        }
        setVisible(false);
        setDetail(null);
      } else {
        // Identity not authorized - show simple auth prompt
        setVisible(false);
        setDetail(null);

        // Create new request ID for the auth prompt
        const authRequestId = `simple-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Set up listeners for the auth prompt response
        const handleApproved = (e: Event) => {
          const ce = e as CustomEvent;
          if (ce.detail.requestId === authRequestId) {
            cleanup();
            // After approval, dispatch success from original request
            if (d.requestId) {
              window.dispatchEvent(new CustomEvent('account-picker-selected', {
                detail: { requestId: d.requestId, identityIndex }
              }));
            }
          }
        };

        const handleRejected = (e: Event) => {
          const ce = e as CustomEvent;
          if (ce.detail.requestId === authRequestId) {
            cleanup();
            // Propagate rejection to original request
            if (d.requestId) {
              window.dispatchEvent(new CustomEvent('account-picker-rejected', {
                detail: { requestId: d.requestId, error: ce.detail.error }
              }));
            }
          }
        };

        const cleanup = () => {
          window.removeEventListener('simple-auth-approved', handleApproved as EventListener);
          window.removeEventListener('simple-auth-rejected', handleRejected as EventListener);
        };

        window.addEventListener('simple-auth-approved', handleApproved as EventListener);
        window.addEventListener('simple-auth-rejected', handleRejected as EventListener);

        // Trigger simple auth prompt
        window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
          detail: {
            appOrigin: d.appOrigin,
            appName: d.appName,
            identityIndex,
            requestId: authRequestId
          }
        }));
      }
    } catch (error) {
      console.error('Failed to set active identity:', error);
      if (d.requestId) {
        window.dispatchEvent(new CustomEvent('account-picker-rejected', {
          detail: { requestId: d.requestId, error: 'Failed to set active identity' }
        }));
      }
      setVisible(false);
      setDetail(null);
    }
  };

  const handleCancel = () => {
    const d = detail();
    if (d?.requestId) {
      window.dispatchEvent(new CustomEvent('account-picker-rejected', {
        detail: { requestId: d.requestId, error: 'User cancelled' }
      }));
    }
    setVisible(false);
    setDetail(null);
  };

  return (
    <Show when={visible() && detail()}>
      <AccountPicker
        appOrigin={detail()!.appOrigin}
        appName={detail()!.appName}
        identities={identities()}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </Show>
  );
};

export default AccountPickerController;
