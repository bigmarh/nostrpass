# Debugging Cross-Browser Sync

## The Problem
- Browser A: Add identity → vault version updates ✅
- Browser B: Vault version seen in Nostr, but UI doesn't refresh ❌

## What Should Happen

```
Browser A (Active)
  └─→ User adds identity
      └─→ VaultStore.update()
          ├─→ IndexedDB: Save ✅
          ├─→ BroadcastChannel: Notify other tabs ✅
          ├─→ Nostr: Publish vault snapshot ✅
          └─→ UI: Update via reactivity ✅

Browser B (Passive)
  └─→ Nostr subscription receives event
      └─→ Worker: onEvent() handler
          └─→ vault-operations.updateVaultData()
              ├─→ IndexedDB: Save ✅
              ├─→ BroadcastChannel: Notify tabs ❓
              └─→ VaultStore: Receive broadcast ❓
                  └─→ loadVaultData() ❓
                      └─→ UI: Update ❌
```

## Debugging Checklist

### Step 1: Check Browser B Console

Open Browser B console and look for these logs **in order**:

#### A. VaultStore Initialization
```
🏪 [VaultStore] Initializing for user: <username>
🏪 [VaultStore] BroadcastChannel listener set up
```
**If missing**: VaultStore isn't initialized → UI can't receive updates

#### B. Nostr Subscription Active
```
📡 [Worker] Creating subscription with callback-based API
✅ [Worker] Realtime subscription active
```
**If missing**: Nostr subscription isn't active → won't receive events

#### C. Receiving Nostr Event (when Browser A adds identity)
```
📨 [Worker] Received Nostr vault event: {...}
📥 [Worker] Processing full vault snapshot: {...}
✅ [Worker] Decrypted vault successfully
📊 [Worker] Vault timestamp comparison: {...}
📥 [Worker] Applying newer vault from Nostr: {...}
✅ [Worker] Vault synced successfully from Nostr
```
**If missing**: Event not received or rejected as older

#### D. Broadcast Sent from Worker
```
💾 [updateVaultData] Saving vault with: {...}
```
**If missing**: Worker didn't save to IndexedDB

#### E. Broadcast Received by VaultStore
```
🏪 [VaultStore] Received vault broadcast: {broadcastType: 'VAULT_DATA_UPDATED', ...}
🏪 [VaultStore] Reloading vault data after: VAULT_DATA_UPDATED
🏪 [VaultStore] Loaded vault data: {username: '...', identitiesCount: X, version: Y}
```
**If missing**: BroadcastChannel not working or VaultStore not listening

---

## Common Issues & Fixes

### Issue 1: VaultStore Not Initialized
**Symptom**: No `🏪 [VaultStore]` logs in Browser B

**Cause**: Dashboard/component not calling `initVaultStore(username)`

**Fix**: Check if `useVaultData` hook is being used with `autoLoad: true`

**File**: `apps/vault/src/components/Dashboard.tsx`
```typescript
const { vaultData, ... } = useVaultData({ autoLoad: true }); // Must be true!
```

---

### Issue 2: Nostr Subscription Not Active
**Symptom**: No `📡 [Worker]` or `📨 [Worker]` logs

**Cause**: Subscription not started after unlock

**Check**:
1. Is vault unlocked in Browser B?
2. Look for: `🚀 [Worker.startNostrSubscription]` in console
3. Look for any subscription errors

**Fix**: Subscription should start automatically on unlock. Check unlock flow.

---

### Issue 3: Receiving Event But Not Applying
**Symptom**: See `📨 [Worker] Received Nostr vault event` but then see `ℹ️ [Worker] Local vault is newer or equal`

**Cause**: Timestamp comparison thinks local is newer

**Debug**:
```
📊 [Worker] Vault timestamp comparison:
  remoteTimestamp: 1234567890  ← from Nostr event
  localTimestamp: 1234567899   ← from IndexedDB
  willApply: false             ← FALSE means won't apply!
```

**Explanation**:
- Remote timestamp is in **seconds** (Unix timestamp)
- Local timestamp is in **milliseconds** converted to seconds
- If local is newer, update is skipped

**Fix**: This is actually correct behavior! It means Browser B already has a newer version (perhaps it made a change after Browser A).

---

### Issue 4: Broadcast Not Received by VaultStore
**Symptom**: See `💾 [updateVaultData]` but not `🏪 [VaultStore] Received vault broadcast`

**Cause**: BroadcastChannel mismatch or not initialized

**Check**:
1. Both use same channel name: `'nostrpass-vault'`
2. VaultStore listener is set up before update happens
3. Not in incognito/different origin

**Fix**: Make sure VaultStore is initialized before any vault operations

---

### Issue 5: UI Not Reactive
**Symptom**: See all logs including `🏪 [VaultStore] Loaded vault data` but UI doesn't change

**Cause**: Component not consuming reactive `vaultData` signal

