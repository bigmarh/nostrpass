/**
 * VaultCoreDemo - Demonstration component using @nostrpass/vault-core
 *
 * This component demonstrates the new vault-core architecture
 * and can be used for testing the migration.
 */

import { Show, For, createSignal } from 'solid-js';
import { useVaultCore } from '../providers/VaultCoreProvider';

export function VaultCoreDemo() {
  const { auth, identities, permissions, vaultData } = useVaultCore();

  // Local state for forms
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [pin, setPin] = createSignal('');

  const handleLogin = async () => {
    const result = await auth.login(username(), password());
    if (result.success) {
      console.log('Login successful!', result.user);
    } else {
      console.error('Login failed:', result.error);
    }
  };

  const handleUnlock = async () => {
    const result = await auth.unlockVault(pin());
    if (result.success) {
      console.log('Vault unlocked!');
    } else {
      console.error('Unlock failed:', result.error);
    }
  };

  return (
    <div style={{
      padding: '20px',
      'max-width': '800px',
      margin: '0 auto',
      'font-family': 'system-ui'
    }}>
      <h1>🔐 VaultCore Demo</h1>

      {/* Auth Status */}
      <section style={{
        padding: '15px',
        'background-color': '#f5f5f5',
        'border-radius': '8px',
        'margin-bottom': '20px'
      }}>
        <h2>Authentication Status</h2>
        <Show
          when={auth.user()}
          fallback={
            <div>
              <p style={{ color: '#666' }}>Not logged in</p>

              {/* Login Form */}
              <div style={{ 'margin-top': '15px' }}>
                <h3>Login</h3>
                <input
                  type="text"
                  placeholder="Username"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  style={{
                    padding: '8px',
                    'margin-right': '10px',
                    'border-radius': '4px',
                    border: '1px solid #ccc'
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  style={{
                    padding: '8px',
                    'margin-right': '10px',
                    'border-radius': '4px',
                    border: '1px solid #ccc'
                  }}
                />
                <button
                  onClick={handleLogin}
                  style={{
                    padding: '8px 16px',
                    'background-color': '#4CAF50',
                    color: 'white',
                    border: 'none',
                    'border-radius': '4px',
                    cursor: 'pointer'
                  }}
                >
                  Login
                </button>
              </div>
            </div>
          }
        >
          {(user) => (
            <div>
              <p style={{ color: '#4CAF50', 'font-weight': 'bold' }}>
                ✓ Logged in as: {user().profile.username}
              </p>
              <p style={{ 'font-size': '12px', color: '#666' }}>
                Public Key: {user().publicKey.slice(0, 16)}...
              </p>
              <button
                onClick={() => auth.logout()}
                style={{
                  padding: '8px 16px',
                  'background-color': '#f44336',
                  color: 'white',
                  border: 'none',
                  'border-radius': '4px',
                  cursor: 'pointer',
                  'margin-top': '10px'
                }}
              >
                Logout
              </button>
            </div>
          )}
        </Show>

        {/* Lock Status */}
        <Show when={auth.user()}>
          <div style={{ 'margin-top': '15px', 'padding-top': '15px', 'border-top': '1px solid #ddd' }}>
            <Show
              when={auth.isLocked()}
              fallback={<p style={{ color: '#4CAF50' }}>🔓 Vault Unlocked</p>}
            >
              <p style={{ color: '#ff9800' }}>🔒 Vault Locked</p>
              <div style={{ 'margin-top': '10px' }}>
                <input
                  type="password"
                  placeholder="Enter PIN"
                  value={pin()}
                  onInput={(e) => setPin(e.currentTarget.value)}
                  style={{
                    padding: '8px',
                    'margin-right': '10px',
                    'border-radius': '4px',
                    border: '1px solid #ccc'
                  }}
                />
                <button
                  onClick={handleUnlock}
                  style={{
                    padding: '8px 16px',
                    'background-color': '#2196F3',
                    color: 'white',
                    border: 'none',
                    'border-radius': '4px',
                    cursor: 'pointer'
                  }}
                >
                  Unlock
                </button>
              </div>
            </Show>

            <Show when={!auth.isLocked()}>
              <button
                onClick={() => auth.lockVault()}
                style={{
                  padding: '8px 16px',
                  'background-color': '#ff9800',
                  color: 'white',
                  border: 'none',
                  'border-radius': '4px',
                  cursor: 'pointer',
                  'margin-top': '10px'
                }}
              >
                Lock Vault
              </button>
            </Show>
          </div>
        </Show>
      </section>

      {/* Identities */}
      <Show when={auth.user() && !auth.isLocked()}>
        <section style={{
          padding: '15px',
          'background-color': '#f5f5f5',
          'border-radius': '8px',
          'margin-bottom': '20px'
        }}>
          <h2>Identities</h2>
          <Show
            when={!vaultData.loading()}
            fallback={<p>Loading identities...</p>}
          >
            <Show
              when={identities.list().length > 0}
              fallback={<p style={{ color: '#666' }}>No identities yet</p>}
            >
              <div style={{ 'margin-top': '10px' }}>
                <For each={identities.list()}>
                  {(identity, index) => (
                    <div style={{
                      padding: '10px',
                      'background-color': 'white',
                      'border-radius': '4px',
                      'margin-bottom': '10px',
                      border: '1px solid #ddd'
                    }}>
                      <strong>{identity.name || `Identity ${index()}`}</strong>
                      <p style={{ 'font-size': '12px', color: '#666', margin: '5px 0' }}>
                        Purpose: {identity.purpose || 'general'}
                      </p>
                      <p style={{ 'font-size': '11px', color: '#999', margin: 0 }}>
                        Public Key: {identity.publicKey?.slice(0, 16)}...
                      </p>
                    </div>
                  )}
                </For>
                <p style={{ 'font-size': '14px', 'margin-top': '10px' }}>
                  Total: {identities.list().length} identit{identities.list().length === 1 ? 'y' : 'ies'}
                </p>
              </div>
            </Show>
          </Show>
        </section>
      </Show>

      {/* Permissions */}
      <Show when={auth.user()}>
        <section style={{
          padding: '15px',
          'background-color': '#f5f5f5',
          'border-radius': '8px',
          'margin-bottom': '20px'
        }}>
          <h2>App Permissions</h2>
          <Show
            when={!permissions.loading()}
            fallback={<p>Loading permissions...</p>}
          >
            <Show
              when={permissions.list().length > 0}
              fallback={<p style={{ color: '#666' }}>No app permissions yet</p>}
            >
              <For each={permissions.list()}>
                {(perm) => (
                  <div style={{
                    padding: '10px',
                    'background-color': 'white',
                    'border-radius': '4px',
                    'margin-bottom': '10px',
                    border: '1px solid #ddd'
                  }}>
                    <strong>{perm.appName || perm.appId}</strong>
                    <p style={{ 'font-size': '12px', color: '#666', margin: '5px 0' }}>
                      {perm.appId}
                    </p>
                    <button
                      onClick={() => {
                        const u = auth.user();
                        if (u) {
                          permissions.revoke(perm.appId);
                        }
                      }}
                      style={{
                        padding: '4px 12px',
                        'background-color': '#f44336',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '12px',
                        'margin-top': '5px'
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </section>
      </Show>

      {/* Debug Info */}
      <section style={{
        padding: '15px',
        'background-color': '#f0f0f0',
        'border-radius': '8px',
        'font-size': '12px',
        'font-family': 'monospace'
      }}>
        <h3>Debug Info</h3>
        <pre style={{ 'white-space': 'pre-wrap', 'word-break': 'break-all' }}>
          User: {auth.user() ? JSON.stringify({
            username: auth.user()!.profile.username,
            publicKey: auth.user()!.publicKey.slice(0, 16) + '...',
            isAuthenticated: auth.user()!.isAuthenticated
          }, null, 2) : 'null'}
          {'\n\n'}
          Locked: {auth.isLocked() ? 'true' : 'false'}
          {'\n\n'}
          Identities: {identities.list().length}
          {'\n\n'}
          Permissions: {permissions.list().length}
        </pre>
      </section>
    </div>
  );
}
