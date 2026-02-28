#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUCKET_NAME="cdn.nostrpass.com"

echo -e "${GREEN}🚀 NostrPass Lite CDN Deployment Script${NC}"
echo "========================================="

CURRENT_VERSION=$(node -p "require('./apps/lite-embassy/package.json').version")
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
  const path = './apps/lite-embassy/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo -e "${YELLOW}✅ Version bumped to $NEW_VERSION${NC}"

# Build
echo -e "${YELLOW}🔨 Building lite-embassy CDN bundle...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/lite-embassy build:cdn

VERSION=$NEW_VERSION
DIST_FILE="apps/lite-embassy/dist/cdn/${VERSION}/lite-embassy.iife.js"

# Upload versioned file (immutable)
echo -e "${YELLOW}📤 Uploading versioned file: lite-embassy@${VERSION}.js${NC}"
gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/javascript" \
       cp "$DIST_FILE" \
       gs://$BUCKET_NAME/lite-embassy@${VERSION}.js

# Upload latest file (short cache)
echo -e "${YELLOW}📤 Uploading latest file: lite-embassy.js${NC}"
gsutil -h "Cache-Control:public, max-age=3600" \
       -h "Content-Type:application/javascript" \
       cp "$DIST_FILE" \
       gs://$BUCKET_NAME/lite-embassy.js

echo ""
echo -e "${GREEN}✅ Lite CDN Deployment Complete!${NC}"
echo ""
echo "🔗 URLs:"
echo "  - Latest:    https://cdn.nostrpass.com/lite-embassy.js"
echo "  - Versioned: https://cdn.nostrpass.com/lite-embassy@${VERSION}.js"
echo ""
echo "📋 Usage:"
echo "  <script src=\"https://cdn.nostrpass.com/lite-embassy.js\" data-auto-init></script>"

# Commit version bump
echo ""
echo -e "${YELLOW}📝 Committing version bump...${NC}"
git add apps/lite-embassy/package.json
git commit -m "chore: Bump lite-embassy version to $VERSION

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo -e "${GREEN}✅ Version $VERSION committed${NC}"
