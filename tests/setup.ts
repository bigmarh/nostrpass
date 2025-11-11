/**
 * Test setup file for Vitest
 */

import { vi } from 'vitest';

// Mock Web Workers
class MockWorker {
  private messageHandlers: ((event: MessageEvent) => void)[] = [];
  private errorHandlers: ((event: ErrorEvent) => void)[] = [];

  constructor(public scriptURL: string) {}

  postMessage(data: any) {
    // Simulate async message handling
    setTimeout(() => {
      this.messageHandlers.forEach(handler => {
        handler({
          data: { type: 'MOCK_RESPONSE', data },
          origin: 'mock-origin'
        } as MessageEvent);
      });
    }, 0);
  }

  addEventListener(type: string, handler: (event: any) => void) {
    if (type === 'message') {
      this.messageHandlers.push(handler);
    } else if (type === 'error') {
      this.errorHandlers.push(handler);
    }
  }

  removeEventListener(type: string, handler: (event: any) => void) {
    if (type === 'message') {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    } else if (type === 'error') {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    }
  }

  terminate() {
    this.messageHandlers = [];
    this.errorHandlers = [];
  }
}

// Mock global Worker
Object.defineProperty(global, 'Worker', {
  value: MockWorker,
  writable: true
});

// Mock SharedWorker
class MockSharedWorker {
  port = {
    start: vi.fn(),
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    close: vi.fn()
  };

  constructor(public scriptURL: string | URL, public options?: any) {}
}

Object.defineProperty(global, 'SharedWorker', {
  value: MockSharedWorker,
  writable: true
});

// Mock crypto.getRandomValues
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  },
  writable: true
});

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => ({
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          add: vi.fn(),
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn()
        }))
      }))
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  })),
  deleteDatabase: vi.fn()
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock sessionStorage
Object.defineProperty(global, 'sessionStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock performance.now
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now())
  },
  writable: true
});

// Mock URL.createObjectURL
Object.defineProperty(global.URL, 'createObjectURL', {
  value: vi.fn(() => 'mock-object-url'),
  writable: true
});

Object.defineProperty(global.URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true
});

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(input: string) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(input: Uint8Array) {
    return Buffer.from(input).toString('utf8');
  }
};

// Mock AbortController
global.AbortController = class AbortController {
  signal = {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  };
  
  abort() {
    this.signal.aborted = true;
  }
};

// Mock BroadcastChannel
global.BroadcastChannel = class BroadcastChannel {
  constructor(public name: string) {}
  
  postMessage = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
};

// Mock MessageChannel
global.MessageChannel = class MessageChannel {
  port1 = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    close: vi.fn()
  };
  
  port2 = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    close: vi.fn()
  };
};

// Mock structuredClone
global.structuredClone = vi.fn((obj) => JSON.parse(JSON.stringify(obj)));

// Mock crypto.subtle
Object.defineProperty(global.crypto, 'subtle', {
  value: {
    generateKey: vi.fn(),
    importKey: vi.fn(),
    exportKey: vi.fn(),
    deriveKey: vi.fn(),
    deriveBits: vi.fn(),
    digest: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    wrapKey: vi.fn(),
    unwrapKey: vi.fn()
  },
  writable: true
});

