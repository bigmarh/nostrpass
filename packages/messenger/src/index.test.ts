/**
 * @nostrpass/messenger - Origin Security Tests
 *
 * These tests verify the security improvements that prevent wildcard origin attacks.
 * Key security properties tested:
 * 1. Origin locking: First message locks the messenger to that origin
 * 2. No wildcard responses: Messages are never sent to '*', even if configured
 * 3. Origin validation: Messages from different origins are rejected after lock
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SecureMessenger, SecureServerMessenger, IframeMessenger, ParentMessenger } from './index';

// Mock window and postMessage
function createMockWindow(origin: string = 'https://test.com') {
  const listeners: Map<string, Function[]> = new Map();

  return {
    location: { origin, hostname: 'test.com' },
    parent: {
      postMessage: vi.fn()
    },
    frames: [],
    document: {
      querySelector: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue({
        style: {},
        addEventListener: vi.fn(),
        src: ''
      }),
      body: {
        appendChild: vi.fn()
      }
    },
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    dispatchEvent: (event: MessageEvent) => {
      const handlers = listeners.get('message') || [];
      handlers.forEach(h => h(event));
    },
    // Helper to simulate incoming message
    simulateMessage: (data: any, messageOrigin: string) => {
      const event = new MessageEvent('message', {
        data,
        origin: messageOrigin,
        source: { postMessage: vi.fn() } as any
      });
      const handlers = listeners.get('message') || [];
      handlers.forEach(h => h(event));
    }
  };
}

function createValidMessage(type: string, data: any = {}, origin: string = 'https://app.com') {
  return {
    id: `msg_${Date.now()}_abc123`,
    type,
    data,
    timestamp: Date.now(),
    origin
  };
}

describe('SecureMessenger Origin Security', () => {
  describe('Origin Locking', () => {
    it('should lock to the first message origin', async () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['*']); // Dynamic mode

      // Register a handler
      messenger.on('TEST', () => 'response');

      // Simulate first message from app.com
      const message = createValidMessage('TEST', {}, 'https://app.com');
      mockWindow.simulateMessage(message, 'https://app.com');

      // Wait for async handling
      await new Promise(r => setTimeout(r, 10));

      // Should be locked to app.com
      expect(messenger.getVerifiedOrigin()).toBe('https://app.com');
    });

    it('should reject messages from different origins after lock', async () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['*']);

      let handlerCalled = 0;
      messenger.on('TEST', () => {
        handlerCalled++;
        return 'response';
      });

      // First message locks origin
      mockWindow.simulateMessage(
        createValidMessage('TEST', {}, 'https://app.com'),
        'https://app.com'
      );
      await new Promise(r => setTimeout(r, 10));
      expect(handlerCalled).toBe(1);

      // Second message from different origin should be rejected
      mockWindow.simulateMessage(
        createValidMessage('TEST', {}, 'https://evil.com'),
        'https://evil.com'
      );
      await new Promise(r => setTimeout(r, 10));

      // Handler should NOT have been called again
      expect(handlerCalled).toBe(1);
    });

    it('should accept messages from same origin after lock', async () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['*']);

      let handlerCalled = 0;
      messenger.on('TEST', () => {
        handlerCalled++;
        return 'response';
      });

      // First message
      mockWindow.simulateMessage(
        createValidMessage('TEST', {}, 'https://app.com'),
        'https://app.com'
      );
      await new Promise(r => setTimeout(r, 10));

      // Second message from same origin
      mockWindow.simulateMessage(
        createValidMessage('TEST', {}, 'https://app.com'),
        'https://app.com'
      );
      await new Promise(r => setTimeout(r, 10));

      expect(handlerCalled).toBe(2);
    });
  });

  describe('No Wildcard Responses', () => {
    it('should send responses to verified origin, not wildcard', async () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['*']);

      messenger.on('TEST', () => 'response');

      // Simulate message
      mockWindow.simulateMessage(
        createValidMessage('TEST', {}, 'https://app.com'),
        'https://app.com'
      );
      await new Promise(r => setTimeout(r, 10));

      // Check postMessage was called with specific origin, not '*'
      const postMessageMock = mockWindow.parent.postMessage as Mock;
      expect(postMessageMock).toHaveBeenCalled();

      // Second argument should be the verified origin
      const [, targetOrigin] = postMessageMock.mock.calls[0];
      expect(targetOrigin).toBe('https://app.com');
      expect(targetOrigin).not.toBe('*');
    });

    it('should throw error when trying to send without verified origin', () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['*']); // Wildcard configured but no messages received yet

      // Trying to send before receiving a message should throw
      expect(() => {
        messenger.send('TEST', {});
      }).toThrow('No verified origin available');
    });

    it('should use single allowed origin when configured', () => {
      const mockWindow = createMockWindow('https://vault.nostrpass.com');
      const messenger = new SecureMessenger(false, mockWindow);
      messenger.init(['https://app.com']); // Single specific origin

      // Should be able to send to the single configured origin
      messenger.send('TEST', {});

      const postMessageMock = mockWindow.parent.postMessage as Mock;
      expect(postMessageMock).toHaveBeenCalled();

      const [, targetOrigin] = postMessageMock.mock.calls[0];
      expect(targetOrigin).toBe('https://app.com');
    });
  });

  describe('Wildcard Warning', () => {
    it('should warn when wildcard is used', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockWindow = createMockWindow();
      const messenger = new SecureMessenger(false, mockWindow);

      messenger.init(['*']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Using wildcard origin "*" is insecure')
      );

      consoleSpy.mockRestore();
    });

    it('should not warn when specific origins are used', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockWindow = createMockWindow();
      const messenger = new SecureMessenger(false, mockWindow);

      messenger.init(['https://app.com', 'https://other.com']);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

describe('IframeMessenger Origin Security', () => {
  it('should start in dynamic origin mode by default', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new IframeMessenger(mockWindow);

    messenger.initWithParent(); // No origins = dynamic mode

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Dynamic origin mode')
    );

    consoleSpy.mockRestore();
  });

  it('should report origin lock status correctly', async () => {
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new IframeMessenger(mockWindow);
    messenger.initWithParent(['*']);

    // Before any message
    expect(messenger.isOriginLocked()).toBe(false);
    expect(messenger.getParentOrigin()).toBeNull();

    // Register a route
    messenger.route('TEST', {
      handler: () => 'response'
    });

    // Simulate message
    mockWindow.simulateMessage(
      createValidMessage('TEST', {}, 'https://app.com'),
      'https://app.com'
    );
    await new Promise(r => setTimeout(r, 10));

    // After message
    expect(messenger.isOriginLocked()).toBe(true);
    expect(messenger.getParentOrigin()).toBe('https://app.com');
  });
});

describe('SecureServerMessenger Origin Security', () => {
  it('should lock origin in middleware context', async () => {
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new SecureServerMessenger(false, mockWindow);
    messenger.init(['*']);

    let contextOrigin: string | undefined;

    messenger.route('TEST', {
      handler: (data, context) => {
        contextOrigin = context.origin;
        return 'response';
      }
    });

    mockWindow.simulateMessage(
      createValidMessage('TEST', {}, 'https://app.com'),
      'https://app.com'
    );
    await new Promise(r => setTimeout(r, 10));

    // Context should have the verified origin
    expect(contextOrigin).toBe('https://app.com');
    expect(messenger.getVerifiedOrigin()).toBe('https://app.com');
  });
});

describe('ParentMessenger Origin Security', () => {
  it('should extract and use iframe origin from src URL', () => {
    const mockWindow = createMockWindow('https://app.com');
    const mockIframe = {
      style: { cssText: '' },
      src: '',
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (event === 'load') {
          // Simulate immediate load
          setTimeout(() => handler(), 0);
        }
      }),
      contentWindow: {
        postMessage: vi.fn()
      }
    };

    mockWindow.document.createElement = vi.fn().mockReturnValue(mockIframe);
    mockWindow.document.body.appendChild = vi.fn();

    const messenger = new ParentMessenger(mockWindow);
    messenger.createHiddenIframe('https://vault.nostrpass.com/embed');

    // The iframe src should be set
    expect(mockIframe.src).toBe('https://vault.nostrpass.com/embed');
  });
});

describe('Message Validation', () => {
  it('should reject messages with invalid structure', async () => {
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new SecureMessenger(false, mockWindow);
    messenger.init(['https://app.com']);

    let handlerCalled = false;
    messenger.on('TEST', () => {
      handlerCalled = true;
      return 'response';
    });

    // Message missing required fields
    mockWindow.simulateMessage(
      { type: 'TEST', data: {} }, // Missing id, timestamp, origin
      'https://app.com'
    );
    await new Promise(r => setTimeout(r, 10));

    expect(handlerCalled).toBe(false);
  });

  it('should reject messages with old timestamps', async () => {
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new SecureMessenger(false, mockWindow);
    messenger.init(['https://app.com']);

    let handlerCalled = false;
    messenger.on('TEST', () => {
      handlerCalled = true;
      return 'response';
    });

    // Message with timestamp > 5 minutes old
    const oldMessage = {
      id: 'msg_123',
      type: 'TEST',
      data: {},
      timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
      origin: 'https://app.com'
    };

    mockWindow.simulateMessage(oldMessage, 'https://app.com');
    await new Promise(r => setTimeout(r, 10));

    expect(handlerCalled).toBe(false);
  });
});

describe('Cleanup', () => {
  it('should clear verified origin on destroy', () => {
    const mockWindow = createMockWindow('https://vault.nostrpass.com');
    const messenger = new SecureMessenger(false, mockWindow);
    messenger.init(['*']);

    // Manually set verified origin (simulating after message)
    (messenger as any).verifiedResponseOrigin = 'https://app.com';

    expect(messenger.getVerifiedOrigin()).toBe('https://app.com');

    messenger.destroy();

    expect(messenger.getVerifiedOrigin()).toBeNull();
  });
});
