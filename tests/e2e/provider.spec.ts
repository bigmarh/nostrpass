import { test, expect } from '@playwright/test';

test.describe('NIP-07 provider flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test host page
    await page.goto('/fixtures/test-host.html');
    
    // Wait for provider to initialize
    await page.waitForSelector('#provider-status .success', { timeout: 10000 });
  });

  test('getPublicKey returns a hex pubkey when unlocked', async ({ page }) => {
    // Click getPublicKey test button
    await page.click('#test-getPublicKey');
    
    // Wait for result and verify it's a valid hex pubkey
    const result = await page.waitForSelector('#nip07-results .success');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Public key: [0-9a-f]{64}/);
  });

  test('signEvent prompts permission, then signs after approval', async ({ page }) => {
    // Click signEvent test button
    await page.click('#test-signEvent');
    
    // Wait for permission prompt in vault iframe
    const vaultFrame = page.frameLocator('iframe[src*="vault"]');
    await vaultFrame.locator('text=Allow').waitFor({ timeout: 10000 });
    
    // Approve the permission
    await vaultFrame.locator('button:has-text("Allow")').click();
    
    // Wait for successful result
    const result = await page.waitForSelector('#nip07-results .success');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Event signed successfully/);
    expect(resultText).toMatch(/ID: [0-9a-f]{64}/);
    expect(resultText).toMatch(/Sig: [0-9a-f]{20}/);
  });

  test('signEvent shows permission prompt and can be denied', async ({ page }) => {
    // Click signEvent test button
    await page.click('#test-signEvent');
    
    // Wait for permission prompt in vault iframe
    const vaultFrame = page.frameLocator('iframe[src*="vault"]');
    await vaultFrame.locator('text=Deny').waitFor({ timeout: 10000 });
    
    // Deny the permission
    await vaultFrame.locator('button:has-text("Deny")').click();
    
    // Wait for error result
    const result = await page.waitForSelector('#nip07-results .error');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Error.*E_PERMISSION_DENIED/);
  });

  test('nip04 encrypt/decrypt works after permission approval', async ({ page }) => {
    // First encrypt
    await page.click('#test-nip04-encrypt');
    
    // Wait for permission prompt and approve
    const vaultFrame = page.frameLocator('iframe[src*="vault"]');
    await vaultFrame.locator('button:has-text("Allow")').waitFor({ timeout: 10000 });
    await vaultFrame.locator('button:has-text("Allow")').click();
    
    // Wait for encryption success
    await page.waitForSelector('#nip07-results .success');
    
    // Then decrypt
    await page.click('#test-nip04-decrypt');
    
    // Wait for decryption success
    const result = await page.waitForSelector('#nip07-results .success');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Decrypted: Secret message for encryption test/);
  });

  test('permission deny surfaces E_PERMISSION_DENIED code', async ({ page }) => {
    // Click permission deny test button
    await page.click('#test-permission-deny');
    
    // Wait for permission prompt and deny
    const vaultFrame = page.frameLocator('iframe[src*="vault"]');
    await vaultFrame.locator('button:has-text("Deny")').waitFor({ timeout: 10000 });
    await vaultFrame.locator('button:has-text("Deny")').click();
    
    // Wait for error result
    const result = await page.waitForSelector('#permission-results .success');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Permission correctly denied/);
  });

  test('identity switching works with different identityIndex', async ({ page }) => {
    // Click identity switch test button
    await page.click('#test-identity-switch');
    
    // Wait for result
    const result = await page.waitForSelector('#identity-results .success');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Identity switch works/);
    expect(resultText).toMatch(/Pubkey 0: [0-9a-f]{20}/);
    expect(resultText).toMatch(/Pubkey 1: [0-9a-f]{20}/);
  });

  test('provider handles concurrent requests gracefully', async ({ page }) => {
    // Trigger multiple concurrent requests
    await Promise.all([
      page.click('#test-getPublicKey'),
      page.click('#test-getPublicKey'),
      page.click('#test-getPublicKey')
    ]);
    
    // Wait for all results
    await page.waitForSelector('#nip07-results .success');
    
    // Verify at least one succeeded
    const result = await page.locator('#nip07-results .success').first();
    const resultText = await result.textContent();
    expect(resultText).toMatch(/Public key: [0-9a-f]{64}/);
  });

  test('provider shows proper error for invalid operations', async ({ page }) => {
    // Test with invalid event data
    await page.evaluate(() => {
      window.nostr.signEvent({ kind: 'invalid' }).catch(e => {
        document.getElementById('nip07-results').innerHTML = 
          `<div class="error">Error: ${e.message} (Code: ${e.code})</div>`;
      });
    });
    
    // Wait for error result
    const result = await page.waitForSelector('#nip07-results .error');
    const resultText = await result.textContent();
    
    expect(resultText).toMatch(/Error.*invalid/);
  });
});


