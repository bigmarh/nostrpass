# NostrPass Data Structures

## Overview

This document provides a comprehensive reference for all data structures used in NostrPass, including vault data, message formats, and type definitions.

## Core Data Structures

### VaultData

The main vault data structure stored in IndexedDB and synchronized to Nostr.

```typescript
interface VaultData {
  // Core identifiers
  storagePublicKey: string;            // Primary vault key (derived from master key)
  username: string;                    // Display name only
  publicKey: string;                   // Alias of storagePublicKey (compat)

  // Encrypted master key
  xprivEncrypted: string;              // BIP32 xpriv encrypted with PIN
  salt: string;                        // PIN derivation salt (hex)

  // Storage keypair (new auth flow)
  storageKeypairEncrypted?: string;    // PIN-encrypted storage keypair

  // Identity management
  identities: Identity[];              // Array of user identities
  currentIdentityIndex?: number;       // Currently selected identity index
  activeIdentityByApp?: Record<string, string | null>; // App -> identity publicKey

  // Recovery system
  recovery?: RecoveryData;             // PIN recovery configuration

  // User preferences
  customRelays?: string[];             // User relay overrides

  // Metadata
  updatedAt: number;                   // Last update timestamp
  version: number;                     // Incremented on every save
  createdAt?: number;                  // Account creation timestamp
  lastSyncedAt?: number;               // Last sync with Nostr
  lastUnlocked?: number;               // Last time vault was unlocked
  derivationPath?: string;             // BIP32 derivation path
  sessionExpiry?: number;              // Session expiry timestamp

  // Security
  passwordSalt?: string;               // Password derivation salt (for LoginObj)

  // Linked authentication providers
  linkedAuthProviders?: LinkedAuthProvider[];
}
```

### Identity

Individual identity derived from the master key.

```typescript
interface Identity {
  // Basic info
  nickname: string;                    // User-friendly name (e.g., "Personal", "Work")
  path: string;                        // BIP44 derivation path: m/44'/1237'/0'/0/${index}
  
  // Derived keys (optional, computed on demand)
  publicKey?: string;                  // Hex-encoded public key
  index?: number;                      // Derivation index
  
  // Per-identity permissions
  appPermissions?: Record<string, AppPermissions>;  // Domain -> permissions
  
  // Identity-specific settings
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    defaultRelays?: string[];          // Preferred Nostr relays
    preferences?: Record<string, any>; // Additional preferences
  };
}
```

### AppPermissions

Permission configuration for a specific app/domain.

```typescript
interface AppPermissions {
  // App identification
  appId: string;                       // Origin/domain (e.g., "https://app.com")
  appName?: string;                    // Human-readable app name
  
  // Permission levels by operation
  kinds: Record<number, PermissionLevel>;     // Event kind -> permission
  signData: PermissionLevel;                  // Arbitrary data signing
  getPublicKey?: PermissionLevel;             // Public key access
  nip04?: PermissionLevel;                    // Encryption/decryption
  getRelays?: PermissionLevel;                // Relay list access
  
  // Timestamps
  grantedAt: number;                   // When permissions were first granted
  lastUsedAt: number;                  // Last time app made a request
  
  // Session-based temporary permissions
  sessionPermissions?: {
    kinds: Record<number, boolean>;    // Temporary kind permissions
    signData: boolean;                 // Temporary data signing permission
    expiresAt: number;                 // Session expiration timestamp
  };
}

// Permission levels enum
type PermissionLevel = 'ALLOW' | 'ASK_PER_SESSION' | 'ASK_EVERYTIME' | 'DENY';
```

### LinkedAuthProvider

Authentication providers linked to a vault.

```typescript
interface LinkedAuthProvider {
  provider: 'username' | 'google';
  linkedAt: number;
  displayName?: string;
  googleUid?: string;
}
```

### RecoveryData

PIN recovery configuration using security questions.

```typescript
interface RecoveryData {
  questions: Array<{
    id: string;                        // Question identifier
    question: string;                  // The security question
    answerHash: string;                // Hashed answer for verification
  }>;
  encryptedMasterKey: string;          // Master key encrypted with recovery key
  salt: string;                        // Salt for answer derivation
  createdAt: number;                   // When recovery was configured
}
```

### User (Runtime)

