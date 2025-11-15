import { Component } from 'solid-js';
import { useAuth } from '../providers';
import { Dashboard } from './Dashboard';
import { Login } from './Login';
import { PinUnlock } from './PinUnlock';

/**
 * AccountManager - Smart routing component for account management
 *
 * This component handles the account management flow without relying on AuthGuard.
 * It checks the actual auth status and routes accordingly:
 *
 * 1. Not authenticated → Show Login
 * 2. Authenticated but locked → Show PIN unlock
 * 3. Authenticated and unlocked → Show Dashboard
 *
 * This prevents the "blinking" issue where guards redirect unnecessarily.
 */
export const AccountManager: Component = () => {
  const { isAuthenticated, isVaultLocked, user } = useAuth();

  console.log('[AccountManager] Rendering - Auth:', isAuthenticated(), 'Locked:', isVaultLocked(), 'User:', !!user());

  // Not authenticated - show login
  if (!isAuthenticated() || !user()) {
    console.log('[AccountManager] Showing Login');
    return <Login />;
  }

  // Authenticated but vault is locked - show PIN unlock
  if (isVaultLocked()) {
    console.log('[AccountManager] Showing PIN unlock');
    return <PinUnlock />;
  }

  // Authenticated and unlocked - show dashboard
  console.log('[AccountManager] Showing Dashboard');
  return <Dashboard />;
};

export default AccountManager;
