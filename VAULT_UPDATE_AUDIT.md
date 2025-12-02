# Vault Update Audit

## Summary

- **Total files with vault updates**: 18
- **Direct worker calls** (`cryptoWorker.updateVaultData`): 14 locations
- **VaultStore calls** (`store.update` / `updateVaultData` via hook): 12 locations
- **vaultDataService calls** (`vaultDataService.updateVaultData`): 8 locations
- **PRE event calls** (`publishIdentityMeta` / `publishPermissions`): 3 locations

## Files to Migrate

### Component: IdentityManager.tsx

**Path**: `apps/vault/src/components/IdentityManager.tsx`

**Update Locations**:

1. **Line 324**: `onUpdateVaultData()` - Authorizing identity for app - syncToNostr: **omitted** (defaults to true) ✅
2. **Line 370**: `onUpdateVaultData()` - Connecting identity to app - syncToNostr: **omitted** (defaults to true) ✅
3. **Line 456**: `onUpdateVaultData()` - Disconnecting identity from app - syncToNostr: **omitted** (defaults to true) ✅
4. **Line 502**: `onUpdateVaultData()` - Setting active identity for app - syncToNostr: **omitted** (defaults to true) ✅
5. **Line 523**: `onUpdateVaultData()` - Unsetting active identity for app - syncToNostr: **omitted** (defaults to true) ✅
6. **Line 592**: `onUpdateVaultData()` - Archiving identity - syncToNostr: **true** ✅
7. **Line 651**: `onUpdateVaultData()` - Adding identity - syncToNostr: **true** ✅
8. **Line 656**: `publishIdentityMeta()` - PRE event - **REMOVE** ❌

**Migration Plan**: 
- Remove `publishIdentityMeta` call (line 656)
- All `onUpdateVaultData` calls already use streamlined approach (auto-sync)
- No changes needed for update calls

---

### Component: GlobalSettings.tsx

**Path**: `apps/vault/src/components/GlobalSettings.tsx`

**Update Locations**:

1. **Line 132**: `onUpdateVaultData()` - Restoring archived identity - syncToNostr: **true** ✅

**Migration Plan**: 
- Already using streamlined approach
- No changes needed

---

### Component: Settings.tsx

**Path**: `apps/vault/src/components/Settings.tsx`

**Update Locations**:

1. **Line 101**: `cryptoWorker.updateVaultData()` - Updating identity nickname - syncToNostr: **omitted** ❌
2. **Line 130**: `cryptoWorker.updateVaultData()` - Setting active identity for app - syncToNostr: **omitted** ❌

**Migration Plan**: 
- Replace direct worker calls with `useVaultData` hook
- Use `updateVaultData` from hook instead of direct worker calls
- Ensure syncToNostr defaults to true

---

### Component: AuditLog.tsx

**Path**: `apps/vault/src/components/AuditLog.tsx`

**Update Locations**:

1. **Line 73**: `cryptoWorker.updateVaultData()` - Adding audit event - syncToNostr: **omitted** ❌
2. **Line 196**: `cryptoWorker.updateVaultData()` - Clearing audit log - syncToNostr: **omitted** ❌
3. **Line 425**: `cryptoWorker.updateVaultData()` - Adding audit event (exported function) - syncToNostr: **omitted** ❌

**Migration Plan**: 
- Replace direct worker calls with `useVaultData` hook
- Use `updateVaultData` from hook instead of direct worker calls
- Audit log updates may not need Nostr sync (low priority)

---

### Component: Dashboard.tsx

**Path**: `apps/vault/src/components/Dashboard.tsx`

**Update Locations**:

1. **Line 168**: `onUpdateVaultData={updateVaultData}` - Passes hook function to IdentityManager ✅
2. **Line 244**: `onUpdateVaultData={updateVaultData}` - Passes hook function to GlobalSettings ✅

**Migration Plan**: 
- Already using streamlined approach via `useVaultData` hook
- No changes needed

---

### Component: RelaySettings.tsx

