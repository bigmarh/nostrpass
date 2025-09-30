# Error Codes

Standardized error codes surfaced by the provider and Vault.

- E_LOCKED: Vault is locked or session expired. Prompt user to unlock.
- E_PERMISSION_DENIED: Operation was not authorized or user denied.
- E_TIMEOUT: Request timed out.
- E_ORIGIN_REJECTED: Message from unauthorized origin.
- E_INVALID_REQUEST: Missing/invalid params or unauthenticated state.
- E_INTERNAL: Unexpected internal error.

Usage:

```ts
try {
  await window.nostr.signEvent(evt);
} catch (e: any) {
  switch (e.code) {
    case 'E_LOCKED': /* show unlock */ break;
    case 'E_PERMISSION_DENIED': /* explain and retry */ break;
    default: /* fallback */ break;
  }
}
```
