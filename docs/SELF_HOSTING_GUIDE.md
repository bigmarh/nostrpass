# Self-Hosting NostrPass: Complete Guide

This guide explains how to deploy your own NostrPass vault instance, making NostrPass truly yours while remaining compatible with the open protocol.

## Why Self-Host?

- **Full Control**: Your vault, your rules
- **Privacy**: Data never touches third-party servers (except Nostr relays you choose)
- **Custom Branding**: Make it yours
- **Independence**: Not reliant on nostrpass.com
- **Protocol Compatible**: Works with any NPS-01 compatible app

## Architecture Overview

```
Your Domain (vault.example.com)
├── Vault App (SolidJS frontend)
├── Static Assets
└── Embassy SDK (optional: self-serve)

Your Nostr Relays (optional)
├── relay1.example.com
├── relay2.example.com
└── Public relays (Damus, nos.lol, etc.)
```

## Prerequisites

- Node.js 18+ and pnpm
- A domain name (e.g., `vault.example.com`)
- SSL certificate (Let's Encrypt recommended)
- Basic understanding of web hosting

## Part 1: Building Your Vault

### 1.1 Clone and Configure

```bash
# Clone the repository
git clone https://github.com/yourusername/nostrpass.com
cd nostrpass.com

# Install dependencies
pnpm install

# Navigate to the vault app
cd apps/vault
```

### 1.2 Configure Your Namespace

Edit your configuration to use your custom namespace:

```typescript
// In your app initialization or config file
import { configureNostrPass } from '@nostrpass/nostrHelpers';

configureNostrPass({
  namespace: 'vault.example.com',     // Your custom namespace
  environment: 'production',
  relays: [
    'wss://relay.example.com',        // Your relay (optional)
    'wss://relay.damus.io',           // Public relays
    'wss://nos.lol',
    'wss://relay.nostr.band'
  ],
  debug: false
});
```

### 1.3 Environment Variables

Create a `.env.production` file:

```bash
# Vault Configuration
VITE_VAULT_ORIGIN=https://vault.example.com
VITE_NAMESPACE=vault.example.com
VITE_ENVIRONMENT=production

# Nostr Relays (comma-separated)
VITE_DEFAULT_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band

# Feature Flags
VITE_ENABLE_BIOMETRIC=true
VITE_ENABLE_RECOVERY=true
VITE_ENABLE_MULTI_IDENTITY=true

# Optional: Analytics/Monitoring
VITE_SENTRY_DSN=your_sentry_dsn
```

### 1.4 Build the Vault

```bash
# Build for production
pnpm build

# Output will be in apps/vault/dist/
```

## Part 2: Deployment Options

### Option A: Static Hosting (Recommended)

Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.):

#### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd apps/vault
vercel --prod
```

**vercel.json:**
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "ALLOW-FROM *"
        },
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors *"
        }
      ]
    }
  ]
}
```

#### Netlify

```bash
# netlify.toml
[build]
  command = "pnpm build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "ALLOW-FROM *"
    Content-Security-Policy = "frame-ancestors *"
```

#### Cloudflare Pages

```bash
# Deploy via dashboard or CLI
wrangler pages publish dist --project-name=nostrpass-vault
```

### Option B: Self-Hosted Server (Advanced)

Using nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name vault.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/vault;
    index index.html;

    # Enable iframe embedding
    add_header X-Frame-Options "ALLOW-FROM *" always;
    add_header Content-Security-Policy "frame-ancestors *" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Option C: Docker

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/apps/vault/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build and run:**
```bash
docker build -t nostrpass-vault .
docker run -p 80:80 nostrpass-vault
```

## Part 3: Embassy SDK Configuration

Apps using your vault need to configure the Embassy SDK:

### For Third-Party Apps

Update their integration to point to your vault:

```html
<script src="https://vault.example.com/embassy.js"></script>
<script>
  window.initNostrPass({
    vaultUrl: 'https://vault.example.com',
    trustedOrigins: ['https://vault.example.com'],
    appName: 'My App',
    appDomain: 'myapp.com'
  });
</script>
```

### Build Your Own Embassy SDK

```bash
cd apps/embassy

# Build the SDK
pnpm build:lib

# Output: dist-lib/embassy.js
# Host this file at https://vault.example.com/embassy.js
```

## Part 4: DNS and SSL

### 4.1 DNS Configuration

```
A record: vault.example.com → Your server IP
CNAME: www.vault.example.com → vault.example.com
```

### 4.2 SSL Certificate (Let's Encrypt)

```bash
# Using certbot
sudo certbot certonly --standalone -d vault.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Part 5: Testing Your Deployment

### 5.1 Verify Vault Loads

```bash
curl https://vault.example.com
# Should return your vault HTML
```

### 5.2 Test Embassy Integration

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>NostrPass Test</title>
</head>
<body>
  <h1>Testing Self-Hosted Vault</h1>
  <button onclick="testGetPublicKey()">Get Public Key</button>
  <pre id="output"></pre>

  <script src="https://vault.example.com/embassy.js"></script>
  <script>
    window.initNostrPass({
      vaultUrl: 'https://vault.example.com',
      trustedOrigins: ['https://vault.example.com'],
      debug: true
    });

    async function testGetPublicKey() {
      try {
        const pubkey = await window.nostr.getPublicKey();
        document.getElementById('output').textContent =
          'Success! Public Key: ' + pubkey;
      } catch (err) {
        document.getElementById('output').textContent =
          'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>
```

