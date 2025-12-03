#!/bin/bash
set -e

# NostrPass Complete Deployment Script
# Deploys both CDN (embassy SDK) and Vault in one go

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}"
echo "╔════════════════════════════════════════╗"
echo "║   NostrPass Complete Deployment        ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Step 1: Deploy CDN
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📤 Step 1/4: Deploying Embassy SDK to CDN...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/deploy-cdn.sh

echo ""

# Step 2: Deploy Vault
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📤 Step 2/4: Deploying Vault Application...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/deploy-vault.sh

echo ""

# Step 3: Deploy Website
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📤 Step 3/4: Deploying Marketing Website...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

./scripts/deploy-website.sh

echo ""

# Step 4: Purge CloudFlare cache
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔄 Step 4/4: Purging CloudFlare cache...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f ".env.production" ]; then
    source .env.production

    if [ ! -z "$CLOUDFLARE_ZONE_ID" ] && [ ! -z "$CLOUDFLARE_API_TOKEN" ]; then
        echo -e "${YELLOW}Purging CloudFlare cache...${NC}"

        PURGE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{"purge_everything":true}')

        if echo "$PURGE_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ CloudFlare cache purged${NC}"
        else
            echo -e "${YELLOW}⚠️  CloudFlare cache purge may have failed${NC}"
            echo "$PURGE_RESPONSE"
        fi
    else
        echo -e "${YELLOW}⚠️  CloudFlare credentials not found in .env.production${NC}"
        echo -e "${YELLOW}💡 Manually purge cache at: https://dash.cloudflare.com${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.production not found${NC}"
    echo -e "${YELLOW}💡 Manually purge cache at: https://dash.cloudflare.com${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${MAGENTA}📍 Your NostrPass URLs:${NC}"
echo -e "   🌐 Website: ${BLUE}https://nostrpass.com${NC}"
echo -e "   🔐 Vault:   ${BLUE}https://vault.nostrpass.com${NC}"
echo -e "   📦 CDN:     ${BLUE}https://cdn.nostrpass.com/embassy.js${NC}"
echo ""
echo -e "${GREEN}🎉 NostrPass is live and ready for beta!${NC}"
echo ""
