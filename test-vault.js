#!/usr/bin/env node

/**
 * Manual Testing Script for NostrPass Vault
 *
 * This script helps you manually test vault functionality including:
 * - Account creation with PIN
 * - Login with password
 * - PIN unlock
 * - Session persistence
 * - Vault lock/unlock
 */

const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(60));
  log(message, colors.bright + colors.cyan);
  console.log('='.repeat(60) + '\n');
}

async function startDevServer() {
  log('Starting development server...', colors.yellow);
  log('This will run: pnpm dev', colors.blue);
  log('\nPress Ctrl+C to stop the server when done testing\n', colors.yellow);

  try {
    exec('pnpm dev', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(stdout);
    });

    log('✓ Server starting... Wait for it to be ready before testing', colors.green);
  } catch (error) {
    log(`✗ Failed to start server: ${error.message}`, colors.red);
  }
}

async function checkBuild() {
  log('Running type check...', colors.yellow);
  try {
    const { stdout, stderr } = await execPromise('pnpm run type-check');
    log('✓ Type check passed', colors.green);
    if (stdout) console.log(stdout);
  } catch (error) {
    log('✗ Type check failed', colors.red);
    console.error(error.stderr || error.message);
  }
}

async function showTestScenarios() {
  header('MANUAL TEST SCENARIOS');

  log('Test Scenario 1: New Account Creation', colors.bright);
  log('1. Open http://localhost:5173', colors.blue);
  log('2. Click "Sign Up"');
  log('3. Enter username: testuser_' + Date.now());
  log('4. Enter password: testpass123');
  log('5. Enter PIN: 1234');
  log('6. Optional: Add security questions');
  log('7. Click "Create Account"');
  log('Expected: Account created, vault unlocked\n');

  log('Test Scenario 2: Login with Password', colors.bright);
  log('1. Logout if logged in');
  log('2. Click "Login"');
  log('3. Enter username from Scenario 1');
  log('4. Enter password: testpass123');
  log('5. Click "Login"');
  log('Expected: Logged in, vault locked (need PIN)\n');

  log('Test Scenario 3: Unlock with PIN', colors.bright);
  log('1. After logging in (Scenario 2)');
  log('2. Enter PIN: 1234');
  log('3. Click "Unlock"');
  log('Expected: Vault unlocked, can access features\n');

  log('Test Scenario 4: Session Persistence', colors.bright);
  log('1. Login and unlock vault (Scenarios 2 & 3)');
  log('2. Refresh the page (F5)');
  log('3. Check if session restored');
  log('Expected: User still logged in, vault locked\n');

  log('Test Scenario 5: Lock Vault', colors.bright);
  log('1. Unlock vault (Scenario 3)');
  log('2. Click "Lock Vault" button');
  log('Expected: Vault locked, need PIN to unlock\n');

  log('Test Scenario 6: Wrong PIN', colors.bright);
  log('1. Login (Scenario 2)');
  log('2. Enter wrong PIN: 9999');
  log('3. Click "Unlock"');
  log('Expected: Error message "Invalid PIN"\n');

  log('Test Scenario 7: Cross-tab Sync', colors.bright);
  log('1. Open vault in two browser tabs');
  log('2. Login in tab 1');
  log('3. Unlock in tab 1');
  log('4. Check tab 2');
  log('Expected: Tab 2 should sync state\n');
}

async function showCheckpoints() {
  header('TESTING CHECKLIST');

  log('Authentication:', colors.bright);
  log('[ ] Can create new account');
  log('[ ] Can login with password');
  log('[ ] Can unlock with PIN');
  log('[ ] Wrong password rejected');
  log('[ ] Wrong PIN rejected');
  log('[ ] Can logout\n');

  log('Vault Operations:', colors.bright);
  log('[ ] Can lock vault');
  log('[ ] Can unlock vault');
  log('[ ] Vault state persists on refresh');
  log('[ ] Encrypted data saved to Nostr');
  log('[ ] Can recover vault from Nostr\n');

  log('Session Management:', colors.bright);
  log('[ ] Session restored after page refresh');
  log('[ ] Session expires after timeout');
  log('[ ] Multiple tabs stay in sync');
  log('[ ] Logout clears all sessions\n');

  log('UI/UX:', colors.bright);
  log('[ ] Loading states show properly');
  log('[ ] Error messages are clear');
  log('[ ] Success messages appear');
  log('[ ] Forms validate input');
  log('[ ] Lock overlay works correctly\n');
}

