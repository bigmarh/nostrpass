import { createContext, useContext, ParentComponent, onCleanup, createMemo } from 'solid-js';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';


type CryptoWorkerClient = any;

interface CryptoWorkerContextValue {
  client: CryptoWorkerClient;
  ready: boolean;
}

const CryptoWorkerContext = createContext<CryptoWorkerContextValue>();

export const CryptoWorkerProvider: ParentComponent = (props) => {
  // Get the shared worker instance
  const client = getCryptoWorker();

  onCleanup(() => {
    // Don't terminate the shared worker instance
    // It should persist across the application lifecycle
  });

  const value = {
    get client() {
      return client;
    },
    get ready() {
      return true; // Always ready since it's created synchronously
    }
  };

  return (
    <CryptoWorkerContext.Provider value={value}>
      {props.children}
    </CryptoWorkerContext.Provider>
  );
};

/**
 * Get the crypto worker client.
 * @returns The crypto worker client or null if not ready yet
 */
export const useCryptoWorker = (): CryptoWorkerClient | null => {
  const context = useContext(CryptoWorkerContext);
  if (!context) {
    throw new Error('useCryptoWorker must be used within CryptoWorkerProvider');
  }
  // Return null if not ready instead of throwing
  if (!context.ready) {
    return null;
  }
  return context.client;
};

export const useCryptoWorkerReady = () => {
  const context = useContext(CryptoWorkerContext);
  return createMemo(() => context?.ready ?? false);
};