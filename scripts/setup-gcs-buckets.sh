#!/bin/bash
set -e

# NostrPass GCS Setup Script
# Creates and configures Google Cloud Storage buckets for CDN and Vault

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NostrPass GCS Bucket Setup${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}🔐 Please authenticate with Google Cloud...${NC}"
    gcloud auth login
fi

# Get project ID
echo -e "${YELLOW}📋 Enter your GCP Project ID:${NC}"
read -p "Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: Project ID is required${NC}"
    exit 1
fi

gcloud config set project $PROJECT_ID

echo ""
echo -e "${BLUE}Creating buckets for:${NC}"
echo "  - cdn.nostrpass.com (Provider SDK)"
echo "  - vault.nostrpass.com (Vault Application)"
echo ""

# Create CORS configuration file
echo -e "${YELLOW}📝 Creating CORS configuration...${NC}"
cat > /tmp/cors.json <<'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Cache-Control", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Function to create and configure bucket
setup_bucket() {
    local BUCKET_NAME=$1
    local BUCKET_URL="gs://${BUCKET_NAME}"

    echo ""
    echo -e "${BLUE}Setting up ${BUCKET_NAME}...${NC}"

    # Create bucket if it doesn't exist
    if gsutil ls -b $BUCKET_URL &>/dev/null; then
        echo -e "${YELLOW}⚠️  Bucket ${BUCKET_NAME} already exists${NC}"
    else
        echo -e "${YELLOW}📦 Creating bucket ${BUCKET_NAME}...${NC}"
        gsutil mb -p $PROJECT_ID -c STANDARD -l US $BUCKET_URL
        echo -e "${GREEN}✅ Bucket created${NC}"
    fi

    # Set bucket to serve as website
    echo -e "${YELLOW}🌐 Configuring bucket for static website hosting...${NC}"
    gsutil web set -m index.html -e 404.html $BUCKET_URL

    # Make bucket publicly readable
    echo -e "${YELLOW}🔓 Setting public read permissions...${NC}"
    gsutil iam ch allUsers:objectViewer $BUCKET_URL

    # Set CORS configuration
    echo -e "${YELLOW}🔄 Configuring CORS...${NC}"
    gsutil cors set /tmp/cors.json $BUCKET_URL

    echo -e "${GREEN}✅ ${BUCKET_NAME} configured successfully${NC}"
}

# Setup CDN bucket
setup_bucket "cdn.nostrpass.com"

# Setup Vault bucket
setup_bucket "vault.nostrpass.com"

# Cleanup
rm /tmp/cors.json

echo ""
echo -e "${GREEN}✅ All buckets created and configured!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Configure DNS (CloudFlare recommended):"
echo "   ${YELLOW}cdn.nostrpass.com${NC}   CNAME → c.storage.googleapis.com"
echo "   ${YELLOW}vault.nostrpass.com${NC} CNAME → c.storage.googleapis.com"
echo ""
echo "2. In CloudFlare, enable the ${YELLOW}orange cloud (Proxy)${NC} for both domains"
echo ""
echo "3. Deploy your applications:"
echo "   ${YELLOW}./scripts/deploy-cdn.sh${NC}   # Deploy provider SDK"
echo "   ${YELLOW}./scripts/deploy-vault.sh${NC} # Deploy vault app"
echo ""
echo -e "${BLUE}📍 Your URLs will be:${NC}"
echo "   https://cdn.nostrpass.com/embassy.js"
echo "   https://vault.nostrpass.com"
echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
