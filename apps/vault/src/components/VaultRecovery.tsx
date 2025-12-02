import { Component, createSignal, Show } from 'solid';
import { useParams, useNavigate } from '@solidjs/router';
import { useAuth, useMessenger, useEnvironment, useCryptoWorker, useCryptoWorkerReady } from '../providers';
import { getVaultFromNostr } from '@nostrpass/nostrHelpers';
import { getPublicKey } from 'nostr-tools/pure';
import { generateSecretKey } from 'nostr-tools';

export const VaultRecovery: Component = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { send } = useMessenger();
    const { getRelays } = useEnvironment();
    const cryptoReady = useCryptoWorkerReady();
    const cryptoWorker = useCryptoWorker();
    const [recoveryKey, setRecoveryKey] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    
    const handleRecover = async () => {
        if (!recoveryKey().trim()) {
            setError('Please enter your recovery key');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            // Parse the recovery key (hex private key)
            const privateKeyHex = recoveryKey().trim();
            
            // Validate it's a valid hex string
            if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
                throw new Error('Invalid recovery key format');
            }
            
            // Convert hex to Uint8Array
            const privateKey = new Uint8Array(
                privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            );
            
            // Get public key
            const publicKey = getPublicKey(privateKey);
            
            // Try to fetch vault from Nostr
            const relays = getRelays();
            const vaultData = await getVaultFromNostr(publicKey, privateKeyHex, relays);
            
            if (!vaultData) {
                throw new Error('No vault found for this recovery key');
            }
            
            // Store vault data in worker
            const username = vaultData.username || 'recovered_user';
            
            if (!cryptoReady() || !cryptoWorker) {
                throw new Error('Crypto worker not ready');
            }
            
            // Create session in worker with recovered vault
            await cryptoWorker.createSession({
                username,
                publicKey,
                privateKey: privateKeyHex,
                vaultData: {
                    ...vaultData,
                    username,
                    publicKey,
                    updatedAt: Date.now()
                },
                sessionTimeout: 60
            });
            
            console.log('✅ Vault recovered and stored in worker');
            
            // Navigate to login
            navigate(`/${params.app}?recovered=true`);
            
        } catch (err) {
            console.error('Recovery failed:', err);
            setError(err instanceof Error ? err.message : 'Recovery failed');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCancel = () => {
        navigate(`/${params.app}`);
    };
    
    return (
        <div class="flex justify-center md:h-screen items-center bg-white dark:bg-gray-900">
            <div class="flex min-w-[400px] w-full max-w-2xl h-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex-col rounded-lg p-8">
                <div class="text-center mb-6">
                    <h1 class="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Recover Your Vault</h1>
                    <p class="text-gray-600 dark:text-gray-400">
                        Enter your recovery key to restore your vault on this device
                    </p>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Recovery Key (Private Key Hex)
                        </label>
                        <textarea
                            value={recoveryKey()}
                            onInput={(e) => setRecoveryKey(e.currentTarget.value)}
                            placeholder="Enter your 64-character hex private key..."
                            class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            rows="3"
                            disabled={isLoading()}
                        />
                    </div>
                    
                    <Show when={error()}>
                        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm">
                            {error()}
                        </div>
                    </Show>
                    
                    <div class="flex gap-3">
                        <button
                            onClick={handleCancel}
                            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                            disabled={isLoading()}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRecover}
                            class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 font-medium"
                            disabled={isLoading()}
                        >
                            {isLoading() ? 'Recovering...' : 'Recover Vault'}
                        </button>
                    </div>
                    
                    <div class="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p class="text-sm text-yellow-800 dark:text-yellow-400">
                            <strong>Note:</strong> This feature is for advanced users. Your recovery key is your Nostr private key in hex format. 
                            Keep it safe and never share it with anyone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};