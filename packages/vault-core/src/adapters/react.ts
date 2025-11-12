/**
 * React adapter for @nostrpass/vault-core
 *
 * Provides React hooks for using VaultCore in React applications.
 *
 * @example
 * ```tsx
 * import { useVault, useAuth } from '@nostrpass/vault-core/adapters/react';
 *
 * function App() {
 *   const vault = useVault({ workerUrl: '/crypto.worker.js' });
 *   const { user, isLocked } = useAuth(vault);
 *
 *   if (!user) {
 *     return <LoginForm vault={vault} />;
 *   }
 *
 *   return <Dashboard user={user} vault={vault} />;
 * }
 * ```
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { VaultCore } from '../VaultCore';
import type { User, VaultData, AppPermissions, VaultCoreConfig } from '../types';

/**
 * Create and initialize a VaultCore instance
 *
 * @param config - Vault configuration
 * @returns VaultCore instance
 *
 * @example
 * ```tsx
 * function App() {
 *   const vault = useVault({ workerUrl: '/crypto.worker.js' });
 *
 *   return <Dashboard vault={vault} />;
 * }
 * ```
 */
export function useVault(config: VaultCoreConfig): VaultCore | null {
  const [vault, setVault] = useState<VaultCore | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    const vaultInstance = new VaultCore(configRef.current);

    vaultInstance.initialize().then(() => {
      setVault(vaultInstance);
    }).catch(error => {
      console.error('[useVault] Initialization error:', error);
    });

    return () => {
      vaultInstance.destroy();
    };
  }, []);

  return vault;
}

/**
 * Subscribe to authentication state
 *
 * @param vault - VaultCore instance
 * @returns Auth state
 *
 * @example
 * ```tsx
 * function Dashboard({ vault }) {
 *   const { user, isLocked, login, logout, unlockVault, lockVault } = useAuth(vault);
 *
 *   if (!user) {
 *     return <button onClick={() => login('username', 'password')}>Login</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Welcome {user.profile.username}</h1>
 *       {isLocked && <button onClick={() => unlockVault('123456')}>Unlock</button>}
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(vault: VaultCore | null) {
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    if (!vault) return;

    const unsubAuth = vault.auth.onAuthStateChanged(setUser);
    const unsubLock = vault.auth.onLockStateChanged(setIsLocked);

    return () => {
      unsubAuth();
      unsubLock();
    };
  }, [vault]);

  const login = useMemo(() => {
    if (!vault) return async () => ({ success: false, error: 'Vault not initialized' });
    return vault.auth.login.bind(vault.auth);
  }, [vault]);

  const logout = useMemo(() => {
    if (!vault) return async () => {};
    return vault.auth.logout.bind(vault.auth);
  }, [vault]);

  const unlockVault = useMemo(() => {
    if (!vault) return async () => ({ success: false, error: 'Vault not initialized' });
    return vault.auth.unlockVault.bind(vault.auth);
  }, [vault]);

  const lockVault = useMemo(() => {
    if (!vault) return async () => {};
    return vault.auth.lockVault.bind(vault.auth);
  }, [vault]);

  return {
    user,
    isLocked,
    login,
    logout,
    unlockVault,
    lockVault
  };
}

/**
 * Subscribe to vault data
 *
 * @param vault - VaultCore instance
 * @param username - Username
 * @returns Vault data
 *
 * @example
 * ```tsx
 * function VaultSettings({ vault, username }) {
 *   const { vaultData, loading, error, updateVaultData } = useVaultData(vault, username);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return <VaultDataEditor data={vaultData} onSave={updateVaultData} />;
 * }
 * ```
 */
export function useVaultData(vault: VaultCore | null, username: string | null) {
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vault || !username) return;

    setLoading(true);
    vault.vault.getVaultData(username)
      .then(data => {
        setVaultData(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubVault = vault.vault.onVaultUpdated(setVaultData);

    return () => {
      unsubVault();
    };
  }, [vault, username]);

  const updateVaultData = useMemo(() => {
    if (!vault || !username) return async () => {};
    return (data: VaultData) => vault.vault.updateVaultData(username, data);
  }, [vault, username]);

  return {
    vaultData,
    loading,
    error,
    updateVaultData
  };
}

