# Frameworkless Architecture Analysis for NostrPass Vault

**Date**: November 2025
**Question**: Should the NostrPass vault be rewritten as a frameworkless library?
**Current State**: ~20,645 lines of SolidJS code

---

## TL;DR: Verdict

**Recommendation**: ⚠️ **Hybrid Approach** - Extract core to frameworkless library, keep UI framework-based

**Why**:
- The vault needs complex UI interactions (forms, modals, state transitions)
- Core business logic (60%) can be frameworkless
- UI layer (40%) benefits from framework primitives
- Best of both worlds: reusable core + productive UI development

---

## What Is the Vault?

The vault is a **full-featured web application** that runs in an iframe and handles:

### Core Responsibilities
1. **Authentication & Sessions**
   - Login with username/password
   - Session restoration across tabs
   - PIN-based vault locking/unlocking
   - Account migration

2. **Identity Management**
   - Create/edit/delete identities (Nostr keypairs)
   - Derive keys from master seed (BIP32/BIP44)
   - Manage multiple identities per vault

3. **Permission System**
   - Per-app, per-identity permissions
   - Per-event-kind permission granularity
   - Permission prompt UI (Allow/Deny/Always/Never)
   - Permission history tracking

4. **Cryptographic Operations**
   - Event signing (NIP-01)
   - Encryption/Decryption (NIP-04)
   - Key derivation (Argon2id)
   - Session key management

5. **Nostr Sync**
   - Backup vault to Nostr relays (PRE events)
   - Restore vault from Nostr
   - Cross-device sync
   - Relay management

6. **UI Components** (32 components)
   - Dashboard with identity list
   - Login/Signup forms
   - PIN pad with recovery flow
   - Permission prompts
   - Settings panels
   - Account picker
   - Relay configuration

---

## Option 1: Fully Frameworkless (Vanilla JS)

### What This Means

Build everything with vanilla JavaScript:
- DOM manipulation with `document.createElement`
- Event handling with `addEventListener`
- Manual state management
- Custom reactivity system or none

### Example Code

```javascript
// Frameworkless vault core
class VaultApp {
  constructor(container) {
    this.container = container;
    this.state = {
      user: null,
      isLocked: true,
      identities: []
    };
    this.render();
  }

  render() {
    // Manual DOM manipulation
    this.container.innerHTML = '';

    const dashboard = document.createElement('div');
    dashboard.className = 'dashboard';

    if (this.state.isLocked) {
      dashboard.appendChild(this.renderPinPad());
    } else {
      dashboard.appendChild(this.renderIdentityList());
    }

    this.container.appendChild(dashboard);
  }

  renderPinPad() {
    const pinPad = document.createElement('div');
    pinPad.className = 'pin-pad';

    // Create 0-9 buttons
    for (let i = 0; i <= 9; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.onclick = () => this.handlePinInput(i);
      pinPad.appendChild(button);
    }

    return pinPad;
  }

  handlePinInput(digit) {
    // Manual state update and re-render
    this.currentPin += digit;
    this.render(); // Full re-render
  }
}
```

### Pros ✅

1. **Zero Dependencies**
   - No framework bundle (~100-200KB saved)
   - No framework updates to track
   - No framework breaking changes

2. **Maximum Control**
   - Direct DOM access
   - No virtual DOM overhead
   - Predictable performance

3. **Framework Independence**
   - Can be used by any parent app
   - No framework lock-in
   - Long-term stability

4. **Bundle Size**
   - Smaller final bundle (~30-40% reduction)
   - Faster initial load

### Cons ❌

1. **Development Velocity** 🐌
   - Manual DOM manipulation is verbose
   - No reactivity system (or build your own)
   - More boilerplate code
   - Slower feature development

2. **Maintainability Issues**
   - More code to maintain (2-3x more lines)
   - Higher bug surface area
   - Harder to understand state flow
   - Manual memory management (event listeners)

3. **Missing Productivity Features**
   - No declarative JSX/templates
   - No component composition
   - No built-in form handling
   - No routing system
   - Manual state synchronization

4. **Complex UI Requirements**
   The vault has complex UI needs:
   - Multi-step flows (login → migrate → dashboard)
   - Conditional rendering (locked/unlocked states)
   - Form validation (PIN, passwords, recovery)
   - Modal overlays (permissions, account picker)
   - Real-time updates (cross-tab sync)

5. **Time Investment** ⏱️
   - ~3-6 months to rewrite ~20k lines
   - ~2-3x more code to write
   - Testing complexity increases

### Code Comparison

