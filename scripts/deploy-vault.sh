#!/bin/bash
set -e

# NostrPass Vault Deployment Script
# Deploys vault application to Firebase Hosting

# Configuration
VAULT_URL="https://vault.nostrpass.com"
FIREBASE_CONFIG="firebase-vault.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NostrPass Vault Deployment${NC}"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Error: Firebase CLI is not installed${NC}"
    echo "Install with: npm install -g firebase-tools"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Build the vault application
echo -e "${YELLOW}📦 Building vault application...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/vault build

if [ ! -d "apps/vault/dist" ]; then
    echo -e "${RED}❌ Error: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}"

# Deploy to Firebase Hosting
echo -e "${YELLOW}📤 Deploying vault to Firebase Hosting...${NC}"
firebase deploy --only hosting --config $FIREBASE_CONFIG

echo ""
echo -e "${GREEN}✅ Vault Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📍 Firebase URL: https://vault-nostrpass.web.app${NC}"
echo -e "${BLUE}📍 Custom URL:   ${VAULT_URL}${NC}"
echo ""

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
