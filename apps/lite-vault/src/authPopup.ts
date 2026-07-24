/**
 * Top-level Google auth page (auth.html), opened as a popup by the vault when
 * it is running inside a cross-origin iframe.
 *
 * Why: Firebase signInWithPopup cannot complete inside a third-party iframe on
 * WebKit — iOS Safari partitions the iframe's storage away from the auth
 * domain, so the popup handshake never resolves and the vault spins forever.
 * A top-level window on the vault's own origin has first-party storage, where
 * the popup flow works everywhere. The result is handed back to the opener
 * (the vault iframe, same origin) via postMessage — direct window references
 * are not storage-partitioned.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};

export const GOOGLE_AUTH_MESSAGE_TYPE = 'nostrpass-lite-google-auth';

interface AuthResultMessage {
  type: typeof GOOGLE_AUTH_MESSAGE_TYPE;
  ok: boolean;
  user?: { uid: string; email: string | null; displayName: string | null };
  error?: string;
}

function send(message: AuthResultMessage): void {
  // The opener is the vault iframe on this same origin.
  window.opener?.postMessage(message, window.location.origin);
}

function setStatus(text: string, showButton: boolean): void {
  const status = document.getElementById('status');
  const button = document.getElementById('continue');
  if (status) status.textContent = text;
  if (button) button.style.display = showButton ? 'inline-block' : 'none';
}

// Watchdog: on iOS Safari, signInWithPopup without a valid gesture can hang
// without ever throwing (no popup, no auth/popup-blocked). If an attempt
// doesn't settle in time, reset the UI so the user can tap to retry.
const ATTEMPT_WATCHDOG_MS = 20_000;
let attemptInFlight = false;

async function attempt(): Promise<void> {
  if (attemptInFlight) return;
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    setStatus('Google Sign-In is not configured for this vault.', false);
    send({ type: GOOGLE_AUTH_MESSAGE_TYPE, ok: false, error: 'Google Sign-In unavailable.' });
    return;
  }
  attemptInFlight = true;
  const watchdog = setTimeout(() => {
    attemptInFlight = false;
    setStatus('Sign-in is taking too long. Tap continue to retry.', true);
  }, ATTEMPT_WATCHDOG_MS);
  try {
    setStatus('Opening Google sign-in…', false);
    const existing = getApps();
    const app =
      existing.length > 0
        ? existing[0]
        : initializeApp(firebaseConfig as { apiKey: string; authDomain: string; projectId: string });
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    const result = await signInWithPopup(auth, provider);
    clearTimeout(watchdog);
    send({
      type: GOOGLE_AUTH_MESSAGE_TYPE,
      ok: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
      },
    });
    setStatus('Signed in — you can close this window.', false);
    window.close();
  } catch (error) {
    clearTimeout(watchdog);
    attemptInFlight = false;
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    if (code === 'auth/popup-blocked') {
      setStatus('Popup blocked — tap continue to sign in.', true);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      setStatus('Sign-in was cancelled. Tap continue to retry.', true);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Sign-in failed: ${message}`, true);
    send({ type: GOOGLE_AUTH_MESSAGE_TYPE, ok: false, error: message });
  } finally {
    attemptInFlight = false;
  }
}

document.getElementById('continue')?.addEventListener('click', () => void attempt());
// No auto-attempt: WebKit only allows the Google popup from a real user
// gesture, and a gestureless signInWithPopup can hang forever on iOS.
// The button is visible from the start — one tap opens Google directly.
setStatus('Tap continue to sign in with Google.', true);