**Path**: `apps/vault/src/components/RelaySettings.tsx`

**Update Locations**:

1. **Line 48**: `updateVaultData()` - Adding custom relay - syncToNostr: **omitted** (defaults to true) ✅
2. **Line 70**: `updateVaultData()` - Removing custom relay - syncToNostr: **omitted** (defaults to true) ✅
3. **Line 86**: `updateVaultData()` - Resetting to default relays - syncToNostr: **omitted** (defaults to true) ✅

**Migration Plan**: 
- Already using streamlined approach via `useVaultData` hook
- No changes needed

---

### Service: vaultDataService.ts

**Path**: `apps/vault/src/services/vaultDataService.ts`

**Update Locations**:

1. **Line 117**: `cryptoWorker.updateVaultData()` - Core update method - syncToNostr: **omitted** (handled separately) ⚠️
2. **Line 160**: `this.updateVaultData()` - Updating identity - syncToNostr: **omitted** (defaults to false) ❌
3. **Line 182**: `this.updateVaultData()` - Adding identity - syncToNostr: **true** ✅
4. **Line 192**: `this.updateVaultData()` - Removing identity - syncToNostr: **omitted** (defaults to false) ❌
5. **Line 395**: `publishPermissions()` - PRE event - **REMOVE** ❌

**Migration Plan**: 
- Service should delegate to VaultStore instead of calling worker directly
- Remove `publishPermissions` call (line 395)
- Ensure all update paths sync to Nostr by default

---

### Hook: useVaultData.ts

**Path**: `apps/vault/src/hooks/useVaultData.ts`

**Update Locations**:

1. **Line 53**: `store.update()` - Core update method - syncToNostr: **always true** ✅

**Migration Plan**: 
- Already using streamlined approach
- No changes needed

---

### Store: vaultStore.ts

**Path**: `apps/vault/src/stores/vaultStore.ts`

**Update Locations**:

1. **Line 159**: `worker.updateVaultData()` - Core update method - syncToNostr: **always true** ✅

**Migration Plan**: 
- Already using streamlined approach
- No changes needed

---

### Provider: AuthProvider.legacy.tsx

**Path**: `apps/vault/src/providers/AuthProvider.legacy.tsx`

**Update Locations**:

1. **Line 630**: `cryptoWorker.updateVaultData()` - Marking vault as synced after account creation - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️
2. **Line 1124**: `cryptoWorker.updateVaultData()` - Merging vault data after unlock - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️
3. **Line 1231**: `cryptoWorker.updateVaultData()` - Updating vault with remote identities - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️

**Migration Plan**: 
- These are internal sync operations (skipVersionIncrement: true)
- May need special handling to avoid sync loops
- Consider using a flag to skip Nostr sync for internal merges

---

### Service: nostrSyncService.ts

**Path**: `apps/vault/src/services/nostrSyncService.ts`

**Update Locations**:

1. **Line 317**: `cryptoWorker.updateVaultData()` - Marking vault sync status - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️

**Migration Plan**: 
- Internal sync status update
- Should skip Nostr sync to avoid loops
- Consider using a flag to skip Nostr sync for status updates

---

### Component: AccountPickerController.tsx

**Path**: `apps/vault/src/components/AccountPickerController.tsx`

**Update Locations**:

1. **Line 53**: `vaultDataService.updateVaultData()` - Auto-selecting identity - syncToNostr: **omitted** (defaults to false) ❌
2. **Line 204**: `vaultDataService.updateVaultData()` - Setting active identity - syncToNostr: **omitted** (defaults to false) ❌

**Migration Plan**: 
- Replace with `useVaultData` hook
- Ensure syncToNostr defaults to true for active identity changes

---

### Component: SimpleAuthPromptController.tsx

**Path**: `apps/vault/src/components/SimpleAuthPromptController.tsx`

**Update Locations**:

