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
        <div class="flex justify-center md:h-screen items-center">
            <div class="flex min-w-[400px] w-full max-w-2xl h-auto bg-white black-outline flex-col rounded-lg p-8">
                <div class="text-center mb-6">
                    <h1 class="text-2xl font-bold mb-2">Recover Your Vault</h1>
                    <p class="text-gray-600">
                        Enter your recovery key to restore your vault on this device
                    </p>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Recovery Key (Private Key Hex)
                        </label>
                        <textarea
                            value={recoveryKey()}
                            onInput={(e) => setRecoveryKey(e.currentTarget.value)}
                            placeholder="Enter your 64-character hex private key..."
                            class="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none font-mono text-sm"
                            rows="3"
                            disabled={isLoading()}
                        />
                    </div>
                    
                    <Show when={error()}>
                        <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                            {error()}
                        </div>
                    </Show>
                    
                    <div class="flex gap-3">
                        <button
                            onClick={handleCancel}
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            disabled={isLoading()}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRecover}
                            class="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                            disabled={isLoading()}
                        >
                            {isLoading() ? 'Recovering...' : 'Recover Vault'}
                        </button>
                    </div>
                    
                    <div class="mt-6 p-4 bg-yellow-50 rounded-lg">
                        <p class="text-sm text-yellow-800">
                            <strong>Note:</strong> This feature is for advanced users. Your recovery key is your Nostr private key in hex format. 
                            Keep it safe and never share it with anyone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};