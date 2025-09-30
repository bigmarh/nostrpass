import { MessageHandler, MessageHandlerDependencies } from './index';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';
import { Msg } from '@nostrpass/types';
import { vaultError, ErrorCode } from './errors';
import { showErrorToast, showSuccessToast } from '../components/Toast';
import { addAuditEvent } from '../components/AuditLog';

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
      
      const hasPermission = await deps.checkPermission('getPublicKey', origin);
      if (!hasPermission) {
        try {
          window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
            detail: {
              appOrigin: origin,
              appName: data?.appName,
              action: 'getPublicKey',
              identityIndex: data?.identityIndex
            }
          }));
        } catch {}
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied');
      }

      // Require explicit identityIndex and validate authorization for this origin
      const requestedIndex = data?.identityIndex;
      if (requestedIndex === undefined || requestedIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const cryptoWorker = deps.getCryptoWorker();
      if (!cryptoWorker || !currentUser.profile?.username) {
        throw vaultError(ErrorCode.INTERNAL, 'Crypto not ready');
      }
      const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      const appKey = originToAppKey(origin);
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (requestedIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
      }
      const appIdentity = vaultData?.identities?.[requestedIndex];
      if (!appIdentity?.appPermissions || !appIdentity.appPermissions[appKey]) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Selected identity is not authorized for this application');
      }
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

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      const eventKind = data.event?.kind;
      const hasPermission = await deps.checkPermission('signEvent', origin, eventKind);
      if (!hasPermission) {
        try {
          window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
            detail: {
              appOrigin: origin,
              appName: data?.appName,
              action: 'signEvent',
              eventKind,
              identityIndex: data?.identityIndex
            }
          }));
        } catch {}
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Require explicit identity and validate authorization
      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
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

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      const hasPermission2 = await deps.checkPermission('signData', origin);
      if (!hasPermission2) {
        try {
          window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
            detail: {
              appOrigin: origin,
              appName: (data as any)?.appName,
              action: 'signData',
              identityIndex: (data as any)?.identityIndex
            }
          }));
        } catch {}
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Require explicit identity and validate authorization
      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
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

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      const hasPermission3 = await deps.checkPermission('nip04', origin);
      if (!hasPermission3) {
        try {
          window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
            detail: {
              appOrigin: origin,
              appName: (data as any)?.appName,
              action: 'nip04',
              identityIndex: (data as any)?.identityIndex
            }
          }));
        } catch {}
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Require explicit identity and validate authorization
      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
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

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      const hasPermission4 = await deps.checkPermission('nip04', origin);
      if (!hasPermission4) {
        try {
          window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
            detail: {
              appOrigin: origin,
              appName: (data as any)?.appName,
              action: 'nip04',
              identityIndex: (data as any)?.identityIndex
            }
          }));
        } catch {}
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw vaultError(ErrorCode.LOCKED, 'Vault is locked. Please unlock with PIN.');
      }

      // Require explicit identity and validate authorization
      const identityIndex = data?.identityIndex;
      if (identityIndex === undefined || identityIndex === null) {
        throw vaultError(ErrorCode.INVALID_REQUEST, 'Missing identity index');
      }
      const authorizedIndex = await deps.getAppIdentityIndex(origin);
      if (identityIndex !== authorizedIndex) {
        throw vaultError(ErrorCode.PERMISSION_DENIED, 'Requested identity not authorized for this application');
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