/**
 * Subscribe to identities
 *
 * @param vault - VaultCore instance
 * @param username - Username
 * @returns Identities from vault data
 *
 * @example
 * ```tsx
 * function IdentityList({ vault, username }) {
 *   const { identities, createIdentity, updateIdentity, deleteIdentity } = useIdentities(vault, username);
 *
 *   return (
 *     <div>
 *       {identities?.map((identity, index) => (
 *         <IdentityCard
 *           key={index}
 *           identity={identity}
 *           onUpdate={(updates) => updateIdentity(index, updates)}
 *           onDelete={() => deleteIdentity(index)}
 *         />
 *       ))}
 *       <button onClick={() => createIdentity({ name: 'New Identity' })}>
 *         Add Identity
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useIdentities(vault: VaultCore | null, username: string | null) {
  const { vaultData } = useVaultData(vault, username);

  const createIdentity = useMemo(() => {
    if (!vault || !username) return async () => null;
    return vault.identities.createIdentity.bind(vault.identities, username);
  }, [vault, username]);

  const updateIdentity = useMemo(() => {
    if (!vault || !username) return async () => {};
    return vault.identities.updateIdentity.bind(vault.identities, username);
  }, [vault, username]);

  const deleteIdentity = useMemo(() => {
    if (!vault || !username) return async () => {};
    return vault.identities.deleteIdentity.bind(vault.identities, username);
  }, [vault, username]);

  const signEvent = useMemo(() => {
    if (!vault || !username) return async () => null;
    return vault.identities.signEvent.bind(vault.identities, username);
  }, [vault, username]);

  const encrypt = useMemo(() => {
    if (!vault || !username) return async () => '';
    return vault.identities.encrypt.bind(vault.identities, username);
  }, [vault, username]);

  const decrypt = useMemo(() => {
    if (!vault || !username) return async () => '';
    return vault.identities.decrypt.bind(vault.identities, username);
  }, [vault, username]);

  return {
    identities: vaultData?.identities || [],
    createIdentity,
    updateIdentity,
    deleteIdentity,
    signEvent,
    encrypt,
    decrypt
  };
}

/**
 * Subscribe to app permissions
 *
 * @param vault - VaultCore instance
 * @param username - Username
 * @returns App permissions
 *
 * @example
 * ```tsx
 * function PermissionsManager({ vault, username }) {
 *   const { permissions, loading, revokePermissions } = usePermissions(vault, username);
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {permissions.map(perm => (
 *         <PermissionCard
 *           key={perm.appId}
 *           permission={perm}
 *           onRevoke={() => revokePermissions(perm.appId)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(vault: VaultCore | null, username: string | null) {
  const [permissions, setPermissions] = useState<AppPermissions[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vault || !username) return;

    setLoading(true);
    vault.permissions.getAllAppPermissions(username)
      .then(setPermissions)
      .catch(err => console.error('Failed to load permissions:', err))
      .finally(() => setLoading(false));

    const unsubUpdated = vault.permissions.onPermissionsUpdated(() => {
      vault.permissions.getAllAppPermissions(username).then(setPermissions);
    });

    const unsubRevoked = vault.permissions.onPermissionsRevoked(() => {
      vault.permissions.getAllAppPermissions(username).then(setPermissions);
    });

    return () => {
      unsubUpdated();
      unsubRevoked();
    };
  }, [vault, username]);

  const revokePermissions = useMemo(() => {
    if (!vault || !username) return async () => {};
    return (origin: string) => vault.permissions.revokeAppPermissions(username, origin);
  }, [vault, username]);

  return {
    permissions,
    loading,
    revokePermissions
  };
}