### 5.3 Verify Nostr Events

Check that your vault is publishing events with your namespace:

```bash
# Use a Nostr client or CLI to query
# Look for events with d-tag: "vault.example.com_login_..."
```

## Part 6: Customization

### 6.1 Branding

Update colors, logo, and styling in `apps/vault/src/`:

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        secondary: '#your-color',
      }
    }
  }
}
```

### 6.2 Features

Enable/disable features in your config:

```typescript
// apps/vault/src/config/features.ts
export const features = {
  biometric: true,
  recovery: true,
  multiIdentity: true,
  hardwareWallet: false,
  customThemes: true
};
```

## Part 7: Maintenance

### 7.1 Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
pnpm build
# Deploy via your chosen method
```

### 7.2 Monitoring

Set up monitoring for:
- Uptime (UptimeRobot, Pingdom)
- SSL expiry
- Error tracking (Sentry)
- Analytics (optional, privacy-respecting)

### 7.3 Backups

**Important**: Users' data is stored on Nostr relays, not your server. However, backup your:
- Configuration files
- Custom modifications
- SSL certificates
- Server configs

## Part 8: Advanced Configuration

### 8.1 Custom Relay Network

Run your own Nostr relay:

```bash
# Using nostr-rs-relay
git clone https://github.com/scsibug/nostr-rs-relay
cd nostr-rs-relay
cargo build --release

# Configure and run
./target/release/nostr-rs-relay --config config.toml
```

Update your vault config to prioritize your relay:

```typescript
relays: [
  'wss://relay.example.com',  // Your relay (first priority)
  'wss://relay.damus.io',      // Fallback public relays
  'wss://nos.lol',
]
```

### 8.2 Custom Domain for Embassy SDK

Host the SDK on a CDN:

```bash
# Upload embassy.js to CDN
aws s3 cp dist-lib/embassy.js s3://your-cdn-bucket/embassy.js
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/embassy.js"
```

Users can then integrate:
```html
<script src="https://cdn.example.com/embassy.js"></script>
```

### 8.3 Multi-Environment Setup

Run multiple environments on subdomains:

```
vault.example.com       → Production
staging.vault.example.com → Staging
dev.vault.example.com   → Development
```

Each with different namespace configs.

## Security Considerations

### Required Headers

```nginx
# Prevent clickjacking (while allowing embedding in iframes)
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "frame-ancestors 'self' *" always;

# XSS Protection
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# HTTPS only
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Firewall Rules

```bash
# Allow only HTTPS
ufw allow 443/tcp
ufw allow 80/tcp  # For Let's Encrypt renewal
ufw enable
```

### Regular Updates

```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## Troubleshooting

### Issue: Vault doesn't load in iframe

**Solution**: Check CSP headers, ensure `frame-ancestors` allows embedding

### Issue: Can't connect to Nostr relays

**Solution**:
- Verify relay URLs are correct
- Check firewall isn't blocking websocket connections
- Test relays directly: `wscat -c wss://relay.damus.io`

### Issue: Users can't log in

**Solution**:
- Verify namespace is consistent across all configs
- Check browser console for errors
- Ensure SSL certificate is valid

### Issue: Cross-origin errors

**Solution**:
- Verify `trustedOrigins` in embassy config
- Check CORS headers on your server
- Ensure vaultUrl matches actual domain

## Migration from nostrpass.com

To migrate existing users:

1. **Export Data**: Users export their vault data
2. **Change Namespace**: Update to your new namespace
3. **Re-import**: Import into your vault
4. **Republish**: Events republished with new namespace

**Migration script:**
```typescript
import { configureNostrPass } from '@nostrpass/nostrHelpers';

// Old namespace
configureNostrPass({ namespace: 'nostrpass.com' });
const oldData = await exportVaultData();

// New namespace
configureNostrPass({ namespace: 'vault.example.com' });
await importVaultData(oldData);
```

## Support and Community

- **Documentation**: [Protocol Specification](PROTOCOL_SPECIFICATION.md)
- **Issues**: GitHub Issues
- **Community**: Nostr (npub...)
- **Updates**: Follow development on Nostr/GitHub

## Compliance Badge

Once deployed and tested, your vault can claim:

> ✅ **NostrPass Protocol (NPS-01) Compatible**

Run the compliance test suite:
```bash
pnpm test:compliance
```

## License

Your self-hosted instance inherits the license of this codebase. You're free to:
- Use commercially
- Modify and customize
- Distribute your version

Just maintain the open-source license if redistributing.

---

**Questions?** Open an issue or reach out on Nostr!

**Happy Self-Hosting! 🚀**
