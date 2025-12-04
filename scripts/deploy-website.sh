#!/bin/bash
set -e

# NostrPass Marketing Site Deployment Script
# Deploys website to Firebase Hosting (nostrpass.com)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NostrPass Marketing Site Deployment${NC}"
echo ""

# Check if firebase CLI is installed
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

# Build the frontend app
echo -e "${YELLOW}📦 Building frontend app...${NC}"
NODE_ENV=production pnpm --filter @nostrpass/frontend build

if [ ! -d "apps/frontend/dist" ]; then
    echo -e "${RED}❌ Error: Build failed - apps/frontend/dist directory not found${NC}"
    exit 1
fi

echo -e "${YELLOW}✓ Frontend built to apps/frontend/dist${NC}"

echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Deploy to Firebase
echo -e "${YELLOW}🚀 Deploying to Firebase Hosting...${NC}"
firebase deploy --only hosting

echo ""
echo -e "${GREEN}✅ Marketing Site Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo -e "   🌐 Production: ${BLUE}https://nostrpass.com${NC}"
echo -e "   🌐 Firebase:   ${BLUE}https://nostrpass.web.app${NC}"
echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
