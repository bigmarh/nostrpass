# Contributing to NostrPass

Thank you for your interest in contributing to NostrPass! This document provides guidelines and information for contributors.

## Code of Conduct

Be respectful, constructive, and collaborative. We're building open infrastructure for the decentralized web.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/nostrpass/nostrpass/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Browser/environment details

### Suggesting Features

1. Check [Issues](https://github.com/nostrpass/nostrpass/issues) for existing feature requests
2. Create a new issue with:
   - Clear use case description
   - Proposed solution
   - Alternative approaches considered
   - Willingness to implement it yourself

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow existing code style
   - Write tests for new features
   - Update documentation
   - Keep commits focused and atomic

4. **Test your changes**:
   ```bash
   pnpm test
   pnpm build
   ```

5. **Commit with conventional commits**:
   ```bash
   feat: Add profile picture upload
   fix: Resolve identity sync issue
   docs: Update self-hosting guide
   ```

6. **Push and create PR**:
   - Provide clear description
   - Link related issues
   - Include screenshots for UI changes

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm 8+
- Git

### Getting Started

1. **Clone and install**:
   ```bash
   git clone https://github.com/nostrpass/nostrpass.git
   cd nostrpass
   pnpm install
   ```

2. **Start development servers**:
   ```bash
   pnpm dev
   ```

3. **Run tests**:
   ```bash
   pnpm test
   ```

### Project Structure

```
nostrpass/
├── apps/
│   ├── embassy/     - NostrPass provider SDK
│   └── vault/       - Vault management UI
├── packages/
│   ├── types/       - Shared TypeScript types
│   ├── messenger/   - Cross-frame messaging
│   ├── vault-core/  - Framework-agnostic vault library
│   └── ...         - Other shared packages
└── docs/           - Documentation
```

## Coding Guidelines

### TypeScript
- Use strict mode
- Prefer interfaces over types for objects
- Use type inference when obvious
- Document complex types

### React/SolidJS
- Use functional components
- Prefer hooks over class components
- Keep components small and focused
- Use TypeScript for props

### Testing
- Write unit tests for utilities
- Write integration tests for features
- Test edge cases
- Aim for meaningful coverage, not 100%

### Commits
- Use conventional commit format
- Keep commits focused
- Write descriptive messages
- Reference issues when applicable

## Architecture Guidelines

### Security First
- Never expose private keys
- Validate all inputs
- Use encryption for sensitive data
- Follow principle of least privilege

### Privacy
- Minimize data collection
- User data stays on their device
- No tracking without consent

### Decentralization
- Don't create central points of failure
- Support self-hosting
- Use Nostr relays, not central servers

## Documentation

- Update docs when changing features
- Add JSDoc comments to public APIs
- Keep README up to date
- Write clear code comments for complex logic

## Review Process

1. **Automated checks** must pass:
   - Type checking
   - Tests
   - Linting

2. **Code review** by maintainers:
   - Architecture fit
   - Code quality
   - Security review
   - Documentation

3. **Merge**:
   - Squash and merge preferred
   - Clear commit message
   - Update changelog if needed

## Getting Help

- **Documentation**: Check [docs/](docs/) first
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions for questions
- **Nostr**: Find us on Nostr (npub coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Appreciated by the community!

---

Thank you for helping build the future of decentralized identity! 🥚
