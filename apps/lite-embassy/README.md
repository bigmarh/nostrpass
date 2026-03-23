# @nostrpass/lite-embassy

Lightweight NIP-07 integration SDK for NostrPass Lite.

## Features

- `window.initNostrPassLite(config)` bootstrap
- Automatic `window.nostr` provider installation
- Per-operation permission hooks via `lite-core`
- Status event stream (`nostrpass-lite:status`)
- Styled drop-in auth button with NostrPass visual language

## Development

```bash
pnpm --filter @nostrpass/lite-embassy dev
```

## Build

```bash
pnpm --filter @nostrpass/lite-embassy build
```

Library artifacts are emitted to `dist-lib/`.
