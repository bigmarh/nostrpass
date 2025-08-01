import { Component, createSignal, For, Show, createMemo } from 'solid-js';
import { useAuth, useCryptoWorker } from '../providers';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';

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
  const { user } = useAuth();
  const cryptoWorker = getCryptoWorker();

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

  // Test handlers
  const testGetPublicKey = async () => {
    addLog('request', 'Testing GET_PUBLIC_KEY...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      // Get current session
      const currentUser = user();
      addLog('info', 'Current user from useAuth:', currentUser);
      
      if (!currentUser) {
        addLog('error', 'No user object found');
        return;
      }
      
      if (!currentUser.username && !currentUser.profile?.username) {
        addLog('error', 'No username found in user object');
        addLog('info', 'User object structure:', JSON.stringify(currentUser, null, 2));
        return;
      }
      
      const username = currentUser.username || currentUser.profile?.username;
      
      // Try to get vault data (doesn't require unlock)
      const vaultData = await cryptoWorker.getVaultData({ username });
      
      if (vaultData) {
        addLog('info', 'Vault data found:', {
          currentIdentityIndex: vaultData.currentIdentityIndex,
          identitiesCount: vaultData.identities?.length || 0
        });
        
        // Get the current identity
        const currentIdentity = vaultData.identities?.[vaultData.currentIdentityIndex || 0];
        if (currentIdentity?.publicKey) {
          addLog('response', 'GET_PUBLIC_KEY successful (from current identity):', { 
            publicKey: currentIdentity.publicKey,
            identityName: currentIdentity.name,
            identityIndex: vaultData.currentIdentityIndex || 0
          });
        } else {
          // Fallback to user object public key
          addLog('response', 'GET_PUBLIC_KEY successful (from user object):', { 
            publicKey: currentUser.publicKey,
            note: 'Using default public key, identity not found'
          });
        }
      } else {
        // No vault data, use user object
        addLog('response', 'GET_PUBLIC_KEY successful (no vault data):', { 
          publicKey: currentUser.publicKey,
          isAuthenticated: currentUser.isAuthenticated,
          hasPin: !!currentUser.vaultPinHash
        });
      }
    } catch (error) {
      addLog('error', 'GET_PUBLIC_KEY failed:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error
      });
    }
  };

  const testSignEvent = async () => {
    addLog('request', 'Testing SIGN_EVENT...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }

      const testEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Test event from VaultTestConsole',
        pubkey: currentUser.publicKey || ''
      };
      
      const result = await cryptoWorker.signEventWithSession({
        username: currentUser.profile.username,
        event: testEvent
      });
      addLog('response', 'SIGN_EVENT response:', result);
    } catch (error) {
      addLog('error', 'SIGN_EVENT failed:', error);
    }
  };

  const testSignMessage = async () => {
    addLog('request', 'Testing SIGN_MESSAGE...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }

      const testMessage = 'Hello from VaultTestConsole! This is test data to sign.';
      const result = await cryptoWorker.signMessageWithSession({
        username: currentUser.profile.username,
        message: testMessage
      });
      addLog('response', 'SIGN_MESSAGE response:', result);
    } catch (error) {
      addLog('error', 'SIGN_MESSAGE failed:', error);
    }
  };

  const testEncrypt = async () => {
    addLog('request', 'Testing ENCRYPT (NIP-04)...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }
      
      const plaintext = 'Hello from test console!';
      const recipientPubkey = currentUser.publicKey; // Encrypt to self for testing
      
      const ciphertext = await cryptoWorker.encryptWithSession({
        username: currentUser.profile.username,
        plaintext,
        recipientPubkey
      });
      addLog('response', 'ENCRYPT response:', { ciphertext });
      
      // Try to decrypt it back
      addLog('request', 'Testing DECRYPT with encrypted result...');
      const decrypted = await cryptoWorker.decryptWithSession({
        username: currentUser.profile.username,
        ciphertext,
        senderPubkey: recipientPubkey
      });
      addLog('response', 'DECRYPT response:', { plaintext: decrypted });
    } catch (error) {
      addLog('error', 'ENCRYPT/DECRYPT failed:', error);
    }
  };

  const testInitializeVault = async () => {
    addLog('request', 'Testing INITIALIZE_VAULT...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      // Generate a new xpriv
      const { xpriv } = await cryptoWorker.generateXpriv();
      
      // Derive master keypair
      const masterKeypair = await cryptoWorker.deriveKeypairFromXpriv({
        xpriv,
        index: 0
      });

      // Create test vault data
      const testUsername = 'testuser_' + Date.now();
      const testPassword = 'testpassword123';
      
      // Derive encryption key
      const { key: encryptionKey, salt } = await cryptoWorker.deriveKey({
        password: testPassword
      });

      // Encrypt xpriv
      const encryptedXpriv = await cryptoWorker.encryptData({
        data: xpriv,
        password: encryptionKey
      });

      const vaultData = {
        username: testUsername,
        publicKey: masterKeypair.publicKey,
        encryptedXpriv,
        salt,
        identities: [{
          index: 0,
          publicKey: masterKeypair.publicKey,
          name: 'Master',
          createdAt: Date.now()
        }],
        currentIdentityIndex: 0,
        hasPin: false,
        updatedAt: Date.now()
      };

      // Create session
      const sessionInfo = await cryptoWorker.createSession({
        username: testUsername,
        publicKey: masterKeypair.publicKey,
        privateKey: masterKeypair.privateKey,
        vaultData,
        sessionTimeout: 60
      });

      addLog('response', 'INITIALIZE_VAULT response:', {
        username: testUsername,
        publicKey: masterKeypair.publicKey,
        sessionInfo
      });
    } catch (error) {
      addLog('error', 'INITIALIZE_VAULT failed:', error);
    }
  };

  const testUnlockVault = async () => {
    addLog('request', 'Testing UNLOCK_VAULT...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }

      addLog('error', 'UNLOCK_VAULT requires password/PIN - cannot test without user input');
    } catch (error) {
      addLog('error', 'UNLOCK_VAULT failed:', error);
    }
  };

  const testLockVault = async () => {
    addLog('request', 'Testing LOCK_VAULT...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }

      cryptoWorker.clearSession({ username: currentUser.profile.username });
      addLog('response', 'Vault locked successfully');
    } catch (error) {
      addLog('error', 'LOCK_VAULT failed:', error);
    }
  };

  const testGetSession = async () => {
    addLog('request', 'Testing GET_SESSION...');
    try {
      if (!cryptoWorker) {
        addLog('error', 'Worker not ready yet');
        return;
      }

      const currentUser = user();
      if (!currentUser?.profile?.username) {
        addLog('error', 'No user logged in');
        return;
      }

      const session = await cryptoWorker.getSession({ 
        username: currentUser.profile.username 
      });
      addLog('response', 'GET_SESSION response:', session);
    } catch (error) {
      addLog('error', 'GET_SESSION failed:', error);
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'request': return 'text-blue-600';
      case 'response': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'info': return 'text-gray-600';
      default: return 'text-gray-800';
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
        class={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen() ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div class="bg-gray-800 text-white p-4 flex-shrink-0">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Vault Test Console</h3>
            <button
              onClick={() => setIsOpen(false)}
              class="text-gray-300 hover:text-white"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="text-sm text-gray-300 mt-2">
            Worker Ready: {cryptoWorker ? '✅' : '❌'}
          </div>
        </div>

        {/* Control Panel */}
        <div class="bg-gray-100 p-4 border-b flex-shrink-0">
          <div class="grid grid-cols-2 gap-2">
              <button
                onClick={testGetPublicKey}
                class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                disabled={!cryptoWorker}
              >
                Get Public Key
              </button>
              <button
                onClick={testSignEvent}
                class="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                disabled={!cryptoWorker}
              >
                Sign Event
              </button>
              <button
                onClick={testSignMessage}
                class="px-3 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 text-sm"
                disabled={!cryptoWorker}
              >
                Sign Message
              </button>
              <button
                onClick={testEncrypt}
                class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                disabled={!cryptoWorker}
              >
                Encrypt/Decrypt
              </button>
              <button
                onClick={testInitializeVault}
                class="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                disabled={!cryptoWorker}
              >
                Initialize Vault
              </button>
              <button
                onClick={testGetSession}
                class="px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                disabled={!cryptoWorker}
              >
                Get Session
              </button>
              <button
                onClick={testLockVault}
                class="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                disabled={!cryptoWorker}
              >
                Lock Vault
              </button>
              <button
                onClick={clearLogs}
                class="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm col-span-2"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {/* Console Output */}
          <div class="bg-black text-green-400 p-4 flex-1 overflow-y-auto font-mono text-sm">
            {logs().length === 0 ? (
              <div class="text-gray-500">No logs yet. Click a button to test functions.</div>
            ) : (
              <For each={logs()}>
                {(log) => (
                  <div class="mb-2">
                    <div class={`${getLogColor(log.type)}`}>
                      <span class="text-gray-500">[{log.timestamp}]</span>{' '}
                      <span class="font-bold">{log.type.toUpperCase()}:</span>{' '}
                      {log.message}
                    </div>
                    {log.data && (
                      <pre class="text-gray-300 ml-4 mt-1 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </For>
            )}
          </div>
      </div>
    </>
  );
};