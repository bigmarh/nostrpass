# NostrPass Lite Web App Agent Brief

Use this brief instead of the older provider docs when implementing **NostrPass Lite** in a web app.

## Correct integration target

For a normal web app, the correct integration is:

- `lite-embassy` in the host page
- `lite-vault` hosted at `https://cdn.nostrpass.com/lite-vault/index.html`
- `window.nostr` installed by `initNostrPassLite(...)`
- auth UI and signing UI handled inside the iframe-backed vault overlay

Do **not** implement Lite using the older `@nostrpass/provider` docs. That is the full provider path, not the Lite iframe path.

## Important constraints

- `vaultUrl` must be set. That is what switches `lite-embassy` into iframe mode.
- For an external web app, use the CDN build first.
- Do not rely on `npm install @nostrpass/lite-embassy` unless the package has been published. In this repo it is still marked `private`.
- Do not reimplement the raw iframe `postMessage` bridge unless you are modifying the SDK itself. The SDK already wraps that.
- Do not call low-level LiteCore auth flows from the host page when using iframe mode. The vault should own auth UI.

## What the other agent should build

1. Load the Lite embassy script in the host app:

```html
<script src="https://cdn.nostrpass.com/lite-embassy@0.1.2.js"></script>
```

2. Initialize it once on app startup:

```html
<script>
  async function setupNostrPassLite() {
    const embassy = await window.initNostrPassLite({
      appName: 'My App',
      appDomain: window.location.origin,
      vaultUrl: 'https://cdn.nostrpass.com/lite-vault/index.html',
      relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'],
      overrideExistingProvider: false,
    });

    window.nostrPassLiteEmbassy = embassy;
  }

  setupNostrPassLite().catch(console.error);
</script>
```

3. Use `window.nostr` after init resolves:

```js
const pubkey = await window.nostr.getPublicKey();

const signed = await window.nostr.signEvent({
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'hello from NostrPass Lite',
});
```

4. Add a login/connect button using the SDK:

```js
const embassy = window.nostrPassLiteEmbassy;

embassy.createNostrPassLiteButton({
  appendTo: '#nostrpass-connect',
  labelSignedOut: 'Use NostrPass Lite',
  labelLocked: 'Unlock NostrPass Lite',
  labelSignedIn: 'Connected',
});
```

5. Listen for status changes if the app needs UI state:

```js
window.addEventListener('nostrpass-lite:status', (event) => {
  const { kind, auth } = event.detail;
  console.log('nostrpass-lite status', kind, auth);
});
```

## Expected behavior

- On init, `window.nostr` is installed automatically unless an existing provider is present and `overrideExistingProvider` is `false`.
- When the user is signed out or locked, clicking the Lite button opens the hosted vault overlay.
- Permission prompts happen inside the vault overlay.
- Once unlocked, standard NIP-07-style calls work through `window.nostr`.
- Refresh should preserve session state and then require unlock when appropriate.

## Supported host-side API surface

Use these from the host app:

- `window.initNostrPassLite(config)`
- `embassy.getAuthState()`
- `embassy.logout()`
- `embassy.createNostrPassLiteButton(...)`
- `window.nostr.getPublicKey()`
- `window.nostr.signEvent(...)`
- `window.nostr.signData(...)`
- `window.nostr.nip04.encrypt(...)`
- `window.nostr.nip04.decrypt(...)`
- `window.nostr.nip44.encrypt(...)`
- `window.nostr.nip44.decrypt(...)`

## Do not do these things

- Do not use `@nostrpass/provider` for Lite.
- Do not omit `vaultUrl` for the web-app integration path.
- Do not ask the host app to build signup/login/PIN forms unless you intentionally want the non-iframe local-core mode.
- Do not overwrite `window.nostr` from a browser extension unless that is explicitly desired.
- Do not treat the marketing page snippets as the source of truth if they conflict with the SDK code.

## Acceptance checklist

- `window.initNostrPassLite(...)` runs without errors.
- `window.nostr` exists after initialization.
- Clicking the Lite button opens the vault overlay.
- After login, `window.nostr.getPublicKey()` succeeds.
- A `signEvent(...)` call triggers permission UI and returns a signed event.
- Refreshing the page preserves auth state and supports unlock.

## Source of truth in this repo

- `apps/lite-embassy/src/liteEmbassy.ts`
- `apps/lite-vault/src/App.tsx`
- `scripts/deploy-lite-vault.sh`
- `scripts/deploy-lite-cdn.sh`
