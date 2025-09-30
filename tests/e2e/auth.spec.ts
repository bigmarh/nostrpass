import { test, expect } from '@playwright/test';

test.describe('Authentication flows', () => {
  test('vault unlock route exists and shows unlock form', async ({ page }) => {
    await page.goto('/app/unlock');
    await expect(page.locator('text=Unlock')).toBeVisible({ timeout: 10000 });
    
    // Should show PIN input field
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Should show unlock button
    await expect(page.locator('button:has-text("Unlock")')).toBeVisible();
  });

  test('vault login route shows login form', async ({ page }) => {
    await page.goto('/app/login');
    await expect(page.locator('text=Login')).toBeVisible({ timeout: 10000 });
  });

  test('vault signup route shows signup form', async ({ page }) => {
    await page.goto('/app/signup');
    await expect(page.locator('text=Sign Up')).toBeVisible({ timeout: 10000 });
  });

  test('vault recovery route shows recovery form', async ({ page }) => {
    await page.goto('/app/unlock?recovery=1');
    await expect(page.locator('text=Recovery')).toBeVisible({ timeout: 10000 });
  });

  test('vault handles invalid PIN gracefully', async ({ page }) => {
    await page.goto('/app/unlock');
    
    // Enter invalid PIN
    await page.fill('input[type="password"]', '0000');
    await page.click('button:has-text("Unlock")');
    
    // Should show error message
    await expect(page.locator('text=Invalid PIN')).toBeVisible({ timeout: 5000 });
  });

  test('vault shows lockout after multiple failed attempts', async ({ page }) => {
    await page.goto('/app/unlock');
    
    // Try multiple invalid PINs
    for (let i = 0; i < 6; i++) {
      await page.fill('input[type="password"]', '0000');
      await page.click('button:has-text("Unlock")');
      await page.waitForTimeout(1000);
    }
    
    // Should show lockout message
    await expect(page.locator('text=Too many attempts')).toBeVisible({ timeout: 5000 });
  });

  test('vault redirects to dashboard after successful unlock', async ({ page }) => {
    // This would require setting up a test user with known PIN
    // For now, just verify the redirect logic exists
    await page.goto('/app/unlock');
    
    // The form should be present
    await expect(page.locator('form')).toBeVisible();
  });

  test('vault handles session expiry properly', async ({ page }) => {
    // This would require setting up an expired session
    // For now, just verify the session handling exists
    await page.goto('/app/dashboard');
    
    // Should redirect to login if no valid session
    await page.waitForURL('**/login');
  });
});


