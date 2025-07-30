import { Component, createSignal, Show } from 'solid-js';
import { useAuth, useMessenger, useNostrComms, useCryptoWorkerReady } from '../providers';
import { useParams } from '@solidjs/router';

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

    const params = useParams();
    const { send } = useMessenger();
    const { login, createAccount } = useAuth();
    const { checkUsernameAvailable, registerUsername, isConnected } = useNostrComms();
    const cryptoReady = useCryptoWorkerReady();

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

        // Check username availability
        console.log('🔍 Checking username availability:', username());
        const isAvailable = await checkUsernameAvailable(username());
        
        if (!isAvailable) {
            throw new Error('Username is already taken');
        }

        // Create account with password-based encryption
        console.log('🔑 Creating account...');
        await createAccount(username(), password());
        
        // Register username on Nostr
        console.log('📝 Registering username on Nostr...');
        const auth = useAuth();
        const user = auth.user();
        if (user) {
            await registerUsername(username(), user.publicKey);
        }
        
        console.log('✅ Signup successful!');
    };
    // Reactive signal for background that updates based on time
    const getTimeBasedBackground = () => {
        const timeOfDay = new Date().getHours();
        console.log('Current hour:', timeOfDay);
        if (timeOfDay < 6 || timeOfDay > 21) {
            return 3; // Night
        } else if (timeOfDay < 15) {
            return 1; // Morning/Day
        } else if (timeOfDay < 18) {
            return 2; // Evening
        } else {
            return 0; // Default
        }
    };

    const [backgroundIndex, setBackgroundIndex] = createSignal(getTimeBasedBackground());
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
        
        // Login with password
        console.log('🔑 Login attempt:', { username: username() });
        await login(password(), username());
        
        console.log('✅ Login successful!');
    };

    const toggleMode = () => {
        setIsSignup(!isSignup());
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    return (
        <div class="flex justify-center md:h-screen items-center">
            <div class="flex w-auto min-w-[600px] max-w-2xl h-auto bg-white black-outline flex-col md:flex-row rounded-lg ">
                <div style={`background-image: url('egg_background_${changeBackground()}.png')`} class={`flex flex-col items-center  rounded-l-lg bg-bottom bg-contain md:bg-cover md:bg-center justify-center p-4 md:w-48 md:min-w-[12rem]`}>
                    <div class="w-32 h-32 ">
                        <img class="w-full h-full " src="/logo.svg" alt="NostrPass Logo" />
                    </div>
                   
                </div>
                <div class="flex flex-1 flex-col items-center justify-center min-w-0 p-6">
                    <div class="w-full max-w-sm space-y-4">
                        <div class="text-center">
                            <h1 class="text-xl font-semibold">{isSignup() ? 'Create Account' : 'Welcome Back'}</h1>
                            <p class="text-sm text-gray-500 mt-1">
                                {isSignup() ? 'Sign up to get started' : 'Sign in to your account'}
                            </p>
                            {params.app && (
                                <p class="text-xs text-gray-400 mt-2">App: {desanitizeDomain(params.app)}</p>
                            )}
                        </div>
                        
                        <form onSubmit={handleSubmit} class="flex w-full flex-col gap-3">
                            <input 
                                type="text" 
                                placeholder="Username" 
                                value={username()}
                                onInput={(e) => setUsername(e.currentTarget.value)}
                                class="w-full border-2 border-gray-300 p-2 rounded-md focus:border-blue-500 focus:outline-none" 
                                autocomplete="username"
                                required
                                disabled={isLoading()}
                            />
                            <input 
                                type="password" 
                                placeholder="Password" 
                                value={password()}
                                onInput={(e) => setPassword(e.currentTarget.value)}
                                class="w-full p-2 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none" 
                                autocomplete={isSignup() ? "new-password" : "current-password"}
                                required
                                disabled={isLoading()}
                            />
                            
                            <Show when={isSignup()}>
                                <input 
                                    type="password" 
                                    placeholder="Confirm Password" 
                                    value={confirmPassword()}
                                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                                    class="w-full p-2 rounded-md border-2 border-gray-300 focus:border-blue-500 focus:outline-none" 
                                    autocomplete="new-password"
                                    required
                                    disabled={isLoading()}
                                />
                            </Show>
                            
                            <Show when={error()}>
                                <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                                    {error()}
                                </div>
                            </Show>
                            
                            <Show when={!cryptoReady()}>
                                <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm">
                                    Initializing security module...
                                </div>
                            </Show>
                            
                            <Show when={!isConnected() && isSignup()}>
                                <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-md text-sm">
                                    Connecting to Nostr relays...
                                </div>
                            </Show>
                            
                            <button 
                                type="submit" 
                                class="w-full p-2 rounded-md bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white transition-colors font-medium"
                                disabled={isLoading() || !cryptoReady() || (!isConnected() && isSignup())}
                            >
                                {isLoading() ? 'Processing...' : (isSignup() ? 'Create Account' : 'Sign In')}
                            </button>
                        </form>
                        
                        <div class="text-center space-y-2">
                            <button 
                                onClick={toggleMode}
                                class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                type="button"
                            >
                                {isSignup() ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </button>
                            
                            <div>
                                <button 
                                    onClick={handleHideVault}
                                    class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};