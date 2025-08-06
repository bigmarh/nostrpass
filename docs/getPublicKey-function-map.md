# getPublicKey Function Map

## Context Layers

### 1. **Third-Party App Context** (User's Website)
```
window.nostr.getPublicKey()
    │
    └─> Calls Embassy SDK
```

### 2. **Embassy SDK Context** (Injected in Third-Party Page)

#### File: `/apps/embassy/src/embassy.ts`
```typescript
// Line 401-417: Global initialization
window.nostr = {
  getPublicKey: () => embassyInstance!.getPublicKey()
}

// Line 272-300: Main getPublicKey method
class NostrPassEmbassy {
  async getPublicKey(): Promise<string> {
    // Ensure iframe exists
    if (!this.iframe || !this.messenger) {
      await this.createIframe();
      await this.waitForReady();
    }
    
    // Show vault UI
    this.show();
    
    // Send request via messenger
    const response = await this.messenger!.request('GET_PUBLIC_KEY', {
      appName: this.config.appName,
      appDomain: this.config.appDomain
    });
    
    // Hide vault UI
    this.hide();
    
    return response.publicKey || response;
  }
}
```

### 3. **Messenger Layer** (Communication Bridge)

#### File: `/packages/messenger/src/index.ts`

##### Parent Side (Embassy)
```typescript
// Line 37-68: Send request
async request(type: string, data: any, timeout: number): Promise<any> {
  const message: MessagePayload = {
    id: this.generateId(),
    type,
    data,
    timestamp: Date.now(),
    origin: this.window.location.origin
  };
  
  // Store pending request with promise handlers
  this.pendingRequests.set(id, { resolve, reject, timeout });
  
  // Send via postMessage
  this.sendMessage(message);
}

// Line 101-118: Send message to iframe
private sendMessage(message: MessagePayload): void {
  // Custom override in embassy.ts lines 247-258
  this.iframe.contentWindow.postMessage(message, vaultOrigin);
}

// Line 174-189: Handle response
protected handleResponse(message: MessagePayload): void {
  const pending = this.pendingRequests.get(message.id);
  if (message.data.error) {
    pending.reject(new Error(message.data.error));
  } else {
    pending.resolve(message.data);
  }
}
```

##### Iframe Side (Vault)
```typescript
// Line 249-307: Handle incoming message
protected async handleMessage(event: MessageEvent): Promise<void> {
  // Validate origin
  if (!this.isOriginAllowed(event.origin)) return;
  
  // Validate message structure
  if (!this.isValidMessage(message)) return;
  
  // Find route handler
  const route = this.routes.get(message.type);
  
  // Execute with middleware
  const result = await this.executeMiddlewareChain(
    middlewareChain,
    context,
    () => route.handler(message.data, context)
  );
  
  // Send response
  await this.sendResponse(message, result);
}

// Line 88-98: Send response back
protected async sendResponse(originalMessage: MessagePayload, responseData: any, error?: string): Promise<void> {
  const responseMessage: MessagePayload = {
    id: originalMessage.id,
    type: `${originalMessage.type}_RESPONSE`,
    data: error ? { error } : responseData,
    timestamp: Date.now(),
    origin: this.window.location.origin
  };
  
  this.sendMessage(responseMessage);
}
```

### 4. **Vault Context** (NostrPass Vault Application)

#### File: `/apps/vault/src/providers/MessengerProvider.tsx`
```typescript
// Line 20-96: Initialize messenger
onMount(() => {
  const messengerInstance = new IframeMessenger(window);
  
  // Configure allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://nostrpass.com',
    // etc...
  ];
  
  messengerInstance.init(allowedOrigins);
  setIsReady(true);
  
  // Set up message handlers (delegated to AuthProvider)
  setupMessageHandlers(messengerInstance);
})
```

