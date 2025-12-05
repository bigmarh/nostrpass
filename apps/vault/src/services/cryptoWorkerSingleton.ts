/**
 * Crypto Worker Singleton
 *
 * This module re-exports the crypto worker factory for backward compatibility.
 * The factory now supports both SharedWorker (desktop) and Dedicated Worker (mobile).
 *
 * @see cryptoWorkerFactory.ts for implementation details
 */

export {
  getCryptoWorker,
  getCryptoWorkerInstance,
  getBackendType,
  detectBestBackend,
  isMobileDevice,
  terminateWorker,
  type WorkerBackend
} from './cryptoWorkerFactory';
