# NostrPass Deployment and Production Guide

## Overview

This guide covers everything needed to deploy NostrPass to production, including infrastructure requirements, deployment steps, configuration, monitoring, and maintenance.

## Infrastructure Requirements

### 1. Hosting Requirements

**Minimum Requirements:**
- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100Mbps
- **SSL**: Required (HTTPS only)

**Recommended Production Setup:**
- **CPU**: 4+ vCPUs
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: 1Gbps
- **CDN**: CloudFlare or similar
- **Load Balancer**: For high availability

### 2. Domain Configuration

**Required Domains:**
```
nostrpass.com              # Main marketing site
vault.nostrpass.com        # Vault application
app.nostrpass.com          # Demo/test application
api.nostrpass.com          # API endpoints (future)
cdn.nostrpass.com          # Static assets
```

**DNS Configuration:**
```dns
# A Records
nostrpass.com.         A     1.2.3.4
vault.nostrpass.com.   A     1.2.3.5
app.nostrpass.com.     A     1.2.3.6

# CNAME Records (if using CDN)
cdn.nostrpass.com.     CNAME cdn-provider.com

# CAA Records (Certificate Authority Authorization)
nostrpass.com.         CAA   0 issue "letsencrypt.org"
```

### 3. SSL/TLS Configuration

**Certificate Requirements:**
- Valid SSL certificates for all domains
- TLS 1.2 minimum (TLS 1.3 recommended)
- Strong cipher suites only
- HSTS enabled

**Nginx SSL Configuration:**
```nginx
# SSL Configuration
ssl_certificate /etc/ssl/certs/nostrpass.com.crt;
ssl_certificate_key /etc/ssl/private/nostrpass.com.key;

# Modern SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;

# HSTS
add_header Strict-Transport-Security "max-age=63072000" always;
```

## Build and Deployment

### 1. Environment Configuration

**Production Environment Variables:**
```bash
# .env.production
NODE_ENV=production
VITE_ENVIRONMENT=production
VITE_VAULT_URL=https://vault.nostrpass.com
# If using IIFE build, point to provider bundle
VITE_PROVIDER_URL=https://cdn.nostrpass.com/provider/index.iife.js
VITE_NOSTR_RELAYS=wss://relay.nostr.band,wss://relay.damus.io,wss://nos.lol
VITE_SENTRY_DSN=your-sentry-dsn
VITE_GA_ID=your-google-analytics-id
```

### 2. Build Process

**Local Build:**
```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific apps/packages
npm run build:vault
pnpm --filter @nostrpass/provider build
```

**CI/CD Pipeline (GitHub Actions):**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build production
      run: npm run build
      env:
        NODE_ENV: production
    
    - name: Deploy Vault
      run: |
        rsync -avz --delete \
          ./apps/vault/dist/ \
          user@vault.nostrpass.com:/var/www/vault/
    
    - name: Deploy Provider SDK
      run: |
        rsync -avz --delete \
          ./packages/provider/dist/ \
          user@cdn.nostrpass.com:/var/www/provider/
    
    - name: Purge CDN Cache
      run: |
        curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
          -H "Authorization: Bearer $CF_API_TOKEN" \
          -H "Content-Type: application/json" \
          --data '{"purge_everything":true}'
```

### 3. Server Configuration

**Nginx Configuration for Vault:**
```nginx
server {
    listen 443 ssl http2;
    server_name vault.nostrpass.com;
    
    root /var/www/vault;
    index index.html;
    
    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://*.nostr.band wss://*.damus.io https://*.nostrpass.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    
    # Permissions Policy
    add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;
    
    # SPA Configuration
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**Provider CDN Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name cdn.nostrpass.com;
    
    root /var/www/provider;
    
    # CORS Headers for SDK
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    
    # Cache Headers
    location ~* \.(js|css)$ {
        expires 1d;
        add_header Cache-Control "public, must-revalidate";
    }
}
```

## Security Configuration

### 1. Content Security Policy

**Vault CSP:**
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' wss://*.nostr.band wss://*.damus.io https://*.nostrpass.com;
  frame-ancestors https://*.nostrpass.com https://localhost:* http://localhost:*;
  base-uri 'self';
  form-action 'self';
">
```

### 2. CORS Configuration

**Allowed Origins:**
```javascript
// Production origins
const allowedOrigins = [
  'https://nostrpass.com',
  'https://app.nostrpass.com',
  'https://vault.nostrpass.com'
];

// Staging origins (if applicable)
const stagingOrigins = [
  'https://staging.nostrpass.com',
  'https://vault-staging.nostrpass.com'
];
```

### 3. Rate Limiting

**Nginx Rate Limiting:**
```nginx
# Define rate limit zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Apply rate limits
location /api/ {
    limit_req zone=api burst=20 nodelay;
}

location /auth/ {
    limit_req zone=auth burst=5 nodelay;
}
```

## Monitoring and Logging

### 1. Application Monitoring

**Sentry Integration:**
```javascript
// Vault app initialization
import * as Sentry from "@sentry/browser";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Remove sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    }
  });
}
```

**Health Check Endpoint:**
```javascript
// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString()
  });
});
```