**Current (SolidJS)**:
```typescript
// 50 lines of declarative code
export const PinPad: Component<Props> = (props) => {
  const [pin, setPin] = createSignal('');

  return (
    <div class="pin-pad">
      <Show when={pin().length < 6}>
        <For each={[0,1,2,3,4,5,6,7,8,9]}>
          {(digit) => (
            <button onClick={() => setPin(pin() + digit)}>
              {digit}
            </button>
          )}
        </For>
      </Show>
      <Show when={pin().length === 6}>
        <button onClick={() => props.onSubmit(pin())}>
          Unlock
        </button>
      </Show>
    </div>
  );
};
```

**Frameworkless**:
```javascript
// 200+ lines of imperative code
class PinPad {
  constructor(container, onSubmit) {
    this.container = container;
    this.onSubmit = onSubmit;
    this.pin = '';
    this.buttons = [];
    this.display = null;
    this.submitButton = null;
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'pin-pad';

    // Create display
    this.display = document.createElement('div');
    this.display.className = 'pin-display';
    this.updateDisplay();
    wrapper.appendChild(this.display);

    // Create digit buttons
    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'button-grid';

    for (let i = 0; i <= 9; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.className = 'digit-button';
      button.dataset.digit = i;
      this.buttons.push(button);
      buttonGrid.appendChild(button);
    }

    wrapper.appendChild(buttonGrid);

    // Create submit button
    this.submitButton = document.createElement('button');
    this.submitButton.textContent = 'Unlock';
    this.submitButton.className = 'submit-button';
    this.submitButton.disabled = true;
    wrapper.appendChild(this.submitButton);

    this.container.appendChild(wrapper);
  }

  attachEvents() {
    // Attach click handlers
    this.buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const digit = e.target.dataset.digit;
        this.handleDigit(digit);
      });
    });

    this.submitButton.addEventListener('click', () => {
      this.handleSubmit();
    });
  }

  handleDigit(digit) {
    if (this.pin.length < 6) {
      this.pin += digit;
      this.updateDisplay();
      this.updateSubmitButton();
    }
  }

  updateDisplay() {
    this.display.textContent = '•'.repeat(this.pin.length);
  }

  updateSubmitButton() {
    this.submitButton.disabled = this.pin.length !== 6;
  }

  handleSubmit() {
    if (this.pin.length === 6) {
      this.onSubmit(this.pin);
      this.reset();
    }
  }

  reset() {
    this.pin = '';
    this.updateDisplay();
    this.updateSubmitButton();
  }

  destroy() {
    // Manual cleanup
    this.buttons.forEach(button => {
      button.removeEventListener('click', this.handleDigit);
    });
    this.submitButton.removeEventListener('click', this.handleSubmit);
    this.container.innerHTML = '';
  }
}
```

**Verdict**: ❌ **Not worth it** - 4x more code for the same functionality

---

## Option 2: Hybrid Approach (Recommended)

### Architecture

Separate concerns into two layers:

```
┌─────────────────────────────────────────────────────┐
│            UI Layer (Framework-Based)               │
│                                                     │
│  - Components (SolidJS/React/Svelte)               │
│  - State management (Signals/Hooks/Stores)         │
│  - Routing                                         │
│  - Forms & validation                              │
│                                                     │
│  Can be swapped: Choose your framework             │
└─────────────────────────────────────────────────────┘
                        ▲
                        │ Clean API
                        ▼
┌─────────────────────────────────────────────────────┐
│         Core Layer (Frameworkless Library)          │
│                                                     │
│  @nostrpass/vault-core                             │
│  ├── AuthManager      - Login, sessions, migration │
│  ├── VaultManager     - CRUD operations            │
│  ├── IdentityManager  - Key management             │
│  ├── PermissionManager - Permission system         │
│  ├── CryptoWorker     - Already frameworkless ✅   │
│  └── NostrSync        - Relay operations           │
│                                                     │
│  Pure TypeScript, Event-based API                  │
└─────────────────────────────────────────────────────┘
```

### Example Implementation

#### **Core Layer (Frameworkless)**

