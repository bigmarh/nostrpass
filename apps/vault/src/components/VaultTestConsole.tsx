import { Component, createSignal, For, Show, createMemo } from 'solid-js';
import { useAuth, useCryptoWorker } from '../providers';
import { useParams } from '@solidjs/router';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';
import { PermissionService } from '../services/permissionService';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  message: string;
  data?: any;
}

export const VaultTestConsole: Component = () => {
  const [logs, setLogs] = createSignal<LogEntry[]>([]);
  const [isOpen, setIsOpen] = createSignal(false);
  const [simulatedOrigin, setSimulatedOrigin] = createSignal<string>('');
  const { user } = useAuth();
  const cryptoWorker = useCryptoWorker();
  const params = useParams();
  const permissionService = PermissionService.getInstance();

  // Get current app origin
  const currentAppOrigin = createMemo(() => {
    if (params.app) {
      return desanitizeDomain(params.app);
    }
    return simulatedOrigin() || 'https://example.com';
  });

  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    setLogs(prev => [...prev, entry]);
  };

  const clearLogs = () => setLogs([]);

  // Test actual implementation functions
  const testGetPublicKey = async () => {
    addLog('request', `Testing GET_PUBLIC_KEY from origin: ${currentAppOrigin()}`);
    
    try {
      const currentUser = user();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Check permission
      const permissionCheck = await permissionService.checkPermission(
        currentUser.profile.username,
        currentAppOrigin(),
        'getPublicKey'
      );

      addLog('info', 'Permission check result:', permissionCheck);

      if (permissionCheck.allowed) {
        // The public key is stored in the user object, which was derived from the current identity
        // when the user logged in. The identity itself only stores the derivation path.
        const publicKey = currentUser.publicKey;
        
        // Get additional info about the current identity
        let identityInfo = { nickname: 'Personal', index: 0 };
        if (cryptoWorker && currentUser.profile?.username) {
          try {
            const vaultData = await cryptoWorker.getVaultData({ 
              username: currentUser.profile.username 
            });
            
            if (vaultData?.identities) {
              const currentIndex = vaultData.currentIdentityIndex || 0;
              const currentIdentity = vaultData.identities[currentIndex];
              if (currentIdentity) {
                identityInfo = {
                  nickname: currentIdentity.nickname || 'Personal',
                  index: currentIndex
                };
              }
            }
          } catch (error) {
          }
        }

        addLog('response', 'GET_PUBLIC_KEY successful:', { 
          publicKey: publicKey,
          identityName: identityInfo.nickname,
          identityIndex: identityInfo.index
        });
        
        return publicKey;
      } else {
        addLog('error', 'Permission denied', { level: permissionCheck.level });
      }
    } catch (error) {
      addLog('error', 'GET_PUBLIC_KEY failed:', error);
    }
  };

  const testSignEvent = async (kind: number = 1) => {
    addLog('request', `Testing SIGN_EVENT (kind ${kind}) from origin: ${currentAppOrigin()}`);
    
    try {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Check permission
      const permissionCheck = await permissionService.checkPermission(
        currentUser.profile.username,
        currentAppOrigin(),
        'signEvent',
        kind
      );

      addLog('info', 'Permission check result:', permissionCheck);

      if (permissionCheck.allowed) {
        // Create test event
        const testEvent = {
          kind,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: `Test event (kind ${kind}) from VaultTestConsole`,
          pubkey: currentUser.publicKey || ''
        };

        // Sign with worker
        const result = await cryptoWorker.signEventWithSession({
          username: currentUser.profile.username,
          event: testEvent
        });

        addLog('response', 'Event signed successfully:', result.event);
        return result.event;
      } else {
        addLog('error', 'Permission denied', { level: permissionCheck.level });
      }
    } catch (error) {
      addLog('error', 'SIGN_EVENT failed:', error);
    }
  };

  const testSignData = async () => {
    addLog('request', `Testing SIGN_DATA from origin: ${currentAppOrigin()}`);
    
    try {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Check permission
      const permissionCheck = await permissionService.checkPermission(
        currentUser.profile.username,
        currentAppOrigin(),
        'signData'
      );

      addLog('info', 'Permission check result:', permissionCheck);

      if (permissionCheck.allowed) {
        const testMessage = 'Hello from VaultTestConsole! This is test data to sign.';
        
        // Sign with worker
        const result = await cryptoWorker.signMessageWithSession({
          username: currentUser.profile.username,
          message: testMessage
        });

        addLog('response', 'Data signed successfully:', {
          message: testMessage,
          signature: result.signature
        });
        return result.signature;
      } else {
        addLog('error', 'Permission denied', { level: permissionCheck.level });
      }
    } catch (error) {
      addLog('error', 'SIGN_DATA failed:', error);
    }
  };

  const testEncrypt = async () => {
    addLog('request', `Testing ENCRYPT (NIP-04) from origin: ${currentAppOrigin()}`);
    
    try {
      const currentUser = user();
      if (!currentUser || !cryptoWorker) {
        throw new Error('User not authenticated or crypto not ready');
      }

      // Check permission
      const permissionCheck = await permissionService.checkPermission(
        currentUser.profile.username,
        currentAppOrigin(),
        'nip04'
      );

      addLog('info', 'Permission check result:', permissionCheck);

      if (permissionCheck.allowed) {
        const plaintext = 'Hello from test console!';
        const recipientPubkey = currentUser.publicKey; // Encrypt to self for testing
        
        // Encrypt with worker
        const ciphertext = await cryptoWorker.encryptWithSession({
          username: currentUser.profile.username,
          plaintext,
          recipientPubkey
        });

        addLog('response', 'Encrypted successfully:', { 
          plaintext,
          ciphertext,
          recipientPubkey
        });
        
        // Test decrypt immediately
        addLog('info', 'Testing decrypt with the encrypted result...');
        const decrypted = await cryptoWorker.decryptWithSession({
          username: currentUser.profile.username,
          ciphertext,
          senderPubkey: recipientPubkey
        });
        
        addLog('response', 'Decrypted successfully:', { 
          decrypted,
          matches: decrypted === plaintext 
        });
        
        return ciphertext;
      } else {
        addLog('error', 'Permission denied', { level: permissionCheck.level });
      }
    } catch (error) {
      addLog('error', 'ENCRYPT/DECRYPT failed:', error);
    }
  };

  const testGetAuthStatus = async () => {
    addLog('request', 'Testing GET_AUTH_STATUS');
    
    try {
      const currentUser = user();
      const authStatus = {
        isAuthenticated: !!currentUser,
        publicKey: currentUser?.publicKey || null,
        username: currentUser?.profile?.username || null,
        hasPin: !!currentUser?.vaultPinHash,
        identities: 0
      };

      if (currentUser && cryptoWorker) {
        const vaultData = await cryptoWorker.getVaultData({ 
          username: currentUser.profile.username 
        });
        if (vaultData) {
          authStatus.identities = vaultData.identities?.length || 0;
        }
      }

      addLog('response', 'Auth status:', authStatus);
      return authStatus;
    } catch (error) {
      addLog('error', 'GET_AUTH_STATUS failed:', error);
    }
  };

  const testDifferentEventKinds = async () => {
    const eventKinds = [
      { kind: 0, name: 'Metadata' },
      { kind: 1, name: 'Text Note' },
      { kind: 3, name: 'Contact List' },
      { kind: 4, name: 'Encrypted DM' },
      { kind: 7, name: 'Reaction' },
      { kind: 9734, name: 'Zap Request' },
      { kind: 30023, name: 'Long-form Content' }
    ];

    for (const { kind, name } of eventKinds) {
      addLog('info', `Testing signing event kind ${kind} (${name})...`);
      await testSignEvent(kind);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Permission management functions
  const grantTestPermission = async () => {
    const currentUser = user();
    if (!currentUser?.profile?.username) {
      addLog('error', 'No user logged in');
      return;
    }

    try {
      addLog('info', 'Granting ALLOW permission for kind 30023 (Long-form Content)');
      
      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        currentAppOrigin(),
        {
          kinds: { 30023: 'ALLOW' }
        },
        'Test App'
      );
      
      addLog('response', 'Permission granted successfully');
    } catch (error) {
      addLog('error', 'Failed to grant permission:', error);
    }
  };

  const viewCurrentPermissions = async () => {
    const currentUser = user();
    if (!currentUser?.profile?.username) {
      addLog('error', 'No user logged in');
      return;
    }

    try {
      const permissions = await permissionService.getAppPermissions(
        currentUser.profile.username,
        currentAppOrigin()
      );
      
      addLog('info', `Current permissions for ${currentAppOrigin()}:`, permissions || 'No permissions set');
    } catch (error) {
      addLog('error', 'Failed to get permissions:', error);
    }
  };

  const revokeAllPermissions = async () => {
    const currentUser = user();
    if (!currentUser?.profile?.username) {
      addLog('error', 'No user logged in');
      return;
    }

    try {
      addLog('info', `Revoking all permissions for ${currentAppOrigin()}`);
      
      await permissionService.revokeAppPermissions(
        currentUser.profile.username,
        currentAppOrigin()
      );
      
      addLog('response', 'All permissions revoked');
    } catch (error) {
      addLog('error', 'Failed to revoke permissions:', error);
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'request': return 'text-blue-400';
      case 'response': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <>
      {/* Toggle Button - Fixed position */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="fixed right-4 bottom-4 z-50 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-all"
        title="Toggle Test Console"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </button>

      {/* Slide-out Panel */}
      <div 
        class={`fixed right-0 top-0 h-full w-[480px] bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen() ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div class="bg-gray-800 text-white p-4 flex-shrink-0 border-b border-gray-700">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Vault Implementation Test</h3>
            <button
              onClick={() => setIsOpen(false)}
              class="text-gray-300 hover:text-white"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="text-sm text-gray-400 mt-2 space-y-1">
            <div>User: {user()?.profile?.username || 'Not logged in'}</div>
            <div>Testing as origin: {currentAppOrigin()}</div>
            <div>Crypto Worker: {cryptoWorker ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Origin Override */}
        <div class="bg-gray-800 p-3 border-b border-gray-700 flex-shrink-0">
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="Override origin (e.g., https://app.com)"
              value={simulatedOrigin()}
              onInput={(e) => setSimulatedOrigin(e.currentTarget.value)}
              class="flex-1 px-3 py-1.5 bg-gray-700 text-white rounded text-sm placeholder-gray-400"
            />
            <button
              onClick={() => setSimulatedOrigin('')}
              class="px-3 py-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Control Panel */}
        <div class="bg-gray-800 p-4 border-b border-gray-700 flex-shrink-0">
          <div class="space-y-3">
            <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Core Operations</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                onClick={testGetPublicKey}
                class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                disabled={!user() || !cryptoWorker}
              >
                Get Public Key
              </button>
              <button
                onClick={() => testSignEvent(1)}
                class="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm transition-colors"
                disabled={!user() || !cryptoWorker}
              >
                Sign Event (Kind 1)
              </button>
              <button
                onClick={testSignData}
                class="px-3 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 text-sm transition-colors"
                disabled={!user() || !cryptoWorker}
              >
                Sign Data
              </button>
              <button
                onClick={testEncrypt}
                class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition-colors"
                disabled={!user() || !cryptoWorker}
              >
                Encrypt/Decrypt
              </button>
              <button
                onClick={testGetAuthStatus}
                class="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm transition-colors"
              >
                Get Auth Status
              </button>
              <button
                onClick={testDifferentEventKinds}
                class="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm transition-colors"
                disabled={!user() || !cryptoWorker}
              >
                Test All Kinds
              </button>
            </div>

            <div class="text-xs text-gray-400 uppercase tracking-wider mt-4 mb-2">Permission Management</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                onClick={viewCurrentPermissions}
                class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm transition-colors"
                disabled={!user()}
              >
                View Permissions
              </button>
              <button
                onClick={grantTestPermission}
                class="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 text-sm transition-colors"
                disabled={!user()}
              >
                Grant Test Permission
              </button>
              <button
                onClick={revokeAllPermissions}
                class="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm transition-colors col-span-2"
                disabled={!user()}
              >
                Revoke All Permissions
              </button>
            </div>

            <button
              onClick={clearLogs}
              class="w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm transition-colors mt-2"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Console Output */}
        <div class="bg-black p-4 flex-1 overflow-y-auto font-mono text-xs">
          {logs().length === 0 ? (
            <div class="text-gray-500">
              <div>This console tests the vault implementation directly.</div>
              <div class="mt-2">Click buttons to test core functionality.</div>
              <div class="mt-2">Tests include:</div>
              <div class="ml-2">• Permission checks via PermissionService</div>
              <div class="ml-2">• Crypto operations via CryptoWorker</div>
              <div class="ml-2">• Vault data access</div>
            </div>
          ) : (
            <For each={logs()}>
              {(log) => (
                <div class="mb-3">
                  <div class={`${getLogColor(log.type)}`}>
                    <span class="text-gray-600">[{log.timestamp}]</span>{' '}
                    <span class="font-bold">{log.type.toUpperCase()}:</span>{' '}
                    {log.message}
                  </div>
                  {log.data && (
                    <pre class="text-gray-400 ml-4 mt-1 whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </For>
          )}
        </div>

        {/* Status Bar */}
        <div class="bg-gray-800 px-4 py-2 text-xs text-gray-400 border-t border-gray-700 flex-shrink-0">
          <Show when={user()?.profile?.username}>
            <div>Ready to test • Services: {cryptoWorker ? '✅' : '❌'}</div>
          </Show>
          <Show when={!user()}>
            <div>Please log in to test vault operations</div>
          </Show>
        </div>
      </div>
    </>
  );
};