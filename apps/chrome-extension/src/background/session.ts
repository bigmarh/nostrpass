/**
 * Session Manager
 *
 * Manages vault lock/unlock state and derived identities
 */

import type { AuthState, DerivedIdentity, SessionData } from '@/shared/types';
import {
  getVaultData,
  getSessionData,
  setSessionData,
  clearSessionData,
  hasVault,
} from './storage';
import { deriveKeypairFromXpriv, decryptData } from './crypto';

/**
 * Get current auth state
 */
export async function getAuthState(): Promise<AuthState> {
  const vaultExists = await hasVault();
  const session = await getSessionData();

  return {
    hasVault: vaultExists,
    isLoggedIn: vaultExists,
    isLocked: !session?.unlocked,
    activeIdentityIndex: session?.activeIdentityIndex ?? 0,
    publicKey: session?.identities?.[session.activeIdentityIndex]?.publicKey,
  };
}

/**
 * Unlock vault with PIN
 */
export async function unlockVault(pin: string): Promise<{
  success: boolean;
  error?: string;
  identities?: DerivedIdentity[];
}> {
  const vaultData = await getVaultData();
  if (!vaultData) {
    return { success: false, error: 'No vault found' };
  }

  try {
    // Decrypt xpriv with PIN
    const xpriv = decryptData(vaultData.xprivEncrypted, pin);

    // Derive all identities
    const identities: DerivedIdentity[] = vaultData.identities.map(
      (identity, index) => {
        const derived = deriveKeypairFromXpriv(xpriv, index);
        return {
          ...identity,
          privateKey: derived.privateKey,
          publicKey: derived.publicKey,
        };
      }
    );

    // Save session
    const sessionData: SessionData = {
      unlocked: true,
      xpriv,
      identities,
      activeIdentityIndex: 0,
    };
    await setSessionData(sessionData);

    return { success: true, identities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid PIN',
    };
  }
}

/**
 * Lock vault (clear session)
 */
export async function lockVault(): Promise<void> {
  await clearSessionData();
}

/**
 * Get current identity's private key
 */
export async function getActivePrivateKey(
  identityIndex?: number
): Promise<string | null> {
  const session = await getSessionData();
  if (!session?.unlocked || !session.identities) {
    return null;
  }

  const index = identityIndex ?? session.activeIdentityIndex;
  return session.identities[index]?.privateKey || null;
}

/**
 * Get current identity's public key
 */
export async function getActivePublicKey(
  identityIndex?: number
): Promise<string | null> {
  const session = await getSessionData();
  if (!session?.unlocked || !session.identities) {
    return null;
  }

  const index = identityIndex ?? session.activeIdentityIndex;
  return session.identities[index]?.publicKey || null;
}

/**
 * Switch active identity
 */
export async function switchIdentity(index: number): Promise<boolean> {
  const session = await getSessionData();
  if (!session?.unlocked || !session.identities) {
    return false;
  }

  if (index < 0 || index >= session.identities.length) {
    return false;
  }

  await setSessionData({
    ...session,
    activeIdentityIndex: index,
  });

  return true;
}

/**
 * Check if vault is unlocked
 */
export async function isUnlocked(): Promise<boolean> {
  const session = await getSessionData();
  return session?.unlocked === true;
}
