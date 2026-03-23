/**
 * Google Auth Provider
 *
 * Provides Google Sign-In functionality as an alternative to username-based login.
 * Google only provides identity (UID) - the user's password is still required
 * for encryption key derivation.
 */

import {
  createContext,
  useContext,
  ParentComponent,
  createSignal,
  onMount,
  createEffect
} from 'solid-js';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { getFirebaseAuth, isGoogleAuthAvailable } from '../config/firebase';

export interface GoogleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface GoogleAuthContextType {
  /** Whether Google auth is available (Firebase configured) */
  isAvailable: () => boolean;
  /** Whether a Google sign-in is in progress */
  isLoading: () => boolean;
  /** The currently signed-in Google user (null if not signed in) */
  googleUser: () => GoogleUser | null;
  /** Sign in with Google popup - returns the Google UID */
  signInWithGoogle: () => Promise<GoogleUser>;
  /** Sign out from Google */
  signOutGoogle: () => Promise<void>;
  /** Clear the current Google user (without signing out from Google) */
  clearGoogleUser: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextType>();

export const GoogleAuthProvider: ParentComponent = (props) => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [googleUser, setGoogleUser] = createSignal<GoogleUser | null>(null);
  const [isAvailable, setIsAvailable] = createSignal(false);

  onMount(() => {
    // Check if Google auth is available
    const available = isGoogleAuthAvailable();
    setIsAvailable(available);

    if (!available) {
      console.log('[GoogleAuth] Not available - Firebase not configured');
      return;
    }

    // Initialize Firebase and listen for auth state changes
    const auth = getFirebaseAuth();
    if (auth) {
      // Listen for auth state changes (e.g., user already signed in)
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setGoogleUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          });
          console.log('[GoogleAuth] User state changed - signed in:', user.email);
        } else {
          // Don't clear googleUser here - we manage that manually
          // This prevents losing the user during the password prompt flow
          console.log('[GoogleAuth] User state changed - signed out');
        }
      });

      // Cleanup on unmount
      return () => unsubscribe();
    }
  });

  /**
   * Sign in with Google popup
   * Returns the Google user info (including UID for vault lookup)
   */
  const signInWithGoogle = async (): Promise<GoogleUser> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Google Sign-In is not available');
    }

    setIsLoading(true);

    try {
      const provider = new FirebaseGoogleAuthProvider();
      // Request email scope
      provider.addScope('email');
      provider.addScope('profile');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const googleUserData: GoogleUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };

      setGoogleUser(googleUserData);
      console.log('[GoogleAuth] Signed in successfully:', user.email);

      return googleUserData;
    } catch (error: any) {
      console.error('[GoogleAuth] Sign in failed:', error);

      // Handle specific error codes
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.');
      }

      throw new Error(error.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out from Google
   */
  const signOutGoogle = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setGoogleUser(null);
      return;
    }

    try {
      await firebaseSignOut(auth);
      setGoogleUser(null);
      console.log('[GoogleAuth] Signed out successfully');
    } catch (error) {
      console.error('[GoogleAuth] Sign out failed:', error);
      // Clear local state even if Firebase sign out fails
      setGoogleUser(null);
    }
  };

  /**
   * Clear the Google user from local state
   * Used after vault login/signup is complete
   */
  const clearGoogleUser = () => {
    setGoogleUser(null);
  };

  const value: GoogleAuthContextType = {
    isAvailable,
    isLoading,
    googleUser,
    signInWithGoogle,
    signOutGoogle,
    clearGoogleUser
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {props.children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
  }
  return context;
};
