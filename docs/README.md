# NostrPass Documentation

Welcome to the NostrPass documentation. This directory contains all technical documentation, guides, and architecture documents for the NostrPass project.

---

## 📚 Getting Started

### For New Developers
1. [Architecture Overview](ARCHITECTURE.md) - System architecture and design
2. [Message Flow](MESSAGE_FLOW.md) - How components communicate
3. [Refactoring Guide](REFACTORING_GUIDE.md) - Understanding the codebase organization

### For Users
1. [Self-Hosting Guide](SELF_HOSTING_GUIDE.md) - Deploy your own NostrPass instance
2. [Integration Examples](INTEGRATION_EXAMPLES.md) - How to integrate NostrPass
3. [NostrPass Button](NostrPassButton.md) - Using the NostrPass button component

---

## 🏗️ Architecture & Design

### Core Architecture
- [Architecture Overview](ARCHITECTURE.md) - Complete system architecture
- [Data Structures](DATA_STRUCTURES.md) - Core data models and schemas
- [Security & Permissions](SECURITY_AND_PERMISSIONS.md) - Security model and permissions
- [Event Sourced Vault Model](EVENT_SOURCED_VAULT_MODEL.md) - Vault data model

### Component Architecture
- [Message Flow](MESSAGE_FLOW.md) - Inter-component communication
- [Vault Flow Explained](VAULT_FLOW_EXPLAINED.md) - How vault operations work
- [New Auth Flow](NewAuthFlow.md) - Authentication process
- [getPublicKey Function Map](getPublicKey-function-map.md) - Public key retrieval flow

### Strategy Documents
- [NostrPass Architecture](NOSTRPASS_ARCHITECTURE.md) - High-level architecture
- [Security Non-Negotiables](SECURITY_NON_NEGOTIABLES.md) - Critical security requirements
- [Vault Sync Production Strategy](VAULT_SYNC_PRODUCTION_STRATEGY.md) - Sync architecture
- [Rust WASM Plan](RUST_WASM_PLAN.md) - Future Rust/WASM integration

---

## 🔧 Development

### Code Organization
- [Refactoring Guide](REFACTORING_GUIDE.md) - **⭐ Complete refactoring documentation**
  - Crypto handlers decomposition
  - Auth provider cleanup
  - Dashboard component breakdown
  - AuthProvider modularization
  - Architecture patterns
  - Testing strategy
  - Lessons learned

### Build & Deployment
- [Build Simplification](BUILD_SIMPLIFICATION.md) - Build configuration analysis
- [Deployment Production](DEPLOYMENT_PRODUCTION.md) - Production deployment guide
- [Migration to Noble](MIGRATION-TO-NOBLE.md) - Cryptography library migration

### Testing
- [Testing Guide](TESTING_GUIDE.md) - Complete testing documentation
- [Quick Test Steps](QUICK_TEST_STEPS.md) - Fast testing checklist

### Fixes & Changes
- [Vault Persistence Fix](VAULT_PERSISTENCE_FIX.md) - Vault data persistence improvements
- [Organization](Organization.md) - Project organization notes

---

## 🔌 Integration

### For App Developers
- [Integration Examples](INTEGRATION_EXAMPLES.md) - Code examples and integration patterns
- [NostrPass Button](NostrPassButton.md) - Button component integration
- [Provider Quickstart](PROVIDER_QUICKSTART.md) - Quick start for using the provider
- [API Reference](API_REFERENCE.md) - Complete API documentation

### Protocols
- [Protocol Specification](PROTOCOL_SPECIFICATION.md) - NostrPass protocol spec
- [Open Protocol Strategy](OPEN_PROTOCOL_STRATEGY.md) - Open protocol vision

---

## 📋 Reference

### Technical Reference
- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Error Codes](ERROR_CODES.md) - Error code reference
- [Data Structures](DATA_STRUCTURES.md) - Data model reference

