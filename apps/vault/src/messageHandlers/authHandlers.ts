import { MessageHandler, MessageHandlerDependencies } from './index';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { Msg } from '@nostrpass/types';
import { vaultError, ErrorCode } from './errors';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { addAuditEvent } from '../components/AuditLog';
import { permissionPromptManager } from '../utils/permissionPromptManager';

function originToAppKey(origin: string): string {
  try {
    const u = new URL(origin);
    return sanitizeDomain(u.host);
  } catch {
    // Fallback: if origin is already a sanitized key
    return sanitizeDomain(origin);
  }
}

export const authHandlers: MessageHandler[] = [
  {
    route: Msg.GET_PUBLIC_KEY,
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'User not authenticated');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';

      const requestedIndex = data?.identityIndex;
      if (requestedIndex === undefined || requestedIndex === null) {
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

      // Get origin from context
      const origin = context?.origin || 'unknown';

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

      if (!permissionResult.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: data?.appName,
            action: 'signEvent',
            eventKind,
            identityIndex
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

      // NIP-07: signEvent() returns the signed event object directly
      return result.event;
    }
  },

  {
    route: Msg.SIGN_DATA,
    handler: async (data: { data: string; identityIndex?: number }, context: any, deps: MessageHandlerDependencies) => {
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

      // Get origin from context
      const origin = context?.origin || 'unknown';

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
      const permissionResult2 = await deps.checkPermission('signData', origin, undefined, identityIndex);
      if (!permissionResult2.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'signData',
            identityIndex
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

      // Get origin from context
      const origin = context?.origin || 'unknown';

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
      if (!permissionResult3.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'nip04',
            identityIndex
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

      showSuccessToast('Message Encrypted', `Message encrypted for ${data?.appName || 'app'}`);
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

      // Get origin from context
      const origin = context?.origin || 'unknown';

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
      if (!permissionResult4.allowed) {
        // Request permission with async wait for user response
        try {
          const promptResult = await permissionPromptManager.requestPermission({
            appOrigin: origin,
            appName: (data as any)?.appName,
            action: 'nip04',
            identityIndex
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

      return decrypted;
    }
  },

  {
    route: 'GET_AUTH_STATUS',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      return {
        isAuthenticated: !!currentUser,
        publicKey: currentUser?.publicKey || null
      };
    }
  },

  {
    route: 'AUTH_STATUS_RESPONSE',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      // Just acknowledge - parent is confirming receipt of AUTH_STATUS
    }
  }
];