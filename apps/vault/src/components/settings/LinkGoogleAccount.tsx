/**
 * Link Google Account Component
 *
 * Allows existing username-based accounts to link a Google account
 * for alternative sign-in. Creates a second LoginObj keyed by Google UID.
 */

import { Component, createSignal, Show } from 'solid-js';
import { useGoogleAuth } from '../../providers/GoogleAuthProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useCryptoWorker, useEnvironment } from '../../providers';
import { showErrorToast, showSuccessToast } from '../Toast';
import { getNamespace } from '@nostrpass/nostrHelpers';
import { ErrorCode } from '@nostrpass/types';

interface LinkGoogleAccountProps {
  onLinked?: () => void;
  vaultData?: any; // VaultData with linkedAuthProviders
}

export const LinkGoogleAccount: Component<LinkGoogleAccountProps> = (props) => {
  const googleAuth = useGoogleAuth();
  const { user, authState } = useAuth();
  const cryptoWorker = useCryptoWorker();
  const { storageEnvironmentName, getRelays } = useEnvironment();

  // Get the session environment (from login) or fall back to URL-based environment
  const sessionEnvironment = () => authState().environment || storageEnvironmentName();

  // Check if user logged in via Google (already linked)
  // authProvider is the authoritative source - set by session-state-manager
  const isLoggedInViaGoogle = () => {
    // Use explicit authProvider - this is set during login/restore and is authoritative
    const provider = authState().authProvider;
    if (provider === 'google') return true;
    if (provider === 'username') return false;

    // No authProvider set (very old session?) - be conservative, assume NOT Google
    // The user can re-login to get proper authProvider set
    console.log('[LinkGoogleAccount] authProvider not set, assuming username login');
    return false;
  };

  const [isLinking, setIsLinking] = createSignal(false);
  const [isUnlinking, setIsUnlinking] = createSignal(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = createSignal(false);
  const [pendingGoogleUser, setPendingGoogleUser] = createSignal<{
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');

  // Track linked Google account (set after successful linking in this session)
  const [linkedGoogleAccount, setLinkedGoogleAccount] = createSignal<{
    email: string;
    displayName: string;
  } | null>(null);

  // Check vault data for linked Google accounts
  const vaultLinkedGoogle = () => {
    const vault = props.vaultData;
    if (!vault?.linkedAuthProviders) return null;
    const googleProvider = vault.linkedAuthProviders.find((p: any) => p.provider === 'google');
    if (googleProvider) {
      return {
        email: googleProvider.displayName || 'Google Account',
        displayName: googleProvider.displayName || 'Google User',
        linkedAt: googleProvider.linkedAt,
        googleUid: googleProvider.googleUid
      };
    }
    return null;
  };

  // If logged in via Google, show as linked with the current user's display name
  // Also check vault data for previously linked accounts
  const effectiveLinkedAccount = () => {
    if (isLoggedInViaGoogle()) {
      const currentUser = user();
      return {
        email: currentUser?.displayName || currentUser?.username || 'Google Account',
        displayName: currentUser?.displayName || currentUser?.username || 'Google User'
      };
    }
    // Check if we linked in this session
    const sessionLinked = linkedGoogleAccount();
    if (sessionLinked) return sessionLinked;
    // Check vault data for previously linked accounts
    return vaultLinkedGoogle();
  };

  const handleLinkGoogle = async () => {
    if (!googleAuth.isAvailable()) {
      showErrorToast(ErrorCode.GOOGLE_AUTH_NOT_AVAILABLE);
      return;
    }

    setError('');

    try {
      // Sign in with Google to get the UID
      const googleUser = await googleAuth.signInWithGoogle();
      setPendingGoogleUser({
        uid: googleUser.uid,
        email: googleUser.email,
        displayName: googleUser.displayName
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleConfirmLink = async () => {
    const currentUser = user();
    const googleUser = pendingGoogleUser();

    if (!currentUser || !googleUser || !cryptoWorker) {
      setError('Missing required data');
      return;
    }

    if (!password()) {
      setError('Please enter your vault password');
      return;
    }

    setIsLinking(true);
    setError('');

    try {
      // Call worker to link Google account
      // This will:
      // 1. Verify the password is correct
      // 2. Create a new LoginObj with the Google UID
      // 3. Save it to Nostr with _google_ identifier type
      // NOTE: displayName is the VAULT username (for vault picker when logging in with Google)
      // googleDisplayName is the Google email (preferred) for showing in vault settings
      // Access username via profile - the user() getter returns profile.username not a top-level username
      const vaultUsername = currentUser.profile?.username || currentUser.displayName || 'Unknown';
      console.log('[LinkGoogleAccount] Calling linkGoogleAccount with:', {
        username: vaultUsername,
        displayName: vaultUsername,
        googleDisplayName: googleUser.email || googleUser.displayName || 'Google User',
        environment: sessionEnvironment()
      });
      const result = await cryptoWorker.linkGoogleAccount({
        username: vaultUsername,
        password: password(),
        googleUid: googleUser.uid,
        displayName: vaultUsername, // Vault username for vault picker display
        googleDisplayName: googleUser.email || googleUser.displayName || 'Google User', // Prefer email for settings display
        relays: getRelays(),
        environment: sessionEnvironment()
      });

      // Store the storagePublicKey in localStorage as a same-device fallback
      // This enables multi-vault lookup when relay custom tag indexing isn't available
      // We store a JSON array of storagePublicKeys to support multiple vaults per Google account
      if (result?.storagePublicKey) {
        const storageKey = `nostrpass_google_vaults_${googleUser.uid}`;
        const existingJson = localStorage.getItem(storageKey);
        let vaultKeys: string[] = [];
        try {
          vaultKeys = existingJson ? JSON.parse(existingJson) : [];
        } catch {
          vaultKeys = [];
        }
        // Add new storagePublicKey if not already present
        if (!vaultKeys.includes(result.storagePublicKey)) {
          vaultKeys.push(result.storagePublicKey);
          localStorage.setItem(storageKey, JSON.stringify(vaultKeys));
        }
        console.log('[LinkGoogleAccount] Stored storagePublicKey for multi-vault fallback:', {
          googleUid: googleUser.uid,
          storagePublicKey: result.storagePublicKey.slice(0, 12) + '...',
          totalLinkedVaults: vaultKeys.length,
          storageKey
        });
      }

      showSuccessToast('Success', 'Google account linked successfully');

      // Store linked account info to show in UI
      setLinkedGoogleAccount({
        email: googleUser.email || 'Google Account',
        displayName: googleUser.displayName || googleUser.email || 'Google User'
      });

      setPendingGoogleUser(null);
      setPassword('');
      googleAuth.clearGoogleUser();
      props.onLinked?.();
    } catch (err: any) {
      console.error('[LinkGoogleAccount] Failed to link:', err);
      setError(err.message || 'Failed to link Google account');
    } finally {
      setIsLinking(false);
    }
  };

  const handleCancel = () => {
    setPendingGoogleUser(null);
    setPassword('');
    setError('');
    googleAuth.clearGoogleUser();
  };

  const handleUnlink = async () => {
    const linked = vaultLinkedGoogle();
    if (!linked?.googleUid || !cryptoWorker) {
      setError('Cannot unlink - missing Google account information');
      return;
    }

    setIsUnlinking(true);
    setError('');

    try {
      await cryptoWorker.unlinkGoogleAccount({
        googleUid: linked.googleUid,
        relays: getRelays(),
        environment: sessionEnvironment()
      });

      // Remove from localStorage fallback
      try {
        const storageKey = `nostrpass_google_vaults_${linked.googleUid}`;
        const existingJson = localStorage.getItem(storageKey);
        if (existingJson) {
          const currentUser = user();
          const vaultKeys: string[] = JSON.parse(existingJson);
          // Remove this vault's storagePublicKey from the array
          // Note: We'd need the storagePublicKey here - for now just clear the entry if it's the only one
          if (vaultKeys.length <= 1) {
            localStorage.removeItem(storageKey);
          }
          // If multiple vaults, we'd need storagePublicKey to filter - the vault will still work
        }
      } catch (e) {
        console.warn('[LinkGoogleAccount] Failed to clean localStorage:', e);
      }

      showSuccessToast('Success', 'Google account unlinked');
      setLinkedGoogleAccount(null);
      setShowUnlinkConfirm(false);
      props.onLinked?.(); // Trigger refresh of vault data
    } catch (err: any) {
      console.error('[LinkGoogleAccount] Failed to unlink:', err);
      setError(err.message || 'Failed to unlink Google account');
    } finally {
      setIsUnlinking(false);
    }
  };

  // Google icon SVG component
  const GoogleIcon = () => (
    <svg class="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  return (
    <div class="space-y-4">
      {/* Show linked account if we have one (either from login or from linking) */}
      <Show when={effectiveLinkedAccount()}>
        <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-green-200 dark:border-green-700">
                <GoogleIcon />
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  Google Account Linked
                  <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {effectiveLinkedAccount()!.email}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 rounded-full">
                Connected
              </span>
              {/* Show unlink button only if logged in via username (not Google) and we have googleUid */}
              <Show when={!isLoggedInViaGoogle() && vaultLinkedGoogle()?.googleUid}>
                <button
                  onClick={() => setShowUnlinkConfirm(true)}
                  disabled={isUnlinking()}
                  class="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Unlink
                </button>
              </Show>
            </div>
          </div>

          {/* Unlink confirmation */}
          <Show when={showUnlinkConfirm()}>
            <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p class="text-sm text-red-700 dark:text-red-300 mb-3">
                Are you sure you want to unlink this Google account? You won't be able to sign in with Google until you link it again.
              </p>
              <Show when={error()}>
                <p class="text-sm text-red-600 dark:text-red-400 mb-3">{error()}</p>
              </Show>
              <div class="flex gap-2">
                <button
                  onClick={() => {
                    setShowUnlinkConfirm(false);
                    setError('');
                  }}
                  class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={isUnlinking()}
                  class="flex-1 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isUnlinking() ? 'Unlinking...' : 'Yes, Unlink'}
                </button>
              </div>
            </div>
          </Show>

          {/* Show warning if logged in via Google */}
          <Show when={isLoggedInViaGoogle()}>
            <p class="mt-3 text-xs text-amber-600 dark:text-amber-400">
              You're currently signed in with Google. Log in with your username to unlink.
            </p>
          </Show>
        </div>
      </Show>

      {/* Show link button if no linked account and not in pending state */}
      <Show when={!effectiveLinkedAccount() && !pendingGoogleUser()}>
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-600">
              <GoogleIcon />
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                Link Google Account
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Sign in with Google as an alternative to your username
              </div>
            </div>
          </div>
          <button
            onClick={handleLinkGoogle}
            disabled={!googleAuth.isAvailable() || googleAuth.isLoading()}
            class="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleAuth.isLoading() ? 'Connecting...' : 'Link'}
          </button>
        </div>

        <Show when={!googleAuth.isAvailable()}>
          <p class="text-xs text-amber-600 dark:text-amber-400">
            Google Sign-In is not configured for this environment.
          </p>
        </Show>
      </Show>

      <Show when={pendingGoogleUser()}>
        {/* Password confirmation state */}
        <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                Google Account Selected
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {pendingGoogleUser()!.email}
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              Confirm your vault password
            </label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Enter your vault password"
              class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmLink();
                }
              }}
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Your password is required to securely link your Google account.
            </p>
          </div>

          <Show when={error()}>
            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
          </Show>

          <div class="flex gap-3">
            <button
              onClick={handleCancel}
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLink}
              disabled={isLinking() || !password()}
              class="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLinking() ? 'Linking...' : 'Link Account'}
            </button>
          </div>
        </div>
      </Show>

      {/* Show where the Google LoginObj will be stored (only when not linked yet) */}
      <Show when={!effectiveLinkedAccount()}>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
          Will link to: {getNamespace()} / {sessionEnvironment()}
        </p>
      </Show>

      {/* Show linked storage location */}
      <Show when={effectiveLinkedAccount()}>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
          Linked to: {getNamespace()} / {sessionEnvironment()}
        </p>
      </Show>
    </div>
  );
};
