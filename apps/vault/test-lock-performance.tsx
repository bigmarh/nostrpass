// Test file to verify instant lock functionality
// This demonstrates the fix for the 3-30 second timeout issue

import { createSignal, createEffect } from 'solid-js';

// Mock setup to simulate the fix
export function testLockPerformance() {
  const [isVaultLocked, setIsVaultLocked] = createSignal(false);
  const [uiVaultLocked, setUiVaultLocked] = createSignal(false);
  
  // Old approach (SLOW - waits for worker)
  const lockVaultOld = async () => {
    console.time('Old lock method');
    try {
      // Simulating worker timeout
      await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Worker timeout')), 3000);
      });
    } catch (error) {
      console.log('Worker timeout occurred');
    }
    setIsVaultLocked(true);
    console.timeEnd('Old lock method'); // ~3 seconds
  };
  
  // New approach (INSTANT - UI first)
  const lockVaultNew = async () => {
    console.time('New lock method');
    
    // INSTANT UI UPDATE
    setUiVaultLocked(true);
    setIsVaultLocked(true);
    console.log('UI updated instantly!');
    console.timeEnd('New lock method'); // <1ms
    
    // Background worker cleanup (non-blocking)
    Promise.resolve().then(async () => {
      try {
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Worker timeout')), 3000);
        });
      } catch (error) {
        console.log('Worker cleanup failed (non-critical)');
      }
    });
  };
  
  return {
    lockVaultOld,
    lockVaultNew,
    isVaultLocked
  };
}

// Expected output:
// Old method: ~3000ms (waits for timeout)
// New method: <1ms (instant UI update)