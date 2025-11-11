## NostrPass Event-Sourced Vault Model (Secure PRE Streams)

This document specifies a secure, event-sourced replacement for the full-vault blob sync. It is designed so any engineer/AI agent can implement, test, and maintain the model safely.

### Goals
- Replace full-state sync with granular, parameterized-replaceable streams (kind 30078).
- Maintain strong confidentiality (NIP-04 with the storage keypair) and minimal metadata leakage.
- Preserve the password-encrypted snapshot for cold-start restore only.
- Ensure deterministic discovery, robust conflict handling, and downgrade protection.

### Terminology
- Storage Keypair: Dedicated keypair derived from xpriv at hardened path (STORAGE_INDEX). Used to sign and encrypt operational events.
- PRE: Parameterized-replaceable events (Nostr kind 30078) grouped by unique d-tag (streamId).
- Snapshot: Password-encrypted full vault used only for first-time restore.

### High-Level Design
1) Initial bootstrap
   - On account creation, publish password-encrypted snapshot once.
   - Afterwards, operational updates are written as PRE streams signed by the storage keypair and encrypted via NIP-04.

2) Operational streams (all kind 30078)
   - Author: storagePublicKey
   - Tags:
     - ["d", "np/<type>/<streamId>"] where <type> ∈ {identity, perm, active, relays, index}
     - No semantic tags beyond the opaque d-tag
   - Content: NIP-04 encrypted JSON envelope (see below)

3) Subscriptions
   - Subscribe by author=storagePublicKey, kind=30078
   - No extra filters. Client assembles state from latest event per d-tag.

4) Assembly
   - Group events by d-tag. For each stream, select the latest event by created_at.
   - Decrypt content and validate version monotonicity, prevHash chain, and contentHash.
   - Apply to in-memory state.

### Stream Types
All content is encrypted and shares a common envelope structure.

Common Envelope
{
  "version": number,          // Monotonic per stream
  "updatedAt": number,        // ms since epoch
  "prevHash": string|null,    // SHA256 of previous envelope JSON (pre-encrypt)
  "contentHash": string,      // SHA256 of current envelope JSON (pre-encrypt)
  "data": {}                  // Stream-specific payload
}

1) Identity meta stream
  - d: np/identity/<streamId>
  - data: { identityId, nickname, path, createdAt }

2) Permissions per identity+app
  - d: np/perm/<streamId>
  - data: { identityId, appId, appPermissions: string[] }

3) Active identity per app
  - d: np/active/<streamId>
  - data: { appId, identityId }

4) Relays (optional)
  - d: np/relays/<streamId>
  - data: { relays: string[] }

5) Index (optional convenience)
  - d: np/index
  - data: {
      identities: [{ identityId, identityStreamId }],
      perms: [{ appId, identityId, permStreamId }],
      active: [{ appId, activeStreamId }],
      relaysStreamId?: string
    }

Notes:
- identityId and appId are opaque IDs (e.g., HMAC-SHA256 derived) only present inside encrypted content.
- streamId is deterministic and opaque (see derivation below).

### Deterministic IDs

Use HMAC-SHA256 with the storagePrivateKey as key, and a clear-text domain string as message:
- identityId = HMAC(storagePrivateKey, "np:identity:<path>" )
- appId = HMAC(storagePrivateKey, "np:app:<appDomain>" )
- Stream IDs:
  - identityStreamId = HMAC(storagePrivateKey, "np:stream:identity:<identityId>")
  - permStreamId = HMAC(storagePrivateKey, "np:stream:perm:<identityId>:<appId>")
  - activeStreamId = HMAC(storagePrivateKey, "np:stream:active:<appId>")
  - relaysStreamId = HMAC(storagePrivateKey, "np:stream:relays")

All outputs are hex strings. Derivation must be stable across devices.

### Write Algorithm (per stream)
1) Read latest event for stream (if any). After decrypt, extract envelope and compute prevHash = SHA256(prevEnvelopeJSON).
2) Build new envelope with incremented version and updatedAt, set prevHash accordingly, and compute contentHash.
3) Encrypt envelope with NIP-04 using storagePrivateKey and storagePublicKey.
4) Publish kind 30078 with tag d = np/<type>/<streamId>.

### Read/Assemble Algorithm
1) Query author=storagePublicKey & kind=30078.
2) Group by d-tag; pick latest by created_at.
3) Decrypt via NIP-04; verify contentHash and prevHash chain consistency; enforce version monotonicity.
4) Apply envelopes to build identities, permissions, active per app, and relays.

### Security Model
- Confidentiality: All operational data encrypted under NIP-04 with dedicated storage keypair.
- Metadata minimization: Only opaque d-tags; no semantic tags or app domains in plaintext.
- Integrity: Nostr signature + envelope contentHash; rollback protection through prevHash chain and version monotonicity.
- Key separation: Storage keypair is only used for vault data. Identity keys remain independent.
- Snapshot: Keep password-encrypted full vault for cold-start. Not used during normal operation.

### Migration Plan
1) On next write after adopting PRE, emit identity streams, permission streams, active streams, and optionally relays/index from current local state.
2) Keep existing snapshot publishing at account creation only.
3) Subscriptions move to author-only PRE fetch; client assembles state from streams.

### Testing Checklist
- Create account -> snapshot published; no PRE.
- Add identity -> identity stream created; other client receives latest and shows identity.
- Update permissions -> only perm stream changes; other client updates.
- Switch active identity -> active stream updates; reflected across tabs within one poll/real-time tick.
- Tamper tests: reject events with non-monotonic version or broken prevHash/contentHash.
- Multi-relay tests: handle duplicate/stale events idempotently.

### Implementation Notes
- Keep the existing worker session cache of storagePrivateKey for NIP-04.
- Maintain a small index cache (in IndexedDB) mapping streamId -> latest envelope to speed validation.
- Backoff on decryption errors; log but continue.

This spec is intentionally constrained to minimize metadata leakage while enabling robust, incremental sync.


