# Vault Sync Architecture Refactoring Plan

## Problem Statement

The current vault synchronization system is overly complex with multiple update paths, manual sync flags, and fragmented state management. This leads to:

- **Maintenance burden**: Multiple places to update for each feature
- **Bug-prone**: Easy to forget sync flags or miss update paths
- **Poor developer experience**: Unclear which method to use for updates
- **Race conditions**: Multiple systems (PRE, full vault, BroadcastChannel) can conflict

## Current Architecture (Complex)

```
Components
  ├─→ useVaultData
  │     ├─→ VaultStore.update(data, {syncToNostr: true/false})  ← Manual flag!
  │     └─→ Worker.updateVaultData
  │           ├─→ vault-operations.updateVaultData
  │           │     ├─→ IndexedDB.save
  │           │     ├─→ BroadcastChannel.send
  │           │     └─→ nostrSync.saveVaultToNostr (if flag true)  ← Conditional!
  │           └─→ nostrSync.publishIdentityMeta (separate call)  ← PRE events
  │
  └─→ Direct worker calls (some components bypass store)

Nostr Subscription (Multiple handlers)
  ├─→ PRE identity events (np/identity/*)
  ├─→ PRE permission events (np/perm/*)
  ├─→ Full vault events (nostrpass.com_vault_*)
  └─→ Polling fallback (every 60s)
```

**Issues:**
1. Components must remember to pass `{syncToNostr: true}`
2. Two parallel systems: PRE events + full vault snapshots
3. Multiple entry points for vault updates
4. Sync logic scattered across files

## Proposed Architecture (Streamlined)

```
┌─────────────────────────────────────────────────────────────┐
│                      Any Component                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ updateVault(changes)
                        ↓
                  ┌─────────────┐
                  │ VaultStore  │ ← SINGLE SOURCE OF TRUTH
                  └─────┬───────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
   IndexedDB        Nostr Relays   BroadcastChannel
   (persist)        (sync)         (notify tabs)
        │               │               │
        └───────────────┴───────────────┘
                        ↓
                 UI Auto-Updates
                 (SolidJS reactivity)


Nostr Subscription (Single handler)
  ↓ Receives vault update from other device
  ↓ Checks: remote.updatedAt > local.updatedAt ?
  ├─→ YES: Apply to IndexedDB + broadcast to tabs → UI updates
  └─→ NO:  Ignore (local is newer)
```

**Benefits:**
1. ✅ One entry point for ALL vault updates
2. ✅ Always syncs (no flags to forget)
3. ✅ Timestamp-based conflict resolution
4. ✅ Simple mental model: update → persist + sync + notify

## Implementation Plan

### Phase 1: Consolidate Update Path (High Priority)

**Goal**: Make VaultStore the single entry point for all vault updates

**Changes:**
1. **VaultStore Enhancement** (`apps/vault/src/stores/vaultStore.ts`)
   - Make `updateVaultData` ALWAYS sync to Nostr (remove flag)
   - Add validation and error handling
   - Add retry logic for Nostr failures
   - Export single `updateVault()` function

2. **Remove Manual Sync Flags**
   - Update all components to remove `{syncToNostr: true}` flags
   - Updates now always sync by default
   - Files affected: IdentityManager.tsx, PermissionManager.tsx, GlobalSettings.tsx

3. **Deprecate Direct Worker Calls**
   - Search for direct `worker.updateVaultData` calls
   - Replace with `VaultStore.updateVault`
   - Ensure all paths go through the store

**Success Criteria:**
- All vault updates go through VaultStore
- No more manual sync flags in components
- Automatic Nostr sync on every change

---

### Phase 2: Simplify Nostr Sync (Medium Priority)

**Goal**: Remove PRE event complexity, use only full vault snapshots

**Changes:**
1. **Remove PRE Event System** (`apps/vault/src/workers/nostr-sync.ts`)
   - Remove `publishIdentityMeta()` function
   - Remove `publishPermissions()` function
   - Remove `assembleStateFromAuthor()` function
   - Remove PRE helper functions from `pre.helpers.ts`
   - Keep only `saveVaultToNostr()` and `getVaultFromNostr()`