**Check Dashboard.tsx**:
```typescript
const { vaultData } = useVaultData();

// Component must ACCESS vaultData() as a function
<Show when={vaultData()}>  // ✅ Correct - calls signal
  {vaultData().identities}
</Show>

// NOT like this:
<Show when={vaultData}>    // ❌ Wrong - not calling signal
  {vaultData.identities}
</Show>
```

**Fix**: Make sure all vault data access calls the signal function: `vaultData()`

---

## Manual Test Steps

### Test Cross-Browser Sync

1. **Open Browser A**
   - Go to http://localhost:3001
   - Login with username "tghjk"
   - Open console
   - Verify: `🏪 [VaultStore] Initializing for user: tghjk`
   - Verify: `📡 [Worker] Realtime subscription active`

2. **Open Browser B** (different browser or incognito)
   - Go to http://localhost:3001
   - Login with same username "tghjk"
   - Open console
   - Verify: `🏪 [VaultStore] Initializing for user: tghjk`
   - Verify: `📡 [Worker] Realtime subscription active`

3. **In Browser A: Add Identity**
   - Click "+" to add identity
   - Name it "Test Identity"
   - Click Save
   - Verify logs:
     ```
     🏪 [VaultStore] Updating vault data (auto-sync enabled)
     📡 [updateVaultData] Syncing to Nostr...
     ✅ [updateVaultData] Vault synced to Nostr successfully
     ```

4. **In Browser B: Wait 2-5 seconds**
   - Watch console for:
     ```
     📨 [Worker] Received Nostr vault event
     📥 [Worker] Processing full vault snapshot
     📊 [Worker] Vault timestamp comparison: {willApply: true}
     📥 [Worker] Applying newer vault from Nostr
     ✅ [Worker] Vault synced successfully from Nostr
     🏪 [VaultStore] Received vault broadcast
     🏪 [VaultStore] Reloading vault data
     ```
   - UI should show "Test Identity" **without refreshing page**

5. **If UI Doesn't Update**
   - Check each log in step 4
   - Note which log is missing
   - Refer to "Common Issues" section above

---

## Quick Fixes to Try

### If Nothing Works:

1. **Hard Refresh Both Browsers**
   - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - This ensures latest code is loaded

2. **Check Service Worker**
   - Open DevTools → Application → Service Workers
   - Click "Unregister" if any service worker is registered
   - Refresh page

3. **Check SharedWorker**
   - SharedWorkers can be sticky
   - Close ALL tabs of localhost:3001
   - Wait 5 seconds
   - Reopen fresh tab

4. **Check Nostr Relay**
   - Is localhost:8080 relay running?
   - Try: `ws://localhost:8080` in browser console
   - Or check other relays: relay.damus.io, nos.lol

5. **Nuclear Option: Clear Everything**
   ```javascript
   // In console:
   localStorage.clear();
   indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
   location.reload();
   ```
   Then login fresh in both browsers

---

## Expected Console Output (Success Case)

### Browser A (Active - Adding Identity)
```
🏪 [VaultStore] Updating vault data (auto-sync enabled): {identitiesCount: 3, version: 8}
💾 [updateVaultData] Saving vault with: {version: 9, identitiesCount: 3, syncToNostr: true}
📡 [updateVaultData] Syncing to Nostr...
📤 [saveVaultToNostr] Preparing vault for Nostr sync: {identitiesCount: 3}
✅ [saveVaultToNostr] Vault event published to relays successfully
✅ [updateVaultData] Vault synced to Nostr successfully
✅ [VaultStore] Vault updated and synced to Nostr
```

### Browser B (Passive - Receiving Update)
```
📨 [Worker] Received Nostr vault event: {kind: 30078, eventId: 'abc123...'}
📥 [Worker] Processing full vault snapshot: {eventId: 'abc123...'}
✅ [Worker] Decrypted vault successfully
📊 [Worker] Vault timestamp comparison: {
  remoteTimestamp: 1764692888,
  localTimestamp: 1764692800,
  remoteDate: '2025-12-02T16:34:48Z',
  localDate: '2025-12-02T16:33:20Z',
  remoteIdentities: 3,
  localIdentities: 2,
  willApply: true
}
📥 [Worker] Applying newer vault from Nostr: {remoteIdentities: 3, localIdentities: 2}
💾 [updateVaultData] Saving vault with: {version: 9, identitiesCount: 3, syncToNostr: false}
✅ [Worker] Vault synced successfully from Nostr
🏪 [VaultStore] Received vault broadcast: {broadcastType: 'VAULT_DATA_UPDATED', username: 'tghjk'}
🏪 [VaultStore] Reloading vault data after: VAULT_DATA_UPDATED
🏪 [VaultStore] Loaded vault data: {username: 'tghjk', identitiesCount: 3, version: 9}
```

---

## Next Steps

1. Follow the debugging checklist in Browser B
2. Note which log is the **last one you see**
3. That tells you where the chain breaks
4. Apply the corresponding fix from "Common Issues"
5. If still stuck, share the console logs

The most common issue is **VaultStore not initialized** or **Nostr subscription not active**. Check those first!
