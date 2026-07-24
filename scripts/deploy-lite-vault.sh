#!/bin/bash
set -e

# NostrPass Lite Vault Deployment Script
# Deploys lite-vault SPA to Google Cloud Storage

BUCKET_NAME="cdn.nostrpass.com"
BUCKET_PREFIX="lite-vault"
BUCKET_URL="gs://${BUCKET_NAME}/${BUCKET_PREFIX}"
DIST_DIR="apps/lite-vault/dist"
GCP_PROJECT="${GCP_PROJECT:-nostrpass}"
GCLOUD_CONFIG="${GCLOUD_CONFIG:-nostrpass}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 NostrPass Lite Vault Deployment${NC}"
echo "==================================="

# Switch to the nostrpass gcloud config
echo -e "${YELLOW}🔧 Activating gcloud config: ${GCLOUD_CONFIG}${NC}"
gcloud config configurations activate "$GCLOUD_CONFIG" 2>/dev/null || {
    echo -e "${RED}❌ Config '${GCLOUD_CONFIG}' not found.${NC}"
    echo "Run: gcloud config configurations create nostrpass"
    echo "     gcloud auth login  # use the account that owns nostrpass.firebaseapp.com"
    echo "     gcloud config set project nostrpass"
    exit 1
}

# Checks
if ! command -v gsutil &> /dev/null; then
    echo -e "${RED}❌ gsutil not found. Install Google Cloud SDK.${NC}"
    exit 1
fi
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud not found. Install Google Cloud SDK.${NC}"
    exit 1
fi
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Must run from project root.${NC}"
    exit 1
fi

# Build
echo -e "${YELLOW}📦 Building lite-vault...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/lite-vault build

if [ ! -d "$DIST_DIR" ]; then
    echo -e "${RED}❌ Build failed — dist not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build complete${NC}"

# Upload hashed assets — long cache, immutable
echo -e "${YELLOW}📤 Uploading assets (immutable)...${NC}"
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" \
    rsync -r -c \
    "${DIST_DIR}/assets/" \
    "${BUCKET_URL}/assets/"

# Upload logo.svg — long cache
if [ -f "${DIST_DIR}/logo.svg" ]; then
    gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
           -h "Content-Type:image/svg+xml" \
        cp "${DIST_DIR}/logo.svg" "${BUCKET_URL}/logo.svg"
fi

# Upload index.html — no cache (always fetch fresh)
echo -e "${YELLOW}📤 Uploading index.html (no-cache)...${NC}"
gsutil -h "Cache-Control:no-cache, must-revalidate" \
       -h "Content-Type:text/html" \
    cp "${DIST_DIR}/index.html" "${BUCKET_URL}/index.html"

# Upload auth.html — top-level Google auth popup page, no cache
echo -e "${YELLOW}📤 Uploading auth.html (no-cache)...${NC}"
gsutil -h "Cache-Control:no-cache, must-revalidate" \
       -h "Content-Type:text/html" \
    cp "${DIST_DIR}/auth.html" "${BUCKET_URL}/auth.html"

echo ""
echo -e "${GREEN}✅ Lite Vault Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📍 URL: https://cdn.nostrpass.com/lite-vault/index.html${NC}"
echo ""
echo -e "${YELLOW}Usage in your app:${NC}"
echo "  window.initNostrPassLite({ vaultUrl: 'https://cdn.nostrpass.com/lite-vault/' })"