### Special Topics
- [Financial Tab](FinancialTab.md) - Financial features documentation
- [Permission Implementation](PERMISSION_IMPLEMENTATION.md) - Permission system details
- [Signup Flow](Signup-flow.md) - User signup process

---

## 📖 Documentation Categories

### By Audience

#### 🔰 New Contributors
Start here to understand the codebase:
1. [Architecture Overview](ARCHITECTURE.md)
2. [Refactoring Guide](REFACTORING_GUIDE.md)
3. [Message Flow](MESSAGE_FLOW.md)
4. [Testing Guide](TESTING_GUIDE.md)

#### 👨‍💻 Developers
Building features or fixing bugs:
1. [Refactoring Guide](REFACTORING_GUIDE.md) - Code organization patterns
2. [API Reference](API_REFERENCE.md) - API documentation
3. [Data Structures](DATA_STRUCTURES.md) - Data models
4. [Testing Guide](TESTING_GUIDE.md) - Testing approach

#### 🔐 Security Reviewers
Reviewing security architecture:
1. [Security & Permissions](SECURITY_AND_PERMISSIONS.md)
2. [Security Non-Negotiables](SECURITY_NON_NEGOTIABLES.md)
3. [Vault Flow Explained](VAULT_FLOW_EXPLAINED.md)
4. [Event Sourced Vault Model](EVENT_SOURCED_VAULT_MODEL.md)

#### 🏢 Integrators
Integrating NostrPass into apps:
1. [Integration Examples](INTEGRATION_EXAMPLES.md)
2. [NostrPass Button](NostrPassButton.md)
3. [Provider Quickstart](PROVIDER_QUICKSTART.md)
4. [Protocol Specification](PROTOCOL_SPECIFICATION.md)

#### 🚀 DevOps
Deploying and maintaining:
1. [Self-Hosting Guide](SELF_HOSTING_GUIDE.md)
2. [Deployment Production](DEPLOYMENT_PRODUCTION.md)
3. [Build Simplification](BUILD_SIMPLIFICATION.md)
4. [Testing Guide](TESTING_GUIDE.md)

---

## 🎯 Key Documents

### Must-Read for All Contributors
- **[Refactoring Guide](REFACTORING_GUIDE.md)** - Comprehensive guide to codebase organization
- **[Architecture Overview](ARCHITECTURE.md)** - System design and architecture
- **[Security & Permissions](SECURITY_AND_PERMISSIONS.md)** - Security model

### Recent Updates
- ✨ **[Refactoring Guide](REFACTORING_GUIDE.md)** - Complete refactoring documentation (Nov 2025)
- 📦 **[Event Sourced Vault Model](EVENT_SOURCED_VAULT_MODEL.md)** - New vault architecture
- 🔧 **[Build Simplification](BUILD_SIMPLIFICATION.md)** - Build configuration analysis

---

## 📝 Documentation Standards

### Creating New Documentation

When creating new documentation, follow these guidelines:

**File Naming:**
- Use `SCREAMING_SNAKE_CASE.md` for technical docs
- Use `PascalCase.md` for component/feature docs
- Use `kebab-case.md` for guide docs

**Structure:**
```markdown
# Title

Brief description

## Overview
High-level explanation

## Details
In-depth content with code examples

## Examples
Practical examples

## References
Links to related docs
```

**Content Guidelines:**
- Include code examples
- Use diagrams where helpful
- Link to related documents
- Keep it up to date
- Add to this README when creating new docs

---

## 🔄 Documentation Maintenance

### Keeping Docs Current

- Update docs when making significant code changes
- Add new docs to this README under appropriate sections
- Remove outdated information
- Keep examples working and tested
- Review docs quarterly

### Need Help?

- Check existing docs first (use search)
- Ask in project issues/discussions
- Create PR to improve docs
- Report outdated information

---

**Documentation Status:** ✅ Organized and Current (Nov 2025)

*Last Updated: November 2025*
