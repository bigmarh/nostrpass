# Vault-Core Migration Guide

This guide explains how to migrate the existing NostrPass vault application to use the new `@nostrpass/vault-core` framework-agnostic library.

## Overview

The `@nostrpass/vault-core` package extracts all vault business logic into a framework-independent library with the following benefits:

- ✅ **Framework Agnostic** - Core logic works with any UI framework
- ✅ **Better Testing** - Business logic can be tested independently
- ✅ **Code Reuse** - Same core can power web, mobile, desktop apps
- ✅ **Cleaner Architecture** - Separation of concerns between UI and logic
- ✅ **Type Safety** - Full TypeScript with comprehensive types

## Migration Strategy

We're using a **gradual migration** approach:

### Phase 1: Parallel Implementation ✅ COMPLETE
- Created `@nostrpass/vault-core` package with all managers
- Created SolidJS adapter with hooks/primitives
- Created `VaultCoreProvider` alongside existing `AuthProvider`
- Added demo route at `/:app/vault-core-demo` to test integration
- Both systems run in parallel without breaking existing functionality

### Phase 2: Component Migration (TODO)
- Migrate one component at a time to use `useVaultCore()` hooks
- Test each migrated component thoroughly
- Keep fallback to old provider during migration

### Phase 3: Full Migration (TODO)
- Replace `AuthProvider` with `VaultCoreProvider`
- Remove legacy code
- Update all components to use vault-core

## Current Status

### ✅ Completed

1. **Created `@nostrpass/vault-core` package** ([packages/vault-core/](../packages/vault-core/))
   - AuthManager - Login, logout, session management
   - VaultManager - Vault CRUD operations
   - IdentityManager - Identity and crypto operations
   - PermissionManager - App permission management
   - VaultCore - Main class coordinating all managers

2. **Created SolidJS adapter** ([packages/vault-core/src/adapters/solid.ts](../packages/vault-core/src/adapters/solid.ts))
   - `createVault()` - Initialize vault instance
   - `createAuth()` - Auth state and methods
   - `createVaultData()` - Vault data management
   - `createIdentities()` - Identity operations
   - `createPermissions()` - Permission management

3. **Created VaultCoreProvider** ([apps/vault/src/providers/VaultCoreProvider.tsx](../apps/vault/src/providers/VaultCoreProvider.tsx))
   - Wraps vault-core for SolidJS apps
   - Provides convenient hooks: `useVaultCore()`, `useVaultCoreAuth()`, etc.
   - Works alongside existing AuthProvider

4. **Created VaultCoreDemo** ([apps/vault/src/components/VaultCoreDemo.tsx](../apps/vault/src/components/VaultCoreDemo.tsx))
   - Demonstrates vault-core usage
   - Available at `/:app/vault-core-demo` route
   - Tests all major features: auth, identities, permissions

5. **Created comprehensive tests** (98 test cases)
   - Manager unit tests
   - EventEmitter tests
   - VaultCore integration tests

### 🚧 In Progress

- Testing vault-core integration with real vault app
- Identifying differences between old and new implementations

### ⏳ TODO

1. **Worker Integration**
   - Update vault-core to work with existing crypto.worker.js
   - Ensure message formats match

2. **Component Migration**
   - Migrate Login component
   - Migrate Dashboard component
   - Migrate Settings/Permissions components

3. **Complete Transition**
   - Remove old AuthProvider
   - Update all remaining components
   - Remove legacy code

## Usage Examples

### Using VaultCoreProvider

```tsx
// In App.tsx or any route
import { VaultCoreProvider } from './providers/VaultCoreProvider';
import { MyComponent } from './components/MyComponent';

function MyRoute() {
  return (
    <VaultCoreProvider>
      <MyComponent />
    </VaultCoreProvider>
  );
}
```

### Using the hooks

