import { test, expect } from '@playwright/test';

test.describe('PIN behavior tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up a test user with known credentials
    // You'll need to implement this based on your auth flow
    await page.goto('http://localhost:3001/app/unlock');
  });

  test('PIN auto-clears after incorrect entry', async ({ page }) => {
    // Wait for PIN pad to be visible
    await page.waitForSelector('[data-testid="pin-pad"]', { timeout: 5000 });

    // Enter 6-digit incorrect PIN by clicking the number buttons
    const pinDigits = ['1', '2', '3', '4', '5', '6'];
    for (const digit of pinDigits) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(100); // Small delay between clicks
    }

    // Wait for the PIN to be validated (500ms timeout in onComplete)
    await page.waitForTimeout(600);

    // Check console logs for shakeAndClear being called
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    // Verify error message appears
    await expect(page.locator('text=/Incorrect PIN/i')).toBeVisible({ timeout: 2000 });

    // Wait for shake animation (500ms)
    await page.waitForTimeout(600);

    // Verify PIN was cleared - check that all dots are empty
    const filledDots = await page.locator('.w-2\\.5.h-2\\.5.rounded-full.bg-white').count();
    expect(filledDots).toBe(0);

    // Verify console logs show shakeAndClear was called
    expect(consoleLogs.some(log => log.includes('[PinPad] shakeAndClear called'))).toBeTruthy();
    expect(consoleLogs.some(log => log.includes('[PinPad] Clearing PIN after shake'))).toBeTruthy();
  });

  test('PIN clears after successful unlock', async ({ page }) => {
    // This test requires a test user with known PIN
    // You'll need to set up test fixtures for this

    await page.goto('http://localhost:3001/app/unlock');

    // Enter correct PIN (you need to have a test user set up)
    const correctPin = ['1', '1', '1', '1', '1', '1']; // Example
    for (const digit of correctPin) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(100);
    }

    // Wait for unlock to complete
    await page.waitForTimeout(1000);

    // Verify we navigated away or modal closed
    // The PIN pad should no longer be visible or should be cleared
    const isPinPadVisible = await page.locator('[data-testid="pin-pad"]').isVisible();
    expect(isPinPadVisible).toBe(false);
  });

  test('Lock toggle actually locks vault', async ({ page }) => {
    // First, ensure user is logged in and vault is unlocked
    await page.goto('http://localhost:4000'); // Frontend with NostrPassButton

    // Wait for NostrPassButton to load
    await page.waitForSelector('.nostrpass-user-btn', { timeout: 5000 });

    // Click the user button to open dropdown
    await page.click('.nostrpass-user-btn');

    // Wait for dropdown to open
    await page.waitForSelector('.nostrpass-dropdown.open', { timeout: 2000 });

    // Click the lock toggle
    await page.click('[data-action="toggle-lock"]');

    // Wait for lock to complete
    await page.waitForTimeout(500);

    // Verify slider changed to locked state
    const slider = await page.locator('.nostrpass-lock-slider');
    const hasLockedClass = await slider.evaluate(el => el.classList.contains('locked'));
    expect(hasLockedClass).toBe(true);

    // Verify console shows lock message was sent
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    expect(consoleLogs.some(log => log.includes('[LOCK_VAULT]'))).toBeTruthy();

    // Try to trigger an operation - should show PIN unlock
    await page.evaluate(() => {
      (window as any).nostr?.getPublicKey();
    });

    // Should show unlock modal
    await expect(page.locator('text=/Unlock/i')).toBeVisible({ timeout: 2000 });
  });

  test('PIN persists visually during validation delay', async ({ page }) => {
    await page.goto('http://localhost:3001/app/unlock');
    await page.waitForSelector('[data-testid="pin-pad"]', { timeout: 5000 });

    // Enter 6 digits
    const pinDigits = ['1', '2', '3', '4', '5', '6'];
    for (const digit of pinDigits) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(50);
    }

    // Immediately after 6th digit, PIN should still be visible
    const filledDotsImmediately = await page.locator('.bg-white.dark\\:bg-gray-900.scale-125').count();
    expect(filledDotsImmediately).toBe(6);

    // After 500ms delay for onComplete, validation happens
    await page.waitForTimeout(300);

    // During validation, PIN should still be visible
    const filledDotsDuringValidation = await page.locator('.bg-white.dark\\:bg-gray-900.scale-125').count();
    expect(filledDotsDuringValidation).toBe(6);
  });
});
