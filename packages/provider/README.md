# @nostrpass/provider

NostrPass provider SDK (NIP-07 compatible). Framework-agnostic, drop-in provider that exposes `window.nostr` and a small init API.

## Install

- pnpm (workspace):

```bash
pnpm add @nostrpass/provider
```

## Usage (bundlers)

```ts
import { initNostrPass } from '@nostrpass/provider';

// Initialize and install window.nostr
const provider = initNostrPass({
  vaultUrl: 'https://vault.nostrpass.com',
  appName: 'My App'
});

// NIP-07
const pubkey = await window.nostr.getPublicKey();
const signed = await window.nostr.signEvent({ kind: 1, content: 'hello', tags: [], created_at: Math.floor(Date.now()/1000) });
```

## Usage (IIFE)

```html
<script src="/dist/index.iife.js"></script>
<script>
  const provider = window.initNostrPass({ vaultUrl: 'https://vault.nostrpass.com', appName: 'My App' });
  // window.nostr is now available
</script>
```

## Notes

- Prompts (PIN, permissions) are handled inside the Vault iframe by default.
- Strict origin pinning is enforced in the messenger.
- For self-hosting the Vault, point `vaultUrl` to your instance and allow its origin in production.

## Exports

- `initNostrPass(config)` → installs `window.nostr`
- `NostrPassEmbassy` (advanced)
- Types: `EmbassyConfig`, `NostrProvider`, `NostrEvent`
