# NostrPass Open Source Release Checklist

This document outlines the steps to publish NostrPass as open source on GitHub while keeping sensitive deployment information private.

## ✅ Completed Preparation

- [x] Created `LICENSE` (MIT)
- [x] Created `CONTRIBUTING.md`
- [x] Created `.gitattributes` with export-ignore rules
- [x] Created public-focused `README.md`
- [x] Updated `.gitignore` for sensitive files
- [x] Backed up original README to `README-PRIVATE.md`

## 📋 Pre-Release Checklist

### 1. Review Sensitive Data

Before publishing, verify these files contain NO secrets:

```bash
# Check for API keys, tokens, passwords
grep -r "API" --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "TOKEN" --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "SECRET" --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "PASSWORD" --include="*.ts" --include="*.tsx" --include="*.js"
```

### 2. Verify .gitattributes Exclusions

Test what will be exported:

```bash
# Create a test archive to see what would be included
git archive --format=tar HEAD | tar -t > archive-contents.txt
less archive-contents.txt

# Verify excluded files are NOT in the list:
# - .env.production ❌
# - scripts/ ❌
# - firebase*.json ❌
# - apps/frontend/ ❌
# - Internal *.md docs ❌
```

### 3. Clean Commit History (Optional)

If you want to start with clean history without internal development commits:

**Option A: Keep Full History** (Recommended)
- Pro: Shows development evolution, credit to all contributors
- Con: May expose some internal discussions in commit messages

**Option B: Clean/Squashed History**
- Pro: Clean, professional commit history
- Con: Loses development context

For Option B:
```bash
# Create orphan branch with clean history
git checkout --orphan opensource-clean
git add -A
git commit -m "feat: Initial open source release of NostrPass

NostrPass is a secure, self-sovereign identity and key management
solution for Nostr. This release includes:

- Embassy SDK for easy integration
- Vault UI for key management
- Core libraries and utilities
- Complete documentation
- Self-hosting guides

License: MIT
"
```

## 🚀 GitHub Publication Steps

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `nostrpass` (or your preferred name)
3. Description: "Secure, self-sovereign identity and key management for Nostr"
4. Visibility: **Public**
5. Do NOT initialize with README, license, or .gitignore (we have these)
6. Click "Create repository"

### Step 2: Add GitHub as Remote

```bash
# Add GitHub as a second remote
git remote add github https://github.com/YOUR_USERNAME/nostrpass.git

# Verify remotes
git remote -v
# Should show:
# origin  https://source.developers.google.com/p/nostrpass/r/nostrpass (fetch)
# origin  https://source.developers.google.com/p/nostrpass/r/nostrpass (push)
# github  https://github.com/YOUR_USERNAME/nostrpass.git (fetch)
# github  https://github.com/YOUR_USERNAME/nostrpass.git (push)
```

### Step 3: Push to GitHub

**Option A: Push Current Branch (with history)**
```bash
# Push your current main/master branch to GitHub
git push github main

# Or if you're on a different branch you want to make main:
git push github feature/identity-nostr-profiles:main
```

**Option B: Push Clean History**
```bash
# If you created orphan branch
git push github opensource-clean:main
```

### Step 4: Verify on GitHub

1. Go to your GitHub repo
2. Check README displays correctly
3. Verify sensitive files are NOT visible:
   - `.env.production` ❌
   - `scripts/` directory ❌
   - `firebase.json` ❌
   - Internal docs ❌

### Step 5: Configure GitHub Repository

1. **Add topics**: nostr, authentication, identity, privacy, self-hosted, web3
2. **Add description**: "Secure, self-sovereign identity and key management for Nostr"
3. **Set website**: https://nostrpass.com
4. **Enable Issues**: For bug reports
5. **Enable Discussions**: For community Q&A
6. **Disable Wiki**: (unless you want to use it)
7. **Disable Projects**: (unless you want to use it)

### Step 6: Create GitHub Release

1. Go to "Releases" → "Create a new release"
2. Tag: `v1.0.0` (or appropriate version)
3. Title: "NostrPass v1.0.0 - Initial Open Source Release"
4. Description:
```markdown
# NostrPass v1.0.0 🥚

Initial open source release of NostrPass - secure, self-sovereign identity and key management for Nostr.

## Features

- 🔐 Secure key management
- 👥 Multiple identity support
- 🎯 Granular permissions
- 🔄 Cross-device sync via Nostr
- 🌐 Self-hostable
- 📱 Mobile support

## For Developers

Add NostrPass to your app:
\`\`\`html
<script src="https://cdn.nostrpass.com/embassy.js"></script>
\`\`\`

See [Integration Guide](docs/INTEGRATION_EXAMPLES.md)

## For Self-Hosters

See [Self-Hosting Guide](docs/SELF_HOSTING_GUIDE.md)

## Documentation

Complete docs at [docs/README.md](docs/README.md)

---

Made with 🥚 by the NostrPass team
```

