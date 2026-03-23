# NostrPass Chrome Extension - Development Status

## Overview

Chrome extension for NostrPass that provides NIP-07 (`window.nostr`) support, reusing the vault's existing UI components.

## Current State: Architecture Refactor Needed

The extension builds and displays the login UI, but the authentication flow doesn't work because the popup is trying to use a web worker (copied from vault) instead of the background service worker.

### The Problem

The vault app uses:
```
Popup UI → Web Worker (crypto.worker.ts) → IndexedDB
```

But Chrome extensions should use:
```
Popup UI → chrome.runtime.sendMessage → Background Service Worker → chrome.storage
```

The popup currently imports `AuthProvider` from vault which expects a web worker. Web workers in extension popups have issues with:
- IndexedDB access in popup context
- Worker lifecycle (popup closes = worker dies)
- Cross-origin restrictions

### The Solution

The background service worker (`src/background/index.ts`) already has:
- ✅ Session management (`session.ts`) - lock/unlock, get keys
- ✅ Crypto operations (`crypto.ts`) - signing, encryption, key derivation
- ✅ Storage via `chrome.storage` (`storage.ts`)
- ✅ NIP-07 handlers (signEvent, encrypt, decrypt, etc.)

What's missing:
- ❌ Login/signup handlers in background
- ❌ Nostr relay communication for LoginObj/VaultObj lookup
- ❌ Popup adapter to use `chrome.runtime.sendMessage` instead of worker

### Implementation Plan

1. **Add login/signup to background service worker**
   - Add message handlers for `atomicLogin`, `atomicSignup`, `getAuthState`
   - Port the Nostr relay communication from vault's `auth-handlers-atomic.ts`
   - Use `chrome.storage.local` for vault data, `chrome.storage.session` for unlocked keys

2. **Create extension-specific CryptoWorkerProvider**
   - Create `src/providers/ExtensionCryptoProvider.tsx`
   - Implement same interface as `useCryptoWorker()` but uses `chrome.runtime.sendMessage`
   - All worker method calls become background messages

3. **Update popup providers**
   - Replace `CryptoWorkerProvider` with `ExtensionCryptoProvider` in `AppProviders`
   - Keep `AuthProvider` - it will work once crypto provider sends to background

4. **Remove web worker from build**
   - Remove `crypto.worker` entry from vite.config.ts
   - Remove `crypto.worker.js` from manifest web_accessible_resources

### What's Already Working
- Extension loads and displays the Login UI
- Logo and background images load correctly
- Popup dimensions are correct (400x600px)
- Google Sign-In button is present
- Username/password form is functional
- Background service worker handles NIP-07 operations (signing, encryption)
- Background has crypto/session/storage modules ready

## File Structure

```
apps/chrome-extension/
├── dist/                          # Built extension (load this in Chrome)
│   ├── manifest.json
│   ├── background.js              # Service worker (crypto + NIP-07)
│   ├── content.js                 # Content script
│   ├── window-nostr.js            # Injected NIP-07 provider
│   ├── assets/                    # JS/CSS chunks
│   ├── icons/                     # Extension icons
│   ├── logo.svg
│   └── egg_background_*.png       # Login backgrounds
├── public/
│   ├── manifest.json              # Source manifest
│   └── icons/
├── src/
│   ├── popup/                     # Extension popup UI
│   │   ├── index.html
│   │   ├── index.tsx              # Gets current tab origin for params.app
│   │   └── App.tsx                # HashRouter setup
│   ├── background/                # Service worker - THIS IS THE KEY
│   │   ├── index.ts               # Message router
│   │   ├── crypto.ts              # All crypto ops (signing, encryption, derivation)
│   │   ├── session.ts             # Lock/unlock state, key access
│   │   └── storage.ts             # chrome.storage wrapper
│   ├── content/                   # Content script + window.nostr injection
│   │   ├── index.ts
│   │   └── window-nostr.ts
│   ├── components/                # Copied from vault (47 files)
│   ├── providers/                 # Need ExtensionCryptoProvider
│   ├── services/
│   │   └── cryptoWorkerFactory.ts # TO BE REMOVED - use background instead
│   ├── workers/                   # TO BE REMOVED - not needed in extension
│   └── ...
└── vite.config.ts                 # Multi-entry build config
```

## Background Service Worker - Current Handlers

The background (`src/background/index.ts`) already handles:
- `getAuthState` - returns hasVault, isLocked, publicKey
- `unlock` - unlocks vault with PIN
- `lock` - locks vault
- `getPublicKey` - NIP-07: returns active identity's pubkey
- `signEvent` - NIP-07: signs a Nostr event
- `signData` - Signs arbitrary data
- `nip04.encrypt/decrypt` - NIP-04 encryption
- `nip44.encrypt/decrypt` - NIP-44 encryption
- `getRelays` - Returns configured relays
- `resolvePermission` - Handles permission prompt responses

## Missing Background Handlers (To Add)

```typescript
// These need to be added to background/index.ts:
case 'atomicLogin': {
  // 1. Lookup LoginObj on Nostr by username/Google UID
  // 2. Decrypt with password to get storageKeys
  // 3. Lookup VaultObj on Nostr
  // 4. Store vault data in chrome.storage.local
  // 5. Return success (user still needs PIN to unlock)
}

case 'atomicSignup': {
  // 1. Generate new xpriv and derive storage keys
  // 2. Create and encrypt VaultObj
  // 3. Publish to Nostr
  // 4. Create and encrypt LoginObj
  // 5. Publish to Nostr
  // 6. Store vault data in chrome.storage.local
}

case 'getAuthState': {
  // Already exists, may need to expand for full auth state
}
```

## Key Files to Reference

From vault (for porting login/signup logic):
- `apps/vault/src/workers/auth-handlers-atomic.ts` - atomicLogin, atomicSignup
- `apps/vault/src/workers/session-manager.ts` - session state
- `apps/vault/src/workers/nostr-sync.ts` - Nostr relay communication
- `packages/nostrHelpers/src/index.ts` - getLoginObj, getVaultObj, publish functions

From extension (already working):
- `src/background/crypto.ts` - has all the crypto primitives needed
- `src/background/storage.ts` - has chrome.storage wrappers
- `src/background/session.ts` - has unlock/lock logic (needs LoginObj lookup)

## Build & Test Commands

```bash
# Build extension
pnpm --filter @nostrpass/chrome-extension build

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select: apps/chrome-extension/dist/

# After changes, click the refresh icon on the extension card

# View background service worker console:
# Click "service worker" link on extension card in chrome://extensions/
```

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEBSITE                                  │
│  window.nostr.getPublicKey() / signEvent() / etc.               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT SCRIPT                                │
│  window-nostr.ts (injected) → content/index.ts (bridge)         │
│  CustomEvent ←→ chrome.runtime.sendMessage                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                BACKGROUND SERVICE WORKER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   crypto.ts  │  │  session.ts  │  │  storage.ts  │          │
│  │  - signEvent │  │  - unlock    │  │  - getVault  │          │
│  │  - encrypt   │  │  - lock      │  │  - setVault  │          │
│  │  - decrypt   │  │  - getKeys   │  │  - perms     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  TODO: Add login/signup handlers with Nostr relay comms         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTENSION POPUP                               │
│  Login UI, Dashboard, Permission prompts                         │
│  Communicates with background via chrome.runtime.sendMessage     │
│                                                                  │
│  TODO: Replace CryptoWorkerProvider with ExtensionCryptoProvider │
└─────────────────────────────────────────────────────────────────┘
```
