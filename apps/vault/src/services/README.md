# VaultDataService

A centralized service for managing vault data operations throughout the NostrPass application.

## Overview

The `VaultDataService` provides a clean, type-safe interface for all vault data operations including:

- Loading and caching vault data
- Updating vault data with automatic timestamp management
- Identity management (get, update, add, remove, switch)
- Nostr synchronization
- Error handling and logging

## Features

### 🚀 **Caching**
- Automatic 5-minute cache for vault data
- Force refresh option for critical updates
- Cache invalidation and statistics

### 🔒 **Type Safety**
- Full TypeScript support
- Proper error handling with typed exceptions
- Consistent data structures

### ⚡ **Performance**
- Optimized loading patterns
- Debounced Nostr synchronization
- Efficient identity operations

### 🔄 **Consistency**
- Centralized error handling
- Standardized update patterns
- Automatic timestamp management

## Usage

### Direct Service Usage

```typescript
import { vaultDataService } from '../services/vaultDataService';

// Get vault data (with caching)
const vaultData = await vaultDataService.getVaultData(username);

// Update vault data
await vaultDataService.updateVaultData(username, {
  currentIdentityIndex: 1
});

// Get current identity
const currentIdentity = await vaultDataService.getCurrentIdentity(username);

// Update specific identity
await vaultDataService.updateIdentity(username, 0, {
  nickname: 'Work Identity'
});

// Switch identities
await vaultDataService.switchIdentity(username, 1);

// Sync to Nostr
await vaultDataService.syncToNostr(username);
```

### Using the Hook

```typescript
import { useVaultData } from '../hooks/useVaultData';

function MyComponent() {
  const { 
    vaultData, 
    currentIdentity, 
    isLoading, 
    error,
    updateVaultData,
    switchIdentity,
    syncToNostr 
  } = useVaultData({ autoLoad: true });

  const handleUpdateIdentity = async () => {
    await updateVaultData((current) => ({
      identities: current.identities.map((identity, index) => 
        index === 0 ? { ...identity, nickname: 'Updated Name' } : identity
      )
    }));
  };

  return (
    <div>
      {isLoading() && <p>Loading...</p>}
      {error() && <p>Error: {error()}</p>}
      {currentIdentity() && (
        <p>Current Identity: {currentIdentity()!.nickname}</p>
      )}
    </div>
  );
}
```

## API Reference

### VaultDataService Methods

#### `getVaultData(username: string, options?: VaultDataOptions)`
Load vault data with optional caching control.

**Options:**
- `forceRefresh?: boolean` - Skip cache and force reload
- `includeIdentities?: boolean` - Include identity data (default: true)

#### `updateVaultData(username: string, updates, options?: UpdateVaultDataOptions)`
Update vault data with automatic timestamp management.

**Options:**
- `syncToNostr?: boolean` - Automatically sync to Nostr after update
- `updateTimestamp?: boolean` - Update the `updatedAt` timestamp (default: true)

#### `getCurrentIdentity(username: string)`
Get the currently active identity.

#### `getIdentity(username: string, index: number)`
Get a specific identity by index.

#### `updateIdentity(username: string, index: number, updates: Partial<Identity>)`
Update a specific identity.

#### `switchIdentity(username: string, newIndex: number)`
Switch to a different identity.

#### `addIdentity(username: string, identity: Identity)`
Add a new identity.

#### `removeIdentity(username: string, index: number)`
Remove an identity and adjust current index if needed.

#### `syncToNostr(username: string)`
Sync vault data to Nostr relays.

#### `clearCache(username?: string)`
Clear cache for specific user or all users.

#### `getCacheStats()`
Get cache statistics for debugging.

#### `isCached(username: string)`
Check if data is cached and fresh.

### useVaultData Hook

The hook provides reactive access to vault data with automatic loading and error handling.

**Options:**
- `autoLoad?: boolean` - Automatically load data when user changes (default: true)
- `forceRefresh?: boolean` - Force refresh on initial load (default: false)

**Returns:**
- `vaultData` - Current vault data signal
- `currentIdentity` - Current active identity signal
- `isLoading` - Loading state signal
- `error` - Error state signal
- `loadVaultData()` - Manual load function
- `updateVaultData()` - Update function
- `getIdentity()` - Get specific identity
- `switchIdentity()` - Switch identity function
- `updateIdentity()` - Update identity function
- `addIdentity()` - Add identity function
- `removeIdentity()` - Remove identity function
- `syncToNostr()` - Sync to Nostr function
- `clearCache()` - Clear cache function
- `username` - Current username signal

## Migration Guide

### From Direct Crypto Worker Usage

**Before:**
```typescript
const cryptoWorker = getCryptoWorker();
const vaultData = await cryptoWorker.getVaultData({ username });
await cryptoWorker.updateVaultData({ username, vaultData: updatedData });
```

**After:**
```typescript
const vaultData = await vaultDataService.getVaultData(username);
await vaultDataService.updateVaultData(username, updates);
```

### From PermissionService

The PermissionService has been updated to use VaultDataService internally, so no changes needed.

### From Components

**Before:**
```typescript
const [vaultData, setVaultData] = createSignal(null);
const loadVaultData = async () => {
  const data = await cryptoWorker.getVaultData({ username });
  setVaultData(data);
};
```

**After:**
```typescript
const { vaultData, loadVaultData } = useVaultData({ autoLoad: true });
```

## Best Practices

1. **Use the hook for components** - Provides reactive updates and error handling
2. **Use the service for utilities** - Direct service access for non-reactive code
3. **Handle errors gracefully** - All methods throw typed errors
4. **Use force refresh sparingly** - Cache provides good performance
5. **Sync to Nostr when needed** - Use the `syncToNostr` option for important updates

## Error Handling

All service methods throw typed errors with descriptive messages:

```typescript
try {
  await vaultDataService.updateVaultData(username, updates);
} catch (error) {
  if (error instanceof Error) {
    console.error('Vault update failed:', error.message);
  }
}
```

## Performance Considerations

- Cache duration is 5 minutes by default
- Nostr sync is debounced in the Dashboard component
- Identity operations are optimized for minimal data transfer
- Cache statistics available for monitoring 