### 2. Server Monitoring

**Essential Metrics:**
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- SSL certificate expiry
- Response times
- Error rates

**Prometheus Configuration:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nostrpass-vault'
    static_configs:
      - targets: ['vault.nostrpass.com:9090']
  
  - job_name: 'nginx'
    static_configs:
      - targets: ['vault.nostrpass.com:9113']
```

### 3. Log Management

**Application Logs:**
```javascript
// Structured logging
const logger = {
  info: (message, data) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      ...data,
      timestamp: new Date().toISOString()
    }));
  },
  error: (message, error, data) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error.stack,
      ...data,
      timestamp: new Date().toISOString()
    }));
  }
};
```

**Log Aggregation:**
```bash
# Ship logs to centralized logging
journalctl -u nostrpass-vault -f | \
  jq -c '. + {host: "vault.nostrpass.com"}' | \
  nc logserver.example.com 5140
```

## Database and Storage

### 1. Backup Strategy

**Client-Side Data:**
- IndexedDB data is client-side only
- Users responsible for their vault backup
- Nostr network provides distributed backup

**Server Logs:**
```bash
# Daily log backup
0 2 * * * tar -czf /backup/logs/$(date +\%Y\%m\%d).tar.gz /var/log/nginx/
```

### 2. Nostr Relay Configuration

**Recommended Relays:**
```javascript
const productionRelays = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io', 
  'wss://nos.lol',
  'wss://relay.nostr.bg',
  'wss://relay.snort.social'
];
```

## Performance Optimization

### 1. Frontend Optimization

**Build Optimization:**
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['solid-js', '@solidjs/router'],
          'crypto': ['@noble/curves', '@noble/hashes'],
          'nostr': ['nostr-tools']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
};
```

**Resource Hints:**
```html
<!-- Preconnect to required origins -->
<link rel="preconnect" href="https://vault.nostrpass.com">
<link rel="preconnect" href="wss://relay.nostr.band">

<!-- Preload critical resources -->
<link rel="preload" href="/js/app.js" as="script">
<link rel="preload" href="/css/app.css" as="style">
```

### 2. Caching Strategy

**Service Worker:**
```javascript
// sw.js
const CACHE_NAME = 'nostrpass-v1';
const urlsToCache = [
  '/',
  '/css/app.css',
  '/js/app.js',
  '/js/worker.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

## Disaster Recovery

### 1. Backup Procedures

**Critical Components:**
- SSL certificates
- Nginx configurations
- Environment variables
- DNS configurations
- Deployment scripts

**Backup Script:**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup configurations
tar -czf $BACKUP_DIR/nginx.tar.gz /etc/nginx/
tar -czf $BACKUP_DIR/ssl.tar.gz /etc/ssl/
cp /home/deploy/.env* $BACKUP_DIR/

# Sync to remote
rsync -avz $BACKUP_DIR/ backup-server:/backups/nostrpass/
```

### 2. Recovery Procedures

**Service Recovery Checklist:**
1. ✓ Restore DNS if needed
2. ✓ Provision new servers
3. ✓ Install dependencies
4. ✓ Restore configurations
5. ✓ Deploy application code
6. ✓ Verify SSL certificates
7. ✓ Test all endpoints
8. ✓ Monitor for issues

## Maintenance

### 1. Regular Tasks

**Daily:**
- Monitor error logs
- Check SSL certificate validity
- Review security alerts

**Weekly:**
- Update dependencies
- Review performance metrics
- Test backup procedures

**Monthly:**
- Security updates
- Performance optimization
- Capacity planning

### 2. Update Procedures

**Zero-Downtime Deployment:**
```bash
#!/bin/bash
# deploy.sh

# Build new version
npm run build

# Deploy to staging
rsync -avz ./dist/ staging-server:/var/www/vault-new/

# Test staging
curl -f https://staging.vault.nostrpass.com/health || exit 1

# Atomic switch
ssh production-server "ln -sfn /var/www/vault-new /var/www/vault"

# Reload nginx
ssh production-server "nginx -s reload"
```

## Production Checklist

### Pre-Launch
- [ ] SSL certificates configured
- [ ] Security headers implemented
- [ ] CSP policy tested
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation complete

### Post-Launch
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review user feedback
- [ ] Update documentation
- [ ] Plan improvements

## Support and Incident Response

### 1. Incident Response Plan

**Severity Levels:**
- **P1**: Service down (< 30 min response)
- **P2**: Major feature broken (< 2 hour response)
- **P3**: Minor issues (< 24 hour response)

**Response Procedure:**
1. Acknowledge incident
2. Assess impact
3. Communicate status
4. Implement fix
5. Verify resolution
6. Post-mortem analysis

### 2. Support Channels

**User Support:**
- Email: support@nostrpass.com
- GitHub Issues: github.com/nostrpass/nostrpass
- Nostr: @nostrpass

**Developer Support:**
- Documentation: docs.nostrpass.com
- API Status: status.nostrpass.com
- Discord: discord.gg/nostrpass

This comprehensive deployment guide ensures a secure, performant, and maintainable production environment for NostrPass.