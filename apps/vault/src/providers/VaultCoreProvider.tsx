/**
 * VaultCoreProvider - Modern provider using @nostrpass/vault-core
 *
 * This provider wraps the framework-agnostic VaultCore library
 * for use in the SolidJS vault application.
 *
 * This is intended to eventually replace the legacy AuthProvider.
 *
 * Note: This inlines the SolidJS adapter logic to avoid Vite subpath export issues.
 */

import { createContext, useContext, ParentComponent, onMount, onCleanup, createSignal, createEffect, Accessor } from 'solid-js';
import { VaultCore } from '@nostrpass/vault-core';
import type { User, VaultData, AppPermissions } from '@nostrpass/vault-core';
import { getCryptoWorker } from '../services/cryptoWorkerSingleton';
import { getRelays } from './EnvironmentProvider';

// Inline SolidJS adapter functions
function createVault(config: any): Accessor<VaultCore | null> {
  const [vault, setVault] = createSignal<VaultCore | null>(null);

  createEffect(() => {
    const vaultInstance = new VaultCore(config);

    vaultInstance.initialize().then(() => {
      setVault(vaultInstance);
    }).catch(error => {
      console.error('[createVault] Initialization error:', error);
    });

    onCleanup(() => {
      vaultInstance.destroy();
    });
  });

  return vault;
}

function createAuth(vault: Accessor<VaultCore | null>) {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLocked, setIsLocked] = createSignal(true);

  createEffect(() => {
    const v = vault();
    if (!v) return;

    const unsubAuth = v.auth.onAuthStateChanged(setUser);
    const unsubLock = v.auth.onLockStateChanged(setIsLocked);

    onCleanup(() => {
      unsubAuth();
      unsubLock();
    });
  });

  const login = async (username: string, password: string) => {
    const v = vault();
    if (!v) return { success: false, error: 'Vault not initialized' };
    return v.auth.login(username, password);
  };

  const logout = async () => {
    const v = vault();
    if (!v) return;
    return v.auth.logout();
  };

  const unlockVault = async (pin: string) => {
    const v = vault();
    if (!v) return { success: false, error: 'Vault not initialized' };
    return v.auth.unlockVault(pin);
  };

  const lockVault = async () => {
    const v = vault();
    if (!v) return;
    return v.auth.lockVault();
  };

  return {
    user,
    isLocked,
    login,
    logout,
    unlockVault,
    lockVault
  };
}

function createVaultData(vault: Accessor<VaultCore | null>, username: Accessor<string | null>) {
  const [data, setData] = createSignal<VaultData | null>(null);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    const v = vault();
    const u = username();

    if (!v || !u) return;

    setLoading(true);
    v.vault.getVaultData(u)
      .then(vaultData => {
        setData(vaultData);
      })
      .catch(err => {
        console.error('Failed to load vault data:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubVault = v.vault.onVaultUpdated(setData);

    onCleanup(() => {
      unsubVault();
    });
  });

  return {
    data,
    loading
  };
}

function createIdentities(vault: Accessor<VaultCore | null>, username: Accessor<string | null>) {
  const vaultData = createVaultData(vault, username);

  const list = () => vaultData.data()?.identities || [];

  const create = async (options: { name: string; purpose?: string }) => {
    const v = vault();
    const u = username();
    if (!v || !u) return null;
    return v.identities.createIdentity(u, options);
  };

  return {
    list,
    create
  };
}

function createPermissions(vault: Accessor<VaultCore | null>, username: Accessor<string | null>) {
  const [list, setList] = createSignal<AppPermissions[]>([]);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    const v = vault();
    const u = username();

    if (!v || !u) return;

    setLoading(true);
    v.permissions.getAllAppPermissions(u)
      .then(setList)
      .catch(err => console.error('Failed to load permissions:', err))
      .finally(() => setLoading(false));

    const unsubUpdated = v.permissions.onPermissionsUpdated(() => {
      v.permissions.getAllAppPermissions(u).then(setList);
    });

    const unsubRevoked = v.permissions.onPermissionsRevoked(() => {
      v.permissions.getAllAppPermissions(u).then(setList);
    });

    onCleanup(() => {
      unsubUpdated();
      unsubRevoked();
    });
  });

  const revoke = async (origin: string) => {
    const v = vault();
    const u = username();
    if (!v || !u) return;
    return v.permissions.revokeAppPermissions(u, origin);
  };

  return {
    list,
    loading,
    revoke
  };
}

interface VaultCoreContextType {
  vault: Accessor<VaultCore | null>;
  auth: ReturnType<typeof createAuth>;
  vaultData: ReturnType<typeof createVaultData>;
  identities: ReturnType<typeof createIdentities>;
  permissions: ReturnType<typeof createPermissions>;
}

const VaultCoreContext = createContext<VaultCoreContextType>();

/**
 * Provider component that initializes and provides vault-core
 *
 * @example
 * ```tsx
 * <VaultCoreProvider>
 *   <App />
 * </VaultCoreProvider>
 * ```
 */
export const VaultCoreProvider: ParentComponent = (props) => {
  // Get the worker-messenger RPC client
  const workerClient = getCryptoWorker();
  const relays = getRelays();

  // Create vault instance with RPC client
  const vault = createVault({
    workerClient,
    environment: import.meta.env.MODE || 'production',
    relays,
    debug: import.meta.env.DEV
  });

  // Create auth state
  const auth = createAuth(vault);

  // Get username from auth
  const username = () => auth.user()?.profile?.username || null;

  // Create vault data manager
  const vaultData = createVaultData(vault, username);

  // Create identities manager
  const identities = createIdentities(vault, username);

  // Create permissions manager
  const permissions = createPermissions(vault, username);

  // Log initialization
  onMount(() => {
    console.log('[VaultCoreProvider] Initialized');
  });

  // Cleanup on unmount
  onCleanup(() => {
    const v = vault();
    if (v) {
      v.destroy();
      console.log('[VaultCoreProvider] Destroyed');
    }
  });

  const value: VaultCoreContextType = {
    vault,
    auth,
    vaultData,
    identities,
    permissions
  };

  return (
    <VaultCoreContext.Provider value={value}>
      {props.children}
    </VaultCoreContext.Provider>
  );
};

/**
 * Hook to access the vault-core context
 */
export function useVaultCore() {
  const context = useContext(VaultCoreContext);
  if (!context) {
    throw new Error('useVaultCore must be used within VaultCoreProvider');
  }
  return context;
}

/**
 * Hook to access just the auth state (convenience)
 */
export function useVaultCoreAuth() {
  return useVaultCore().auth;
}

/**
 * Hook to access just the vault instance (convenience)
 */
export function useVault() {
  return useVaultCore().vault;
}

/**
 * Hook to access just the identities manager (convenience)
 */
export function useVaultCoreIdentities() {
  return useVaultCore().identities;
}

/**
 * Hook to access just the permissions manager (convenience)
 */
export function useVaultCorePermissions() {
  return useVaultCore().permissions;
}
