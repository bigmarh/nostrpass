import { Component, createSignal, Show } from 'solid-js';
import { useAuth, useMessenger, useNostrComms, useCryptoWorkerReady, useEnvironment, useGoogleAuth } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import PinSetup from './PinSetup';
import PinVerification from './PinVerification';
import { configureNostrPass, getEnvironment, getNamespace, isConfiguredByUser, getAllGoogleLoginObjs, type GoogleVaultInfo } from '@nostrpass/nostrHelpers';
import GooglePasswordPrompt from './GooglePasswordPrompt';
import VaultPicker from './VaultPicker';

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
    const [isGoogleSignup, setIsGoogleSignup] = createSignal(false); // Track if PIN setup is for Google signup
    const [showPinUnlock, setShowPinUnlock] = createSignal(false);
    const [tempAccountData, setTempAccountData] = createSignal<{username: string, password: string, publicKey: string} | null>(null);

    // Google auth state
    const [showGooglePasswordPrompt, setShowGooglePasswordPrompt] = createSignal(false);
    const [googleAuthMode, setGoogleAuthMode] = createSignal<'login' | 'signup'>('login');
    const [googleAuthEnvironment, setGoogleAuthEnvironment] = createSignal<string>(''); // Store determined environment
    const [googlePasswordError, setGooglePasswordError] = createSignal<string>(''); // Error to show in password prompt

    // Multi-vault Google auth state
    const [showVaultPicker, setShowVaultPicker] = createSignal(false);
    const [googleVaults, setGoogleVaults] = createSignal<GoogleVaultInfo[]>([]);
    const [selectedVault, setSelectedVault] = createSignal<GoogleVaultInfo | null>(null);

    // Orphan Google login recovery state (vault not found on Nostr)
    const [showOrphanRecovery, setShowOrphanRecovery] = createSignal(false);
    const [orphanVaultInfo, setOrphanVaultInfo] = createSignal<GoogleVaultInfo | null>(null);
    const [isUnlinking, setIsUnlinking] = createSignal(false);

    // Advanced settings state - initialized after we have environment context
    const [showAdvancedPopover, setShowAdvancedPopover] = createSignal(false);
    const [customNamespace, setCustomNamespace] = createSignal('');
    const [customEnvironment, setCustomEnvironment] = createSignal('');
    const [environmentTypeInitialized, setEnvironmentTypeInitialized] = createSignal(false);
    const [environmentType, setEnvironmentType] = createSignal<'production' | 'development' | 'staging' | 'custom'>('production');
    const [advancedConfirmed, setAdvancedConfirmed] = createSignal(false);
    const [hasCustomSettings, setHasCustomSettings] = createSignal(false);

    const params = useParams();
    const navigate = useNavigate();
    const { send } = useMessenger();
    const { login, createAccount, unlockVault } = useAuth();
    const { checkUsernameAvailable, registerUsername, isConnected } = useNostrComms();

    const cryptoReady = useCryptoWorkerReady();
    // cryptoWorker available via useCryptoWorker() if needed
    const { getRelays, storageEnvironmentName } = useEnvironment();
    const { isAvailable: googleAvailable, googleUser, signInWithGoogle, clearGoogleUser, isLoading: googleLoading } = useGoogleAuth();

    // Initialize environment type from URL params when popover opens
    const openAdvancedSettings = () => {
        if (!environmentTypeInitialized()) {
            // Read directly from URL params - this is the source of truth set by the developer
            const urlParams = new URLSearchParams(window.location.search);
            const urlEnv = urlParams.get('storageEnvironment');

            if (urlEnv) {
                // Check if it matches a preset option
                if (urlEnv === 'production' || urlEnv === 'development' || urlEnv === 'staging') {
                    setEnvironmentType(urlEnv);
                } else {
                    // Custom environment (like 'demo')
                    setEnvironmentType('custom');
                    setCustomEnvironment(urlEnv);
                }
                console.log('[Login] Initialized environment from URL param:', urlEnv);
            }
            setEnvironmentTypeInitialized(true);
        }
        setShowAdvancedPopover(true);
    };

    const handleHideVault = () => {
        send('HIDE_VAULT');
    };

    // Handle Google Sign-In button click
    // Mode is determined automatically based on whether account exists on Nostr
    // For multi-vault: shows vault picker if multiple vaults linked to same Google account
    const handleGoogleSignIn = async () => {
        try {
            setError('');
            setIsLoading(true);
            setLoadingStatus('Signing in with Google...');

            const user = await signInWithGoogle();

            if (!user) {
                setIsLoading(false);
                setLoadingStatus('');
                return;
            }

            // Check for all vaults linked to this Google account
            setLoadingStatus('Checking for linked vaults...');
            const relays = getRelays();

            // Get environment - priority: user configured global > URL params > provider default
            // This ensures Google sign-in respects advanced settings
            const urlParams = new URLSearchParams(window.location.search);
            const urlEnv = urlParams.get('storageEnvironment');
            const userConfigured = isConfiguredByUser();
            const globalEnv = getEnvironment();
            const globalNamespace = getNamespace();

            let environment: string;
            if (userConfigured) {
                // User applied advanced settings - use global config
                environment = globalEnv;
            } else if (urlEnv) {
                // URL param provided
                environment = urlEnv;
            } else {
                // Fall back to provider
                environment = storageEnvironmentName();
            }

            console.log('[Login] Google sign-in environment check:', {
                userConfigured,
                globalNamespace,
                globalEnv,
                urlEnv,
                providerEnv: storageEnvironmentName(),
                effectiveEnv: environment
            });

            // Query for all vaults linked to this Google account using #t tag
            const vaults = await getAllGoogleLoginObjs(user.uid, environment, relays);

            console.log('[Login] Google vaults found:', { uid: user.uid.substring(0, 8) + '...', environment, namespace: globalNamespace, vaultCount: vaults.length });

            // Store the determined environment for use in login/signup
            setGoogleAuthEnvironment(environment);

            if (vaults.length === 0) {
                // No vaults found - this is a new user, go to signup flow
                console.log('[Login] No vaults found for Google account, switching to signup mode');
                setGoogleAuthMode('signup');
                setGooglePasswordError('');
                setShowGooglePasswordPrompt(true);
            } else if (vaults.length === 1) {
                // Single vault - proceed directly to password prompt
                console.log('[Login] Single vault found, proceeding to password prompt');
                setSelectedVault(vaults[0]);
                setGoogleAuthMode('login');
                setGooglePasswordError('');
                setShowGooglePasswordPrompt(true);
            } else {
                // Multiple vaults - show vault picker
                console.log('[Login] Multiple vaults found, showing vault picker');
                setGoogleVaults(vaults);
                setShowVaultPicker(true);
            }

            setIsLoading(false);
            setLoadingStatus('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    // Handle vault selection from picker (multi-vault Google auth)
    const handleVaultSelect = (vault: GoogleVaultInfo) => {
        setSelectedVault(vault);
        setShowVaultPicker(false);
        setGoogleAuthMode('login');
        setGooglePasswordError('');
        setShowGooglePasswordPrompt(true);
    };

    // Handle Google login with password
    const handleGoogleLogin = async (password: string) => {
        if (!googleUser()) return;

        setIsLoading(true);
        setShowGooglePasswordPrompt(false);
        setError('');
        setGooglePasswordError('');

        try {
            const user = googleUser()!;
            const environment = googleAuthEnvironment(); // Use the stored environment
            const vault = selectedVault(); // May be null for single-vault (will use standard lookup)
            setLoadingStatus('Verifying credentials...');

            // If we have a selected vault (from picker or single vault), pass its d-tag
            // This enables multi-vault support
            // Get displayName: prefer Google displayName, fallback to email username (before @), never use UID
            let displayName = user.displayName;
            if (!displayName && user.email) {
                // Use the part before @ as a fallback (e.g., "john.doe" from "john.doe@gmail.com")
                displayName = user.email.split('@')[0];
            }
            // If still no displayName, the session manager will use a better fallback
            
            await login(
                password,
                user.uid,
                'google',
                displayName || undefined, // Pass undefined if we can't get a good displayName
                environment,
                vault?.dTag,
                vault?.passwordSalt
            );

            setLoadingStatus('Loading your vault...');
            setIsLoading(false);
            setShowPinUnlock(true);
            clearGoogleUser();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';

            // Since we already checked loginObjExists before showing the password prompt,
            // if googleAuthMode is 'login', we know the account exists.
            // A failure here means wrong password - show error in password prompt
            if (googleAuthMode() === 'login') {
                // Check if it's a decryption/password error
                const isPasswordError = errorMessage.toLowerCase().includes('decrypt') ||
                    errorMessage.toLowerCase().includes('password') ||
                    errorMessage.toLowerCase().includes('invalid') ||
                    errorMessage.toLowerCase().includes('failed');

                if (isPasswordError) {
                    console.log('[Login] Google login failed with wrong password, showing error');
                    setGooglePasswordError('Incorrect password. Please try again.');
                } else {
                    // Some other error - show it
                    setGooglePasswordError(errorMessage);
                }
                setShowGooglePasswordPrompt(true);
                setIsLoading(false);
                setLoadingStatus('');
                return;
            }

            // Only switch to signup mode if we haven't verified the account exists
            // (This is a fallback for edge cases where loginObjExists wasn't called)
            if (errorMessage.toLowerCase().includes('not found') ||
                errorMessage.toLowerCase().includes('no account') ||
                errorMessage.toLowerCase().includes('loginobj not found')) {
                console.log('[Login] Google account not found, switching to signup mode');
                setGoogleAuthMode('signup');
                setShowGooglePasswordPrompt(true);
                setIsLoading(false);
                setLoadingStatus('');
                // Don't clear googleUser - we still need it for signup
                return;
            }

            setError(errorMessage);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    // Handle Google signup - show PIN setup after password entry
    const handleGoogleSignupPassword = async (password: string) => {
        if (!googleUser()) return;

        const user = googleUser()!;

        // Store temp data for PIN setup
        setTempAccountData({
            username: user.displayName || user.email || user.uid,
            password: password,
            publicKey: ''
        });

        setShowGooglePasswordPrompt(false);
        setIsGoogleSignup(true); // Mark this as a Google signup
        setShowPinSetup(true);
    };

    // Handle PIN set for Google signup
    const handleGooglePinSet = async (pin: string) => {
        const accountData = tempAccountData();
        const user = googleUser();
        if (!accountData || !user) return;

        try {
            setIsLoading(true);
            setShowPinSetup(false);
            setLoadingStatus('Securing your vault with PIN...');

            const environment = googleAuthEnvironment(); // Use the stored environment
            // Get displayName: prefer Google displayName, fallback to email username (before @)
            let displayName = user.displayName;
            if (!displayName && user.email) {
                // Use the part before @ as a fallback (e.g., "john.doe" from "john.doe@gmail.com")
                displayName = user.email.split('@')[0];
            }
            // For vaultUsername, use displayName or email (never UID)
            const vaultUsername = displayName || user.email || 'Google User';
            
            await createAccount(
                user.uid, // Use Google UID as identifier
                accountData.password,
                pin,
                undefined, // No recovery questions for now
                'google',
                displayName || vaultUsername, // Pass displayName (not vaultUsername which might be email)
                user.uid,
                environment // Pass the environment
            );

            // Note: The primary multi-vault discovery uses google-uid-hash tag query (Phase 1)
            // This localStorage entry is deprecated - it was intended as a fallback but
            // used vaultUsername instead of storagePublicKey, which is incorrect.
            // Keeping for reference but the google-uid-hash query is the reliable method.
            // localStorage.setItem(`nostrpass_google_vault_${user.uid}`, vaultUsername);
            console.log('[Login] Google signup complete. Multi-vault discovery uses google-uid-hash tag.');

            setLoadingStatus('Connecting to app...');
            await new Promise(resolve => setTimeout(resolve, 300));

            const appId = params.app;
            const appOrigin = appId ? desanitizeDomain(appId) : window.location.origin;

            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
                detail: {
                    appOrigin: appOrigin,
                    appName: appOrigin,
                    identityIndex: 0,
                    afterSignup: true
                }
            }));

            clearGoogleUser();
            setIsLoading(false);
            setLoadingStatus('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Account creation failed');
            setShowPinSetup(false);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    // Apply custom namespace/environment settings
    const applyAdvancedSettings = () => {
        const namespace = customNamespace().trim() || 'nostrpass.com';
        const environment = environmentType() === 'custom'
            ? customEnvironment().trim() || 'production'
            : environmentType();

        configureNostrPass({
            namespace,
            environment
        });

        const isCustom = namespace !== 'nostrpass.com' || environment !== 'production';
        setHasCustomSettings(isCustom);
        setShowAdvancedPopover(false);

        console.log('[Login] ========================================');
        console.log('[Login] ADVANCED SETTINGS APPLIED');
        console.log('[Login] Namespace:', namespace);
        console.log('[Login] Environment:', environment);
        console.log('[Login] Has Custom Settings:', isCustom);
        console.log('[Login] ========================================');
    };

    // Reset to default settings
    const resetAdvancedSettings = () => {
        setCustomNamespace('');
        setCustomEnvironment('');
        setEnvironmentType('production');
        setAdvancedConfirmed(false);
        setHasCustomSettings(false);

        configureNostrPass({
            namespace: 'nostrpass.com',
            environment: 'production'
        });

        setShowAdvancedPopover(false);
        console.log('[Login] Reset to default settings');
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
        console.log('[Signup] Checking username availability for:', normalizedUsername, 'in environment:', storageEnvironmentName());
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
        setIsGoogleSignup(false); // This is a username signup, not Google
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
        // Import to check what settings are active
        const { getEnvironment, getNamespace } = await import('@nostrpass/nostrHelpers');
        console.log('[Login] ========================================');
        console.log('[Login] ATTEMPTING LOGIN');
        console.log('[Login] Username:', username().trim().toLowerCase());
        console.log('[Login] Namespace (from config):', getNamespace());
        console.log('[Login] Environment (from config):', getEnvironment());
        console.log('[Login] Environment (from provider):', storageEnvironmentName());
        console.log('[Login] Has Custom Settings:', hasCustomSettings());
        console.log('[Login] ========================================');
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

            // Double-check username availability before registering (in case it was taken during PIN setup)
            setLoadingStatus('Verifying username availability...');
            const stillAvailable = await checkUsernameAvailable(accountData.username);

            if (!stillAvailable) {
                throw new Error('Username was taken while you were setting up. Please try a different username.');
            }

            // Register username on Nostr with user's relay preferences
            setLoadingStatus('Registering username on Nostr network...');

            // Get the user's relays from environment config
            const userRelays = getRelays();

            await registerUsername(accountData.username, publicKey, 'NostrPass Vault', userRelays);

            setLoadingStatus('Connecting to app...');

            // Wait a moment for auth state to propagate from worker
            await new Promise(resolve => setTimeout(resolve, 300));

            // After signup, trigger simple-auth prompt which will auto-approve
            const appId = params.app;
            const appOrigin = appId ? desanitizeDomain(appId) : window.location.origin;

            console.log('📱 [SIGNUP] Triggering auto-approval for app:', appOrigin);

            // Dispatch event - SimpleAuthPromptController will auto-approve and close vault
            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
                detail: {
                    appOrigin: appOrigin,
                    appName: appOrigin,
                    identityIndex: 0,
                    afterSignup: true
                }
            }));

            // Clear loading state
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

            // Double-check username availability before registering (in case it was taken during PIN setup)
            setLoadingStatus('Verifying username availability...');
            const stillAvailable = await checkUsernameAvailable(accountData.username);

            if (!stillAvailable) {
                throw new Error('Username was taken while you were setting up. Please try a different username.');
            }

            // Register username on Nostr with user's relay preferences
            setLoadingStatus('Registering username on Nostr network...');

            // Get the user's relays from environment config
            const userRelays = getRelays();

            await registerUsername(accountData.username, publicKey, 'NostrPass Vault', userRelays);

            setLoadingStatus('Connecting to app...');

            // Wait a moment for auth state to propagate from worker
            await new Promise(resolve => setTimeout(resolve, 300));

            // After signup, trigger simple-auth prompt which will auto-approve
            const appId = params.app;
            const appOrigin = appId ? desanitizeDomain(appId) : window.location.origin;

            console.log('📱 [SIGNUP] Triggering auto-approval for app:', appOrigin);

            // Dispatch event - SimpleAuthPromptController will auto-approve and close vault
            window.dispatchEvent(new CustomEvent('vault-simple-auth-prompt', {
                detail: {
                    appOrigin: appOrigin,
                    appName: appOrigin,
                    identityIndex: 0,
                    afterSignup: true
                }
            }));

            // Clear loading state
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
            // unlockVault now throws on error instead of returning false
            await unlockVault(pin);

            setLoadingStatus('Vault unlocked successfully!');

// After login+unlock, navigate to account picker so user can select identity
                // Use params.app directly (sanitized format like "localhost-4000") for consistent key lookup
                const appOrigin = params.app || 'vault';
                const appName = params.app ? desanitizeDomain(params.app) : 'unknown';
                navigate(`/${params.app || 'vault'}/account-picker?appOrigin=${encodeURIComponent(appOrigin)}&appName=${encodeURIComponent(appName)}&afterLogin=true`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to unlock vault';

            // Check if this is an orphan Google login (VaultObj not found)
            // This happens when Google was linked to a vault that no longer exists on Nostr
            if (errorMessage.includes('VaultObj not found') && googleUser()) {
                console.log('[Login] Detected orphan Google login - vault not found on Nostr');
                // Store the vault info for recovery UI
                const currentVault = selectedVault() || (googleVaults().length > 0 ? googleVaults()[0] : null);
                setOrphanVaultInfo(currentVault);
                setShowPinUnlock(false);
                setShowOrphanRecovery(true);
                setIsLoading(false);
                setLoadingStatus('');
                return;
            }

            setError(errorMessage);
            setShowPinUnlock(false);
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    // Handle unlinking orphan Google login
    const handleUnlinkOrphanVault = async () => {
        const vault = orphanVaultInfo();
        const user = googleUser();
        if (!vault || !user) return;

        setIsUnlinking(true);
        try {
            // Import the tombstone function
            const { publishGoogleLoginTombstone } = await import('@nostrpass/nostrHelpers');

            // Get relays for tombstone publish
            const relays = getRelays();

            // Publish tombstone to mark this LoginObj as deleted
            // Note: We need the storage keys to publish the tombstone, but we don't have them
            // So we'll just clear the local state and let the user try again
            // The orphan LoginObj will remain on Nostr but won't match any vault

            console.log('[Login] Clearing orphan Google login state');

            // Clear Google auth state
            clearGoogleUser();
            setShowOrphanRecovery(false);
            setOrphanVaultInfo(null);
            setSelectedVault(null);
            setGoogleVaults([]);
            setShowGooglePasswordPrompt(false);
            setGooglePasswordError('');

            // Show success message and return to login
            setError('');
            console.log('[Login] Orphan Google login cleared - user can try again or create new vault');
        } catch (err) {
            console.error('[Login] Failed to unlink orphan vault:', err);
            setError('Failed to unlink. Please try again.');
        } finally {
            setIsUnlinking(false);
        }
    };

    const handlePinUnlockFailed = () => {
        // Too many failed attempts
        setShowPinUnlock(false);
        setError('Too many failed PIN attempts. Please log in again.');
    };

    return (
        <div class="w-full h-full bg-white dark:bg-gray-900 overflow-hidden">
            <div class="flex w-full h-full bg-white dark:bg-gray-800 flex-col md:flex-row">
                <div style={`background-image: url('/egg_background_${changeBackground()}.png')`} class={`flex flex-col items-center md:rounded-l-lg bg-bottom bg-cover bg-no-repeat justify-center pt-4 pb-1 px-4 md:p-3 md:w-40 md:min-w-[10rem]`}>
                    <div class="w-24 h-24 md:w-28 md:h-28">
                        <img class="w-full h-full" src="/logo.svg" alt="NostrPass Logo" />
                    </div>
                </div>
                <div class="flex flex-1 flex-col items-center justify-center min-w-0 pt-2 pb-4 px-6 md:p-6">
                    {/* Loading state - replaces form while loading */}
                    <Show when={isLoading() && loadingStatus()}>
                        <div class="w-full max-w-sm flex flex-col items-center justify-center py-8">
                            <div class="flex flex-col items-center gap-4">
                                <div class="relative">
                                    <div class="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                                    <div class="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                                </div>
                                <div class="text-center">
                                    <p class="text-base font-medium text-gray-900 dark:text-white">{loadingStatus()}</p>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <Show when={!isLoading() || !loadingStatus()}>
                    <div class="w-full max-w-sm space-y-3">
                        {/* Non-production environment warning */}
                        <Show when={storageEnvironmentName() !== 'production'}>
                            <p class="text-xs text-amber-600 dark:text-amber-400 text-center">
                                This is a {storageEnvironmentName()} site. Accounts here are separate from regular NostrPass accounts.
                            </p>
                        </Show>

                        {/* Google Sign-In Button - Primary option above username form */}
                        <Show when={googleAvailable()}>
                            <button
                                type="button"
                                onClick={() => handleGoogleSignIn()}
                                disabled={isLoading() || googleLoading() || !cryptoReady() || !isConnected()}
                                class="w-full p-2.5 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <Show when={googleLoading()}>
                                    <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </Show>
                                <Show when={!googleLoading()}>
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                </Show>
                                Continue with Google
                            </button>

                            <div class="relative flex items-center">
                                <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                <span class="flex-shrink mx-3 text-xs text-gray-400 dark:text-gray-500">or use username</span>
                                <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                            </div>
                        </Show>

                        <form onSubmit={handleSubmit} class={`flex w-full flex-col gap-2.5 ${isSignup() ? 'signup-form' : 'login-form'}`} method="post" action="#">
                            {/* Advanced Settings Link */}
                            <div class="flex justify-end relative">
                                <button
                                    type="button"
                                    onClick={openAdvancedSettings}
                                    class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors flex items-center gap-1"
                                >
                                    Advanced
                                    <Show when={hasCustomSettings()}>
                                        <span class="inline-block w-2 h-2 bg-amber-500 rounded-full" title="Custom settings active" />
                                    </Show>
                                </button>
                            </div>

                            {/* Advanced Settings Modal - Centered and Scrollable */}
                            <Show when={showAdvancedPopover()}>
                                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowAdvancedPopover(false)}>
                                    <div class="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
                                        {/* Header - Fixed */}
                                        <div class="relative px-5 pt-5 pb-3 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setShowAdvancedPopover(false)}
                                                class="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                            <h3 class="text-base font-semibold text-gray-900 dark:text-white">Advanced Settings</h3>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Custom vault storage location</p>
                                        </div>

                                        {/* Scrollable Content */}
                                        <div class="flex-1 overflow-y-auto px-5 pb-4">
                                            {/* Warning Banner - Compact */}
                                            <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                                                <p class="text-xs text-amber-800 dark:text-amber-200">
                                                    <strong>Warning:</strong> These settings control where your vault data is stored on Nostr. If you change them and forget the exact values, you will not be able to access your vault. There is no recovery option.
                                                </p>
                                            </div>

                                            {/* Form Fields - Compact */}
                                            <div class="space-y-3">
                                                {/* Namespace Field */}
                                                <div>
                                                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Namespace
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={customNamespace()}
                                                        onInput={(e) => setCustomNamespace(e.currentTarget.value)}
                                                        placeholder="nostrpass.com"
                                                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none transition-all"
                                                    />
                                                </div>

                                                {/* Environment Field */}
                                                <div>
                                                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Environment
                                                    </label>
                                                    <select
                                                        value={environmentType()}
                                                        onChange={(e) => setEnvironmentType(e.currentTarget.value as 'production' | 'development' | 'staging' | 'custom')}
                                                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none transition-all cursor-pointer"
                                                    >
                                                        <option value="production">production</option>
                                                        <option value="development">development</option>
                                                        <option value="staging">staging</option>
                                                        <option value="custom">custom...</option>
                                                    </select>

                                                    <Show when={environmentType() === 'custom'}>
                                                        <input
                                                            type="text"
                                                            value={customEnvironment()}
                                                            onInput={(e) => setCustomEnvironment(e.currentTarget.value)}
                                                            placeholder="Enter custom environment"
                                                            class="w-full mt-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none transition-all"
                                                        />
                                                    </Show>
                                                </div>

                                                {/* Confirmation Checkbox - Compact */}
                                                <label class="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={advancedConfirmed()}
                                                        onChange={(e) => setAdvancedConfirmed(e.currentTarget.checked)}
                                                        class="mt-0.5 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500 accent-gray-900 dark:accent-white flex-shrink-0"
                                                    />
                                                    <span class="text-xs text-gray-600 dark:text-gray-400">
                                                        I understand I must remember these values to access my vault
                                                    </span>
                                                </label>

                                                {/* Current Active Settings - at bottom */}
                                                <p class="mt-3 font-mono text-[9px] text-gray-400 dark:text-gray-600 truncate">
                                                    current: {getNamespace()} / {storageEnvironmentName()}{new URLSearchParams(window.location.search).get('storageEnvironment') ? ` (url: ${new URLSearchParams(window.location.search).get('storageEnvironment')})` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer Actions - Fixed */}
                                        <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={resetAdvancedSettings}
                                                class="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                Reset
                                            </button>
                                            <div class="flex-1" />
                                            <button
                                                type="button"
                                                onClick={() => setShowAdvancedPopover(false)}
                                                class="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={applyAdvancedSettings}
                                                disabled={!advancedConfirmed()}
                                                class="px-4 py-1.5 text-xs font-medium bg-gray-900 hover:bg-black disabled:bg-gray-300 dark:bg-white dark:hover:bg-gray-100 dark:disabled:bg-gray-600 text-white dark:text-gray-900 dark:disabled:text-gray-400 rounded-lg transition-colors disabled:cursor-not-allowed"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Show>

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
                                    name="password"
                                    id="password"
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

                            <Show when={!isSignup()}>
                                <div>
                                    <button
                                        onClick={() => navigate(`/${params.app}/restore-from-phrase`)}
                                        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                        type="button"
                                    >
                                        Restore from recovery phrase
                                    </button>
                                </div>
                            </Show>

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
                    </Show>
                </div>
            </div>

            {/* PIN Setup Modal */}
            <Show when={showPinSetup()}>
                <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start md:items-center justify-center z-50 overflow-y-auto">
                    <div class="bg-white dark:bg-gray-900 w-full md:w-auto md:rounded-lg md:shadow-xl md:border-2 md:border-black dark:md:border-gray-700 min-h-screen md:min-h-0">
                        <PinSetup
                            onPinSet={isGoogleSignup() ? handleGooglePinSet : handlePinSet}
                            onPinSetWithRecovery={handlePinSetWithRecovery}
                            onCancel={() => {
                                setShowPinSetup(false);
                                setTempAccountData(null);
                                setIsGoogleSignup(false);
                                clearGoogleUser();
                                setError('PIN setup cancelled. Please try again.');
                            }}
                        />
                    </div>
                </div>
            </Show>

            {/* PIN Unlock Modal (shown after successful login) */}
            <Show when={showPinUnlock()}>
                <div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
                    <div class="bg-white dark:bg-gray-800 w-full max-w-md md:rounded-lg md:shadow-xl md:border-2 md:border-black dark:md:border-gray-700 p-8 relative overflow-hidden">
                        {/* Loading overlay for PIN unlock - covers entire modal */}
                        <Show when={isLoading() && loadingStatus()}>
                            <div class="absolute inset-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                <div class="flex flex-col items-center gap-4">
                                    <div class="relative">
                                        <div class="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
                                        <div class="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-base font-medium text-gray-900 dark:text-white">{loadingStatus()}</p>
                                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Please wait...</p>
                                    </div>
                                </div>
                            </div>
                        </Show>

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

                        <PinVerification
                            onSuccess={handlePinUnlockSuccess}
                            onFailed={handlePinUnlockFailed}
                            expectedPinHash={undefined}
                        />

                        <div class="mt-4 text-center">
                            <button
                                onClick={() => {
                                    setShowPinUnlock(false);
                                    setError('Login cancelled');
                                }}
                                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                disabled={isLoading()}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Vault Picker Modal (multi-vault Google auth) */}
            <Show when={showVaultPicker() && googleUser()}>
                <VaultPicker
                    googleUser={googleUser()!}
                    vaults={googleVaults()}
                    onSelect={handleVaultSelect}
                    onCancel={() => {
                        setShowVaultPicker(false);
                        setGoogleVaults([]);
                        clearGoogleUser();
                    }}
                />
            </Show>

            {/* Google Password Prompt Modal */}
            <Show when={showGooglePasswordPrompt() && googleUser()}>
                <GooglePasswordPrompt
                    googleUser={googleUser()!}
                    mode={googleAuthMode()}
                    onSubmit={googleAuthMode() === 'login' ? handleGoogleLogin : handleGoogleSignupPassword}
                    onCancel={() => {
                        setShowGooglePasswordPrompt(false);
                        setGooglePasswordError('');
                        setSelectedVault(null);
                        clearGoogleUser();
                    }}
                    isLoading={isLoading()}
                    namespace={getNamespace()}
                    environment={googleAuthEnvironment()}
                    errorMessage={googlePasswordError()}
                />
            </Show>

{/* Orphan Google Login Recovery Modal */}
            <Show when={showOrphanRecovery()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                        <div class="text-center mb-6">
                            <div class="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                                <svg class="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Vault Not Found</h2>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                Your Google account is linked to a vault that no longer exists on Nostr. This can happen if:
                            </p>
                            <ul class="text-sm text-gray-500 dark:text-gray-400 mt-3 text-left list-disc list-inside space-y-1">
                                <li>The vault was never fully created</li>
                                <li>The vault data was lost or corrupted</li>
                                <li>The link was created in a different environment</li>
                            </ul>
                        </div>

                        <div class="space-y-3">
                            <button
                                onClick={handleUnlinkOrphanVault}
                                disabled={isUnlinking()}
                                class="w-full p-3 rounded-md bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Show when={isUnlinking()}>
                                    <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                </Show>
                                {isUnlinking() ? 'Clearing...' : 'Clear Link & Try Again'}
                            </button>

                            <button
                                onClick={() => {
                                    setShowOrphanRecovery(false);
                                    setOrphanVaultInfo(null);
                                    clearGoogleUser();
                                }}
                                disabled={isUnlinking()}
                                class="w-full p-3 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>

                        <p class="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
                            After clearing, you can sign in with a different Google account or create a new vault.
                        </p>
                    </div>
                </div>
            </Show>
        </div>
    );
};