1. **Line 92**: `vaultDataService.updateVaultData()` - Auto-approving after signup - syncToNostr: **true** ✅
2. **Line 192**: `vaultDataService.updateVaultData()` - Authorizing app - syncToNostr: **true** ✅

**Migration Plan**: 
- Already using syncToNostr: true
- Consider migrating to `useVaultData` hook for consistency

---

### Component: AccountPickerPage.tsx

**Path**: `apps/vault/src/components/AccountPickerPage.tsx`

**Update Locations**:

1. **Line 154**: `vaultDataService.updateVaultData()` - Setting active identity - syncToNostr: **omitted** (defaults to false) ❌

**Migration Plan**: 
- Replace with `useVaultData` hook
- Ensure syncToNostr defaults to true

---

### Handler: authHandlers.ts

**Path**: `apps/vault/src/messageHandlers/authHandlers.ts`

**Update Locations**:

1. **Line 691**: `vaultDataService.updateVaultData()` - Setting active identity - syncToNostr: **false** ❌

**Migration Plan**: 
- Change syncToNostr to true
- Consider migrating to `useVaultData` hook

---

### Migration: AuthMigrations.ts

**Path**: `apps/vault/src/providers/auth/AuthMigrations.ts`

**Update Locations**:

1. **Line 217**: `cryptoWorker.updateVaultData()` - Saving migrated vault data - syncToNostr: **omitted** ⚠️

**Migration Plan**: 
- Migration operation - may need special handling
- Consider skipping Nostr sync during migration, then syncing after completion

---

### Service: sessionService.ts

**Path**: `apps/vault/src/services/sessionService.ts`

**Update Locations**:

1. **Line 70**: `cryptoWorker.updateVaultData()` - Generic update method - syncToNostr: **omitted** ❌

**Migration Plan**: 
- This is a wrapper service - consider removing or updating to use VaultStore
- If kept, ensure syncToNostr defaults to true

---

### Worker: nostr-sync.ts

**Path**: `apps/vault/src/workers/nostr-sync.ts`

**Update Locations**:

1. **Line 157**: `vaultOperations.updateVaultData()` - Applying newer vault from Nostr poll - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️
2. **Line 488**: `vaultOperations.updateVaultData()` - Updating identity nickname from PRE - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️
3. **Line 505**: `vaultOperations.updateVaultData()` - Adding identity from PRE - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️
4. **Line 564**: `vaultOperations.updateVaultData()` - Applying newer vault from realtime event - syncToNostr: **omitted** (skipVersionIncrement: true) ⚠️

**Migration Plan**: 
- These are sync operations from Nostr (skipVersionIncrement: true)
- Should NOT sync back to Nostr to avoid loops
- Consider using a flag to skip Nostr sync for incoming syncs

---

## Migration Priority

### High Priority (User-facing features)

1. **IdentityManager.tsx** - Adding/archiving identities, connecting/disconnecting apps
   - Remove `publishIdentityMeta` call
   - Already using streamlined approach ✅

2. **AccountPickerController.tsx** - Setting active identity
   - Migrate to `useVaultData` hook
   - Ensure syncToNostr defaults to true

3. **SimpleAuthPromptController.tsx** - Authorizing apps
   - Already using syncToNostr: true ✅
   - Consider migrating to hook for consistency

4. **AccountPickerPage.tsx** - Setting active identity
   - Migrate to `useVaultData` hook
   - Ensure syncToNostr defaults to true

5. **authHandlers.ts** - Setting active identity
   - Change syncToNostr to true
   - Consider migrating to hook

### Medium Priority (Settings and configuration)

6. **Settings.tsx** - Updating identity nickname, setting active identity
   - Replace direct worker calls with `useVaultData` hook

7. **RelaySettings.tsx** - Managing custom relays
   - Already using streamlined approach ✅

8. **GlobalSettings.tsx** - Restoring archived identities
   - Already using streamlined approach ✅

### Low Priority (Internal/admin operations)

9. **AuditLog.tsx** - Adding/clearing audit events
   - Migrate to `useVaultData` hook
   - Audit logs may not need Nostr sync

