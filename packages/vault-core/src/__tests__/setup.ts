/**
 * Test setup file
 *
 * This file runs before all tests to set up the testing environment
 */

// Mock Worker since it's not available in jsdom
global.Worker = class Worker {
  constructor(public url: string) {}

  postMessage(_message: any) {
    // Mock implementation
  }

  addEventListener(_event: string, _handler: any) {
    // Mock implementation
  }

  removeEventListener(_event: string, _handler: any) {
    // Mock implementation
  }

  terminate() {
    // Mock implementation
  }
} as any;
