import { Component, createSignal, Show } from 'solid-js';
import { useAuth, useMessenger, useNostrComms, useCryptoWorkerReady, useCryptoWorker, useEnvironment } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import PinSetup from './PinSetup';
import PinVerification from './PinVerification';
import { permissionService } from '../services/permissionService';
import { DEFAULT_PERMISSIONS, DEFAULT_GET_PUBLIC_KEY } from '@nostrpass/types';

function desanitizeDomain(domain: string) {
    return domain.replace(/_/g, '.');
}

export const Login: Component = () => {
    const [isSignup, setIsSignup] = createSignal(false);
    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [loadingStatus, setLoadingStatus] = createSignal('');
    const [showPinSetup, setShowPinSetup] = createSignal(false);
    const [showPinUnlock, setShowPinUnlock] = createSignal(false);
    const [tempAccountData, setTempAccountData] = createSignal<{username: string, password: string, publicKey: string} | null>(null);

    const params = useParams();
    const navigate = useNavigate();
    const { send } = useMessenger();
    const { login, createAccount, hasPinVault, unlockVault, user } = useAuth();
    const { checkUsernameAvailable, registerUsername, isConnected } = useNostrComms();
    
    const cryptoReady = useCryptoWorkerReady();
    const cryptoWorker = useCryptoWorker();
    const { getRelays } = useEnvironment();

    const handleHideVault = () => {
        send('HIDE_VAULT');
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            if (isSignup()) {
                await handleSignup();
            } else {
                await handleLogin();
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An error occurred');
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const handleSignup = async () => {
        // Validation
        if (!username().trim()) {
            throw new Error('Username is required');
        }
        
        if (username().length < 3) {
            throw new Error('Username must be at least 3 characters');
        }
        
        if (password() !== confirmPassword()) {
            throw new Error('Passwords do not match');
        }
        
        if (password().length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Check if crypto is ready
        if (!cryptoReady()) {
            throw new Error('Crypto module is not ready. Please refresh and try again.');
        }

        // Check if Nostr is connected
        if (!isConnected()) {
            throw new Error('Not connected to Nostr relays. Please try again.');
        }

        // Normalize username
        const normalizedUsername = username().trim().toLowerCase();
        
        // Check username availability
        setLoadingStatus('Checking username availability...');
        const isAvailable = await checkUsernameAvailable(normalizedUsername);
        
        if (!isAvailable) {
            throw new Error('Username is already taken');
        }

        // Store temporary account data for PIN setup
        setTempAccountData({
            username: normalizedUsername,
            password: password(),
            publicKey: '' // Will be filled after account creation
        });
        
        // Show PIN setup modal first
        setShowPinSetup(true);
        setIsLoading(false);
    };
    // Reactive signal for background that updates based on time
    const getTimeBasedBackground = () => {
        const timeOfDay = new Date().getHours();
        
        if (timeOfDay < 6 || timeOfDay > 20) {
            return 3; // Night
        } else if (timeOfDay < 15) {
            return 1; // Morning/Day
        } else if (timeOfDay < 18) {
            return 2; // Evening
        } else {
            return 0; // Default
        }
    };
    

    const [backgroundIndex] = createSignal(getTimeBasedBackground());
    const changeBackground = () => backgroundIndex();

    const handleLogin = async () => {
        // Validation
        if (!username().trim() || !password().trim()) {
            throw new Error('Username and password are required');
        }

        // Check if crypto is ready
        if (!cryptoReady()) {
            throw new Error('Crypto module is not ready. Please refresh and try again.');
        }

        // Check if Nostr is connected
        if (!isConnected()) {
            throw new Error('Not connected to Nostr relays. Please try again.');
        }

        // Login with password (new flow uses LoginObj lookup)
        setLoadingStatus('Verifying credentials...');
        await login(password(), username().trim().toLowerCase());

        setLoadingStatus('Loading your vault...');

        // Show PIN unlock prompt instead of closing immediately
        // This ensures the account is fully unlocked before closing
        setIsLoading(false);
        setShowPinUnlock(true);
    };

    const toggleMode = () => {
        setIsSignup(!isSignup());
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setError('');
        setLoadingStatus('');
    };

    const handlePinSet = async (pin: string) => {
        const accountData = tempAccountData();
        if (!accountData) return;
        
        try {
            setIsLoading(true);
            setShowPinSetup(false);
            setLoadingStatus('Securing your vault with PIN...');
            
            // Create account with PIN encryption
            const { publicKey } = await createAccount(accountData.username, accountData.password, pin, undefined);

            // Register username on Nostr with user's relay preferences
            setLoadingStatus('Registering username on Nostr network...');


            // Get the user's relays from environment config
            const userRelays = getRelays();

            await registerUsername(accountData.username, publicKey, 'NostrPass Vault', userRelays);

            setLoadingStatus('Saving vault to Nostr...');

            // PRE model: initial snapshot is saved during account creation; operational updates are PRE streams
            setLoadingStatus('Finalizing registration...');

            // After signup, trigger simple-auth prompt overlay
            const appId = params.app;
            const appOrigin = appId ? desanitizeDomain(appId) : window.location.origin;

            console.log('📱 [SIGNUP] Triggering simple auth for app:', appOrigin);

            // Dispatch event to trigger simple-auth prompt overlay
            // The prompt will show on top of current page and handle vault closing after user action
            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
                detail: {
                    appOrigin: appOrigin,
                    appName: appOrigin,
                    identityIndex: 0,
                    afterSignup: true
                }
            }));

            // Clear loading state to show the prompt
            setIsLoading(false);
            setLoadingStatus('');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An error occurred');
            setShowPinSetup(false);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const handlePinSetWithRecovery = async (pin: string, questions: string[], answers: string[]) => {
        const accountData = tempAccountData();
        if (!accountData) return;

        try {
            setIsLoading(true);
            setShowPinSetup(false);
            setLoadingStatus('Securing your vault with PIN and recovery questions...');

            const { publicKey } = await createAccount(
                accountData.username,
                accountData.password,
                pin,
                { questions, answers }
            );

            // Register username on Nostr with user's relay preferences
            setLoadingStatus('Registering username on Nostr network...');

            // Get the user's relays from environment config
            const userRelays = getRelays();

            await registerUsername(accountData.username, publicKey, 'NostrPass Vault', userRelays);

            setLoadingStatus('Saving vault to Nostr...');

            // PRE model: initial snapshot is saved during account creation; operational updates are PRE streams
            setLoadingStatus('Finalizing registration...');

            // After signup, trigger simple-auth prompt overlay
            const appId = params.app;
            const appOrigin = appId ? desanitizeDomain(appId) : window.location.origin;

            console.log('📱 [SIGNUP] Triggering simple auth for app:', appOrigin);

            // Dispatch event to trigger simple-auth prompt overlay
            // The prompt will show on top of current page and handle vault closing after user action
            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
                detail: {
                    appOrigin: appOrigin,
                    appName: appOrigin,
                    identityIndex: 0,
                    afterSignup: true
                }
            }));

            // Clear loading state to show the prompt
            setIsLoading(false);
            setLoadingStatus('');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An error occurred');
            setShowPinSetup(false);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const handlePinUnlockSuccess = async (pin: string) => {
        try {
            setIsLoading(true);
            setLoadingStatus('Unlocking vault and fetching identities from Nostr...');

            // Unlock the vault with the PIN - this will fetch VaultObj from Nostr if needed
            const success = await unlockVault(pin);

            if (success) {
                setLoadingStatus('Vault unlocked successfully!');

                // After login+unlock, navigate to account picker so user can select identity
                const appOrigin = params.app ? desanitizeDomain(params.app) : 'unknown';
                navigate(`/${params.app || 'vault'}/account-picker?appOrigin=${encodeURIComponent(appOrigin)}&appName=${encodeURIComponent(appOrigin)}&afterLogin=true`);
            } else {
                throw new Error('Failed to unlock vault. Please try again.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unlock vault');
            setShowPinUnlock(false);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const handlePinUnlockFailed = () => {
        // Too many failed attempts
        setShowPinUnlock(false);
        setError('Too many failed PIN attempts. Please log in again.');
    };

    return (
        <div class="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
            <div class="flex w-full h-full bg-white dark:bg-gray-800 flex-col md:flex-row">
                <div style={`background-image: url('/egg_background_${changeBackground()}.png')`} class={`flex flex-col items-center md:rounded-l-lg bg-bottom bg-contain md:bg-cover md:bg-center justify-center pt-8 pb-2 px-4 md:p-4 md:w-48 md:min-w-[12rem]`}>
                    <div class="w-32 h-32 ">
                        <img class="w-full h-full " src="/logo.svg" alt="NostrPass Logo" />
                    </div>
                   
                </div>
                <div class="flex flex-1 flex-col items-center justify-center min-w-0 pt-2 pb-6 px-6 md:p-8">
                    <div class="w-full max-w-sm space-y-4">
                        <div class="text-center">
                            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{isSignup() ? 'Create Account' : 'Welcome Back'}</h1>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {isSignup() ? 'Sign up to get started' : 'Sign in to your account'}
                            </p>
                            {params.app && (
                                <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">App: {desanitizeDomain(params.app)}</p>
                            )}
                        </div>
                        
                        <form onSubmit={handleSubmit} class={`flex w-full flex-col gap-3 ${isSignup() ? 'signup-form' : 'login-form'}`} method="post">
                            <div class="w-full">
                                <label for="username" class="sr-only">Username</label>
                                <input 
                                    type="text" 
                                    name="username"
                                    id="username"
                                    placeholder="Username" 
                                    value={username()}
                                    onInput={(e) => setUsername(e.currentTarget.value)}
                                    class="w-full border-2 border-gray-300 dark:border-gray-600 p-2 rounded-md focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" 
                                    autocomplete="username"
                                    required
                                    disabled={isLoading()}
                                />
                            </div>
                            <div class="w-full">
                                <label for="password" class="sr-only">Password</label>
                                <input 
                                    type="password" 
                                    name={isSignup() ? "new-password" : "current-password"}
                                    id={isSignup() ? "new-password" : "current-password"}
                                    placeholder="Password" 
                                    value={password()}
                                    onInput={(e) => setPassword(e.currentTarget.value)}
                                    class="w-full p-2 rounded-md border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" 
                                    autocomplete={isSignup() ? "new-password" : "current-password"}
                                    required
                                    disabled={isLoading()}
                                />
                            </div>
                            
                            <Show when={isSignup()}>
                                <div class="w-full">
                                    <label for="confirm-password" class="sr-only">Confirm Password</label>
                                    <input 
                                        type="password" 
                                        name="confirm-password"
                                        id="confirm-password"
                                        placeholder="Confirm Password" 
                                        value={confirmPassword()}
                                        onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                        class="w-full p-2 rounded-md border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" 
                                        autocomplete="new-password"
                                        required
                                        disabled={isLoading()}
                                    />
                                </div>
                            </Show>
                            
                            <Show when={error()}>
                                <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm">
                                    {error()}
                                </div>
                            </Show>
                            
                            <Show when={!cryptoReady()}>
                                <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 px-3 py-2 rounded-md text-sm">
                                    Initializing security module...
                                </div>
                            </Show>
                            
                            <Show when={!isConnected()}>
                                <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 px-3 py-2 rounded-md text-sm">
                                    Connecting to Nostr relays...
                                </div>
                            </Show>
                            
                            <Show when={isLoading() && loadingStatus()}>
                                <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-md text-sm flex items-center gap-2">
                                    <svg class="animate-spin h-4 w-4 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {loadingStatus()}
                                </div>
                            </Show>
                            
                            <button 
                                type="submit" 
                                class="w-full p-2 rounded-md bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors font-medium flex items-center justify-center gap-2"
                                disabled={isLoading() || !cryptoReady() || !isConnected()}
                            >
                                <Show when={isLoading()}>
                                    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </Show>
                                {isLoading() ? (isSignup() ? 'Creating Account...' : 'Signing In...') : (isSignup() ? 'Create Account' : 'Sign In')}
                            </button>
                        </form>
                        
                        <div class="text-center space-y-2">
                            <button 
                                onClick={toggleMode}
                                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                                type="button"
                            >
                                {isSignup() ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </button>
                            
                            <div>
                                <button 
                                    onClick={handleHideVault}
                                    class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* PIN Setup Modal */}
            <Show when={showPinSetup()}>
                <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start md:items-center justify-center z-50 overflow-y-auto">
                    <div class="bg-white dark:bg-gray-900 w-full md:w-auto md:rounded-lg md:shadow-xl md:border-2 md:border-black dark:md:border-gray-700 min-h-screen md:min-h-0">
                        <PinSetup
                            onPinSet={handlePinSet}
                            onPinSetWithRecovery={handlePinSetWithRecovery}
                            onCancel={() => {
                                setShowPinSetup(false);
                                setTempAccountData(null);
                                setError('PIN setup cancelled. Please try again.');
                            }}
                        />
                    </div>
                </div>
            </Show>

            {/* PIN Unlock Modal (shown after successful login) */}
            <Show when={showPinUnlock()}>
                <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
                    <div class="bg-white dark:bg-gray-800 w-full max-w-md md:rounded-lg md:shadow-xl md:border-2 md:border-black dark:md:border-gray-700 p-8">
                        <div class="text-center mb-6">
                            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Enter Your PIN</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Unlock your vault to complete login
                            </p>
                        </div>

                        <Show when={error() && showPinUnlock()}>
                            <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4">
                                {error()}
                            </div>
                        </Show>

                        <Show when={isLoading() && loadingStatus()}>
                            <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-md text-sm mb-4 flex items-center gap-2">
                                <svg class="animate-spin h-4 w-4 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {loadingStatus()}
                            </div>
                        </Show>

                        <PinVerification
                            onSuccess={handlePinUnlockSuccess}
                            onFailed={handlePinUnlockFailed}
                            expectedPinHash={user()?.vaultPinHash}
                        />

                        <div class="mt-4 text-center">
                            <button
                                onClick={() => {
                                    setShowPinUnlock(false);
                                    setError('Login cancelled');
                                }}
                                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};