10. **vaultDataService.ts** - Core service layer
    - Migrate to delegate to VaultStore
    - Remove `publishPermissions` call

11. **sessionService.ts** - Session wrapper
    - Consider removing or updating to use VaultStore

### Special Cases (Sync operations - need careful handling)

12. **AuthProvider.legacy.tsx** - Internal vault merges
    - Use flag to skip Nostr sync for internal operations
    - These are merge operations, not user-initiated updates

13. **nostrSyncService.ts** - Sync status updates
    - Use flag to skip Nostr sync for status updates

14. **nostr-sync.ts (worker)** - Incoming Nostr syncs
    - Use flag to skip Nostr sync for incoming syncs
    - Critical: Must not sync back to avoid loops

15. **AuthMigrations.ts** - Migration operations
    - Skip Nostr sync during migration
    - Sync after migration completes

---

## Key Findings

### ✅ Already Streamlined

- **IdentityManager.tsx** - Uses `onUpdateVaultData` hook (auto-syncs)
- **Dashboard.tsx** - Uses `useVaultData` hook
- **RelaySettings.tsx** - Uses `useVaultData` hook
- **GlobalSettings.tsx** - Uses `onUpdateVaultData` hook
- **useVaultData.ts** - Delegates to VaultStore (always syncs)
- **vaultStore.ts** - Always syncs to Nostr

### ❌ Needs Migration

- **Settings.tsx** - Direct worker calls (2 locations)
- **AuditLog.tsx** - Direct worker calls (3 locations)
- **AccountPickerController.tsx** - Service calls without syncToNostr (2 locations)
- **AccountPickerPage.tsx** - Service call without syncToNostr (1 location)
- **authHandlers.ts** - Service call with syncToNostr: false (1 location)
- **sessionService.ts** - Direct worker call (1 location)
- **vaultDataService.ts** - Some methods don't sync by default (3 locations)

### ⚠️ Special Cases (Skip Nostr Sync)

- **AuthProvider.legacy.tsx** - Internal merges (3 locations)
- **nostrSyncService.ts** - Status updates (1 location)
- **nostr-sync.ts** - Incoming syncs (4 locations)
- **AuthMigrations.ts** - Migration operations (1 location)

### 🗑️ Remove PRE Event Calls

- **IdentityManager.tsx** - `publishIdentityMeta` (line 656)
- **vaultDataService.ts** - `publishPermissions` (line 395)

---

## Migration Strategy

### Phase 1: Remove PRE Event Calls
- Remove `publishIdentityMeta` from IdentityManager.tsx
- Remove `publishPermissions` from vaultDataService.ts

### Phase 2: Migrate Direct Worker Calls
- Replace `cryptoWorker.updateVaultData` with `useVaultData` hook in:
  - Settings.tsx
  - AuditLog.tsx
  - sessionService.ts (or remove service)

### Phase 3: Fix Service Calls Without Sync
- Update `vaultDataService.updateVaultData` calls to use syncToNostr: true in:
  - AccountPickerController.tsx
  - AccountPickerPage.tsx
  - authHandlers.ts
  - vaultDataService.ts internal methods

### Phase 4: Handle Special Cases
- Add `skipNostrSync` flag for internal operations:
  - AuthProvider.legacy.tsx (merges)
  - nostrSyncService.ts (status updates)
  - nostr-sync.ts (incoming syncs)
  - AuthMigrations.ts (migrations)

### Phase 5: Refactor Service Layer
- Make vaultDataService delegate to VaultStore
- Remove direct worker access from service layer

---

## Notes

- The VaultStore already implements streamlined sync (always syncs to Nostr)
- Components using `useVaultData` hook are already streamlined
- Components using `onUpdateVaultData` prop are already streamlined
- Direct worker calls bypass the streamlined approach and need migration
- Service layer calls may not sync by default and need fixing
- Internal sync operations must skip Nostr sync to avoid loops
- PRE event publishing should be removed (handled by vault sync)

