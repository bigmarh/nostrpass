import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { PermissionPrompt } from './PermissionPrompt';
import type { PermissionLevel } from '@nostrpass/types';
import { useAuth } from '../providers/AuthProvider';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { permissionPromptManager } from '../utils/permissionPromptManager';

interface PermissionEventDetail {
  appOrigin: string;
  appName?: string;
  action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
  identityIndex?: number;
  requestId?: string; // Added for async tracking
  // Data being requested
  event?: any; // Full event object for signEvent
  data?: string; // Data for signData
  pubkey?: string; // Recipient for nip04
  ciphertext?: string; // Encrypted content for nip04 decrypt
  plaintext?: string; // Plaintext for nip04 encrypt
}

export const PermissionPromptController: Component = () => {
  const auth = useAuth();
  const [visible, setVisible] = createSignal(false);
  const [detail, setDetail] = createSignal<PermissionEventDetail | null>(null);

  const onEvent = (e: Event) => {
    const ce = e as CustomEvent<PermissionEventDetail>;
    setDetail(ce.detail);
    setVisible(true);
  };

  onMount(() => {
    window.addEventListener('vault-permission-prompt', onEvent as EventListener);
  });

  onCleanup(() => {
    window.removeEventListener('vault-permission-prompt', onEvent as EventListener);
  });

  const handleApprove = async (level: PermissionLevel) => {
    const d = detail();
    const currentUser = auth.user();
    if (!d || !currentUser) {
      setVisible(false);
      return;
    }

    const username = currentUser.profile.username;
    let appKey = d.appOrigin;
    try {
      appKey = sanitizeDomain(new URL(d.appOrigin).host || d.appOrigin);
    } catch {
      appKey = sanitizeDomain(d.appOrigin);
    }

    try {
      if (level === 'ASK_PER_SESSION') {
        if (d.action === 'signEvent' || d.action === 'signData') {
          await permissionService.grantSessionPermission(username, appKey, d.action, d.eventKind, 60);
        }
      } else {
        const perms: any = {};
        switch (d.action) {
          case 'getPublicKey':
            perms.getPublicKey = level;
            break;
          case 'signData':
            perms.signData = level;
            break;
          case 'nip04':
            perms.nip04 = level;
            break;
          case 'getRelays':
            perms.getRelays = level;
            break;
          case 'signEvent':
            perms.kinds = { [d.eventKind || 0]: level };
            break;
        }
        await permissionService.saveAppPermissions(username, appKey, perms, d.appName, d.identityIndex);
      }

      // Notify the permission manager that permission was granted
      if (d.requestId) {
        permissionPromptManager.resolvePermission(d.requestId, { granted: true, level });
      }
    } catch (e) {
      console.error('Failed to save permission:', e);
      // Reject the permission request on error
      if (d.requestId) {
        permissionPromptManager.rejectPermission(d.requestId, 'Failed to save permission');
      }
    } finally {
      setVisible(false);
      setDetail(null);
    }
  };

  const handleDeny = async () => {
    const d = detail();
    const currentUser = auth.user();
    if (!d || !currentUser) {
      setVisible(false);
      return;
    }

    const username = currentUser.profile.username;
    let appKey = d.appOrigin;
    try {
      appKey = sanitizeDomain(new URL(d.appOrigin).host || d.appOrigin);
    } catch {
      appKey = sanitizeDomain(d.appOrigin);
    }

    try {
      // Persist DENY for the requested action
      const perms: any = {};
      switch (d.action) {
        case 'getPublicKey':
          perms.getPublicKey = 'DENY';
          break;
        case 'signData':
          perms.signData = 'DENY';
          break;
        case 'nip04':
          perms.nip04 = 'DENY';
          break;
        case 'getRelays':
          perms.getRelays = 'DENY';
          break;
        case 'signEvent':
          perms.kinds = { [d.eventKind || 0]: 'DENY' };
          break;
      }
      await permissionService.saveAppPermissions(username, appKey, perms, d.appName, d.identityIndex);

      // Notify the permission manager that permission was denied
      if (d.requestId) {
        permissionPromptManager.rejectPermission(d.requestId, 'Permission denied by user');
      }
    } catch (e) {
      console.error('Failed to save deny:', e);
      // Still reject the permission request on error
      if (d.requestId) {
        permissionPromptManager.rejectPermission(d.requestId, 'Failed to save denial');
      }
    } finally {
      setVisible(false);
      setDetail(null);
    }
  };

  return (
    <Show when={visible() && detail()}>
      <PermissionPrompt
        appOrigin={detail()!.appOrigin}
        appName={detail()!.appName}
        request={{
          action: detail()!.action,
          eventKind: detail()!.eventKind,
          origin: detail()!.appOrigin,
          event: detail()!.event,
          data: detail()!.data,
          pubkey: detail()!.pubkey,
          ciphertext: detail()!.ciphertext,
          plaintext: detail()!.plaintext
        }}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </Show>
  );
};

export default PermissionPromptController;


