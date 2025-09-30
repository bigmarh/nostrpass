/**
 * Unit tests for provider integration and NIP-07 compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NostrPassEmbassy } from '../../../packages/provider/src/embassy';

// Mock the iframe and postMessage
const mockIframe = {
  contentWindow: {
    postMessage: vi.fn()
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  style: {}
};

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: {
    origin: 'https://testapp.com'
  }
};

// Mock global objects
Object.defineProperty(window, 'addEventListener', {
  value: mockWindow.addEventListener,
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockWindow.removeEventListener,
  writable: true
});

Object.defineProperty(window, 'location', {
  value: mockWindow.location,
  writable: true
});

// Mock document.createElement
Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'iframe') {
      return mockIframe;
    }
    return {};
  }),
  writable: true
});

// Mock document.body
Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  writable: true
});

describe('Provider Integration', () => {
  let embassy: NostrPassEmbassy;
  let messageHandlers: Map<string, (data: any) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers = new Map();
    
    // Mock window.addEventListener to capture message handlers
    mockWindow.addEventListener.mockImplementation((event: string, handler: (event: MessageEvent) => void) => {
      if (event === 'message') {
        messageHandlers.set('message', handler);
      }
    });

    embassy = new NostrPassEmbassy({
      appName: 'Test App',
      appDomain: 'https://testapp.com',
      vaultUrl: 'https://vault.nostrpass.com'
    });
  });

  afterEach(() => {
    if (embassy) {
      embassy.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(embassy).toBeDefined();
      expect(embassy.getAppName()).toBe('Test App');
      expect(embassy.getAppDomain()).toBe('https://testapp.com');
    });

    it('should create iframe with correct attributes', () => {
      expect(document.createElement).toHaveBeenCalledWith('iframe');
      expect(mockIframe.style.position).toBe('fixed');
      expect(mockIframe.style.top).toBe('-10000px');
      expect(mockIframe.style.left).toBe('-10000px');
      expect(mockIframe.style.width).toBe('1px');
      expect(mockIframe.style.height).toBe('1px');
      expect(mockIframe.style.border).toBe('none');
    });

    it('should set up message listeners', () => {
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('NIP-07 getPublicKey', () => {
    it('should return public key when vault is unlocked', async () => {
      const expectedPublicKey = 'test_public_key';
      
      // Mock successful response
      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedPublicKey
      };

      // Set up message handler to respond with mock data
      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.getPublicKey();
      
      expect(result).toBe(expectedPublicKey);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'getPublicKey',
          data: {}
        }),
        'https://vault.nostrpass.com'
      );
    });

    it('should handle identity switching', async () => {
      const expectedPublicKey = 'test_public_key_1';
      
      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedPublicKey
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.getPublicKey({ identityIndex: 1 });
      
      expect(result).toBe(expectedPublicKey);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'getPublicKey',
          data: { identityIndex: 1 }
        }),
        'https://vault.nostrpass.com'
      );
    });

    it('should throw error when vault is locked', async () => {
      const mockError = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: false,
        error: {
          code: 'E_VAULT_LOCKED',
          message: 'Vault is locked'
        }
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockError,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.getPublicKey()).rejects.toThrow('Vault is locked');
    });
  });

  describe('NIP-07 signEvent', () => {
    it('should sign event when permission is granted', async () => {
      const event = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };
      
      const expectedSignedEvent = {
        ...event,
        id: 'event_id_123',
        sig: 'signature_123'
      };

      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedSignedEvent
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.signEvent(event);
      
      expect(result).toEqual(expectedSignedEvent);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'signEvent',
          data: { event }
        }),
        'https://vault.nostrpass.com'
      );
    });

    it('should throw error when permission is denied', async () => {
      const event = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };

      const mockError = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: false,
        error: {
          code: 'E_PERMISSION_DENIED',
          message: 'Permission denied'
        }
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockError,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.signEvent(event)).rejects.toThrow('Permission denied');
    });
  });

  describe('NIP-04 Encryption', () => {
    it('should encrypt message', async () => {
      const plaintext = 'Secret message';
      const recipientPubkey = 'recipient_pubkey';
      const expectedCiphertext = 'encrypted_message';

      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedCiphertext
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.nip04.encrypt(recipientPubkey, plaintext);
      
      expect(result).toBe(expectedCiphertext);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'encrypt',
          data: { plaintext, recipientPubkey }
        }),
        'https://vault.nostrpass.com'
      );
    });

    it('should decrypt message', async () => {
      const ciphertext = 'encrypted_message';
      const senderPubkey = 'sender_pubkey';
      const expectedPlaintext = 'Secret message';

      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedPlaintext
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.nip04.decrypt(senderPubkey, ciphertext);
      
      expect(result).toBe(expectedPlaintext);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'decrypt',
          data: { ciphertext, senderPubkey }
        }),
        'https://vault.nostrpass.com'
      );
    });
  });

  describe('Permission Management', () => {
    it('should check permission', async () => {
      const permission = 'getPublicKey';
      const expectedResult = true;

      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: expectedResult
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      const result = await embassy.checkPermission(permission);
      
      expect(result).toBe(expectedResult);
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOSTRPASS_REQUEST',
          method: 'checkPermission',
          data: { permission }
        }),
        'https://vault.nostrpass.com'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockError = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: false,
        error: {
          code: 'E_NETWORK_ERROR',
          message: 'Network error'
        }
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockError,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.getPublicKey()).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      // Mock a timeout by not responding to the message
      const promise = embassy.getPublicKey();
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await expect(promise).rejects.toThrow();
    });

    it('should handle invalid responses', async () => {
      const mockInvalidResponse = {
        type: 'INVALID_RESPONSE',
        id: 'test_id'
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockInvalidResponse,
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.getPublicKey()).rejects.toThrow();
    });
  });

  describe('Security', () => {
    it('should validate message origin', async () => {
      const mockResponse = {
        type: 'NOSTRPASS_RESPONSE',
        id: 'test_id',
        success: true,
        data: 'test_public_key'
      };

      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: mockResponse,
            origin: 'https://malicious.com' // Wrong origin
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.getPublicKey()).rejects.toThrow();
    });

    it('should handle malformed messages', async () => {
      const messageHandler = messageHandlers.get('message');
      if (messageHandler) {
        setTimeout(() => {
          messageHandler({
            data: 'invalid_json',
            origin: 'https://vault.nostrpass.com'
          } as MessageEvent);
        }, 0);
      }

      await expect(embassy.getPublicKey()).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      embassy.destroy();
      
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(document.body.removeChild).toHaveBeenCalledWith(mockIframe);
    });
  });
});

