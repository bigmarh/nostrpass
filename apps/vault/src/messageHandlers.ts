import { IframeMessenger } from '@nostrpass/messenger';

export function setupMessageHandlers(messenger: IframeMessenger) {
  // GET_PUBLIC_KEY handler - NIP-07 compliant
  messenger.route('GET_PUBLIC_KEY', {
    handler: async (data: any) => {
      console.log('GET_PUBLIC_KEY called with data:', data);
      // NIP-07: getPublicKey() returns just the public key hex string
      return 'not implemented yet';
    }
  });

  // SIGN_EVENT handler - NIP-07 compliant
  messenger.route('SIGN_EVENT', {
    handler: async (data: any) => {
      console.log('SIGN_EVENT called with data:', data);
      // NIP-07: signEvent() returns the signed event object
      throw new Error('SIGN_EVENT handler not implemented');
    }
  });

  // SIGN_DATA handler
  messenger.route('SIGN_DATA', {
    handler: async (data: any) => {
      console.log('SIGN_DATA called with data:', data);
      return { 
        signature: 'not implemented yet',
        message: 'SIGN_DATA handler not implemented' 
      };
    }
  });

  // ENCRYPT handler (NIP-04) - NIP-07 compliant
  messenger.route('ENCRYPT', {
    handler: async (data: any) => {
      console.log('ENCRYPT called with data:', data);
      // NIP-07: nip04.encrypt() returns just the encrypted string
      throw new Error('ENCRYPT handler not implemented');
    }
  });

  // DECRYPT handler (NIP-04) - NIP-07 compliant
  messenger.route('DECRYPT', {
    handler: async (data: any) => {
      console.log('DECRYPT called with data:', data);
      // NIP-07: nip04.decrypt() returns just the decrypted string
      throw new Error('DECRYPT handler not implemented');
    }
  });

  // GET_AUTH_STATUS handler
  messenger.route('GET_AUTH_STATUS', {
    handler: async (data: any) => {
      console.log('GET_AUTH_STATUS called with data:', data);
      return { 
        isAuthenticated: false,
        publicKey: null,
        message: 'GET_AUTH_STATUS handler not implemented' 
      };
    }
  });

  console.log('✅ All message handlers registered');
}