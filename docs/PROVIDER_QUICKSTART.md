# Provider Quickstart

Use `@nostrpass/provider` to install a NIP-07 compatible provider that exposes `window.nostr` and handles prompts (PIN/permissions) inside the Vault iframe.

## Install

```bash
pnpm add @nostrpass/provider
```

## Initialize (bundlers)

```ts
import { initNostrPass } from '@nostrpass/provider';

const provider = initNostrPass({
  appName: 'MyApp',
  vaultUrl: 'https://vault.nostrpass.com'
});

const pubkey = await window.nostr.getPublicKey();
```

## Initialize (IIFE)

```html
<script src="https://cdn.nostrpass.com/provider/index.iife.js" integrity="<SRI_HASH>" crossorigin="anonymous"></script>
<script>
  window.initNostrPass({ appName: 'MyApp', vaultUrl: 'https://vault.nostrpass.com' });
</script>
```

## Security & CSP

- Enforce strict origin pinning via provider config and messenger.
- Recommended CSP for host app:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; frame-src https://vault.nostrpass.com; connect-src 'self' https://vault.nostrpass.com wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

## API (NIP-07)

- `window.nostr.getPublicKey()`
- `window.nostr.signEvent(event)`
- `window.nostr.signData(message)`
- `window.nostr.nip04.encrypt(pubkey, plaintext)`
- `window.nostr.nip04.decrypt(pubkey, ciphertext)`

## Notes

- Prompts are rendered inside the Vault by default.
- To self-host the Vault, deploy it and pass your `vaultUrl`, then allow its origin in production.
