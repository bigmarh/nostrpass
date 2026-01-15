# Changelog

All notable changes to NostrPass will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-13

### Added
- **Google Sign-In Authentication**: Users can now sign in with Google as an alternative to username/password
  - Link existing vaults to Google accounts from Vault Settings
  - Multi-vault support: one Google account can link to multiple vaults
  - Vault picker UI when signing in with Google if multiple vaults are linked
  - Unlink Google accounts from vault settings
- **Firebase Integration**: Added Firebase SDK for Google authentication
- **New Components**:
  - `GoogleAuthProvider` - Firebase Google auth context
  - `LinkGoogleAccount` - Settings component for linking/unlinking Google accounts
  - `VaultPicker` - UI for selecting between multiple linked vaults
  - `GooglePasswordPrompt` - Password confirmation for Google auth operations

### Changed
- Enhanced `vaultHelpers.ts` with Google LoginObj management functions
- Updated `AuthProvider` to support Google authentication flow with identifier types
- Added `linkedAuthProviders` field to vault data for tracking linked auth methods
- Improved relay indexing with `'t'` tags (`gvault_`, `svault_`) for reliable lookups

### Technical Details
- Version 2 tagging for Google LoginObjs to distinguish from legacy entries
- Tombstone mechanism for unlinking (marks LoginObj as unlinked without deletion)
- Storage public key tags for direct vault lookups
- Display-name tags for human-readable vault identification in picker UI

## [1.0.0] - 2024-01-12

### Added
- Initial production release
- Embassy CDN distribution with SRI integrity checking
- Vault hosted at vault.nostrpass.com
- Multi-identity support with per-app permissions
- SharedWorker architecture for cross-tab session persistence
- PIN-based vault encryption with hardware-grade key derivation
- NIP-07 compatible API
- NIP-04 encryption/decryption (spec-compliant via nostr-tools)
- Google Cloud Storage CDN with global edge delivery
- NPM package distribution (@nostrpass/embassy)

### Security
- Content Security Policy headers for iframe isolation
- Subresource Integrity (SRI) for CDN resources
- Encrypted vault storage in IndexedDB
- No private keys in memory after lock
- Per-origin permission system

### Infrastructure
- Monorepo structure with shared libraries
- Automated CI/CD with GitHub Actions
- Versioned CDN releases
- Production builds with console stripping
- WASM served with correct MIME types

## [0.9.0] - 2024-01-05 (Pre-release)

### Added
- Beta testing phase
- Basic vault functionality
- Embassy proof of concept
- Initial permission system

## [0.1.0] - 2023-12-01 (Alpha)

### Added
- Initial alpha release
- Core crypto operations
- Basic UI components
- Development environment setup