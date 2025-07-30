import { createContext, useContext, ParentComponent, onCleanup, createResource, createMemo } from 'solid-js';
import { createWorkerClient } from '@nostrpass/worker-messenger';


type CryptoWorkerClient = any;

interface CryptoWorkerContextValue {
  client: CryptoWorkerClient;
  ready: boolean;
}

const CryptoWorkerContext = createContext<CryptoWorkerContextValue>();

export const CryptoWorkerProvider: ParentComponent = (props) => {
  const [workerResource] = createResource(async () => {
    const CryptoWorker = await import('../workers/crypto.worker?worker');
    const worker = new CryptoWorker.default();
    
    const client = createWorkerClient(worker as any, {
      timeout: 10000,
      onError: (error) => {
        console.error('CryptoWorker error:', error);
      },
    });

    return { worker, client };
  });

  onCleanup(() => {
    const resource = workerResource();
    if (resource) {
      resource.worker.terminate();
    }
  });

  const value = {
    get client() {
      const resource = workerResource();
      return resource?.client!;
    },
    get ready() {
      const resource = workerResource();
      return !!resource;
    }
  };

  return (
    <CryptoWorkerContext.Provider value={value}>
      {props.children}
    </CryptoWorkerContext.Provider>
  );
};

export const useCryptoWorker = () => {
  const context = useContext(CryptoWorkerContext);
  if (!context) {
    throw new Error('useCryptoWorker must be used within CryptoWorkerProvider');
  }
  if (!context.ready) {
    throw new Error('CryptoWorker is not ready yet');
  }
  return context.client;
};

export const useCryptoWorkerReady = () => {
  const context = useContext(CryptoWorkerContext);
  return createMemo(() => context?.ready ?? false);
};