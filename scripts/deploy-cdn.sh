#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="nostrpass-cdn"

echo -e "${GREEN}🚀 NostrPass CDN Deployment Script${NC}"
echo "=================================="

# Get version from embassy package.json
VERSION=$(node -p "require('./apps/embassy/package.json').version")
echo -e "${YELLOW}📦 Deploying Embassy version: $VERSION${NC}"

# Build Embassy
echo -e "${YELLOW}🔨 Building Embassy...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/embassy build

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