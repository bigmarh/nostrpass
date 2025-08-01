# NostrPass Architecture Overview

## What We're Building

NostrPass is a **decentralized password manager and identity vault** built on the Nostr protocol. It provides secure, user-controlled authentication for web applications without relying on centralized servers or browser extensions.

## Core Concept

NostrPass replaces traditional password-based authentication with cryptographic identities managed through the Nostr protocol. Users maintain a single identity (Nostr keypair) that can authenticate them across multiple applications while keeping their private keys secure and under their control.

## Architecture Components

### 1. Vault Application (`/apps/vault/`)
The secure identity manager that runs in an isolated iframe:
- **Purpose**: Manages user authentication, private keys, and encrypted credentials
- **Technology**: SolidJS application with Tailwind CSS
- **Security**: Runs in sandboxed iframe, private keys never leave this context
- **Features**:
  - User registration/login
  - Private key generation and storage
  - Encrypted credential management
  - Permission management per application

### 2. Embassy SDK (`/apps/embassy/`)
JavaScript SDK that third-party applications integrate:
- **Purpose**: Provides `window.nostr` interface for applications
- **Technology**: TypeScript library bundled with Vite
- **Security**: Validates origins, manages secure iframe communication
- **Features**:
  - NIP-07 compatible interface
  - Transparent iframe management
  - Secure message passing
  - Permission request handling

### 3. Communication Layer (`/packages/messenger/`)
Secure messaging protocol between Embassy and Vault:
- **Purpose**: Enables secure cross-origin communication
- **Security**: Origin validation, timestamp verification, request correlation
- **Protocol**: PostMessage-based with typed message contracts

### 4. Nostr Integration (`/packages/nostrHelpers/`)
Helper functions for Nostr protocol operations:
- **Username Registration**: Decentralized username registry using custom event kinds
- **Data Storage**: Encrypted user data stored as Nostr events
- **Key Management**: Utilities for key derivation and encryption

## Critical Security Contexts

### 1. Iframe Isolation
- Vault always runs in an isolated iframe with restricted permissions
- No direct DOM access between Vault and host application
- All communication through validated postMessage channel

### 2. Private Key Security
- Private keys are generated and stored only within the Vault
- Keys are encrypted before localStorage persistence
- Private keys never transmitted to parent window or Embassy
- All signing operations happen within Vault context

### 3. Origin Validation
- Every message validates sender origin
- Whitelist of allowed origins per environment
- Timestamp validation (5-minute window) prevents replay attacks
- Request/response correlation with unique IDs

### 4. Permission Model
- Applications must declare required permissions upfront
- User explicitly approves permissions per application
- Permissions stored encrypted and tied to origin
- Granular control over what each app can access

## Data Flow Examples

### Authentication Flow
1. App includes Embassy SDK and calls `window.nostr.getPublicKey()`
2. Embassy creates hidden iframe pointing to Vault
3. Vault checks if user is logged in
4. If not, Vault shows login/signup UI
5. User authenticates with username/password
6. Vault derives keys and returns public key
7. Embassy returns public key to application

### Signing Flow
1. App calls `window.nostr.signEvent(event)`
2. Embassy forwards request to Vault via secure channel
3. Vault validates request and checks permissions
4. If needed, Vault prompts user for approval
5. Vault signs event with private key
6. Signed event returned through Embassy to app

### Username Registration
1. User picks username in Vault
2. Vault hashes username with environment-specific salt
3. Creates Nostr event (kind 31000) claiming username
4. Publishes to configured relays
5. Validates uniqueness across network

## Environment Separation

The system supports multiple environments with complete isolation:
- **Development**: `.dev` usernames, separate relays
- **Staging**: `.staging` usernames, test infrastructure
- **Production**: Clean usernames, production relays

Each environment has:
- Separate username namespaces
- Different relay configurations
- Isolated data storage
- Environment-specific salts

## Benefits

1. **User Sovereignty**: Users own their identity and data
2. **No Central Authority**: Fully decentralized on Nostr network
3. **Developer Friendly**: Drop-in replacement for browser extensions
4. **Privacy Focused**: Minimal data exposure, encrypted storage
5. **Cross-Platform**: Works on any device with a web browser

## Technical Stack

- **Frontend Framework**: SolidJS (reactive, performant)
- **Styling**: Tailwind CSS
- **Build Tools**: Vite, TypeScript, Turborepo
- **Package Manager**: pnpm workspaces
- **Cryptography**: nostr-tools library
- **Monorepo Structure**: Shared packages for types, helpers, messaging

## Security Considerations

1. **Always validate message origins**
2. **Never expose private keys outside Vault**
3. **Encrypt all stored data**
4. **Use time-bound messages to prevent replay**
5. **Implement proper CSP headers**
6. **Regular security audits of iframe communication**

## Future Enhancements

- Biometric authentication support
- Hardware wallet integration
- Multi-device synchronization
- Advanced permission policies
- Social recovery mechanisms
- WebAuthn integration