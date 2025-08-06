import { MessageHandler, MessageHandlerDependencies } from './index';

export const authHandlers: MessageHandler[] = [
  {
    route: 'GET_PUBLIC_KEY',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 GET_PUBLIC_KEY request received:', {
        user: currentUser.profile?.username,
        origin: context?.origin
      });

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission
      const hasPermission = await deps.checkPermission('getPublicKey', origin);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Get the identity associated with this app
      const cryptoWorker = deps.getCryptoWorker();
      if (cryptoWorker && currentUser.profile?.username) {
        try {
          const vaultData = await cryptoWorker.getVaultData({ 
            username: currentUser.profile.username 
          });
          
          if (vaultData?.identities) {
            // Find the identity that's assigned to this app/origin
            let appIdentity = null;
            
            // Check each identity for app permissions matching this origin
            for (let i = 0; i < vaultData.identities.length; i++) {
              const identity = vaultData.identities[i];
              if (identity.appPermissions && identity.appPermissions[origin]) {
                appIdentity = identity;
                console.log(`✅ Found identity '${identity.name}' assigned to app ${origin}`);
                break;
              }
            }
            
            // If no identity is assigned to this app yet, use the current identity
            if (!appIdentity) {
              console.log(`⚠️ No identity assigned to app ${origin}, using current identity`);
              appIdentity = vaultData.identities[vaultData.currentIdentityIndex || 0];
            }
            
            if (appIdentity?.publicKey) {
              console.log(`✅ Returning public key for identity: ${appIdentity.name}`);
              return appIdentity.publicKey;
            }
          }
        } catch (error) {
          console.error('Failed to get identity public key:', error);
        }
      }

      throw new Error('No identity available');
    }
  },

  {
    route: 'SIGN_EVENT',
    handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      console.log('🔍 SIGN_EVENT request received:', {
        user: currentUser.profile?.username,
        origin: context?.origin,
        eventKind: data.event?.kind
      });

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission for signing events
      const eventKind = data.event?.kind;
      const hasPermission = await deps.checkPermission('signEvent', origin, eventKind);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      // Get the identity associated with this app
      const identityIndex = await deps.getAppIdentityIndex(origin);

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
    route: 'SIGN_DATA',
    handler: async (data: { data: string }, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission for signing data
      const hasPermission = await deps.checkPermission('signData', origin);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      // Use session-based signing
      const signature = await cryptoWorker.signMessageWithSession({
        username: currentUser.profile.username,
        message: data.data
      });

      // Return signature in expected format
      return {
        signature,
        publicKey: currentUser.publicKey
      };
    }
  },

  {
    route: 'ENCRYPT',
    handler: async (data: { plaintext: string; recipientPubkey: string }, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission
      const hasPermission = await deps.checkPermission('nip04', origin);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      // TODO: Use app-specific identity for encryption
      const encrypted = await cryptoWorker.encryptWithSession({
        username: currentUser.profile.username,
        plaintext: data.plaintext,
        recipientPubkey: data.recipientPubkey
      });

      return encrypted;
    }
  },

  {
    route: 'DECRYPT',
    handler: async (data: { ciphertext: string; senderPubkey: string }, context: any, deps: MessageHandlerDependencies) => {
      const currentUser = deps.getUser();
      const cryptoWorker = deps.getCryptoWorker();
      
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission
      const hasPermission = await deps.checkPermission('nip04', origin);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Check if vault is locked
      if (deps.isVaultLocked()) {
        throw new Error('Vault is locked. Please unlock with PIN.');
      }

      // TODO: Use app-specific identity for decryption
      const decrypted = await cryptoWorker.decryptWithSession({
        username: currentUser.profile.username,
        ciphertext: data.ciphertext,
        senderPubkey: data.senderPubkey
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
      console.log('Auth status acknowledged by parent:', data);
    }
  }
];