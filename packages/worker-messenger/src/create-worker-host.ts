import { WorkerMessenger } from './worker-messenger';
import type { WorkerMessageHandlers } from './types';

export function createWorkerHost(
  handlers: WorkerMessageHandlers,
  options?: { timeout?: number; onError?: (error: Error) => void }
): WorkerMessenger {
  const messenger = new WorkerMessenger(options);
  messenger.registerHandlers(handlers);

  // The worker messenger will handle messages automatically
  // when used in a worker context
  
  return messenger;
}