#### File: `/apps/vault/src/providers/AuthProvider.tsx`
```typescript
// Line 227-277: Register GET_PUBLIC_KEY handler
createEffect(() => {
  if (!messenger.isReady() || !messenger.messenger) return;
  
  messenger.messenger.route('GET_PUBLIC_KEY', {
    handler: async (data: any, context: any) => {
      const currentUser = user();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get origin from context
      const origin = context?.origin || 'unknown';
      
      // Check permission
      const hasPermission = await checkPermission('getPublicKey', origin);
      if (!hasPermission) {
        throw new Error('Permission denied');
      }
      
      // Get public key from vault
      if (cryptoWorker && currentUser.profile?.username) {
        const vaultData = await cryptoWorker.getVaultData({ 
          username: currentUser.profile.username 
        });
        
        const currentIdentity = vaultData.identities[vaultData.currentIdentityIndex || 0];
        if (currentIdentity?.publicKey) {
          return currentIdentity.publicKey;
        }
      }
      
      // Fallback to user public key
      return currentUser.publicKey;
    }
  });
});

// Line 142-220: Check permissions
const checkPermission = async (
  action: PermissionRequest['action'],
  origin: string,
  eventKind?: number
): Promise<boolean> {
  // Check with permission service
  const permissionCheck = await permissionService.checkPermission(
    currentUser.profile.username,
    origin,
    action,
    eventKind
  );
  
  // Handle DENY, ALLOW, or PROMPT cases
  // ...
}
```

#### File: `/apps/vault/src/services/permissionService.ts`
```typescript
// Check existing permissions
async checkPermission(
  username: string,
  appOrigin: string,
  action: string,
  eventKind?: number
): Promise<PermissionCheckResult> {
  // Load permissions from storage
  // Check if permission exists and is valid
  // Return allowed/denied/needsPrompt
}
```

### 5. **Crypto Worker Context** (Web Worker)

#### File: `/apps/vault/src/workers/crypto.worker.ts`
```typescript
// Line 434-495: Get vault data
case 'getVaultData': {
  const { username } = data;
  
  // Get session from memory
  const session = sessions.get(username);
  if (!session) {
    throw new Error('No active session');
  }
  
  // Return vault data including identities
  return {
    identities: session.vaultData.identities,
    currentIdentityIndex: session.vaultData.currentIdentityIndex,
    // ...
  };
}
```

## Data Flow Summary

```
Third-Party App
    │
    ├─> window.nostr.getPublicKey()
    │
Embassy SDK (embassy.ts)
    │
    ├─> NostrPassEmbassy.getPublicKey()
    ├─> ParentMessenger.request('GET_PUBLIC_KEY', data)
    │
PostMessage Bridge
    │
    ├─> message: { id, type: 'GET_PUBLIC_KEY', data, origin }
    │
Vault Messenger (IframeMessenger)
    │
    ├─> handleMessage()
    ├─> route to handler
    │
AuthProvider Handler
    │
    ├─> checkPermission()
    ├─> permissionService.checkPermission()
    ├─> cryptoWorker.getVaultData()
    │
Crypto Worker
    │
    ├─> return vault.identities[currentIndex].publicKey
    │
Response Flow (reverse)
    │
    └─> Returns hex public key string to app
```

## Key Functions by Context

### Embassy (Parent Window)
- `window.nostr.getPublicKey()` - Public API
- `NostrPassEmbassy.getPublicKey()` - Implementation
- `ParentMessenger.request()` - Send message
- `ParentMessenger.handleResponse()` - Receive response

### Messenger Layer
- `SecureMessenger.sendMessage()` - PostMessage wrapper
- `SecureMessenger.handleMessage()` - Message router
- `SecureServerMessenger.executeMiddlewareChain()` - Process handlers
- `SecureMessenger.sendResponse()` - Send response

### Vault (Iframe)
- `IframeMessenger.initWithParent()` - Initialize
- `AuthProvider.createEffect()` - Register handlers
- `checkPermission()` - Permission logic
- `cryptoWorker.getVaultData()` - Get vault data

### Crypto Worker
- `getVaultData` - Return session vault data
- Access to `sessions` Map with user data

Each context runs in isolation and communicates only through structured messages via postMessage API.