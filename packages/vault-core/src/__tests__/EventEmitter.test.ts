/**
 * EventEmitter tests
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../utils/EventEmitter';

describe('EventEmitter', () => {
  describe('on', () => {
    it('should register event listener', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      emitter.on('test-event', callback);
      emitter.emit('test-event', 'data');

      expect(callback).toHaveBeenCalledWith('data');
    });

    it('should return unsubscribe function', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      const unsubscribe = emitter.on('test-event', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple listeners for same event', () => {
      const emitter = new EventEmitter();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test-event', callback1);
      emitter.on('test-event', callback2);
      emitter.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });
  });

  describe('off', () => {
    it('should remove event listener', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      emitter.on('test-event', callback);
      emitter.off('test-event', callback);
      emitter.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not affect other listeners', () => {
      const emitter = new EventEmitter();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test-event', callback1);
      emitter.on('test-event', callback2);
      emitter.off('test-event', callback1);
      emitter.emit('test-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('data');
    });
  });

  describe('emit', () => {
    it('should call all registered listeners', () => {
      const emitter = new EventEmitter();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      emitter.on('test-event', callback1);
      emitter.on('test-event', callback2);
      emitter.on('other-event', callback3);

      emitter.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
      expect(callback3).not.toHaveBeenCalled();
    });

    it('should pass data to listeners', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      emitter.on('test-event', callback);
      emitter.emit('test-event', { foo: 'bar', num: 42 });

      expect(callback).toHaveBeenCalledWith({ foo: 'bar', num: 42 });
    });

    it('should work with no listeners', () => {
      const emitter = new EventEmitter();

      expect(() => {
        emitter.emit('test-event', 'data');
      }).not.toThrow();
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      emitter.once('test-event', callback);
      emitter.emit('test-event', 'data1');
      emitter.emit('test-event', 'data2');
      emitter.emit('test-event', 'data3');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data1');
    });

    it('should return unsubscribe function', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      const unsubscribe = emitter.once('test-event', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribe before event', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      const unsubscribe = emitter.once('test-event', callback);
      unsubscribe();
      emitter.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event', () => {
      const emitter = new EventEmitter();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      emitter.on('test-event', callback1);
      emitter.on('test-event', callback2);
      emitter.on('other-event', callback3);

      emitter.removeAllListeners('test-event');
      emitter.emit('test-event', 'data');
      emitter.emit('other-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledWith('data');
    });

    it('should remove all listeners for all events if no event specified', () => {
      const emitter = new EventEmitter();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      emitter.on('test-event', callback1);
      emitter.on('test-event', callback2);
      emitter.on('other-event', callback3);

      emitter.removeAllListeners();
      emitter.emit('test-event', 'data');
      emitter.emit('other-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe function', () => {
    it('should unsubscribe when called', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      const unsubscribe = emitter.on('test-event', callback);
      unsubscribe();
      emitter.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      const emitter = new EventEmitter();
      const callback = vi.fn();

      const unsubscribe = emitter.on('test-event', callback);
      unsubscribe();
      unsubscribe();
      unsubscribe();

      expect(() => {
        emitter.emit('test-event', 'data');
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle listener that throws error', () => {
      const emitter = new EventEmitter();
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      emitter.on('test-event', errorCallback);
      emitter.on('test-event', normalCallback);

      expect(() => {
        emitter.emit('test-event', 'data');
      }).toThrow('Test error');

      // Second callback should not be called due to error
      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle removing listener during emit', () => {
      const emitter = new EventEmitter();
      let unsubscribe: (() => void) | null = null;

      const callback1 = vi.fn(() => {
        if (unsubscribe) unsubscribe();
      });
      const callback2 = vi.fn();

      emitter.on('test-event', callback1);
      unsubscribe = emitter.on('test-event', callback2);

      emitter.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      // Second emit should not call callback2
      callback1.mockClear();
      callback2.mockClear();

      emitter.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });
});
