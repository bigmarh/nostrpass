#!/usr/bin/env node

/**
 * NostrPass Authentication Testing CLI
 *
 * Tests the complete auth lifecycle:
 * - Signup (create vault)
 * - Save to Nostr
 * - Login (retrieve from Nostr)
 * - Logout
 *
 * Run: node test-auth-cli.js
 */

import readline from 'readline';
import { webcrypto } from 'crypto';

// Polyfill crypto for Node.js
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

class TestAuthCLI {
  constructor() {
    this.username = null;
    this.password = null;
    this.pin = null;
    this.environment = 'tester';
    this.relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net'
    ];
    // Set NODE_ENV to match test environment (getEnvironment() checks this first)
    if (typeof process !== 'undefined') {
      process.env.NODE_ENV = this.environment;
    }
  }

  async run() {
    console.log('\n🔐 NostrPass Auth Testing CLI\n');
    console.log('This tool helps test the signup/login/logout flow\n');

    while (true) {
      console.log('\n📋 Main Menu:');
      console.log('1. Signup (Create new account)');
      console.log('2. Login (Retrieve from Nostr)');
      console.log('3. Update vault (Add identity/permissions)');
      console.log('4. Check vault status');
      console.log('5. Logout');
      console.log('6. Exit\n');

      const choice = await question('Select an option: ');

      switch (choice.trim()) {
        case '1':
          await this.signup();
          break;
        case '2':
          await this.login();
          break;
        case '3':
          await this.updateVault();
          break;
        case '4':
          await this.checkStatus();
          break;
        case '5':
          await this.logout();
          break;
        case '6':
          console.log('\n👋 Goodbye!\n');
          rl.close();
          process.exit(0);
        default:
          console.log('❌ Invalid option. Please try again.');
      }
    }
  }

  async signup() {
    console.log('\n📝 Signup - Create New Account\n');

    // Get credentials
    this.username = await question('Username: ');
    this.password = await question('Password: ');
    this.pin = await question('PIN (6 digits): ');

    console.log('\n🔄 Creating vault...');

    try {
      // Import crypto modules
      const { NostrCrypto } = await import('./apps/vault/src/workers/crypto.noble.ts');
      const { cryptoPrimitives } = await import('./apps/vault/src/workers/crypto-primitives.ts');
      const { saveLoginObj, publishEvent, configureNostrPass } = await import('./packages/nostrHelpers/src/index.ts');
      
      // Configure environment for this test session
      configureNostrPass({ environment: this.environment });

      const crypto = new NostrCrypto();

      // Step 1: Create vault with PIN encryption
      console.log('1️⃣ Generating vault...');
      const vault = await crypto.createVault(this.username, this.pin);
      console.log(`✅ Vault created with public key: ${vault.publicKey.substring(0, 16)}...`);

      // Step 2: Derive storage keypair (index 1337)
      console.log('2️⃣ Deriving storage keypair...');
      const STORAGE_INDEX = 1337;
      const storageKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv: vault.xpriv,
        index: STORAGE_INDEX
      });
      const storagePrivateKey = storageKeypair.privateKey || storageKeypair.get('privateKey');
      const storagePublicKey = storageKeypair.publicKey || storageKeypair.get('publicKey');
      console.log(`✅ Storage keypair derived: ${storagePublicKey.substring(0, 16)}...`);

      // Step 3: Create password-based encryption for LoginObj
      console.log('3️⃣ Creating password encryption...');
      const passwordSaltResult = await cryptoPrimitives.generateSalt();
      const passwordSalt = passwordSaltResult.salt || passwordSaltResult;

      const passwordKeyResult = await cryptoPrimitives.deriveKey({
        password: this.password,
        salt: passwordSalt
      });
      const passwordKey = passwordKeyResult.key || passwordKeyResult;

      // Step 4: Encrypt storage keypair with PIN for LoginObj
      console.log('4️⃣ Encrypting storage keypair with PIN...');
      const storageKeypairJson = JSON.stringify({
        privateKey: storagePrivateKey,
        publicKey: storagePublicKey
      });
      const storageKeypairEncrypted = await cryptoPrimitives.encryptDataWithSalt({
        data: storageKeypairJson,
        password: this.pin,
        salt: vault.salt
      });

      // Step 5: Create LoginObj
      const loginObj = {
        username: this.username,
        storagePublicKey,
        storageKeypairEncrypted,
        pinSalt: vault.salt,
        passwordSalt,
        createdAt: Date.now(),
        version: 1
      };

      // Step 6: Create identities with preset app permissions
      console.log('5️⃣ Creating identities with preset permissions...');

      // Derive keypairs for multiple identities
      const identity0Keypair = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv: vault.xpriv,
        index: 0
      });
      const identity1Keypair = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv: vault.xpriv,
        index: 1
      });

      const identity0PublicKey = identity0Keypair.publicKey || identity0Keypair.get('publicKey');
      const identity1PublicKey = identity1Keypair.publicKey || identity1Keypair.get('publicKey');

      // Identity 0: Main identity with app permissions
      const defaultIdentity = {
        id: `identity-0-${Date.now()}`,
        index: 0,
        name: 'Main Identity',
        publicKey: identity0PublicKey,
        purpose: 'default',
        appPermissions: {
          'nostr.app': {
            appId: 'nostr.app',
            appName: 'Nostr App',
            grantedAt: Date.now(),
            lastUsedAt: Date.now(),
            getPublicKey: 'ALLOW',
            permissions: {
              social: 'ALLOW',
              messaging: 'ASK_EVERYTIME',
              signData: 'ASK_EVERYTIME',
              zaps: 'ASK_EVERYTIME',
              financial: 'DENY'
            }
          },
          'example.com': {
            appId: 'example.com',
            appName: 'Example App',
            grantedAt: Date.now(),
            lastUsedAt: Date.now(),
            getPublicKey: 'ALLOW',
            permissions: {
              social: 'ASK_EVERYTIME',
              messaging: 'ASK_EVERYTIME',
              signData: 'ALLOW',
              zaps: 'DENY',
              financial: 'DENY'
            }
          }
        },
        createdAt: Date.now(),
        lastUsed: Date.now()
      };

      // Identity 1: Secondary identity for testing
      const secondaryIdentity = {
        id: `identity-1-${Date.now()}`,
        index: 1,
        name: 'Work Identity',
        publicKey: identity1PublicKey,
        purpose: 'work',
        appPermissions: {
          'work.app': {
            appId: 'work.app',
            appName: 'Work Application',
            grantedAt: Date.now(),
            lastUsedAt: Date.now(),
            getPublicKey: 'ALLOW',
            permissions: {
              social: 'ALLOW',
              messaging: 'ALLOW',
              signData: 'ASK_EVERYTIME',
              zaps: 'DENY',
              financial: 'DENY'
            }
          }
        },
        createdAt: Date.now(),
        lastUsed: Date.now()
      };

      console.log(`✅ Created 2 identities with app permissions`);

      // Step 7: Create VaultObj with identities
      console.log('6️⃣ Creating vault object...');
      const vaultObj = {
        username: this.username,
        xprivEncrypted: vault.xprivEncrypted,
        salt: vault.salt,
        identities: [defaultIdentity, secondaryIdentity],
        activeIdentityByApp: {
          'nostr.app': 0,
          'example.com': 0,
          'work.app': 1
        },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      console.log(`✅ VaultObj created with ${vaultObj.identities.length} identities`);

      // Step 8: Encrypt VaultObj with storage keypair (NIP-04 self-encryption)
      console.log('7️⃣ Encrypting vault object...');
      const vaultObjJson = JSON.stringify(vaultObj);
      // Use NIP-04 encryption: encrypt with storage private key to storage public key (self-encryption)
      const vaultObjEncrypted = await cryptoPrimitives.encrypt({
        privateKey: storagePrivateKey,
        recipientPubkey: storagePublicKey,
        plaintext: vaultObjJson
      });

      // Step 9: Publish LoginObj to Nostr
      console.log('8️⃣ Publishing LoginObj to Nostr...');
      const randomKeypairResult = await crypto.generateKeypair();
      const randomPrivateKey = randomKeypairResult.privateKey || randomKeypairResult.get('privateKey');
      const randomPublicKey = randomKeypairResult.publicKey || randomKeypairResult.get('publicKey');

      await saveLoginObj(
        this.username,
        loginObj,
        randomPublicKey,
        randomPrivateKey,
        this.relays,
        this.environment,
        passwordKey
      );
      console.log('✅ LoginObj published to Nostr');

      // Step 10: Publish VaultObj to Nostr
      console.log('9️⃣ Publishing VaultObj to Nostr...');
      // Use the format expected by getVaultFromNostr: kind 30078 with proper d-tag
      const namespace = 'nostrpass.com';
      const environment = this.environment || 'production';
      const dTag = `${namespace}_vault_${storagePublicKey}_${environment}`;
      
      const vaultEvent = {
        kind: 30078,
        content: vaultObjEncrypted,
        tags: [
          ['d', dTag],
          ['client', namespace],
          ['subject', 'encrypted-vault']
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: storagePublicKey
      };

      const signedVaultEvent = crypto.signEvent(vaultEvent, storagePrivateKey);
      await publishEvent(signedVaultEvent, this.relays);
      console.log(`✅ VaultObj published to Nostr with d-tag: ${dTag}`);

      console.log('\n✨ Signup complete!');
      console.log(`👤 Username: ${this.username}`);
      console.log(`🔑 Main Public Key (identity 0): ${identity0PublicKey}`);
      console.log(`🔑 Work Public Key (identity 1): ${identity1PublicKey}`);
      console.log(`💾 Storage Public Key: ${storagePublicKey}`);
      console.log(`\n🎭 Identities Created: 2`);
      console.log(`  - Identity 0 (Main): nostr.app (social=ALLOW), example.com (signData=ALLOW)`);
      console.log(`  - Identity 1 (Work): work.app (social=ALLOW, messaging=ALLOW)`);
      console.log(`\n📦 VaultObj version: ${vaultObj.version}`);
      console.log(`📦 Active identity mappings: ${Object.keys(vaultObj.activeIdentityByApp).length} apps`);
      console.log('\n💡 You can now test login with the same credentials\n');

    } catch (error) {
      console.error('\n❌ Signup failed:', error.message);
      console.error(error.stack);
    }
  }

  async login() {
    console.log('\n🔓 Login - Retrieve from Nostr\n');

    // Get credentials
    const username = await question('Username: ');
    const password = await question('Password: ');
    const pin = await question('PIN: ');

    console.log('\n🔄 Logging in...');

    try {
      // Import modules
      const { getLoginObj, getVaultFromNostr, configureNostrPass } = await import('./packages/nostrHelpers/src/index.ts');
      const { cryptoPrimitives } = await import('./apps/vault/src/workers/crypto-primitives.ts');
      
      // Configure environment for this test session
      configureNostrPass({ environment: this.environment });

      // Step 1: Fetch and decrypt LoginObj from Nostr
      console.log('1️⃣ Fetching LoginObj from Nostr...');
      const loginResult = await getLoginObj(
        username,
        this.environment,
        this.relays,
        password
      );

      if (!loginResult) {
        console.log('❌ No account found or wrong password');
        return;
      }

      const { loginObj, passwordSalt } = loginResult;
      console.log(`✅ LoginObj retrieved: ${loginObj.storagePublicKey.substring(0, 16)}...`);

      console.log('\n📦 LoginObj Data from Nostr:');
      console.log(JSON.stringify(loginObj, null, 2));
      console.log(`\n🔑 Password Salt: ${passwordSalt}\n`);

      // Step 2: Decrypt storage keypair with PIN
      console.log('2️⃣ Decrypting storage keypair with PIN...');
      const storageKeypairJson = await cryptoPrimitives.decryptDataWithSalt({
        encryptedData: loginObj.storageKeypairEncrypted,
        password: pin,
        salt: loginObj.pinSalt
      });
      const storageKeypair = JSON.parse(storageKeypairJson);
      console.log(`✅ Storage keypair decrypted: ${storageKeypair.publicKey.substring(0, 16)}...`);

      // Step 3: Fetch and decrypt VaultObj from Nostr
      console.log('3️⃣ Fetching VaultObj from Nostr...');
      const vaultData = await getVaultFromNostr(
        storageKeypair.publicKey,
        this.relays,
        storageKeypair.privateKey
      );

      if (!vaultData) {
        console.log('❌ Vault data not found on Nostr');
        return;
      }

      console.log(`✅ VaultObj retrieved with ${vaultData.identities?.length || 0} identities`);

      console.log('\n📦 VaultObj Data from Nostr:');
      console.log(JSON.stringify({
        username: vaultData.username,
        version: vaultData.version,
        createdAt: vaultData.createdAt,
        updatedAt: vaultData.updatedAt,
        identitiesCount: vaultData.identities?.length || 0,
        identities: vaultData.identities,
        activeIdentityByApp: vaultData.activeIdentityByApp,
        hasXprivEncrypted: !!vaultData.xprivEncrypted,
        xprivEncryptedLength: vaultData.xprivEncrypted?.length,
        hasSalt: !!vaultData.salt,
        saltValue: vaultData.salt
      }, null, 2));
      console.log();

      // Step 4: Decrypt xpriv with PIN
      console.log('4️⃣ Decrypting xpriv with PIN...');
      const xpriv = await cryptoPrimitives.decryptDataWithSalt({
        encryptedData: vaultData.xprivEncrypted,
        password: pin,
        salt: vaultData.salt
      });
      console.log('✅ xpriv decrypted successfully');

      // Step 5: Derive public key from xpriv
      console.log('5️⃣ Deriving public key from xpriv...');
      const { NostrCrypto } = await import('./apps/vault/src/workers/crypto.noble.ts');
      const crypto = new NostrCrypto();
      const derivedKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv,
        index: 0
      });
      const publicKey = derivedKeypair.publicKey || derivedKeypair.get('publicKey');
      console.log(`✅ Public key derived: ${publicKey.substring(0, 16)}...`);

      console.log('\n✨ Login successful!');
      console.log(`👤 Username: ${username}`);
      console.log(`🔑 Public Key (identity 0): ${publicKey}`);
      console.log(`💾 Storage Public Key: ${storageKeypair.publicKey}`);
      console.log(`\n🎭 Identities Retrieved: ${vaultData.identities?.length || 0}`);

      // Show identity details
      if (vaultData.identities && vaultData.identities.length > 0) {
        vaultData.identities.forEach((identity, idx) => {
          console.log(`\n  Identity ${idx} (${identity.name}):`);
          console.log(`    - Public Key: ${identity.publicKey.substring(0, 20)}...`);
          console.log(`    - Purpose: ${identity.purpose}`);
          const appCount = Object.keys(identity.appPermissions || {}).length;
          console.log(`    - App Permissions: ${appCount} apps`);

          if (appCount > 0) {
            Object.entries(identity.appPermissions).forEach(([origin, perms]) => {
              console.log(`      • ${origin}:`);
              const p = perms.permissions || {};
              const grants = [];
              if (p.social === 'ALLOW') grants.push('social');
              if (p.messaging === 'ALLOW') grants.push('messaging');
              if (p.signData === 'ALLOW') grants.push('signData');
              console.log(`        Allowed: ${grants.length > 0 ? grants.join(', ') : 'none'}`);
            });
          }
        });
      }

      console.log(`\n📦 VaultObj Version: ${vaultData.version}`);
      console.log(`📦 Active Identity Mappings: ${Object.keys(vaultData.activeIdentityByApp || {}).length} apps`);
      if (vaultData.activeIdentityByApp) {
        Object.entries(vaultData.activeIdentityByApp).forEach(([app, identityIdx]) => {
          console.log(`   - ${app} → Identity ${identityIdx}`);
        });
      }

      console.log('\n💡 Account retrieved and decrypted successfully!\n');

      // Store credentials for update/logout
      this.username = username;
      this.password = password;
      this.pin = pin;

    } catch (error) {
      console.error('\n❌ Login failed:', error.message);
      console.error(error.stack);
    }
  }

  async updateVault() {
    console.log('\n📝 Update Vault - Add New Identity/Permissions\n');

    if (!this.username || !this.password || !this.pin) {
      console.log('❌ You must login first (option 2) before updating vault');
      return;
    }

    try {
      // Import modules
      const { getLoginObj, getVaultFromNostr, publishEvent, configureNostrPass } = await import('./packages/nostrHelpers/src/index.ts');
      const { cryptoPrimitives } = await import('./apps/vault/src/workers/crypto-primitives.ts');
      const { NostrCrypto } = await import('./apps/vault/src/workers/crypto.noble.ts');
      
      // Configure environment for this test session
      configureNostrPass({ environment: this.environment });
      const crypto = new NostrCrypto();

      console.log('1️⃣ Fetching current vault from Nostr...');

      // Fetch LoginObj
      const loginResult = await getLoginObj(
        this.username,
        this.environment,
        this.relays,
        this.password
      );

      if (!loginResult) {
        console.log('❌ Could not fetch vault. Please login first.');
        return;
      }

      const { loginObj } = loginResult;

      // Decrypt storage keypair
      const storageKeypairJson = await cryptoPrimitives.decryptDataWithSalt({
        encryptedData: loginObj.storageKeypairEncrypted,
        password: this.pin,
        salt: loginObj.pinSalt
      });
      const storageKeypair = JSON.parse(storageKeypairJson);

      // Fetch current VaultObj
      const currentVault = await getVaultFromNostr(
        storageKeypair.publicKey,
        this.relays,
        storageKeypair.privateKey
      );

      if (!currentVault) {
        console.log('❌ Could not fetch current vault data');
        return;
      }

      console.log(`✅ Current vault has ${currentVault.identities?.length || 0} identities, version ${currentVault.version}`);

      // Decrypt xpriv to derive new identity
      const xpriv = await cryptoPrimitives.decryptDataWithSalt({
        encryptedData: currentVault.xprivEncrypted,
        password: this.pin,
        salt: currentVault.salt
      });

      console.log('\n2️⃣ Adding new identity with permissions...');

      // Determine next identity index
      const nextIndex = currentVault.identities?.length || 0;

      // Derive keypair for new identity
      const newIdentityKeypair = await cryptoPrimitives.deriveKeypairFromXpriv({
        xpriv,
        index: nextIndex
      });
      const newPublicKey = newIdentityKeypair.publicKey || newIdentityKeypair.get('publicKey');

      // Create new identity with preset permissions
      const newIdentity = {
        id: `identity-${nextIndex}-${Date.now()}`,
        index: nextIndex,
        name: `Identity ${nextIndex}`,
        publicKey: newPublicKey,
        purpose: 'testing',
        appPermissions: {
          'newapp.com': {
            appId: 'newapp.com',
            appName: 'New Test App',
            grantedAt: Date.now(),
            lastUsedAt: Date.now(),
            getPublicKey: 'ALLOW',
            permissions: {
              social: 'ALLOW',
              messaging: 'DENY',
              signData: 'ASK_EVERYTIME',
              zaps: 'DENY',
              financial: 'DENY'
            }
          }
        },
        createdAt: Date.now(),
        lastUsed: Date.now()
      };

      // Update vault data
      const updatedVault = {
        ...currentVault,
        identities: [...(currentVault.identities || []), newIdentity],
        activeIdentityByApp: {
          ...(currentVault.activeIdentityByApp || {}),
          'newapp.com': nextIndex
        },
        version: (currentVault.version || 1) + 1,  // INCREMENT VERSION
        updatedAt: Date.now()
      };

      console.log(`✅ Added identity ${nextIndex} with public key: ${newPublicKey.substring(0, 20)}...`);
      console.log(`✅ Version incremented: ${currentVault.version} → ${updatedVault.version}`);

      console.log('\n3️⃣ Encrypting and publishing updated vault...');

      // Encrypt updated VaultObj
      const updatedVaultJson = JSON.stringify(updatedVault);
      const vaultObjEncrypted = await cryptoPrimitives.encrypt({
        privateKey: storageKeypair.privateKey,
        recipientPubkey: storageKeypair.publicKey,
        plaintext: updatedVaultJson
      });

      // Publish updated VaultObj
      const namespace = 'nostrpass.com';
      const environment = this.environment || 'production';
      const dTag = `${namespace}_vault_${storageKeypair.publicKey}_${environment}`;

      const vaultEvent = {
        kind: 30078,
        content: vaultObjEncrypted,
        tags: [
          ['d', dTag],
          ['client', namespace],
          ['subject', 'encrypted-vault']
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: storageKeypair.publicKey
      };

      const signedVaultEvent = crypto.signEvent(vaultEvent, storageKeypair.privateKey);
      await publishEvent(signedVaultEvent, this.relays);

      console.log('✅ Updated vault published to Nostr');

      console.log('\n✨ Vault update complete!');
      console.log(`📦 New version: ${updatedVault.version}`);
      console.log(`🎭 Total identities: ${updatedVault.identities.length}`);
      console.log(`📱 New identity: ${newIdentity.name} (${newPublicKey.substring(0, 20)}...)`);
      console.log(`🔑 New app permission: newapp.com (social=ALLOW)`);
      console.log('\n💡 Use option 2 (Login) to verify the update was saved!\n');

    } catch (error) {
      console.error('\n❌ Update failed:', error.message);
      console.error(error.stack);
    }
  }

  async checkStatus() {
    console.log('\n📊 Check Vault Status\n');

    if (!this.username || !this.password || !this.pin) {
      console.log('❌ You must login first (option 2) to check vault status');
      return;
    }

    try {
      const { getLoginObj, getVaultFromNostr, configureNostrPass } = await import('./packages/nostrHelpers/src/index.ts');
      const { cryptoPrimitives } = await import('./apps/vault/src/workers/crypto-primitives.ts');
      
      // Configure environment for this test session
      configureNostrPass({ environment: this.environment });

      console.log(`🔍 Checking status for: ${this.username}`);
      console.log(`🌐 Environment: ${this.environment}`);
      console.log(`📡 Relays: ${this.relays.join(', ')}\n`);

      console.log('🔄 Fetching vault from Nostr...');

      // Fetch LoginObj
      const loginResult = await getLoginObj(
        this.username,
        this.environment,
        this.relays,
        this.password
      );

      if (!loginResult) {
        console.log('❌ No account found for this username');
        return;
      }

      const { loginObj } = loginResult;

      // Decrypt storage keypair
      const storageKeypairJson = await cryptoPrimitives.decryptDataWithSalt({
        encryptedData: loginObj.storageKeypairEncrypted,
        password: this.pin,
        salt: loginObj.pinSalt
      });
      const storageKeypair = JSON.parse(storageKeypairJson);

      // Fetch VaultObj
      const vaultData = await getVaultFromNostr(
        storageKeypair.publicKey,
        this.relays,
        storageKeypair.privateKey
      );

      if (!vaultData) {
        console.log('❌ Vault data not found on Nostr');
        return;
      }

      console.log('\n✅ Vault Status:\n');
      console.log(`👤 Username: ${this.username}`);
      console.log(`📦 Version: ${vaultData.version}`);
      console.log(`🎭 Identities: ${vaultData.identities?.length || 0}`);
      console.log(`📱 Apps with permissions: ${Object.keys(vaultData.activeIdentityByApp || {}).length}`);
      console.log(`📅 Created: ${new Date(vaultData.createdAt).toLocaleString()}`);
      console.log(`📅 Last updated: ${new Date(vaultData.updatedAt).toLocaleString()}`);
      console.log(`💾 Storage public key: ${storageKeypair.publicKey.substring(0, 20)}...`);

      // Show identity summary
      if (vaultData.identities && vaultData.identities.length > 0) {
        console.log('\n🎭 Identity Summary:');
        vaultData.identities.forEach((identity, idx) => {
          const appCount = Object.keys(identity.appPermissions || {}).length;
          console.log(`  ${idx}. ${identity.name} (${identity.purpose})`);
          console.log(`     - Public key: ${identity.publicKey.substring(0, 20)}...`);
          console.log(`     - ${appCount} app${appCount !== 1 ? 's' : ''} authorized`);
        });
      }

      // Show app mappings
      if (vaultData.activeIdentityByApp && Object.keys(vaultData.activeIdentityByApp).length > 0) {
        console.log('\n📱 Active Identity per App:');
        Object.entries(vaultData.activeIdentityByApp).forEach(([app, identityIdx]) => {
          const identity = vaultData.identities?.[identityIdx];
          console.log(`  - ${app} → Identity ${identityIdx} (${identity?.name || 'Unknown'})`);
        });
      }

      console.log();

    } catch (error) {
      console.error('\n❌ Status check failed:', error.message);
      console.error(error.stack);
    }
  }

  async logout() {
    console.log('\n🚪 Logout\n');

    if (!this.username) {
      console.log('❌ Not logged in');
      return;
    }

    console.log(`Logging out user: ${this.username}`);

    // Clear credentials
    this.username = null;
    this.password = null;
    this.pin = null;

    console.log('✅ Logged out successfully\n');
  }
}

// Run the CLI
const cli = new TestAuthCLI();
cli.run().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