## 🔄 Ongoing Maintenance Strategy

### Two-Remote Workflow

You'll maintain two remotes:

1. **`origin`** (Google Cloud Source) - Private, full codebase
   - Contains deployment scripts
   - Contains `.env.production`
   - Contains internal docs
   - This is where you actively develop

2. **`github`** (GitHub) - Public, sanitized
   - Excludes sensitive files (via .gitattributes)
   - This is where community contributes

### Workflow for Updates

When you want to publish changes to open source:

```bash
# 1. Develop on private repo (origin)
git add .
git commit -m "feat: Add new feature"
git push origin main

# 2. Push to GitHub (sensitive files auto-excluded by .gitattributes)
git push github main

# Note: .gitattributes export-ignore only works with git archive,
# not git push. So you need to be careful what you push.
```

**IMPORTANT**: `.gitattributes export-ignore` works for `git archive` but NOT for `git push`. You have two options:

**Option 1: Manual Sync (Safer)**
```bash
# Create a script: sync-to-github.sh
#!/bin/bash
git checkout main
git pull origin main

# Create temporary branch without sensitive files
git checkout -b github-sync
git rm -r scripts/ apps/frontend/
git rm .env.production firebase*.json
git rm ATOMIC-AUTH-*.md PHASE*.md PRE*.md PROPOSAL*.md
git rm STREAMLINED*.md VAULT_*.md DEBUG*.md TEST-AUTH*.md
git commit -m "Remove sensitive files for open source"

# Push to GitHub
git push github github-sync:main --force

# Return to main
git checkout main
git branch -D github-sync
```

**Option 2: Separate Branch**
```bash
# Keep an 'opensource' branch that never has sensitive files
git checkout -b opensource
# Remove sensitive files from this branch
# Always merge main → opensource (not the reverse)
# Push opensource branch to GitHub
```

### Handling Community Contributions

When someone submits a PR on GitHub:

```bash
# Add their fork as a remote
git remote add contributor https://github.com/their-username/nostrpass.git

# Fetch their changes
git fetch contributor

# Review and merge into your private repo first
git checkout -b review-pr
git merge contributor/their-branch

# Test, review, merge to main
git checkout main
git merge review-pr
git push origin main

# Then push to GitHub
git push github main
```

## 🎯 Announcement Strategy

### 1. GitHub

- Create comprehensive README ✅
- Add clear contributing guidelines ✅
- Set up issue templates
- Add code of conduct
- Pin important issues/discussions

### 2. Nostr

Post announcement with:
- What NostrPass does
- Why it matters for Nostr ecosystem
- Link to GitHub
- Call for contributors
- Bounties for important features (optional)

### 3. Community Platforms

- Nostr (primary)
- Bitcoin/Nostr Discord servers
- r/nostr (if exists)
- Hacker News (Show HN)
- Bitcoin/Nostr podcasts

### Sample Announcement

```
🥚 NostrPass is now open source!

We're excited to announce that NostrPass - secure, self-sovereign
identity management for Nostr - is now fully open source under MIT license.

What is NostrPass?
A browser-based key manager that gives you complete control over your
Nostr identities with:
- Multiple identity support
- Granular app permissions
- Cross-device sync via Nostr relays
- Self-hostable
- Zero tracking

For Developers:
Add secure Nostr auth to your app in 5 minutes:
https://github.com/nostrpass/nostrpass

For Users:
Self-host your own instance for maximum privacy:
https://github.com/nostrpass/nostrpass#self-hosting

We'd love your feedback, contributions, and help building the
decentralized future!

GitHub: https://github.com/nostrpass/nostrpass
Website: https://nostrpass.com
```

## ✅ Final Pre-Release Checklist

Before pushing to GitHub:

- [ ] All sensitive data removed/ignored
- [ ] README is public-friendly
- [ ] LICENSE file present
- [ ] CONTRIBUTING.md present
- [ ] .gitattributes configured
- [ ] Documentation complete
- [ ] Tests passing
- [ ] Build succeeds
- [ ] Links in README work
- [ ] Example code tested
- [ ] Sensitive files verified NOT in git
- [ ] GitHub repo created
- [ ] Announcement drafted

## 🆘 Rollback Plan

If you accidentally expose secrets:

1. **Immediately** rotate all exposed credentials
2. Delete the GitHub repo
3. Review all commits for sensitive data
4. Use `git filter-branch` or `BFG Repo-Cleaner` to remove from history
5. Create fresh repo with cleaned history

## 📞 Questions?

Review this checklist before publishing. Take your time, verify everything twice.

Good luck with the open source release! 🚀
