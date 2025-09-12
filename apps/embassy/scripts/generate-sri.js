#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;

function generateSRI(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

async function main() {
  const cdnDir = path.join(__dirname, `../dist/cdn/${version}`);
  const embassyPath = path.join(cdnDir, 'embassy.iife.js');
  
  if (!fs.existsSync(embassyPath)) {
    console.error('Embassy build not found. Run "npm run build:cdn" first.');
    process.exit(1);
  }
  
  const sri = generateSRI(embassyPath);
  const fileSize = (fs.statSync(embassyPath).size / 1024).toFixed(2);
  
  const snippet = `<!-- NostrPass Embassy v${version} -->
<script 
  src="https://cdn.nostrpass.com/embassy/${version}/embassy.iife.js"
  integrity="${sri}"
  crossorigin="anonymous"
  data-vault-url="https://vault.nostrpass.com"
></script>
<script>
  window.initNostrPass({
    appName: 'Your App Name',
    appDomain: window.location.hostname,
    permissions: ['social', 'messaging'] // Optional: request specific permissions
  });
</script>`;

  const output = {
    version,
    sri,
    fileSize: `${fileSize} KB`,
    snippet,
    cdnUrl: `https://cdn.nostrpass.com/embassy/${version}/embassy.iife.js`,
    unpkgUrl: `https://unpkg.com/@nostrpass/embassy@${version}/dist/cdn/${version}/embassy.iife.js`
  };
  
  // Write metadata
  fs.writeFileSync(
    path.join(cdnDir, 'metadata.json'),
    JSON.stringify(output, null, 2)
  );
  
  // Write snippet file
  fs.writeFileSync(
    path.join(cdnDir, 'snippet.html'),
    snippet
  );
  
  console.log('Embassy CDN Build Info:');
  console.log('========================');
  console.log(`Version: ${version}`);
  console.log(`File Size: ${fileSize} KB`);
  console.log(`SRI Hash: ${sri}`);
  console.log(`\nCDN URL: ${output.cdnUrl}`);
  console.log(`\nIntegration Snippet:\n${snippet}`);
}

main().catch(console.error);