async function showUsefulCommands() {
  header('USEFUL COMMANDS');

  log('Development:', colors.bright);
  log('  pnpm dev              - Start dev server');
  log('  pnpm build            - Build for production');
  log('  pnpm type-check       - Check TypeScript types\n');

  log('Testing:', colors.bright);
  log('  pnpm test             - Run unit tests');
  log('  pnpm test:ui          - Run tests with UI');
  log('  pnpm test:e2e         - Run E2E tests\n');

  log('Browser DevTools:', colors.bright);
  log('  F12                   - Open DevTools');
  log('  Console tab           - View logs (search for [UNLOCK], [LOGIN])');
  log('  Application tab       - View IndexedDB (NostrPassVault)');
  log('  Network tab           - View Nostr relay connections\n');

  log('Debugging:', colors.bright);
  log('  localStorage.clear()  - Clear session data');
  log('  indexedDB.deleteDatabase("NostrPassVault") - Reset vault\n');
}

async function showVaultURLs() {
  header('TEST URLS');

  log('Local Development:', colors.bright);
  log('  Vault:    http://localhost:5173');
  log('  Embassy:  http://localhost:5174');
  log('  Website:  http://localhost:5175\n');
}

async function generateTestData() {
  header('TEST DATA GENERATOR');

  const timestamp = Date.now();
  const testUsername = `testuser_${timestamp}`;
  const testPassword = 'TestPass123!';
  const testPin = '1234';

  log('Generated Test Credentials:', colors.bright);
  log(`  Username: ${testUsername}`, colors.green);
  log(`  Password: ${testPassword}`, colors.green);
  log(`  PIN:      ${testPin}`, colors.green);
  log('\nCopy these for your manual tests!\n');
}

async function inspectAuthProvider() {
  header('AUTHPROVIDER INSPECTION');

  log('Key Functions to Test:', colors.bright);
  log('  • createAccount(username, password, pin, recovery?)');
  log('  • login(password, username)');
  log('  • unlockVault(pin)');
  log('  • lockVault()');
  log('  • logout(deleteVault?)\n');

  log('State to Monitor:', colors.bright);
  log('  • user() - Current user object');
  log('  • isAuthenticated() - Login status');
  log('  • hasPinVault() - Has encrypted vault');
  log('  • isVaultLocked() - Vault lock state');
  log('  • isLoading() - Loading state\n');

  log('Console Logs to Watch:', colors.bright);
  log('  [AuthProvider] - Auth state changes');
  log('  [CREATE ACCOUNT] - Account creation flow');
  log('  [LOGIN] - Login process');
  log('  [UNLOCK] - Vault unlock process');
  log('  🔐 - Encryption operations');
  log('  🔑 - Key derivation');
  log('  📦 - Vault data operations\n');
}

async function main() {
  console.clear();

  log(`
╔══════════════════════════════════════════════════════════╗
║         NostrPass Vault - Manual Testing Script          ║
╚══════════════════════════════════════════════════════════╝
`, colors.cyan + colors.bright);

  while (true) {
    console.log('\nWhat would you like to do?\n');
    log('1. Start development server', colors.blue);
    log('2. Show test scenarios', colors.blue);
    log('3. Show testing checklist', colors.blue);
    log('4. Show useful commands', colors.blue);
    log('5. Show test URLs', colors.blue);
    log('6. Generate test credentials', colors.blue);
    log('7. Inspect AuthProvider', colors.blue);
    log('8. Run type check', colors.blue);
    log('9. Show all', colors.blue);
    log('0. Exit', colors.red);

    const choice = await question('\nEnter your choice: ');

    switch (choice.trim()) {
      case '1':
        await startDevServer();
        break;
      case '2':
        await showTestScenarios();
        break;
      case '3':
        await showCheckpoints();
        break;
      case '4':
        await showUsefulCommands();
        break;
      case '5':
        await showVaultURLs();
        break;
      case '6':
        await generateTestData();
        break;
      case '7':
        await inspectAuthProvider();
        break;
      case '8':
        await checkBuild();
        break;
      case '9':
        await showVaultURLs();
        await showTestScenarios();
        await showCheckpoints();
        await showUsefulCommands();
        await inspectAuthProvider();
        break;
      case '0':
        log('\nGoodbye! Happy testing! 🎉\n', colors.green);
        rl.close();
        process.exit(0);
      default:
        log('Invalid choice. Please try again.', colors.red);
    }

    await question('\nPress Enter to continue...');
    console.clear();
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('\n\nGoodbye! 👋\n', colors.yellow);
  rl.close();
  process.exit(0);
});

main();
