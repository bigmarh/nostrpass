#!/bin/bash
set -e

# NostrPass Lite Vault Deployment Script
# Deploys lite-vault SPA to Google Cloud Storage

BUCKET_NAME="lite-vault.nostrpass.com"
BUCKET_URL="gs://${BUCKET_NAME}"
DIST_DIR="apps/lite-vault/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 NostrPass Lite Vault Deployment${NC}"
echo "==================================="

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

# Create bucket if it doesn't exist
if ! gsutil ls -b $BUCKET_URL &>/dev/null; then
    echo -e "${YELLOW}📦 Creating bucket ${BUCKET_NAME}...${NC}"
    PROJECT_ID=$(gcloud config get-value project)
    gsutil mb -p "$PROJECT_ID" -c STANDARD -l US $BUCKET_URL

    # Configure as static website (index.html for everything)
    gsutil web set -m index.html -e index.html $BUCKET_URL

    # Public read
    gsutil iam ch allUsers:objectViewer $BUCKET_URL

    # CORS — allow any origin to load the iframe
    cat > /tmp/lite-vault-cors.json <<'CORS'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Cache-Control", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
CORS
    gsutil cors set /tmp/lite-vault-cors.json $BUCKET_URL
    rm /tmp/lite-vault-cors.json

    echo -e "${GREEN}✅ Bucket created and configured${NC}"
else
    echo -e "${YELLOW}ℹ️  Bucket ${BUCKET_NAME} already exists${NC}"
fi

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

echo ""
echo -e "${GREEN}✅ Lite Vault Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📍 GCS URL:    https://storage.googleapis.com/${BUCKET_NAME}/index.html${NC}"
echo -e "${BLUE}📍 Custom URL: https://lite-vault.nostrpass.com${NC}"
echo ""
echo -e "${YELLOW}DNS (if not already set):${NC}"
echo "  lite-vault.nostrpass.com  CNAME → c.storage.googleapis.com"
echo ""
echo -e "${YELLOW}Usage in your app:${NC}"
echo "  window.initNostrPassLite({ vaultUrl: 'https://lite-vault.nostrpass.com/' })"
