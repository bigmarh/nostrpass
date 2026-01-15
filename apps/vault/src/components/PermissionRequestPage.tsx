import { Component, createSignal, onMount, Show, createMemo, createEffect } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { PermissionPrompt } from './PermissionPrompt';
import type { PermissionLevel } from '@nostrpass/types';
import { useAuth, useMessenger } from '../providers';
import { permissionService } from '../services/permissionService';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { getPermissionCategoryForKind } from '@nostrpass/types';

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

  // Make query params reactive with memos
  const appOrigin = createMemo(() => (Array.isArray(searchParams.appOrigin) ? searchParams.appOrigin[0] : searchParams.appOrigin) || window.location.origin);
  const appName = createMemo(() => (Array.isArray(searchParams.appName) ? searchParams.appName[0] : searchParams.appName) || 'Unknown App');
  const action = createMemo(() => (Array.isArray(searchParams.action) ? searchParams.action[0] : searchParams.action) as any);
  const eventKind = createMemo(() => {
    const eventKindStr = Array.isArray(searchParams.eventKind) ? searchParams.eventKind[0] : searchParams.eventKind;
    return eventKindStr ? parseInt(eventKindStr, 10) : undefined;
  });
  const identityIndex = createMemo(() => {
    const identityIndexStr = Array.isArray(searchParams.identityIndex) ? searchParams.identityIndex[0] : searchParams.identityIndex;
    return identityIndexStr ? parseInt(identityIndexStr, 10) : 0;
  });
  const requestId = createMemo(() => Array.isArray(searchParams.requestId) ? searchParams.requestId[0] : searchParams.requestId);

  // Parse JSON-encoded data reactively
  const event = createMemo(() => {
    if (!searchParams.event) return undefined;
    try {
      const eventStr = Array.isArray(searchParams.event) ? searchParams.event[0] : searchParams.event;
      return JSON.parse(eventStr);
    } catch {
      return undefined;
    }
  });

  const data = createMemo(() => Array.isArray(searchParams.data) ? searchParams.data[0] : searchParams.data);
  const pubkey = createMemo(() => Array.isArray(searchParams.pubkey) ? searchParams.pubkey[0] : searchParams.pubkey);
  const plaintext = createMemo(() => Array.isArray(searchParams.plaintext) ? searchParams.plaintext[0] : searchParams.plaintext);
  const ciphertext = createMemo(() => Array.isArray(searchParams.ciphertext) ? searchParams.ciphertext[0] : searchParams.ciphertext);

  // React to changes in searchParams
  createEffect(() => {
    console.log('[PermissionRequestPage] 🔍 Params changed:', {
      action: action(),
      appOrigin: appOrigin(),
      appName: appName(),
      eventKind: eventKind(),
      identityIndex: identityIndex(),
      requestId: requestId(),
      hasEvent: !!event(),
      hasData: !!data()
    });

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

    if (!action()) {
      setError('Invalid permission request');
      setLoading(false);
      return;
    }

    setLoading(false);
  });

  const handleApprove = async (level: PermissionLevel) => {
    console.log('[PermissionRequestPage] ✅ Approve clicked:', { action: action(), level, requestId: requestId() });

    const currentUser = auth.user();
    if (!currentUser) {
      setError('Not authenticated');
      return;
    }

    // Use storagePublicKey for vault lookup (critical for Google login where username is UID)
    const lookupKey = currentUser.profile.storagePublicKey || currentUser.profile.username;

    let appKey = appOrigin();
    try {
      appKey = sanitizeDomain(new URL(appOrigin()).host || appOrigin());
    } catch {
      appKey = sanitizeDomain(appOrigin());
    }

    try {
      // ALWAYS grant a temporary session permission so the pending operation can execute immediately
      // This allows the current operation to succeed after user approval
      if (action() === 'signEvent' || action() === 'signData') {
        // Grant 1-minute session permission for the immediate retry
        await permissionService.grantSessionPermission(lookupKey, appKey, action(), eventKind(), 1);
      }

      // Save the permission for future requests based on selected level
      if (level === 'ASK_PER_SESSION') {
        if (action() === 'signEvent' || action() === 'signData') {
          // Extend the session to 60 minutes if user selected "Ask per session"
          await permissionService.grantSessionPermission(lookupKey, appKey, action(), eventKind(), 60);
        }
      } else {
        // Save permanent permission setting
        const perms: any = {};
        switch (action()) {
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
            {
              // For signEvent, save permission based on the category of the event kind
              const category = eventKind() !== undefined ? getPermissionCategoryForKind(eventKind()!) : null;

              if (category) {
                // Save to the appropriate category (social, messaging, financial, signData)
                perms.permissions = { [category]: level };
                console.log(`[PermissionRequestPage] Saving signEvent permission to category: ${category} = ${level}`);
              } else {
                // Unknown event kind - save as top-level signEvent permission as fallback
                perms.signEvent = level;
                console.log(`[PermissionRequestPage] Saving signEvent permission to top-level signEvent = ${level}`);
              }
            }
            break;
        }
        await permissionService.saveAppPermissions(lookupKey, appKey, perms, appName(), identityIndex());
      }

      console.log('[PermissionRequestPage] ✅ Permission saved, level:', level);

      // Notify embassy/parent that permission was granted
      // The app will need to retry the operation since the first attempt failed due to missing permission
      if (requestId()) {
        send('PERMISSION_GRANTED', { requestId: requestId(), level });
      }

      // Close the vault - the operation has already completed (with error)
      // The calling app should retry the operation now that permission is granted
      send('HIDE_VAULT');
    } catch (err) {
      console.error('Failed to save permission:', err);
      setError('Failed to save permission');
    }
  };

  const handleDeny = async () => {
    // Cancel button - just deny this one request without saving any permission
    if (requestId()) {
      send('PERMISSION_DENIED', { requestId: requestId() });
    }
    send('HIDE_VAULT');
  };

  return (
    <div class="w-full h-full">
      <Show when={loading()}>
        <div class="flex items-center justify-center w-full h-full">
          <div class="text-center">
            <div class="text-2xl mb-2">⏳</div>
            <div class="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="flex items-center justify-center w-full h-full">
          <div class="text-center">
            <div class="text-4xl mb-3">❌</div>
            <div class="text-red-600 dark:text-red-400 font-medium mb-2">Error</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{error()}</div>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <PermissionPrompt
          appOrigin={appOrigin()}
          appName={appName()}
          request={{
            origin: appOrigin(),
            action: action(),
            eventKind: eventKind(),
            event: event(),
            data: data(),
            pubkey: pubkey(),
            plaintext: plaintext(),
            ciphertext: ciphertext()
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      </Show>
    </div>
  );
};

export default PermissionRequestPage;