```tsx
import { useVaultCore } from '../providers/VaultCoreProvider';

function MyComponent() {
  const { auth, identities, permissions } = useVaultCore();

  // Auth state
  const user = auth.user();
  const isLocked = auth.isLocked();

  // Auth actions
  const handleLogin = async () => {
    const result = await auth.login('username', 'password');
    if (result.success) {
      console.log('Logged in!');
    }
  };

  // Identity operations
  const handleCreateIdentity = async () => {
    const identity = await identities.create({
      name: 'My Identity',
      purpose: 'general'
    });
  };

  return (
    <Show when={user()}>
      <h1>Welcome {user().profile.username}</h1>
      <button onClick={handleCreateIdentity}>Add Identity</button>
    </Show>
  );
}
```

### Convenience hooks

```tsx
// Just need auth?
import { useVaultCoreAuth } from '../providers/VaultCoreProvider';

function LoginButton() {
  const { login, user } = useVaultCoreAuth();

  return (
    <Show when={!user()}>
      <button onClick={() => login('username', 'password')}>
        Login
      </button>
    </Show>
  );
}
```

## Testing the Demo

1. Start the vault app:
   ```bash
   pnpm dev
   ```

2. Navigate to the demo route:
   ```
   http://localhost:5173/vault/vault-core-demo
   ```

3. Test the features:
   - Login with existing account
   - Unlock vault with PIN
   - View identities
   - View app permissions
   - Lock/unlock vault
   - Logout

## Key Differences from Old Implementation

### Old (AuthProvider)
```tsx
const auth = useAuth();

// Tightly coupled to SolidJS
const [user, setUser] = createSignal<User | null>(null);

// Business logic mixed with UI logic
createEffect(() => {
  // Complex worker message handling
  // Mixed with state updates
});
```

### New (VaultCoreProvider)
```tsx
const { auth } = useVaultCore();

// Framework-agnostic core with SolidJS adapter
const user = auth.user(); // Signal from adapter

// Clean separation
// - Core: Pure business logic (AuthManager, VaultManager, etc.)
// - Adapter: Framework bindings (createAuth, createVaultData, etc.)
// - Provider: App-specific setup (VaultCoreProvider)
```

## Migration Checklist

When migrating a component:

- [ ] Import `useVaultCore` instead of `useAuth`
- [ ] Replace `auth.user()` with `auth.user()` (same API!)
- [ ] Replace `auth.login()` with `auth.login()` (same API!)
- [ ] Update identity operations to use `identities.create()`, etc.
- [ ] Update permission operations to use `permissions.*` methods
- [ ] Test the component thoroughly
- [ ] Remove old imports

## Benefits After Migration

1. **Better Testing**
   - Test business logic without UI framework
   - Mock managers easily
   - Unit test individual managers

2. **Code Reuse**
   - Use same core in React Native app
   - Use same core in desktop Electron app
   - Use same core in CLI tools

3. **Cleaner Code**
   - UI components focus on presentation
   - Business logic in well-tested managers
   - Clear separation of concerns

4. **Easier Maintenance**
   - Changes to business logic don't affect UI
   - Changes to UI don't affect business logic
   - Better encapsulation

## Next Steps

1. **Test the demo** - Visit `/:app/vault-core-demo` and test all features
2. **Compare implementations** - Identify any missing features
3. **Migrate one component** - Start with a simple component (e.g., login form)
4. **Iterate** - Gradually migrate more components
5. **Complete transition** - Remove old provider when all components migrated

## Support

For questions or issues:
- Check the [vault-core README](../packages/vault-core/README.md)
- Review the [VaultCoreDemo component](../apps/vault/src/components/VaultCoreDemo.tsx)
- See examples in [adapters documentation](../packages/vault-core/src/adapters/)

## Timeline

- **Week 1**: Test demo, identify gaps ✅
- **Week 2-3**: Migrate core components
- **Week 4**: Complete migration, remove old code
- **Week 5**: Polish and documentation
