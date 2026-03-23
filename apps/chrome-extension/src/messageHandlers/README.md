# Message Handlers

This directory contains all the message handlers for communication between the Embassy SDK and the Vault application.

## Structure

```
messageHandlers/
├── index.ts              # Main setup and dependency injection
├── authHandlers.ts       # NIP-07 authentication handlers
├── vaultHandlers.ts      # Vault UI control handlers
└── permissionHandlers.ts # Permission management handlers
```

## Handler Categories

### Auth Handlers (`authHandlers.ts`)
- `GET_PUBLIC_KEY` - Returns the public key for the app-specific identity
- `SIGN_EVENT` - Signs a Nostr event with the app-specific identity
- `SIGN_DATA` - Signs arbitrary data
- `ENCRYPT` - NIP-04 encryption
- `DECRYPT` - NIP-04 decryption
- `GET_AUTH_STATUS` - Returns current authentication status

### Vault Handlers (`vaultHandlers.ts`)
- `SHOW_VAULT` - Shows the vault UI
- `HIDE_VAULT` - Hides the vault UI
- `GET_RELAYS` - Returns user's configured relays

### Permission Handlers (`permissionHandlers.ts`)
- `REQUEST_PERMISSION` - Request a specific permission
- `GET_PERMISSIONS` - Get all permissions for an origin

## Adding New Handlers

1. Choose the appropriate handler file based on the handler's purpose
2. Add the handler to the handlers array:

```typescript
{
  route: 'YOUR_ROUTE_NAME',
  handler: async (data: any, context: any, deps: MessageHandlerDependencies) => {
    // Handler implementation
    return result;
  }
}
```

3. Use the provided dependencies instead of importing directly:
   - `deps.getUser()` - Get current user
   - `deps.getCryptoWorker()` - Get crypto worker instance
   - `deps.checkPermission()` - Check permissions
   - `deps.isVaultLocked()` - Check vault lock status
   - `deps.getAppIdentityIndex()` - Get app-specific identity

## Benefits of This Structure

1. **Separation of Concerns**: Handlers are grouped by functionality
2. **Testability**: Each handler can be tested independently
3. **Dependency Injection**: No direct imports, easier to mock
4. **Discoverability**: All handlers in one place, easy to find
5. **Type Safety**: Consistent handler interface
6. **Maintainability**: Clear structure for adding new handlers

## Migration from AuthProvider

The handlers were previously defined inside AuthProvider's `createEffect`. This new structure:
- Removes the tight coupling with AuthProvider
- Makes handlers easier to find and modify
- Allows for better testing
- Reduces the complexity of AuthProvider