User object used during runtime (not stored directly).

```typescript
interface User {
  profile: {
    username: string;
    avatar?: string;
    displayName?: string;
  };
  publicKey: string;                   // Current identity's public key
  vaultPublicKey: string;              // Storage identity public key
  vaultPinHash?: string;               // PIN hash if PIN is set
  hasPin: boolean;
  encryptedXpriv?: string;             // Only present after PIN unlock
  currentIdentityIndex?: number;
}
```

## Message Formats

### Base Message Structure

All messages between Embassy and Vault follow this structure:

```typescript
interface MessagePayload {
  id: string;                          // Unique message identifier
  type: string;                        // Message type (e.g., 'GET_PUBLIC_KEY')
  data: any;                           // Message-specific data
  timestamp: number;                   // Message timestamp
  origin: string;                      // Sender's origin
}
```

### Request/Response Patterns

#### GET_PUBLIC_KEY
```typescript
// Request
{
  type: 'GET_PUBLIC_KEY',
  data: {
    appName: string,
    appDomain: string
  }
}

// Response
{
  type: 'GET_PUBLIC_KEY_RESPONSE',
  data: string  // hex public key
}
```

#### SIGN_EVENT
```typescript
// Request
{
  type: 'SIGN_EVENT',
  data: {
    event: {
      kind: number,
      created_at: number,
      tags: string[][],
      content: string,
      pubkey?: string
    },
    appName: string,
    appDomain: string
  }
}

// Response
{
  type: 'SIGN_EVENT_RESPONSE',
  data: SignedEvent  // Full signed event
}
```

#### ENCRYPT (NIP-04)
```typescript
// Request
{
  type: 'ENCRYPT',
  data: {
    plaintext: string,
    recipientPubkey: string,
    appName: string,
    appDomain: string
  }
}

// Response
{
  type: 'ENCRYPT_RESPONSE',
  data: string  // encrypted content
}
```

#### DECRYPT (NIP-04)
```typescript
// Request
{
  type: 'DECRYPT',
  data: {
    ciphertext: string,
    senderPubkey: string,
    appName: string,
    appDomain: string
  }
}

// Response
{
  type: 'DECRYPT_RESPONSE',
  data: string  // decrypted content
}
```

#### AUTH_STATUS
```typescript
// Notification (Vault -> Embassy)
{
  type: 'AUTH_STATUS',
  data: {
    isAuthenticated: boolean,
    publicKey?: string,
    username?: string
  }
}
```

## Worker Message Formats

### Crypto Worker Operations

All crypto worker messages follow this pattern:

```typescript
interface WorkerMessage {
  type: string;                        // Operation type
  data: any;                          // Operation-specific data
}

interface WorkerResponse {
  success: boolean;
  data?: any;                         // Success response data
  error?: string;                     // Error message if failed
}
```

#### Common Worker Operations

```typescript
// Generate Keypair
{ type: 'generateKeypair', data: {} }
// Response: { privateKey: string, publicKey: string }

// Sign Event
{ 
  type: 'signEvent', 
  data: { 
    privateKey: string, 
    event: UnsignedEvent 
  } 
}
// Response: SignedEvent

// Encrypt Data (NIP-04)
{ 
  type: 'encrypt', 
  data: { 
    privateKey: string, 
    publicKey: string, 
    plaintext: string 
  } 
}
// Response: string (encrypted)

// Derive Key from Password
{ 
  type: 'deriveKey', 
  data: { 
    password: string, 
    salt: string 
  } 
}
// Response: { key: string }

// Create Session
{ 
  type: 'createSession', 
  data: { 
    username: string, 
    vaultData: VaultData,
    privateKey?: string 
  } 
}
// Response: { success: true }
```

## Nostr Event Structures

### Vault Storage Event (Kind 30078)

Used to store encrypted vault data on Nostr.

```typescript
{
  kind: 30078,
  tags: [
    ["d", username],                   // Replaceable event identifier
    ["client", "nostrpass"],           // Client identifier
    ["version", "1.0.0"]               // Data version
  ],
  content: vaultObjJson,               // JSON stringified VaultObj (PIN-encrypted xpriv)
  created_at: timestamp,
  pubkey: storagePublicKey,            // Storage identity public key
  id: eventId,
  sig: signature
}
```

