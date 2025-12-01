/**
 * Atomic Auth Test Component
 *
 * Simple test page to verify the new atomic auth API works.
 * Compare performance and behavior with old auth system.
 */

import { createSignal, type Component } from 'solid-js';
import { getCryptoWorker } from '../workers/cryptoWorkerSingleton';

export const AtomicAuthTest: Component = () => {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [pin, setPin] = createSignal('');
  const [status, setStatus] = createSignal('Not logged in');
  const [authState, setAuthState] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net'
  ];

  // Test: Get auth state
  const checkAuthState = async () => {
    try {
      setLoading(true);
      setError(null);
      const startTime = Date.now();

      const cryptoWorker = getCryptoWorker();
      const state = await cryptoWorker.getAuthState({});

      const elapsed = Date.now() - startTime;

      setAuthState(state);
      setStatus(`Auth state retrieved in ${elapsed}ms`);
    } catch (err: any) {
      setError(err.message);
      setStatus('Error checking auth state');
    } finally {
      setLoading(false);
    }
  };

  // Test: Atomic login
  const testAtomicLogin = async () => {
    if (!username() || !password()) {
      setError('Username and password required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const startTime = Date.now();

      const cryptoWorker = getCryptoWorker();
      const result = await cryptoWorker.atomicLogin({
        username: username(),
        password: password(),
        relays: DEFAULT_RELAYS,
        environment: 'production'
      });

      const elapsed = Date.now() - startTime;

      if (result.success) {
        setStatus(`✅ Login successful in ${elapsed}ms`);
        await checkAuthState();
      } else {
        setError('Login failed');
        setStatus('Login failed');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus(`❌ Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test: Atomic unlock
  const testAtomicUnlock = async () => {
    if (!username() || !pin()) {
      setError('Username and PIN required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const startTime = Date.now();

      const cryptoWorker = getCryptoWorker();
      const result = await cryptoWorker.atomicUnlock({
        username: username(),
        pin: pin()
      });

      const elapsed = Date.now() - startTime;

      if (result.success) {
        setStatus(`✅ Unlock successful in ${elapsed}ms`);
        await checkAuthState();
      } else {
        setError('Unlock failed');
        setStatus('Unlock failed');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus(`❌ Unlock failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test: Atomic logout
  const testAtomicLogout = async () => {
    if (!username()) {
      setError('Username required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const startTime = Date.now();

      const cryptoWorker = getCryptoWorker();
      await cryptoWorker.atomicLogout({ username: username() });

      const elapsed = Date.now() - startTime;

      setStatus(`✅ Logout successful in ${elapsed}ms`);
      setAuthState(null);
    } catch (err: any) {
      setError(err.message);
      setStatus(`❌ Logout failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', 'max-width': '800px', margin: '0 auto' }}>
      <h1>🧪 Atomic Auth Test</h1>
      <p>Test the new simplified atomic auth API</p>

      {/* Input Fields */}
      <div style={{ 'margin-bottom': '20px' }}>
        <div style={{ 'margin-bottom': '10px' }}>
          <label>
            Username:
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              style={{ 'margin-left': '10px', padding: '5px', width: '200px' }}
              placeholder="username"
            />
          </label>
        </div>
        <div style={{ 'margin-bottom': '10px' }}>
          <label>
            Password:
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              style={{ 'margin-left': '10px', padding: '5px', width: '200px' }}
              placeholder="password"
            />
          </label>
        </div>
        <div style={{ 'margin-bottom': '10px' }}>
          <label>
            PIN:
            <input
              type="password"
              value={pin()}
              onInput={(e) => setPin(e.currentTarget.value)}
              style={{ 'margin-left': '10px', padding: '5px', width: '200px' }}
              placeholder="123456"
            />
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ 'margin-bottom': '20px' }}>
        <button
          onClick={checkAuthState}
          disabled={loading()}
          style={{ 'margin-right': '10px', padding: '10px 20px' }}
        >
          Check Auth State
        </button>
        <button
          onClick={testAtomicLogin}
          disabled={loading() || !username() || !password()}
          style={{ 'margin-right': '10px', padding: '10px 20px' }}
        >
          Login (Atomic)
        </button>
        <button
          onClick={testAtomicUnlock}
          disabled={loading() || !username() || !pin()}
          style={{ 'margin-right': '10px', padding: '10px 20px' }}
        >
          Unlock (Atomic)
        </button>
        <button
          onClick={testAtomicLogout}
          disabled={loading() || !username()}
          style={{ padding: '10px 20px' }}
        >
          Logout (Atomic)
        </button>
      </div>

      {/* Status */}
      <div style={{ 'margin-bottom': '20px' }}>
        <h3>Status:</h3>
        <p style={{ color: error() ? 'red' : 'green' }}>{status()}</p>
        {error() && (
          <p style={{ color: 'red', 'font-size': '12px' }}>Error: {error()}</p>
        )}
      </div>

      {/* Auth State Display */}
      {authState() && (
        <div style={{ 'margin-top': '20px' }}>
          <h3>Auth State:</h3>
          <pre style={{
            background: '#f5f5f5',
            padding: '10px',
            'border-radius': '5px',
            overflow: 'auto',
            'font-size': '12px'
          }}>
            {JSON.stringify(authState(), null, 2)}
          </pre>
        </div>
      )}

      {/* Instructions */}
      <div style={{ 'margin-top': '40px', 'border-top': '1px solid #ccc', 'padding-top': '20px' }}>
        <h3>Test Flow:</h3>
        <ol>
          <li>Enter credentials (use same account from CLI test)</li>
          <li>Click <strong>Login (Atomic)</strong> - Should fetch from Nostr and create session</li>
          <li>Click <strong>Check Auth State</strong> - Should show authenticated but locked</li>
          <li>Click <strong>Unlock (Atomic)</strong> - Should decrypt keys and unlock</li>
          <li>Click <strong>Check Auth State</strong> - Should show unlocked with keys</li>
          <li>Click <strong>Logout (Atomic)</strong> - Should clear everything</li>
          <li>Click <strong>Check Auth State</strong> - Should show not authenticated</li>
        </ol>

        <h3>What to Look For:</h3>
        <ul>
          <li>✅ Login time should be fast (&lt;2s for Nostr fetch)</li>
          <li>✅ Auth state check should be instant (5-10ms)</li>
          <li>✅ State should be complete (no missing fields)</li>
          <li>✅ No errors in console about missing state</li>
          <li>✅ Logout should clear everything atomically</li>
        </ul>
      </div>
    </div>
  );
};
