# Proposal: Simplified Atomic Auth State Management

## Problem Statement

The current auth system is fragmented across multiple sources of truth, leading to inconsistencies:

### Current Architecture (Fragmented)

```
┌─────────────────────────────────────────────────────────────┐
│                    UI LAYER (React)                         │
│  - Calls getAuthStatus()                                    │
│  - Pieces together state from 3+ sources                    │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              MULTIPLE SOURCES OF TRUTH                      │
├─────────────────────────────────────────────────────────────┤
│ 1. VaultDataService.getSessionStatus()                     │
│    └─ IndexedDB sessions table                             │
│                                                              │
│ 2. cryptoWorker.hasKeysInSession()                         │
│    └─ Worker memory (activeSessions map)                   │
│                                                              │
│ 3. cryptoWorker.getVaultData()                             │
│    └─ IndexedDB vaults table                               │
└─────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ Race conditions between three async calls
❌ State can be inconsistent (session exists, keys don't)
❌ No atomic updates (login touches 4+ places)
❌ Complex synchronization logic
❌ Hard to debug when things go wrong
```

### CLI Tool (Simple & Works)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI LAYER                                │
│  - Stores credentials in memory                             │
│  - Direct function calls                                    │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              SINGLE SOURCE OF TRUTH                         │
├─────────────────────────────────────────────────────────────┤
│ Nostr Relays                                                │
│  ├─ LoginObj (password-encrypted)                          │
│  └─ VaultObj (storage-key-encrypted)                       │
└─────────────────────────────────────────────────────────────┘

SUCCESS:
✅ One call gets everything needed
✅ No state synchronization issues
✅ Atomic operations (fetch → decrypt → done)
✅ Simple and predictable
✅ Easy to debug
```

---

## Proposed Solution: Single Source of Truth Pattern

### Core Principle
**The worker's in-memory session IS the complete auth state. Everything else is derived.**

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UI LAYER (React)                         │
│  - Calls ONE method: getAuthState()                         │
│  - Gets complete state in one call                          │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           SINGLE SOURCE OF TRUTH (Worker)                   │
├─────────────────────────────────────────────────────────────┤
│ activeSessions Map<username, SessionState>                  │
│                                                              │
│ interface SessionState {                                    │
│   username: string                                          │
│   isAuthenticated: boolean  // logged in?                  │
│   isUnlocked: boolean       // has keys in memory?         │
│   publicKey: string                                         │
│   storagePublicKey: string                                  │
│   xpriv?: string            // only when unlocked          │
│   storagePrivateKey?: string // only when unlocked         │
│   vaultVersion: number                                      │
│   identityCount: number                                     │
│   unlockedAt: number                                        │
│   sessionId: string                                         │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ▼
                  (Persistence - optional)
┌─────────────────────────────────────────────────────────────┐
│              INDEXEDDB (Cache Only)                         │
├─────────────────────────────────────────────────────────────┤
│ - Vault data cached for faster unlock                      │
│ - Session marker for page reload detection                 │
│ - NOT the source of truth                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create Atomic State API

Create a new `SessionStateManager` in the worker:

```typescript
// apps/vault/src/workers/session-state-manager.ts

interface CompleteSessionState {
  // Auth state
  isAuthenticated: boolean;
  isUnlocked: boolean;

  // User info
  username: string;
  publicKey: string;
  storagePublicKey: string;

  // Vault metadata
  vaultVersion: number;
  identityCount: number;

  // Session info
  sessionId: string;
  unlockedAt: number;

  // Keys (only when unlocked)
  xpriv?: string;
  privateKey?: string;
  storagePrivateKey?: string;
}

class SessionStateManager {
  private sessions = new Map<string, CompleteSessionState>();

  /**
   * ONE method to get complete auth state
   * No piecing together, no race conditions
   */
  getAuthState(username?: string): CompleteSessionState | null {
    // Get current session (last logged in user if no username)
    const session = username
      ? this.sessions.get(username)
      : Array.from(this.sessions.values())[0];

    return session || null;
  }

  /**
   * Atomic login operation
   * Sets complete state in ONE transaction
   */
  async login(params: {
    username: string;
    password: string;
    relays: string[];
  }): Promise<CompleteSessionState> {
    // Fetch from Nostr (like CLI does)
    const loginObj = await getLoginObj(...);
    const vaultData = await getVaultFromNostr(...);

    // Create complete session state
    const session: CompleteSessionState = {
      isAuthenticated: true,
      isUnlocked: false, // Locked until PIN unlock
      username: params.username,
      publicKey: vaultData.publicKey,
      storagePublicKey: loginObj.storagePublicKey,
      vaultVersion: vaultData.version,
      identityCount: vaultData.identities.length,
      sessionId: `session_${Date.now()}`,
      unlockedAt: 0
    };

    // Store in ONE place
    this.sessions.set(params.username, session);

    // Cache to IndexedDB for page reload (optional)
    await this.persistSessionCache(session);

    return session;
  }

  /**
   * Atomic unlock operation
   * Updates complete state in ONE transaction
   */
  async unlock(params: {
    username: string;
    pin: string;
  }): Promise<CompleteSessionState> {
    const session = this.sessions.get(params.username);
    if (!session) throw new Error('Not logged in');

    // Decrypt keys
    const xpriv = await decryptXpriv(pin);
    const storageKeypair = await decryptStorageKeypair(pin);

    // Update session atomically
    session.isUnlocked = true;
    session.xpriv = xpriv;
    session.storagePrivateKey = storageKeypair.privateKey;
    session.unlockedAt = Date.now();

    return session;
  }

