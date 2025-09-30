import { Page, expect } from '@playwright/test';

export interface TestUser {
  pin: string;
  pubkey: string;
  identityIndex: number;
}

export const TEST_USERS: TestUser[] = [
  {
    pin: '1234',
    pubkey: '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
    identityIndex: 0
  },
  {
    pin: '5678',
    pubkey: '03f28773c2d975288bc7d1d205c3748651b075fbc6610e58cddeeddf8f19405aa8',
    identityIndex: 1
  }
];

export async function waitForVaultIframe(page: Page): Promise<Page> {
  const iframe = page.frameLocator('iframe[src*="vault"]');
  await iframe.locator('body').waitFor({ timeout: 10000 });
  return iframe;
}

export async function approvePermission(page: Page): Promise<void> {
  const vaultFrame = await waitForVaultIframe(page);
  await vaultFrame.locator('button:has-text("Allow")').click();
}

export async function denyPermission(page: Page): Promise<void> {
  const vaultFrame = await waitForVaultIframe(page);
  await vaultFrame.locator('button:has-text("Deny")').click();
}

export async function enterPin(page: Page, pin: string): Promise<void> {
  const vaultFrame = await waitForVaultIframe(page);
  await vaultFrame.locator('input[type="password"]').fill(pin);
  await vaultFrame.locator('button:has-text("Unlock")').click();
}

export async function waitForSuccess(page: Page, selector: string): Promise<string> {
  const result = await page.waitForSelector(`${selector} .success`, { timeout: 10000 });
  const text = await result.textContent();
  expect(text).toBeTruthy();
  return text!;
}

export async function waitForError(page: Page, selector: string): Promise<string> {
  const result = await page.waitForSelector(`${selector} .error`, { timeout: 10000 });
  const text = await result.textContent();
  expect(text).toBeTruthy();
  return text!;
}

export function createTestEvent(content: string = 'Test event'): any {
  return {
    kind: 1,
    content,
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };
}

export function createTestMessage(): string {
  return 'Secret test message for encryption';
}

export async function setupTestUser(page: Page, userIndex: number = 0): Promise<TestUser> {
  const user = TEST_USERS[userIndex];
  
  // Navigate to unlock page
  await page.goto('/app/unlock');
  
  // Enter PIN
  await enterPin(page, user.pin);
  
  // Wait for successful unlock
  await page.waitForURL('**/dashboard');
  
  return user;
}

export async function cleanupTestUser(page: Page): Promise<void> {
  // Clear any stored data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function mockNostrRelays(page: Page): Promise<void> {
  // Mock Nostr relay responses for testing
  await page.route('**/wss://relay.damus.io/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 'ok' })
    });
  });
}

export async function simulateNetworkError(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.abort());
}

export async function restoreNetwork(page: Page): Promise<void> {
  await page.unroute('**/api/**');
}

export function expectValidPubkey(pubkey: string): void {
  expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
}

export function expectValidEventId(eventId: string): void {
  expect(eventId).toMatch(/^[0-9a-f]{64}$/);
}

export function expectValidSignature(signature: string): void {
  expect(signature).toMatch(/^[0-9a-f]{128}$/);
}

export function expectValidNip04Ciphertext(ciphertext: string): void {
  // NIP-04 ciphertext should be base64 encoded
  expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
}