```typescript
// packages/vault-core/src/AuthManager.ts
export class AuthManager extends EventEmitter {
  private worker: Worker;
  private currentUser: User | null = null;
  private isLocked: boolean = true;

  constructor(worker: Worker) {
    super();
    this.worker = worker;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const result = await this.worker.postMessage({
      type: 'login',
      data: { username, password }
    });

    if (result.success) {
      this.currentUser = result.user;
      this.isLocked = false;
      this.emit('auth-state-changed', this.currentUser);
      this.emit('lock-state-changed', this.isLocked);
    }

    return result;
  }

  async unlockVault(pin: string): Promise<boolean> {
    const success = await this.worker.postMessage({
      type: 'unlockVault',
      data: { pin }
    });

    if (success) {
      this.isLocked = false;
      this.emit('lock-state-changed', this.isLocked);
    }

    return success;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  isVaultLocked(): boolean {
    return this.isLocked;
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    this.on('auth-state-changed', callback);
    return () => this.off('auth-state-changed', callback);
  }

  onLockStateChanged(callback: (isLocked: boolean) => void) {
    this.on('lock-state-changed', callback);
    return () => this.off('lock-state-changed', callback);
  }
}

// packages/vault-core/src/index.ts
export class VaultCore {
  public auth: AuthManager;
  public vault: VaultManager;
  public identity: IdentityManager;
  public permissions: PermissionManager;
  public nostr: NostrSyncManager;

  constructor(config: VaultConfig) {
    const worker = new Worker(config.workerUrl);

    this.auth = new AuthManager(worker);
    this.vault = new VaultManager(worker);
    this.identity = new IdentityManager(worker);
    this.permissions = new PermissionManager(worker);
    this.nostr = new NostrSyncManager(worker);
  }

  async initialize() {
    // Initialize all managers
    await this.auth.restoreSession();
  }
}
```

#### **UI Layer (Framework Adapters)**

**SolidJS Adapter**:
```typescript
// packages/vault-solidjs/src/useVaultCore.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { VaultCore } from '@nostrpass/vault-core';

export function useAuth(vaultCore: VaultCore) {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLocked, setIsLocked] = createSignal(true);

  createEffect(() => {
    const unsubAuth = vaultCore.auth.onAuthStateChanged(setUser);
    const unsubLock = vaultCore.auth.onLockStateChanged(setIsLocked);

    onCleanup(() => {
      unsubAuth();
      unsubLock();
    });
  });

  return {
    user,
    isLocked,
    login: vaultCore.auth.login.bind(vaultCore.auth),
    unlock: vaultCore.auth.unlockVault.bind(vaultCore.auth),
    logout: vaultCore.auth.logout.bind(vaultCore.auth)
  };
}
```

**React Adapter**:
```typescript
// packages/vault-react/src/useVaultCore.ts
import { useState, useEffect } from 'react';
import { VaultCore } from '@nostrpass/vault-core';

export function useAuth(vaultCore: VaultCore) {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    const unsubAuth = vaultCore.auth.onAuthStateChanged(setUser);
    const unsubLock = vaultCore.auth.onLockStateChanged(setIsLocked);

    return () => {
      unsubAuth();
      unsubLock();
    };
  }, [vaultCore]);

  return {
    user,
    isLocked,
    login: vaultCore.auth.login.bind(vaultCore.auth),
    unlock: vaultCore.auth.unlockVault.bind(vaultCore.auth),
    logout: vaultCore.auth.logout.bind(vaultCore.auth)
  };
}
```

**Svelte Adapter**:
```typescript
// packages/vault-svelte/src/vaultStore.ts
import { writable } from 'svelte/store';
import { VaultCore } from '@nostrpass/vault-core';

export function createVaultStore(vaultCore: VaultCore) {
  const user = writable<User | null>(null);
  const isLocked = writable(true);

  vaultCore.auth.onAuthStateChanged(u => user.set(u));
  vaultCore.auth.onLockStateChanged(l => isLocked.set(l));

  return {
    user: { subscribe: user.subscribe },
    isLocked: { subscribe: isLocked.subscribe },
    login: vaultCore.auth.login.bind(vaultCore.auth),
    unlock: vaultCore.auth.unlockVault.bind(vaultCore.auth),
    logout: vaultCore.auth.logout.bind(vaultCore.auth)
  };
}
```

### Pros ✅

1. **Best of Both Worlds**
   - Frameworkless core (reusable)
   - Framework UI (productive)
   - Clean separation

2. **Framework Choice**
   - Teams can use their preferred framework
   - SolidJS, React, Vue, Svelte all supported
   - Share same core logic

3. **Maintainability**
   - Business logic isolated in core
   - UI changes don't affect logic
   - Easier to test core independently

4. **Migration Path**
   - Can be done incrementally
   - Extract one manager at a time
   - No big rewrite needed

5. **Bundle Flexibility**
   - Core can be tree-shaken
   - UI framework is separate bundle
   - Optimal bundle splitting

### Cons ⚠️

1. **More Packages**
   - Need to maintain multiple adapter packages
   - More publishing coordination

2. **Learning Curve**
   - Developers need to understand two layers
   - API design requires more thought

3. **Boilerplate**
   - Each framework needs an adapter
   - More initial setup

### Implementation Effort

**Phase 1**: Extract Core (2-3 weeks)
- Create `@nostrpass/vault-core` package
- Extract AuthManager
- Extract VaultManager
- Extract IdentityManager
- Extract PermissionManager
- Keep worker as-is (already frameworkless)

