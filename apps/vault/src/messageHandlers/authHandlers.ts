import { MessageHandler, MessageHandlerDependencies } from './types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { Msg } from '@nostrpass/types';
import { vaultError, ErrorCode } from './errors';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { addAuditEvent } from '../components/AuditLog';
import { permissionPromptManager } from '../utils/permissionPromptManager';
import { getActiveIdentity, setActiveIdentity } from '../utils/activeIdentityManager';

function originToAppKey(origin: string): string {
  try {
    // Try parsing as URL
    let url: URL;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      url = new URL(origin);
    } else {
      // Add protocol if missing (for localhost:3200 format)
      url = new URL(`http://${origin}`);
    }

    const result = sanitizeDomain(url.host);
    console.log('🔑 [originToAppKey] URL parsed:', { origin, host: url.host, result });
    return result;
  } catch (e) {
    // Final fallback: sanitize the raw string
    const result = sanitizeDomain(origin);
    console.log('🔑 [originToAppKey] Fallback to sanitize:', { origin, result, error: (e as Error).message });
    return result;
  }
}

export const authHandlers: MessageHandler[] = [
  {
    route: Msg.GET_PUBLIC_KEY,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      console.log('🔑 [GET_PUBLIC_KEY] Handler called', { data, origin: context?.origin });

      const currentUser = deps.getUser();
      console.log('🔑 [GET_PUBLIC_KEY] Current user:', currentUser ? { username: currentUser.profile?.username, publicKey: currentUser.publicKey?.substring(0, 20) } : null);

      if (!currentUser) {
        console.error('❌ [GET_PUBLIC_KEY] No user authenticated');
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }

      // Check if vault is locked - if so, throw VAULT_LOCKED error which embassy handles specially
      const isLocked = deps.isVaultLocked();
      console.log('🔑 [GET_PUBLIC_KEY] Vault locked:', isLocked);

      if (isLocked) {
        console.error('❌ [GET_PUBLIC_KEY] Vault is locked');
        throw vaultError(ErrorCode.VAULT_LOCKED, 'Vault is locked');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys
      console.log('🔑 [GET_PUBLIC_KEY] Origin:', { raw: rawOrigin, sanitized: origin });

      const requestedIndex = data?.identityIndex;
      console.log('🔑 [GET_PUBLIC_KEY] Requested identity index:', requestedIndex);

      if (requestedIndex === undefined || requestedIndex === null) {
        console.error('❌ [GET_PUBLIC_KEY] Missing identity index');
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Validate identity authorization FIRST (before permission check)
      const cryptoWorker = deps.getCryptoWorker();
      if (!cryptoWorker || !currentUser.profile?.username) {
        throw vaultError(ErrorCode.INTERNAL, 'Crypto not ready');
      }

      const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      const appKey = originToAppKey(origin);
      const authorizedIndex = await deps.getAppIdentityIndex(origin);

      // Check if requested identity matches authorized identity for this origin
      if (requestedIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }

      const appIdentity = vaultData?.identities?.[requestedIndex];
      if (!appIdentity) {
        throw vaultError(ErrorCode.INTERNAL, 'Identity not found');
      }

      // Now check permissions (may trigger async prompt)
      const permissionResult = await deps.checkPermission('getPublicKey', origin, undefined, requestedIndex);

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult.level === 'DENY') {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }

      if (!permissionResult.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: data?.appName,
            action: 'getPublicKey',
            identityIndex: requestedIndex
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }

          // Permission granted, proceed (will be checked again on next line)
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Verify the identity has public key
      if (appIdentity?.publicKey) {
        showSuccessToast('Public Key Retrieved', `Public key provided to ${data?.appName || 'app'}`);

        // Log audit event
        addAuditEvent({
          type: 'permission',
          action: 'Public Key Retrieved',
          details: `Public key provided to ${data?.appName || 'app'} (${origin})`,
          appName: data?.appName,
          appId: origin,
          identityIndex: requestedIndex,
          severity: 'low'
        });

        return appIdentity.publicKey;
      }
      throw vaultError(ErrorCode.INTERNAL, 'No identity available');
    }
  },

  {
    route: Msg.SIGN_EVENT,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();

      if (!currentUser || !cryptoWorker) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated or crypto not ready');
      }

      // Preflight: ensure keys in session; if not, instruct UI to prompt PIN
      const keyStatus = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      if (!keyStatus?.hasPrivateKey && !keyStatus?.hasXpriv) {
        throw vaultError(ErrorCode.LOCKED, 'Session rehydrated without keys; unlock with PIN');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys

      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Validate identity authorization FIRST
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }

      // Now check permissions (may trigger async prompt)
      const eventKind = data.event?.kind;
      const permissionResult = await deps.checkPermission('signEvent', origin, eventKind, identityIndex);

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult.level === 'DENY') {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }

      if (!permissionResult.allowed) {
        // Request permission with async wait for user response (ASK_EVERYTIME)
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: data?.appName,
            action: 'signEvent',
            eventKind,
            identityIndex,
            event: data.event  // Pass the actual event being signed
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }

          // Permission granted, proceed
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Use session-based signing in worker with the correct identity
      const result = await cryptoWorker.signEventWithSession({
        username: currentUser.profile.username,
        event: data.event,
        identityIndex
      });

      showSuccessToast('Event Signed', `Event signed for ${data?.appName || 'app'}`);

      // Log audit event
      addAuditEvent({
        type: 'crypto',
        action: 'Event Signed',
        details: `Kind ${eventKind} event signed for ${data?.appName || 'app'} (${origin})`,
        appName: data?.appName,
        appId: origin,
        identityIndex: identityIndex,
        severity: 'medium'
      });

      // NIP-07: signEvent() returns the signed event object directly
      return result.event;
    }
  },

  {
    route: Msg.SIGN_DATA,
    handler: async (data: { data: string; identityIndex?: number }, context: any, deps: MessageHandlerDependencies) => {
      console.error('🚨🚨🚨 SIGN_DATA HANDLER CALLED 🚨🚨🚨');
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();

      if (!currentUser || !cryptoWorker) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated or crypto not ready');
      }

      // Preflight: ensure keys in session; if not, instruct UI to prompt PIN
      const keyStatus2 = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      if (!keyStatus2?.hasPrivateKey && !keyStatus2?.hasXpriv) {
        throw vaultError(ErrorCode.LOCKED, 'Session rehydrated without keys; unlock with PIN');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys
      console.error('[SIGN_DATA] Raw origin:', rawOrigin, '→ Sanitized:', origin);

      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Validate identity authorization FIRST
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }

      // Now check permissions (may trigger async prompt)
      console.error('[SIGN_DATA] Checking permission for:', { action: 'signData', origin, identityIndex });
      const permissionResult2 = await deps.checkPermission('signData', origin, undefined, identityIndex);
      console.error('[SIGN_DATA] Permission result:', JSON.stringify(permissionResult2, null, 2));

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult2.level === 'DENY') {
        console.error('[SIGN_DATA] ❌ PERMISSION DENIED - Blocking request');
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }
      console.error('[SIGN_DATA] ✅ Permission check passed, level:', permissionResult2.level);

      if (!permissionResult2.allowed) {
        // Request permission with async wait for user response (ASK_EVERYTIME)
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'signData',
            identityIndex,
            data: data.data  // Pass the actual data being signed
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }

          // Permission granted, proceed
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Use session-based signing with correct identity
      const signature = await cryptoWorker.signMessageWithSession({
        username: currentUser.profile.username,
        message: data.data,
        identityIndex
      });

      // Return just the signature string (NIP-07 format)
      showSuccessToast('Event Signed', `Event signed for ${data?.appName || 'app'}`);

      // Log audit event
      addAuditEvent({
        type: 'crypto',
        action: 'Event Signed',
        details: `Event signed for ${data?.appName || 'app'} (${origin})`,
        appName: data?.appName,
        appId: origin,
        identityIndex: identityIndex,
        severity: 'medium'
      });

      return signature;
    }
  },

  {
    route: Msg.ENCRYPT,
    handler: async (data: { plaintext: string; recipientPubkey: string; identityIndex?: number }, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();

      if (!currentUser || !cryptoWorker) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated or crypto not ready');
      }

      // Preflight: ensure keys in session; if not, instruct UI to prompt PIN
      const keyStatus3 = await cryptoWorker.hasKeysInSession({ username: currentUser.profile.username });
      if (!keyStatus3?.hasPrivateKey && !keyStatus3?.hasXpriv) {
        throw vaultError(ErrorCode.LOCKED, 'Session rehydrated without keys; unlock with PIN');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys

      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Validate identity authorization FIRST
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }

      // Now check permissions (may trigger async prompt)
      const permissionResult3 = await deps.checkPermission('nip04', origin, undefined, identityIndex);

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult3.level === 'DENY') {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }

      if (!permissionResult3.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'nip04',
            identityIndex,
            plaintext: data.plaintext,  // Pass the message being encrypted
            pubkey: data.recipientPubkey  // Pass recipient
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }

          // Permission granted, proceed
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Use app-specific identity for encryption
      const encrypted = await cryptoWorker.encryptWithSession({
        username: currentUser.profile.username,
        plaintext: data.plaintext,
        recipientPubkey: data.recipientPubkey,
        identityIndex
      });

      showSuccessToast('Message Encrypted', `Message encrypted for ${(data as any)?.appName || 'app'}`);

      // Log audit event
      addAuditEvent({
        type: 'crypto',
        action: 'Message Encrypted',
        details: `NIP-04 message encrypted for ${(data as any)?.appName || 'app'} (${origin})`,
        appName: (data as any)?.appName,
        appId: origin,
        identityIndex: identityIndex,
        severity: 'medium'
      });

      return encrypted;
    }
  },

  {
    route: Msg.DECRYPT,
    handler: async (data: { ciphertext: string; senderPubkey: string; identityIndex?: number }, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();

      if (!currentUser || !cryptoWorker) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated or crypto not ready');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Get origin - prefer appDomain from data (embassy), fall back to context.origin (direct vault)
      const rawOrigin = (data as any)?.appDomain || context?.origin || 'unknown';
      const origin = originToAppKey(rawOrigin); // Sanitize to match stored permission keys

      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }

      // Validate identity authorization FIRST
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }

      // Now check permissions (may trigger async prompt)
      const permissionResult4 = await deps.checkPermission('nip04', origin, undefined, identityIndex);

      // Check if permission is explicitly DENIED - reject immediately without prompt
      if (permissionResult4.level === 'DENY') {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission explicitly denied for this action');
      }

      if (!permissionResult4.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'nip04',
            identityIndex,
            ciphertext: data.ciphertext,  // Pass the encrypted message
            pubkey: data.senderPubkey  // Pass sender
          });

          if (!promptResult.granted) {
            throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied by user');
          }

          // Permission granted, proceed
        } catch (error) {
          throw vaultError(ErrorCode.PERMISSION_DENIED, error instanceof Error ? error.message : 'Permission denied');
        }
      }

      // Use app-specific identity for decryption
      const decrypted = await cryptoWorker.decryptWithSession({
        username: currentUser.profile.username,
        ciphertext: data.ciphertext,
        senderPubkey: data.senderPubkey,
        identityIndex
      });

      showSuccessToast('Message Decrypted', `Message decrypted from ${(data as any)?.appName || 'app'}`);

      // Log audit event
      addAuditEvent({
        type: 'crypto',
        action: 'Message Decrypted',
        details: `NIP-04 message decrypted from ${(data as any)?.appName || 'app'} (${origin})`,
        appName: (data as any)?.appName,
        appId: origin,
        identityIndex: identityIndex,
        severity: 'medium'
      });

      return decrypted;
    }
  },

  {
    route: Msg.AUTH_STATUS,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      const isLocked = deps.isVaultLocked();

      console.log('[AUTH_STATUS] Query from:', context?.origin);
      console.log('[AUTH_STATUS] Current user:', currentUser?.profile?.username || 'none');
      console.log('[AUTH_STATUS] isLocked:', isLocked);

      if (!currentUser) {
        console.log('[AUTH_STATUS] No user, returning not authenticated');
        return {
          isAuthenticated: false,
          isLocked: false,
          user: null
        };
      }

      // Get the active identity for this app
      try {
        const vaultData = await cryptoWorker?.getVaultData({ username: currentUser.profile?.username });
        const appOrigin = context?.origin;

        // Get app key for permission check
        let appKey = appOrigin;
        try {
          const sanitizeDomain = (await import('@nostrpass/nostrHelpers')).sanitizeDomain;
          appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
        } catch {
          // appKey already set to appOrigin
        }

        // SECURITY: Get the active identity index from vault data (source of truth), not localStorage
        // LocalStorage can be manipulated by malicious scripts
        const activeIdentityIndex = vaultData?.activeIdentityByApp?.[appKey] ?? 0;
        const activeIdentity = vaultData?.identities?.[activeIdentityIndex];

        console.log('[AUTH_STATUS] Active identity lookup:', {
          appKey,
          activeIdentityIndex,
          activeIdentityByApp: vaultData?.activeIdentityByApp,
          identityExists: !!activeIdentity,
          identityArchived: activeIdentity?.archived,
          identityNickname: activeIdentity?.nickname
        });

        // If active identity is archived or doesn't exist, find the first non-archived authorized identity
        if (!activeIdentity || activeIdentity?.archived) {
          console.warn('[AUTH_STATUS] Active identity is archived or missing, finding alternative:', {
            index: activeIdentityIndex,
            nickname: activeIdentity?.nickname,
            appKey
          });

          // Find first non-archived identity that's authorized for this app
          const firstAuthorizedIdentity = vaultData?.identities?.find((id: any, idx: number) =>
            !id.archived && id.appPermissions && id.appPermissions[appKey]
          );

          if (firstAuthorizedIdentity) {
            const newIndex = vaultData.identities.indexOf(firstAuthorizedIdentity);
            console.log('[AUTH_STATUS] Found alternative authorized identity:', {
              newIndex,
              nickname: firstAuthorizedIdentity.nickname
            });

            // Use this identity as active (update in-memory, don't persist yet)
            const response = {
              isAuthenticated: true,
              isLocked,
              username: currentUser.profile?.username,
              user: {
                identityIndex: newIndex,
                publicKey: firstAuthorizedIdentity.publicKey,
                npub: firstAuthorizedIdentity.npub,
                nickname: firstAuthorizedIdentity.nickname,
                authorized: true
              }
            };
            console.log('[AUTH_STATUS] Returning alternative identity response');
            return response;
          }

          // No authorized non-archived identity found - return no user
          console.warn('[AUTH_STATUS] No authorized non-archived identity found for app');
          return {
            isAuthenticated: true,
            isLocked,
            username: currentUser.profile?.username,
            user: null
          };
        }

        // Check if this identity is authorized for the app
        const isAuthorized = !!(activeIdentity?.appPermissions && activeIdentity.appPermissions[appKey]);

        const response = {
          isAuthenticated: true,
          isLocked,
          username: currentUser.profile?.username,
          user: {
            identityIndex: activeIdentityIndex,
            publicKey: activeIdentity?.publicKey || currentUser.publicKey,
            npub: activeIdentity?.npub,
            nickname: activeIdentity?.nickname,
            authorized: isAuthorized
          }
        };
        console.log('[AUTH_STATUS] Returning success response:', { isLocked, username: response.username, authorized: isAuthorized });
        return response;
      } catch (error) {
        console.error('[AUTH_STATUS] Error getting vault data:', error);
        // If we can't get vault data (e.g., vault locked), we can't determine the active identity
        // Return a minimal response indicating the vault is locked
        const errorResponse = {
          isAuthenticated: true,
          isLocked: true,
          username: currentUser.profile?.username,
          user: null // Don't return identity info when vault is locked - we don't know which is active
        };
        console.log('[AUTH_STATUS] Returning error response (vault locked or inaccessible):', errorResponse);
        return errorResponse;
      }
    }
  },

  {
    route: 'AUTH_STATUS_RESPONSE',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      // Just acknowledge - parent is confirming receipt of AUTH_STATUS
    }
  },

  {
    route: 'GET_ALL_IDENTITIES',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      const appOrigin = context?.origin;

      if (!currentUser) {
        return { identities: [], activeIdentityIndex: null };
      }

      try {
        // Use getVaultData instead of getVaultDataFromSession to get fresh data
        // getVaultDataFromSession uses cached data which may be stale after permission changes
        const vaultData = await cryptoWorker?.getVaultData({ username: currentUser.profile?.username });

        if (!vaultData?.identities || vaultData.identities.length === 0) {
          return { identities: [], activeIdentityIndex: null };
        }

        // Get app key for checking which identity is active for this app
        let appKey = appOrigin;
        try {
          const sanitizeDomain = (await import('@nostrpass/nostrHelpers')).sanitizeDomain;
          appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
        } catch {
          // appKey already set to appOrigin
        }

        // SECURITY: Get active identity from vault data (source of truth), not localStorage
        const activeIdentityIndex = vaultData.activeIdentityByApp?.[appKey] ?? null;

        // Return all identities with their authorization status (exclude archived)
        const identities = vaultData.identities
          .map((identity: any, index: number) => ({
            index,
            nickname: identity.nickname || `Identity ${index + 1}`,
            publicKey: identity.publicKey,
            npub: identity.npub,
            createdAt: identity.createdAt,
            isActive: activeIdentityIndex === index,
            isAuthorized: !!(identity.appPermissions && identity.appPermissions[appKey]),
            archived: identity.archived || false
          }))
          .filter((identity: any) => !identity.archived); // Filter out archived identities

        return {
          identities,
          activeIdentityIndex
        };
      } catch (error) {
        console.error('Failed to get all identities:', error);
        return { identities: [], activeIdentityIndex: null };
      }
    }
  },

  {
    route: Msg.SWITCH_IDENTITY,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      const appOrigin = context?.origin;
      const identityIndex = data?.identityIndex;

      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      if (typeof identityIndex !== 'number' || identityIndex < 0) {
        throw new Error('Invalid identity index');
      }

      try {
        const vaultData = await cryptoWorker?.getVaultData({ username: currentUser.profile?.username });

        if (!vaultData?.identities || identityIndex >= vaultData.identities.length) {
          throw new Error('Identity not found');
        }

        const identity = vaultData.identities[identityIndex];

        // Get app key
        let appKey = appOrigin;
        try {
          const sanitizeDomain = (await import('@nostrpass/nostrHelpers')).sanitizeDomain;
          appKey = sanitizeDomain(new URL(appOrigin).host || appOrigin);
        } catch {
          // appKey already set to appOrigin
        }

        console.log('[SWITCH_IDENTITY] Checking authorization:', {
          identityIndex,
          appOrigin,
          appKey,
          identityAppPermissions: identity.appPermissions,
          hasAppKey: !!(identity.appPermissions && identity.appPermissions[appKey])
        });

        // Check if identity is authorized for this app
        const isAuthorized = !!(identity.appPermissions && identity.appPermissions[appKey]);

        if (!isAuthorized) {
          console.error('[SWITCH_IDENTITY] Identity not authorized:', {
            identityIndex,
            appKey,
            availableKeys: identity.appPermissions ? Object.keys(identity.appPermissions) : []
          });
          throw new Error('Requested identity not authorized for this application');
        }

        // Update active identity in localStorage (per-browser, per-origin)
        await setActiveIdentity(currentUser.profile.username, appOrigin, identityIndex);

        // Notify parent window about identity switch (NOT vault data update)
        try {
          const { getMessenger } = await import('../providers/MessengerProvider');
          const messenger = getMessenger();
          if (messenger?.isReady()) {
            messenger.send('IDENTITY_SWITCHED', {
              username: currentUser.profile.username,
              appOrigin,
              identityIndex,
              timestamp: Date.now()
            });
          }
        } catch (err) {
          console.warn('Failed to notify parent of identity switch:', err);
        }

        // Return the new active identity
        return {
          success: true,
          identityIndex,
          identity: {
            nickname: identity.nickname,
            publicKey: identity.publicKey,
            npub: identity.npub,
            authorized: true
          }
        };
      } catch (error) {
        console.error('Failed to switch identity:', error);
        throw error;
      }
    }
  },

  {
    route: Msg.LOGOUT,
    handler: async (_data: any, _context: any, deps: MessageHandlerDependencies) => {
      console.log('[LOGOUT] Handler called');

      const currentUser = deps.getUser();
      if (!currentUser) {
        console.log('[LOGOUT] No user to log out');
        return { success: true };
      }

      try {
        const cryptoWorker = deps.getCryptoWorker();
        if (cryptoWorker) {
          console.log('[LOGOUT] Calling atomic logout for user:', currentUser.profile.username);
          // Use the new atomic logout which broadcasts to all tabs
          await cryptoWorker.atomicLogout({
            username: currentUser.profile.username
          });
        }

        // Broadcast logout event to notify UI components within this tab
        console.log('[LOGOUT] Broadcasting logout event to window');
        window.dispatchEvent(new CustomEvent('nostrpass:logout', {
          detail: { username: currentUser.profile.username }
        }));

        console.log('[LOGOUT] Logout completed successfully');
        return { success: true };
      } catch (error) {
        console.error('[LOGOUT] Logout failed:', error);
        throw error;
      }
    }
  },

  {
    route: 'LOCK_VAULT',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();

      console.log('[LOCK_VAULT] Locking vault...');

      if (!currentUser) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }

      if (!cryptoWorker) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Crypto worker not ready');
      }

      try {
        await cryptoWorker.lockSession({
          username: currentUser.profile.username
        });

        console.log('[LOCK_VAULT] Vault locked successfully');
        return { success: true, locked: true };
      } catch (error) {
        console.error('[LOCK_VAULT] Lock failed:', error);
        throw error;
      }
    }
  }
];