2. **Simplify Subscription Handler**
   - Remove np/identity/* and np/perm/* event handlers
   - Keep only nostrpass.com_vault_* handler
   - Remove polling fallback (real-time only)
   - Simplify to single handler with timestamp comparison

3. **Update Components**
   - Remove `publishIdentityMeta` calls from IdentityManager
   - Remove `publishPermissions` calls from PermissionManager
   - All changes now automatically sync via full vault

**Success Criteria:**
- Only one Nostr event type: full vault snapshots
- Simpler subscription logic (~100 lines vs ~600 lines)
- Easier to debug and maintain

---

### Phase 3: Optimize Performance (Low Priority)

**Goal**: Make sync efficient without sacrificing simplicity

**Changes:**
1. **Debounce Rapid Updates**
   - Add 500ms debounce to Nostr sync
   - Multiple rapid changes → single sync
   - Still immediate for IndexedDB and BroadcastChannel

2. **Background Sync Queue**
   - Queue failed Nostr syncs
   - Retry with exponential backoff
   - Show sync status indicator in UI

3. **Compression**
   - Compress vault data before encryption
   - Reduces Nostr event size by ~70%
   - Faster relay propagation

**Success Criteria:**
- Smooth UX even with rapid changes
- Reliable sync even with network issues
- Smaller Nostr events

---

## File Impact Analysis

### Files to Modify

**Core Sync Logic (Critical):**
- ✅ `apps/vault/src/stores/vaultStore.ts` - Make single source of truth
- ✅ `apps/vault/src/workers/vault-operations.ts` - Remove sync flag, always sync
- ✅ `apps/vault/src/workers/nostr-sync.ts` - Simplify to full vault only
- ✅ `apps/vault/src/hooks/useVaultData.ts` - Remove sync flag from API

**Components (Remove manual sync flags):**
- ✅ `apps/vault/src/components/IdentityManager.tsx` - Remove syncToNostr flags
- ✅ `apps/vault/src/components/PermissionManager.tsx` - Remove syncToNostr flags
- ✅ `apps/vault/src/components/GlobalSettings.tsx` - Remove syncToNostr flags
- ✅ `apps/vault/src/components/Dashboard.tsx` - Update to use VaultStore

**Files to Delete:**
- 🗑️ `apps/vault/src/workers/pre.helpers.ts` - PRE event helpers (no longer needed)

**Tests to Update:**
- ⚠️ Update all vault sync tests to new architecture

### Estimated Code Reduction

- **Before**: ~2,500 lines across sync system
- **After**: ~1,200 lines
- **Reduction**: ~52% less code
- **Complexity**: 3 systems → 1 system

---

## Migration Strategy

### For Developers

**Old Way (Complex):**
```typescript
// Had to remember sync flag
await updateVaultData({
  identities: [...newIdentities]
}, { syncToNostr: true });  // ← Easy to forget!

// Had to call PRE separately
await publishIdentityMeta({...});  // ← Extra call
```

**New Way (Simple):**
```typescript
// Just update - sync happens automatically
await updateVault({
  identities: [...newIdentities]
});
// That's it! Syncs to IndexedDB, Nostr, and notifies tabs
```

### Backward Compatibility

1. **Existing vaults**: Will work immediately, no migration needed
2. **PRE events**: Will be ignored (subscription won't listen)
3. **Full vault events**: Continue to work as before
4. **Timestamps**: Already exist in VaultData, used for conflict resolution

### Rollout Plan

1. **Week 1**: Phase 1 - Consolidate update path
2. **Week 2**: Phase 2 - Simplify Nostr sync
3. **Week 3**: Phase 3 - Optimize performance
4. **Week 4**: Testing and bug fixes

---

## Testing Strategy

### Test Scenarios

1. **Single Browser Updates**
   - ✅ Add identity → syncs to Nostr
   - ✅ Archive identity → syncs to Nostr
   - ✅ Update permissions → syncs to Nostr
   - ✅ Change settings → syncs to Nostr

2. **Multi-Tab Updates (Same Browser)**
   - ✅ Update in tab A → tab B reflects change
   - ✅ BroadcastChannel works correctly
   - ✅ No duplicate updates

3. **Multi-Browser Updates (Different Devices)**
   - ✅ Update in browser A → browser B receives via Nostr
   - ✅ Timestamp conflict resolution works
   - ✅ No data loss

4. **Offline/Online Transitions**
   - ✅ Updates work offline (IndexedDB + BroadcastChannel)
   - ✅ Sync queues when offline
   - ✅ Syncs when back online

5. **Concurrent Updates**
   - ✅ Two devices update same field → latest timestamp wins
   - ✅ No corrupted state
   - ✅ Graceful conflict resolution

### Performance Benchmarks

- **Target**: Vault update → Nostr sync < 1s
- **Target**: Nostr event → UI update < 500ms
- **Target**: Multi-tab sync < 100ms

---

## Risk Analysis

### Low Risk Changes
- ✅ Removing manual sync flags (backward compatible)
- ✅ Consolidating to VaultStore (just routing changes)
- ✅ Using existing timestamp field (already in VaultData)

### Medium Risk Changes
- ⚠️ Removing PRE events (requires testing across devices)
- ⚠️ Always syncing (might increase relay load)
- ⚠️ Simplifying subscription handler (less flexible)

### Mitigation Strategies

1. **Feature Flag**: Add `ENABLE_STREAMLINED_SYNC` env var for gradual rollout
2. **Monitoring**: Add logs for sync success/failure rates
3. **Rollback Plan**: Keep old code commented for 1 release cycle
4. **Testing**: Extensive multi-device testing before production

---

## Success Metrics

### Code Quality
- ✅ 50% reduction in sync-related code
- ✅ Single entry point for all updates
- ✅ Zero manual sync flags in components

### Developer Experience
- ✅ "Update vault" = one function call
- ✅ Sync happens automatically
- ✅ Clear mental model (persist + sync + notify)

### User Experience
- ✅ Cross-device sync works reliably
- ✅ No more "forgot to sync" bugs
- ✅ Faster vault operations

### Reliability
- ✅ 99.9% sync success rate
- ✅ Automatic retry on failures
- ✅ Timestamp-based conflict resolution

---

## Next Steps

1. ✅ Review this plan with team
2. ✅ Get approval for architecture change
3. ✅ Create feature branch: `feature/streamlined-vault-sync`
4. ✅ Start Phase 1 implementation
5. ✅ Write tests alongside implementation
6. ✅ Deploy to staging for testing
7. ✅ Production rollout with monitoring

---

## Questions & Decisions

### Q: Should we keep PRE events?
**Decision**: No. Full vault snapshots are simpler and more reliable. The added complexity of PRE events isn't worth the marginal bandwidth savings.

### Q: What about bandwidth for large vaults?
**Decision**: Add compression in Phase 3. A typical vault (5 identities + permissions) compresses to ~2KB, which is negligible.

### Q: What if Nostr sync fails?
**Decision**: Queue and retry with exponential backoff. Show sync status in UI. Local changes still work (IndexedDB + BroadcastChannel).

### Q: Backward compatibility with old clients?
**Decision**: Old clients will still publish PRE events (no harm). New clients ignore PRE events and only listen to full vault events. Both can coexist.

---

## Conclusion

This refactoring will dramatically simplify the vault sync system while improving reliability and developer experience. The streamlined architecture follows the principle: **"Make the right thing the easy thing"** - by making sync automatic, we eliminate an entire class of bugs.

**Estimated effort**: 2-3 weeks
**Risk level**: Low-Medium
**Value**: High (50% code reduction, better reliability, clearer architecture)

Let's build a sync system that "just works"! 🚀
