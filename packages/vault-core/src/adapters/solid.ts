/**
 * SolidJS adapter for @nostrpass/vault-core
 *
 * Provides SolidJS primitives for using VaultCore in SolidJS applications.
 *
 * @example
 * ```tsx
 * import { createVault, createAuth } from '@nostrpass/vault-core/adapters/solid';
 *
 * function App() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *   const auth = createAuth(vault);
 *
 *   return (
 *     <Show when={auth.user()} fallback={<LoginForm vault={vault()} />}>
 *       <Dashboard user={auth.user()} vault={vault()} />
 *     </Show>
 *   );
 * }
 * ```
 */

import { createSignal, createEffect, onCleanup, Accessor } from 'solid-js';
import { VaultCore } from '../VaultCore';
import type { User, VaultData, AppPermissions, VaultCoreConfig } from '../types';

/**
 * Create and initialize a VaultCore instance
 *
 * @param config - Vault configuration
 * @returns Accessor for VaultCore instance
 *
 * @example
 * ```tsx
 * function App() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *
 *   return (
 *     <Show when={vault()}>
 *       {(v) => <Dashboard vault={v()} />}
 *     </Show>
 *   );
 * }
 * ```
 */
export function createVault(config: VaultCoreConfig): Accessor<VaultCore | null> {
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

/**
 * Create auth state signals
 *
 * @param vault - Accessor for VaultCore instance
 * @returns Auth state and methods
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *   const auth = createAuth(vault);
 *
 *   return (
 *     <div>
 *       <Show when={auth.user()}>
 *         {(user) => <h1>Welcome {user().profile.username}</h1>}
 *       </Show>
 *       <Show when={auth.isLocked()}>
 *         <button onClick={() => auth.unlockVault('123456')}>Unlock</button>
 *       </Show>
 *       <button onClick={auth.logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createAuth(vault: Accessor<VaultCore | null>) {
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

/**
 * Create vault data signal
 *
 * @param vault - Accessor for VaultCore instance
 * @param username - Accessor for username
 * @returns Vault data, loading state, and methods
 *
 * @example
 * ```tsx
 * function VaultSettings() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *   const [username] = createSignal('alice');
 *   const vaultData = createVaultData(vault, username);
 *
 *   return (
 *     <Show when={!vaultData.loading()} fallback={<Spinner />}>
 *       <VaultDataEditor
 *         data={vaultData.data()}
 *         onSave={vaultData.update}
 *       />
 *     </Show>
 *   );
 * }
 * ```
 */
export function createVaultData(
  vault: Accessor<VaultCore | null>,
  username: Accessor<string | null>
) {
  const [data, setData] = createSignal<VaultData | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const v = vault();
    const u = username();

    if (!v || !u) return;

    setLoading(true);
    v.vault.getVaultData(u)
      .then(vaultData => {
        setData(vaultData);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubVault = v.vault.onVaultUpdated(setData);

    onCleanup(() => {
      unsubVault();
    });
  });

  const update = async (vaultData: VaultData) => {
    const v = vault();
    const u = username();
    if (!v || !u) return;
    return v.vault.updateVaultData(u, vaultData);
  };

  return {
    data,
    loading,
    error,
    update
  };
}

/**
 * Create identities signals
 *
 * @param vault - Accessor for VaultCore instance
 * @param username - Accessor for username
 * @returns Identities and methods
 *
 * @example
 * ```tsx
 * function IdentityList() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *   const [username] = createSignal('alice');
 *   const identities = createIdentities(vault, username);
 *
 *   return (
 *     <For each={identities.list()}>
 *       {(identity, index) => (
 *         <IdentityCard
 *           identity={identity}
 *           onUpdate={(updates) => identities.update(index(), updates)}
 *           onDelete={() => identities.remove(index())}
 *         />
 *       )}
 *     </For>
 *   );
 * }
 * ```
 */
export function createIdentities(
  vault: Accessor<VaultCore | null>,
  username: Accessor<string | null>
) {
  const vaultData = createVaultData(vault, username);

  const list = () => vaultData.data()?.identities || [];

  const create = async (options: { name: string; purpose?: string; derivationPath?: string }) => {
    const v = vault();
    const u = username();
    if (!v || !u) return null;
    return v.identities.createIdentity(u, options);
  };

  const update = async (identityIndex: number, updates: Partial<any>) => {
    const v = vault();
    const u = username();
    if (!v || !u) return;
    return v.identities.updateIdentity(u, identityIndex, updates);
  };

  const remove = async (identityIndex: number) => {
    const v = vault();
    const u = username();
    if (!v || !u) return;
    return v.identities.deleteIdentity(u, identityIndex);
  };

  const signEvent = async (event: any, identityIndex: number) => {
    const v = vault();
    const u = username();
    if (!v || !u) return null;
    return v.identities.signEvent(u, event, identityIndex);
  };

  const encrypt = async (plaintext: string, recipientPubkey: string, identityIndex: number) => {
    const v = vault();
    const u = username();
    if (!v || !u) return '';
    return v.identities.encrypt(u, plaintext, recipientPubkey, identityIndex);
  };

  const decrypt = async (ciphertext: string, senderPubkey: string, identityIndex: number) => {
    const v = vault();
    const u = username();
    if (!v || !u) return '';
    return v.identities.decrypt(u, ciphertext, senderPubkey, identityIndex);
  };

  return {
    list,
    create,
    update,
    remove,
    signEvent,
    encrypt,
    decrypt
  };
}

/**
 * Create permissions signal
 *
 * @param vault - Accessor for VaultCore instance
 * @param username - Accessor for username
 * @returns Permissions, loading state, and methods
 *
 * @example
 * ```tsx
 * function PermissionsManager() {
 *   const vault = createVault({ workerUrl: '/crypto.worker.js' });
 *   const [username] = createSignal('alice');
 *   const permissions = createPermissions(vault, username);
 *
 *   return (
 *     <Show when={!permissions.loading()} fallback={<Spinner />}>
 *       <For each={permissions.list()}>
 *         {(perm) => (
 *           <PermissionCard
 *             permission={perm}
 *             onRevoke={() => permissions.revoke(perm.appId)}
 *           />
 *         )}
 *       </For>
 *     </Show>
 *   );
 * }
 * ```
 */
export function createPermissions(
  vault: Accessor<VaultCore | null>,
  username: Accessor<string | null>
) {
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