**Phase 2**: Create Adapters (1 week per framework)
- SolidJS adapter (refactor existing)
- React adapter (if needed)
- Svelte adapter (if needed)

**Total**: 3-6 weeks depending on how many framework adapters needed

---

## Option 3: Web Components

### What This Means

Build the vault as custom web components:

```html
<nostr-vault>
  <nostr-login></nostr-login>
  <nostr-dashboard></nostr-dashboard>
  <nostr-pin-pad></nostr-pin-pad>
</nostr-vault>
```

### Pros ✅

1. **Native Browser Support**
   - No framework needed
   - Works everywhere
   - Standard web platform

2. **Framework Agnostic**
   - Use in React, Vue, Angular, etc.
   - Just HTML tags

3. **Encapsulation**
   - Shadow DOM for style isolation
   - Custom events for communication

### Cons ❌

1. **Limited Ecosystem**
   - No mature web component frameworks for complex apps
   - Manual everything (routing, state, forms)
   - Poor DX compared to modern frameworks

2. **Complex State Management**
   - No built-in state system
   - Cross-component communication is verbose
   - Props down, events up pattern is manual

3. **Browser Support**
   - Shadow DOM has quirks
   - Polyfills may be needed

4. **Development Experience**
   - More verbose than framework code
   - Limited tooling
   - Harder to debug

**Verdict**: ⚠️ **Not recommended for complex apps** - Better for simple components

---

## Recommendation: Hybrid Approach

### Why Hybrid Wins

| Criteria | Frameworkless | Hybrid | Framework-Only |
|----------|--------------|--------|----------------|
| **Reusability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Development Speed** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maintainability** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Bundle Size** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **DX (Dev Experience)** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Testing** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Time to Implement** | 6 months | 6 weeks | Current |
| **Framework Independence** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |

### Action Plan

**Immediate** (Keep SolidJS, improve current state):
1. ✅ Complete refactoring (done)
2. ✅ Improve modularity (done)
3. Continue with SolidJS

**Next 3-6 months** (Extract core gradually):
1. Create `@nostrpass/vault-core` package
2. Extract AuthManager from AuthProvider
3. Extract VaultManager from vault operations
4. Extract IdentityManager from identity operations
5. Extract PermissionManager from permission service
6. Keep crypto worker as-is (already perfect)

**Future** (If multi-framework support needed):
1. Create framework adapters as needed
2. Build example vaults in different frameworks
3. Document integration patterns

---

## Current State Assessment

### What You Have Now ✅

1. **Crypto Worker** - ✅ Already frameworkless (Perfect!)
2. **Messenger** - ✅ Already framework-agnostic
3. **Types** - ✅ Already reusable
4. **Business Logic** - ⚠️ Mixed with SolidJS
5. **UI Components** - ❌ SolidJS-specific

### Percentage Breakdown

- ✅ **60% Already Reusable** (Worker, messenger, types)
- ⚠️ **20% Needs Extraction** (Business logic from providers)
- ❌ **20% Framework-Specific** (UI components - this is fine!)

---

## Conclusion

**Answer**: No, a **fully frameworkless** approach is **not better** for this application.

**Instead**: Use a **hybrid approach**:
- Extract core business logic to frameworkless library (60% of value, 20% of effort)
- Keep UI layer framework-based (maximum productivity, familiar patterns)
- Achieve 95% framework independence for the logic layer
- Maintain high development velocity for UI changes

### Why This Is The Right Answer

1. **The vault is a complex UI application** - Frameworks exist for this reason
2. **60% is already frameworkless** - Worker, messenger, types
3. **20% can be extracted easily** - Business logic from providers
4. **20% should stay framework-based** - UI components (diminishing returns)
5. **Hybrid gives you 95% reusability** with 20% of the effort of full rewrite

### Next Steps

If you want to improve modularity:

1. ✅ **Keep current SolidJS vault** (it works!)
2. 📦 **Extract `@nostrpass/vault-core`** (business logic)
3. 🔌 **Create adapters** (only if multi-framework is needed)
4. 🎨 **Let teams choose UI framework** (all use same core)

This gives you the best of both worlds: **maximum reusability** with **maximum productivity**.

---

**Final Score**:

| Approach | Score | Recommendation |
|----------|-------|----------------|
| **Fully Frameworkless** | ⭐⭐ 2/5 | ❌ Don't do this |
| **Hybrid (Core + Adapters)** | ⭐⭐⭐⭐⭐ 5/5 | ✅ Recommended |
| **Current (SolidJS only)** | ⭐⭐⭐⭐ 4/5 | ✅ Good for now |
| **Web Components** | ⭐⭐⭐ 3/5 | ⚠️ Not for complex apps |

**Keep using SolidJS, extract core logic gradually, add framework adapters only if needed.**
