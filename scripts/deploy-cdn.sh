#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="cdn.nostrpass.com"

echo -e "${GREEN}🚀 NostrPass CDN Deployment Script${NC}"
echo "=================================="

# Get current version from embassy package.json
CURRENT_VERSION=$(node -p "require('./apps/embassy/package.json').version")
echo -e "${YELLOW}📦 Current version: $CURRENT_VERSION${NC}"

# Auto-increment patch version
NEW_VERSION=$(node -p "
  const version = '$CURRENT_VERSION';
  const parts = version.split('.');
  parts[2] = parseInt(parts[2]) + 1;
  parts.join('.');
")
echo -e "${YELLOW}📦 New version: $NEW_VERSION${NC}"

# Update package.json version
node -e "
  const fs = require('fs');
  const path = './apps/embassy/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# Update hardcoded version in embassy.ts
sed -i.bak "s/Embassy v[0-9]*\.[0-9]*\.[0-9]*/Embassy v$NEW_VERSION/" apps/embassy/src/embassy.ts
rm apps/embassy/src/embassy.ts.bak

echo -e "${YELLOW}✅ Version bumped to $NEW_VERSION${NC}"

# Build Embassy
echo -e "${YELLOW}🔨 Building Embassy...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/embassy build

VERSION=$NEW_VERSION

# Upload versioned file
echo -e "${YELLOW}📤 Uploading versioned file: embassy@${VERSION}.js${NC}"
gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/javascript" \
       cp apps/embassy/dist/embassy.iife.js \
       gs://$BUCKET_NAME/embassy@${VERSION}.js

# Upload latest file (always named embassy.js)
echo -e "${YELLOW}📤 Uploading latest file: embassy.js${NC}"
gsutil -h "Cache-Control:public, max-age=3600" \
       -h "Content-Type:application/javascript" \
       cp apps/embassy/dist/embassy.iife.js \
       gs://$BUCKET_NAME/embassy.js

echo ""
echo -e "${GREEN}✅ CDN Deployment Complete!${NC}"
echo ""
echo "🔗 URLs:"
echo "  - Latest: https://cdn.nostrpass.com/embassy.js"
echo "  - Version $VERSION: https://cdn.nostrpass.com/embassy@${VERSION}.js"
echo ""
echo "📋 Usage:"
echo "  <script src=\"https://cdn.nostrpass.com/embassy.js\"></script>"

# Commit version bump
echo ""
echo -e "${YELLOW}📝 Committing version bump...${NC}"
git add apps/embassy/package.json apps/embassy/src/embassy.ts
git commit -m "chore: Bump embassy version to $VERSION

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo -e "${GREEN}✅ Version $VERSION committed${NC}"