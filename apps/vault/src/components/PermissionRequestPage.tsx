import { Component, createSignal, onMount, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { PermissionPrompt } from './PermissionPrompt';
import type { PermissionLevel } from '@nostrpass/types';
import { useAuth, useMessenger } from '../providers';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

/**
 * PermissionRequestPage - Dedicated page for permission requests
 * Opens in its own window when apps need permissions
 *
 * Query params:
 * - appOrigin: The app requesting permission
 * - appName: Display name of the app
 * - action: The action being requested (signEvent, signData, nip04, etc)
 * - eventKind: Event kind for signEvent
 * - identityIndex: Identity index
 * - requestId: Request tracking ID
 * - event: JSON-encoded event for signEvent
 * - data: Data for signData
 * - pubkey: Recipient/sender pubkey for nip04
 * - plaintext: Plaintext for nip04 encrypt
 * - ciphertext: Ciphertext for nip04 decrypt
 */
export const PermissionRequestPage: Component = () => {
  const auth = useAuth();
  const { send } = useMessenger();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const appOrigin = searchParams.appOrigin || window.location.origin;
  const appName = searchParams.appName || 'Unknown App';
  const action = searchParams.action as any;
  const eventKind = searchParams.eventKind ? parseInt(searchParams.eventKind as string, 10) : undefined;
  const identityIndex = searchParams.identityIndex ? parseInt(searchParams.identityIndex as string, 10) : 0;
  const requestId = searchParams.requestId;

  // Parse JSON-encoded data
  const event = searchParams.event ? (() => {
    try {
      return JSON.parse(searchParams.event as string);
    } catch {
      return undefined;
    }
  })() : undefined;

  const data = searchParams.data as string | undefined;
  const pubkey = searchParams.pubkey as string | undefined;
  const plaintext = searchParams.plaintext as string | undefined;
  const ciphertext = searchParams.ciphertext as string | undefined;

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

    if (!action) {
      setError('Invalid permission request');
      setLoading(false);
      return;
    }

    setLoading(false);
  });

  const handleApprove = async (level: PermissionLevel) => {
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
      if (level === 'ASK_PER_SESSION') {
        if (action === 'signEvent' || action === 'signData') {
          await permissionService.grantSessionPermission(currentUser.profile.username, appKey, action, eventKind, 60);
        }
      } else {
        const perms: any = {};
        switch (action) {
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
            perms.kinds = { [eventKind || 0]: level };
            break;
        }
        await permissionService.saveAppPermissions(currentUser.profile.username, appKey, perms, appName, identityIndex);
      }

      // Notify embassy/parent that permission was granted
      if (requestId) {
        send('PERMISSION_GRANTED', { requestId, level });
      }

      // Close the vault
      send('HIDE_VAULT');
    } catch (err) {
      console.error('Failed to save permission:', err);
      setError('Failed to save permission');
    }
  };

  const handleDeny = async () => {
    // Cancel button - just deny this one request without saving any permission
    if (requestId) {
      send('PERMISSION_DENIED', { requestId });
    }
    send('HIDE_VAULT');
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

      <Show when={!loading() && !error()}>
        <PermissionPrompt
          appOrigin={appOrigin}
          appName={appName}
          request={{
            origin: appOrigin,
            action,
            eventKind,
            event,
            data,
            pubkey,
            plaintext,
            ciphertext
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      </Show>
    </div>
  );
};

export default PermissionRequestPage;
