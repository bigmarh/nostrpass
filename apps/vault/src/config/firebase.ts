/**
 * Firebase Configuration for Google Sign-In
 *
 * This module initializes Firebase Auth for Google authentication.
 * The actual encryption is still handled by the user's password -
 * Google only provides identity verification.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Initialize Firebase app and auth
 * Returns null if Firebase is not configured (missing env vars)
 */
export function initializeFirebaseAuth(): Auth | null {
  // Check if Firebase is configured
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    console.log('[Firebase] Not configured - Google Sign-In disabled');
    return null;
  }

  // Return existing auth if already initialized
  if (auth) {
    return auth;
  }

  // Check if app already exists (hot reload scenario)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }

  auth = getAuth(app);
  console.log('[Firebase] Initialized successfully');

  return auth;
}

/**
 * Get the Firebase Auth instance
 * Returns null if not initialized or not configured
 */
export function getFirebaseAuth(): Auth | null {
  if (!auth) {
    return initializeFirebaseAuth();
  }
  return auth;
}

/**
 * Check if Firebase/Google auth is available
 */
export function isGoogleAuthAvailable(): boolean {
  return !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
}
