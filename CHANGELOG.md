# Changelog

All notable changes to NostrPass will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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