#!/bin/bash
set -e

# Configuration
PROJECT_ID="nostrpass-prod"
BUCKET_NAME="nostrpass-cdn"
DOMAIN="cdn.nostrpass.com"

echo "🚀 NostrPass CDN Deployment Script"
echo "=================================="

# Get version from embassy package.json
VERSION=$(node -p "require('./apps/embassy/package.json').version")
echo "📦 Deploying Embassy version: $VERSION"

# Build Embassy for CDN
echo "🔨 Building Embassy for CDN..."
cd apps/embassy
npm run build:cdn
npm run generate:sri
cd ../..

# Create GCS bucket if it doesn't exist
echo "☁️ Setting up Google Cloud Storage..."
if ! gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
  gsutil mb -p $PROJECT_ID -c STANDARD -l US gs://$BUCKET_NAME
  gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
fi

# Set CORS configuration
cat > cors.json <<EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set cors.json gs://$BUCKET_NAME
rm cors.json

# Upload Embassy versioned files
echo "📤 Uploading Embassy to CDN..."
gsutil -h "Cache-Control:public, max-age=31536000, immutable" \
       -h "Content-Type:application/javascript" \
       cp -r apps/embassy/dist/cdn/$VERSION/* \
       gs://$BUCKET_NAME/embassy/$VERSION/

# Upload latest symlink
echo "🔗 Creating latest symlink..."
echo $VERSION > latest.txt
gsutil -h "Cache-Control:public, max-age=300" \
       cp latest.txt gs://$BUCKET_NAME/embassy/latest.txt
rm latest.txt

# Copy to latest directory
gsutil -h "Cache-Control:public, max-age=3600" \
       cp -r apps/embassy/dist/cdn/$VERSION/* \
       gs://$BUCKET_NAME/embassy/latest/

# Set up Cloud CDN if not already configured
if ! gcloud compute backend-buckets describe nostrpass-cdn-backend &>/dev/null; then
  echo "🌐 Setting up Cloud CDN..."
  
  # Create backend bucket
  gcloud compute backend-buckets create nostrpass-cdn-backend \
    --gcs-bucket-name=$BUCKET_NAME \
    --enable-cdn
  
  # Reserve static IP
  gcloud compute addresses create nostrpass-cdn-ip --global
  
  # Get the IP address
  IP=$(gcloud compute addresses describe nostrpass-cdn-ip --global --format="value(address)")
  echo "📍 Static IP: $IP"
  echo "⚠️  Please add an A record for $DOMAIN pointing to $IP"
  
  # Create SSL certificate
  gcloud compute ssl-certificates create nostrpass-cdn-cert \
    --domains=$DOMAIN \
    --global
  
  # Create URL map
  gcloud compute url-maps create nostrpass-cdn-lb \
    --default-backend-bucket=nostrpass-cdn-backend
  
  # Create HTTPS proxy
  gcloud compute target-https-proxies create nostrpass-cdn-https \
    --url-map=nostrpass-cdn-lb \
    --ssl-certificates=nostrpass-cdn-cert \
    --global
  
  # Create forwarding rule
  gcloud compute forwarding-rules create nostrpass-cdn-https-rule \
    --global \
    --address=nostrpass-cdn-ip \
    --target-https-proxy=nostrpass-cdn-https \
    --ports=443
fi

# Purge CDN cache for latest
echo "🧹 Purging CDN cache..."
gcloud compute url-maps invalidate-cdn-cache nostrpass-cdn-lb \
  --path="/embassy/latest/*" \
  --global

echo "✅ CDN Deployment Complete!"
echo ""
echo "📋 Integration Snippet:"
echo "========================"
cat apps/embassy/dist/cdn/$VERSION/snippet.html
echo ""
echo "🔗 URLs:"
echo "  - Versioned: https://$DOMAIN/embassy/$VERSION/embassy.iife.js"
echo "  - Latest: https://$DOMAIN/embassy/latest/embassy.iife.js"
echo "  - Direct GCS: https://storage.googleapis.com/$BUCKET_NAME/embassy/$VERSION/embassy.iife.js"