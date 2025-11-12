/**
 * Debug tool to search for LoginObj events on Nostr
 * This will help identify what environment tags exist for a given username
 */

import { SimplePool } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// Configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'ws://localhost:8080'
];

const NAMESPACE = 'nostrpass.com';
const ENVIRONMENTS = ['development', 'staging', 'production', 'prod', 'dev', 'test'];

function hash(input) {
  const data = new TextEncoder().encode(input);
  const digest = sha256(data);
  return bytesToHex(digest);
}

async function searchLoginObjects(username) {
  console.log('\n🔍 Searching for LoginObj events for username:', username);
  console.log('📡 Relays:', RELAYS);
  console.log('🏷️  Namespace:', NAMESPACE);
  console.log('🌍 Testing environments:', ENVIRONMENTS.join(', '));
  console.log('═'.repeat(80));

  const pool = new SimplePool();
  const usernameHash = hash(username);
  console.log(`\n🔑 Username hash: ${usernameHash}`);

  // Search for each environment
  for (const env of ENVIRONMENTS) {
    const dTag = `${NAMESPACE}_login_${usernameHash}_${env}`;
    console.log(`\n🔎 Searching for d-tag: ${dTag}`);

    const filter = {
      kinds: [30078],
      '#d': [dTag],
      limit: 10
    };

    try {
      const events = await pool.querySync(RELAYS, filter);

      if (events.length > 0) {
        console.log(`✅ FOUND ${events.length} event(s) for environment: "${env}"`);
        events.forEach((event, i) => {
          console.log(`\n   Event #${i + 1}:`);
          console.log(`   - ID: ${event.id}`);
          console.log(`   - Author (pubkey): ${event.pubkey}`);
          console.log(`   - Created: ${new Date(event.created_at * 1000).toISOString()}`);
          console.log(`   - Tags:`, event.tags);
          console.log(`   - Content (first 100 chars): ${event.content.substring(0, 100)}...`);

          try {
            const loginObj = JSON.parse(event.content);
            console.log(`   - Parsed LoginObj keys:`, Object.keys(loginObj));
            if (loginObj.storagePublicKey) {
              console.log(`   - Storage Public Key: ${loginObj.storagePublicKey}`);
            }
          } catch (e) {
            console.log(`   - ⚠️  Failed to parse content as JSON`);
          }
        });
      } else {
        console.log(`❌ No events found for environment: "${env}"`);
      }
    } catch (error) {
      console.error(`⚠️  Error searching environment "${env}":`, error.message);
    }
  }

  // Also do a broad search for ANY login events with this username hash
  console.log(`\n\n🔍 BROAD SEARCH: Looking for ANY events with username hash in d-tag...`);
  const broadFilter = {
    kinds: [30078],
    '#subject': ['login-lookup'],
    limit: 50
  };

  try {
    const allEvents = await pool.querySync(RELAYS, broadFilter);
    const matchingEvents = allEvents.filter(e => {
      const dTag = e.tags.find(t => t[0] === 'd')?.[1] || '';
      return dTag.includes(usernameHash);
    });

    if (matchingEvents.length > 0) {
      console.log(`✅ Found ${matchingEvents.length} events with matching username hash:`);
      matchingEvents.forEach((event, i) => {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
        console.log(`\n   Event #${i + 1}:`);
        console.log(`   - d-tag: ${dTag}`);
        console.log(`   - Created: ${new Date(event.created_at * 1000).toISOString()}`);

        // Try to extract environment from d-tag
        const envMatch = dTag.match(/_login_[a-f0-9]+_(.+)$/);
        if (envMatch) {
          console.log(`   - Detected environment: "${envMatch[1]}"`);
        }
      });
    } else {
      console.log(`❌ No matching events found in broad search`);
    }
  } catch (error) {
    console.error(`⚠️  Error in broad search:`, error.message);
  }

  pool.close(RELAYS);
  console.log('\n' + '═'.repeat(80));
  console.log('🏁 Search complete!\n');
}

// Get username from command line
const username = process.argv[2];

if (!username) {
  console.error('❌ Usage: node debug-login-search.js <username>');
  console.error('   Example: node debug-login-search.js iuyt');
  process.exit(1);
}

searchLoginObjects(username).catch(console.error);
