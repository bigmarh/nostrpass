# @nostrpass/worker-messenger

A type-safe, intuitive messaging library for WebWorker communication with excellent DX.

## Features

- 🎯 **Type-safe** - Full TypeScript support with type inference
- 🚀 **Simple API** - Intuitive client/host creation
- ⏱️ **Timeout handling** - Configurable request timeouts
- 🔍 **Error handling** - Structured error responses
- 🧩 **Framework agnostic** - Works with any framework

## Installation

```bash
pnpm add @nostrpass/worker-messenger
```

## Usage

### 1. Define your worker methods

```typescript
// crypto.worker.ts
import { createWorkerHost } from '@nostrpass/worker-messenger';

const handlers = {
  generateKeypair: async (params: { seed?: string }) => {
    // Your crypto implementation
    return { publicKey: '...', privateKey: '...' };
  },
  
  signMessage: async (params: { message: string; privateKey: string }) => {
    // Sign the message
    return { signature: '...' };
  },
};

export type CryptoWorkerMethods = typeof handlers;

createWorkerHost(handlers);
```

### 2. Create a client in your main thread

```typescript
// main.ts
import { createWorkerClient } from '@nostrpass/worker-messenger';
import type { CryptoWorkerMethods } from './crypto.worker';

const worker = new Worker('./crypto.worker.js');
const crypto = createWorkerClient<CryptoWorkerMethods>(worker);

// Use with full type safety!
const { publicKey, privateKey } = await crypto.generateKeypair({ seed: 'optional' });
const { signature } = await crypto.signMessage({ 
  message: 'Hello', 
  privateKey 
});
```

### 3. Use with SolidJS (or any framework)

```typescript
// CryptoWorkerProvider.tsx
import { createContext, useContext } from 'solid-js';
import { createWorkerClient } from '@nostrpass/worker-messenger';

const CryptoWorkerContext = createContext();

export const CryptoWorkerProvider = (props) => {
  const worker = new Worker('./crypto.worker.js');
  const client = createWorkerClient(worker);
  
  onCleanup(() => worker.terminate());
  
  return (
    <CryptoWorkerContext.Provider value={client}>
      {props.children}
    </CryptoWorkerContext.Provider>
  );
};

export const useCryptoWorker = () => {
  const client = useContext(CryptoWorkerContext);
  if (!client) throw new Error('CryptoWorker not provided');
  return client;
};
```

### 4. Use in components

```typescript
// MyComponent.tsx
const MyComponent = () => {
  const crypto = useCryptoWorker();
  
  const handleSign = async () => {
    const result = await crypto.signMessage({
      message: 'Hello world',
      privateKey: '...'
    });
    console.log('Signature:', result.signature);
  };
  
  return <button onClick={handleSign}>Sign Message</button>;
};
```

## API Reference

### `createWorkerClient<T>(worker, options?)`

Creates a type-safe client for communicating with a worker.

- `worker` - The Worker instance
- `options` - Optional configuration
  - `timeout` - Request timeout in ms (default: 30000)
  - `onError` - Global error handler

Returns a proxy object with methods matching your worker's handlers.

### `createWorkerHost(handlers, options?)`

Sets up message handling in the worker.

- `handlers` - Object with async methods to handle requests
- `options` - Optional configuration (same as client)

### `WorkerMessenger` class

Low-level class for custom implementations.

```typescript
const messenger = new WorkerMessenger(options);
messenger.setWorker(worker);
messenger.registerHandlers(handlers);

// Manual method calls
const result = await messenger.call('methodName', params);
```

## Best Practices

1. **Always define types** - Export your handler types for client-side usage
2. **Handle errors gracefully** - Implement proper error handling in handlers
3. **Clean up workers** - Remember to terminate workers when done
4. **Use providers** - Wrap workers in framework-specific providers for better DX