  /**
   * Atomic logout operation
   * Clears complete state in ONE transaction
   */
  async logout(username: string): Promise<void> {
    // Remove from memory
    this.sessions.delete(username);

    // Clear cache
    await this.clearSessionCache(username);
  }

  /**
   * Update vault metadata after changes
   */
  updateVaultMetadata(username: string, updates: {
    vaultVersion?: number;
    identityCount?: number;
  }): void {
    const session = this.sessions.get(username);
    if (!session) return;

    if (updates.vaultVersion !== undefined) {
      session.vaultVersion = updates.vaultVersion;
    }
    if (updates.identityCount !== undefined) {
      session.identityCount = updates.identityCount;
    }
  }
}
```

### Phase 2: Simplify AuthService

```typescript
// apps/vault/src/services/authService.ts

export async function getAuthStatus(cryptoWorker: any): Promise<AuthStatus> {
  if (!cryptoWorker) {
    return { isAuthenticated: false, isLocked: true, user: null };
  }

  // ONE call instead of three!
  const state = await cryptoWorker.getAuthState();

  if (!state) {
    return { isAuthenticated: false, isLocked: true, user: null };
  }

  return {
    isAuthenticated: state.isAuthenticated,
    isLocked: !state.isUnlocked,
    user: {
      username: state.username,
      publicKey: state.publicKey,
      storagePublicKey: state.storagePublicKey
    },
    sessionId: state.sessionId,
    timestamp: Date.now()
  };
}
```

### Phase 3: Simplify Login Flow

```typescript
// Current login (touches 4+ places)
async function login(username, password) {
  const loginObj = await getLoginObj(...);           // 1. Fetch
  await vaultDB.saveVault(loginObj);                 // 2. Save to IndexedDB
  await sessionManager.initSession(...);              // 3. Create session in worker
  await vaultDB.saveSession(...);                    // 4. Save session to IndexedDB
  broadcastVaultUpdate(...);                          // 5. Broadcast
}

// New login (ONE atomic operation)
async function login(username, password) {
  const session = await sessionStateManager.login({
    username,
    password,
    relays: DEFAULT_RELAYS
  });

  return session; // Done! Complete state returned
}
```

---

## Migration Strategy

### Step 1: Add New API (Non-Breaking)
- Create `SessionStateManager` alongside existing code
- Add `getAuthState()` method to worker
- Don't change existing code yet

### Step 2: Migrate Components One-by-One
- Start with simple components (Settings, AuditLog)
- Replace `getAuthStatus()` calls with new API
- Verify each works before moving to next

### Step 3: Remove Old Code
- Once all components migrated, remove:
  - `VaultDataService.getSessionStatus()`
  - Complex multi-call auth logic
  - Redundant IndexedDB session tables

### Step 4: Simplify IndexedDB
- Keep only vault cache (for offline/performance)
- Remove session persistence (source of bugs)
- Worker memory becomes only source of truth

---

## Benefits

### 1. Consistency
✅ **One source of truth** - Worker memory holds complete state
✅ **No race conditions** - State updated atomically
✅ **No synchronization bugs** - Nothing to sync

### 2. Simplicity
✅ **One call** - `getAuthState()` returns everything
✅ **Clear state** - Complete SessionState object
✅ **Easy debugging** - One place to look

### 3. Performance
✅ **Fewer IPC calls** - One instead of 3+
✅ **Faster state checks** - No multiple async calls
✅ **Predictable** - Same pattern as CLI tool

### 4. Reliability
✅ **Atomic operations** - Login/unlock/logout are transactions
✅ **No partial state** - Either logged in or not, no in-between
✅ **Clear errors** - Failures are obvious, not silent

---

## Comparison

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Auth check** | 3 async calls | 1 call |
| **Login** | 4+ state updates | 1 atomic op |
| **State sources** | 3+ (IndexedDB, worker, memory) | 1 (worker) |
| **Race conditions** | Many | None |
| **Debugging** | Complex | Simple |
| **Like CLI?** | ❌ No | ✅ Yes |

---

## Example: Login Flow Comparison

### Current (Complex)

```typescript
// 1. Check if vault exists
const vaultData = await vaultDB.getVault(username);

// 2. If not, fetch from Nostr
if (!vaultData) {
  const loginObj = await getLoginObj(...);
  await vaultDB.saveVault(...);
}

// 3. Verify password
const verified = await verifyPassword(...);

// 4. Create session in worker
await sessionManager.initSession(...);

// 5. Save session to IndexedDB
await vaultDB.saveSession(...);

// 6. Broadcast
broadcastVaultUpdate(...);

// 7. Check if we have keys
const keyStatus = await cryptoWorker.hasKeysInSession(...);

// 8. Get auth status (3 more calls!)
const authStatus = await getAuthStatus(cryptoWorker);
```

### Proposed (Simple)

```typescript
// One call, atomic operation
const session = await cryptoWorker.login({
  username,
  password,
  relays: DEFAULT_RELAYS
});

// Done! session contains everything:
// - isAuthenticated: true
// - isUnlocked: false
// - username, publicKey, storagePublicKey
// - vaultVersion, identityCount
// - sessionId
```

---

## Next Steps

1. **Review this proposal** - Does this make sense?
2. **Create SessionStateManager** - New file with atomic API
3. **Add getAuthState() to worker** - Single call for UI
4. **Migrate one component** - Prove it works
5. **Gradually replace** - Move rest of app over
6. **Remove old code** - Clean up fragmented state

## Questions to Answer

1. Should we keep any IndexedDB persistence? (vault cache only?)
2. How to handle page reload? (restore from Nostr vs cached?)
3. Migration path for existing users?
4. Should unlock also be atomic? (fetch vault, decrypt xpriv, done?)

---

**The goal: Make the app work as simply and consistently as the CLI tool.** ✨
