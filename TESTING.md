# Testing Guide for NostrPass

## Overview

NostrPass has three types of automated tests:
1. **Unit Tests** (Vitest) - Fast, isolated tests for logic
2. **Integration Tests** (Vitest) - Tests for message flows and workers
3. **E2E Tests** (Playwright) - Full browser automation tests

## Quick Start

```bash
# Run all unit tests
pnpm test:unit

# Run E2E tests (requires dev servers running)
pnpm test:e2e

# Run E2E tests with UI (great for debugging)
pnpm test:e2e:ui

# Run E2E tests in headed mode (see the browser)
pnpm test:e2e:headed

# Run only vault E2E tests
pnpm test:e2e:vault

# Run with debugging
pnpm test:e2e:debug
```

## Unit Tests (Vitest)

Unit tests are located in:
- `tests/unit/` - Integration tests
- `packages/vault-core/src/__tests__/` - Vault core library tests
- `packages/messenger/src/` - Messenger tests

### Running Unit Tests

```bash
# Run all unit tests
pnpm test

# Run in watch mode
pnpm test

# Run with coverage
pnpm test:coverage

# Run with UI
pnpm test:ui

# Run specific test file
pnpm test tests/unit/worker/crypto-worker.test.ts
```

## E2E Tests (Playwright)

E2E tests are located in `tests/e2e/` and test the full application flow in a real browser.

### Setup

Playwright is already installed. The tests will automatically start the dev servers.

### Running E2E Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with visible browser (great for watching tests)
pnpm test:e2e:headed

# Run with Playwright UI (best for debugging)
pnpm test:e2e:ui

# Debug mode (pause on failure)
pnpm test:e2e:debug

# Run specific project
pnpm test:e2e:vault
pnpm test:e2e:provider
```

### E2E Test Files

- `auth.spec.ts` - Authentication flows (login, signup, unlock)
- `vault.spec.ts` - Vault-specific tests
- `provider.spec.ts` - Provider/frontend integration tests
- `pin-behavior.spec.ts` - **NEW** - PIN auto-clear and lock behavior tests

## Testing the PIN Issues

### Manual Testing Checklist

1. **PIN Auto-Clear on Error**
   - Lock vault from NostrPass menu
   - Enter incorrect 6-digit PIN
   - Watch for:
     - Shake animation
     - PIN dots clear after shake
     - Error message shows "Incorrect PIN"
   - Check browser console for:
     - `[PinPad] shakeAndClear called`
     - `[PinPad] Clearing PIN after shake animation`

2. **PIN Clear on Success**
   - Lock vault
   - Enter correct PIN
   - Verify PIN dots clear immediately after unlock
   - Vault should be unlocked

3. **Lock Toggle Works**
   - Click NostrPass button
   - Click lock toggle slider
   - Verify slider moves to locked position
   - Try to trigger an operation (e.g., getPublicKey)
   - Should show PIN unlock prompt

### Automated Testing

Run the PIN behavior tests:

```bash
# Run only PIN tests
pnpm test:e2e --grep "PIN behavior"

# Run with UI to watch
pnpm test:e2e:ui --grep "PIN behavior"

# Run in headed mode
pnpm test:e2e:headed --grep "PIN behavior"
```

## Debugging Tests

### Playwright Debugging

1. **Use Playwright UI** (recommended):
   ```bash
   pnpm test:e2e:ui
   ```
   - Step through tests
   - Inspect DOM at each step
   - See screenshots on failure

2. **Use Debug Mode**:
   ```bash
   pnpm test:e2e:debug
   ```
   - Opens DevTools
   - Pauses on failure

3. **Add Screenshots**:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

4. **Console Logs**:
   ```typescript
   page.on('console', msg => console.log('BROWSER:', msg.text()));
   ```

### Vitest Debugging

1. **Use Vitest UI**:
   ```bash
   pnpm test:ui
   ```

2. **Add Debug Points**:
   ```typescript
   test('my test', () => {
     debugger; // Stops here if running with --inspect
     // ...
   });
   ```

3. **Run with Node Inspector**:
   ```bash
   node --inspect-brk ./node_modules/.bin/vitest
   ```

## Writing New Tests

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('http://localhost:3001/app/unlock');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.waitForSelector('[data-testid="pin-pad"]');

    // Act
    await page.click('button:has-text("Submit")');

    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

### Unit Test Template

```typescript
import { describe, test, expect } from 'vitest';

describe('Feature', () => {
  test('should do something', () => {
    // Arrange
    const input = { foo: 'bar' };

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## Test Best Practices

1. **Use data-testid for selectors** - More reliable than text or CSS classes
2. **Wait for elements** - Use `waitForSelector` instead of fixed timeouts
3. **Test user behavior** - Click buttons, don't call functions directly
4. **Clean up after tests** - Reset state in `afterEach`
5. **Make tests independent** - Each test should run in isolation
6. **Use meaningful assertions** - Be specific about what you're checking

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-deployment

To run tests like CI does:

```bash
# Run all tests
pnpm test:run && pnpm test:e2e
```

## Troubleshooting

### "Port already in use"

The dev servers might already be running. Either:
- Stop existing servers: `pkill -f "pnpm dev"`
- Or use existing servers: Tests will reuse them

### "Element not found"

- Check if element has correct `data-testid`
- Increase timeout: `await page.waitForSelector(..., { timeout: 10000 })`
- Check if element is in iframe: Use `page.frameLocator()`

### Tests pass locally but fail in CI

- CI runs headless by default
- Check for timing issues
- Use `await page.waitForLoadState('networkidle')`

## Resources

- [Playwright Docs](https://playwright.dev/)
- [Vitest Docs](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