### Standard Nostr Event

```typescript
interface NostrEvent {
  id: string;                          // Event ID (32-byte hash)
  pubkey: string;                      // Author's public key
  created_at: number;                  // Unix timestamp
  kind: number;                        // Event kind
  tags: string[][];                    // Tag array
  content: string;                     // Event content
  sig: string;                         // Schnorr signature
}
```

## Permission Check Results

```typescript
interface PermissionCheckResult {
  allowed: boolean;                    // Whether action is allowed
  level: PermissionLevel;              // Current permission level
  needsPrompt: boolean;                // Whether to show permission UI
  sessionGranted?: boolean;            // Whether session permission exists
}
```

## Storage Schemas

### IndexedDB Schema

```typescript
// Database: NostrPassVault
// Object Stores:

// users - Primary user data store
{
  keyPath: 'username',
  indexes: ['publicKey', 'updatedAt']
}

// cache - Temporary data cache
{
  keyPath: 'key',
  indexes: ['type', 'expiry']
}

// sessions - Active session data
{
  keyPath: 'id',
  indexes: ['username', 'expiresAt']
}
```

### Local Storage Keys

```typescript
// Used for non-sensitive data
'nostrpass:theme'                     // UI theme preference
'nostrpass:lastUsername'              // Last logged in username
'nostrpass:devMode'                   // Development mode flag
```

## Validation Functions

### Username Validation
```typescript
function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
}
```

### Password Requirements
```typescript
interface PasswordRequirements {
  minLength: 8;
  requireUppercase: false;
  requireLowercase: false;
  requireNumbers: false;
  requireSpecialChars: false;
}
```

### PIN Requirements
```typescript
interface PINRequirements {
  minLength: 4;
  maxLength: 8;
  numbersOnly: true;
}
```

## Event Kind Registry

Common Nostr event kinds used by NostrPass:

```typescript
const EventKinds = {
  Metadata: 0,                         // User metadata
  TextNote: 1,                         // Text notes
  RecommendRelay: 2,                   // Relay recommendations  
  ContactList: 3,                      // Contact/follow list
  EncryptedDM: 4,                      // Encrypted direct messages
  Deletion: 5,                         // Event deletion
  Reaction: 7,                         // Reactions/likes
  BadgeAward: 8,                       // Badge awards
  Zap: 9735,                          // Lightning zaps
  ZapRequest: 9734,                    // Zap requests
  RelayList: 10002,                    // Relay list metadata
  WalletInfo: 13194,                   // Wallet connect info
  LongFormContent: 30023,              // Articles/long-form
  VaultStorage: 30078,                 // NostrPass vault data
} as const;
```

## Constants

```typescript
// Cryptographic constants
const NOSTR_EPOCH = 0;                 // Nostr time epoch (Unix time)
const IDENTITY_PATH = "m/44'/1237'/0'/0";  // BIP44 path for identities
const STORAGE_INDEX = 2147483647;      // 2^31 - 1 (max hardened index)

// Timing constants
const SESSION_TIMEOUT = 3600000;       // 1 hour in milliseconds
const PIN_ATTEMPTS_MAX = 5;            // Max PIN attempts before lockout
const PIN_LOCKOUT_TIME = 300000;       // 5 minutes lockout

// Size limits
const MAX_EVENT_SIZE = 65536;          // 64KB max event size
const MAX_VAULT_SIZE = 1048576;        // 1MB max vault size
const MAX_IDENTITIES = 10;             // Max identities per vault
```

## Type Utilities

```typescript
// Permission type guards
function isPermissionLevel(value: any): value is PermissionLevel {
  return ['ALLOW', 'ASK_PER_SESSION', 'ASK_EVERYTIME', 'DENY'].includes(value);
}

// Event type guards
function isNostrEvent(value: any): value is NostrEvent {
  return value &&
    typeof value.id === 'string' &&
    typeof value.pubkey === 'string' &&
    typeof value.created_at === 'number' &&
    typeof value.kind === 'number' &&
    Array.isArray(value.tags) &&
    typeof value.content === 'string' &&
    typeof value.sig === 'string';
}
```

This data structure documentation provides a complete reference for all data types used throughout the NostrPass system, ensuring consistent implementation and integration.