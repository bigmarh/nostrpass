/**
 * Svelte adapter for @nostrpass/vault-core
 *
 * Provides Svelte stores for using VaultCore in Svelte applications.
 *
 * @example
 * ```ts
 * import { createVaultStore } from '@nostrpass/vault-core/adapters/svelte';
 *
 * // Create store
 * export const vaultStore = createVaultStore({ workerUrl: '/crypto.worker.js' });
 *
 * // Use in components
 * <script>
 *   import { vaultStore } from './stores';
 *
 *   $: user = $vaultStore.user;
 *   $: isLocked = $vaultStore.isLocked;
 * </script>
 *
 * {#if $user}
 *   <h1>Welcome {$user.profile.username}</h1>
 * {:else}
 *   <LoginForm on:login={(e) => vaultStore.login(e.detail.username, e.detail.password)} />
 * {/if}
 * ```
 */

import { writable, get, type Readable } from 'svelte/store';
import { VaultCore } from '../VaultCore';
import type { User, VaultData, AppPermissions, VaultCoreConfig } from '../types';

export interface VaultStore extends Readable<{
  vault: VaultCore | null;
  user: User | null;
  isLocked: boolean;
  vaultData: VaultData | null;
  permissions: AppPermissions[];
  loading: {
    vault: boolean;
    permissions: boolean;
  };
}> {
  // Auth methods
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  unlockVault: (pin: string) => Promise<any>;
  lockVault: () => Promise<void>;

  // Vault data methods
  getVaultData: (username: string) => Promise<VaultData | null>;
  updateVaultData: (username: string, data: VaultData) => Promise<void>;

  // Identity methods
  createIdentity: (username: string, options: any) => Promise<any>;
  updateIdentity: (username: string, identityIndex: number, updates: any) => Promise<void>;
  deleteIdentity: (username: string, identityIndex: number) => Promise<void>;
  signEvent: (username: string, event: any, identityIndex: number) => Promise<any>;
  encrypt: (username: string, plaintext: string, recipientPubkey: string, identityIndex: number) => Promise<string>;
  decrypt: (username: string, ciphertext: string, senderPubkey: string, identityIndex: number) => Promise<string>;

  // Permission methods
  getAllPermissions: (username: string) => Promise<void>;
  revokePermissions: (username: string, origin: string) => Promise<void>;

  // Cleanup
  destroy: () => void;
}

/**
 * Create a Svelte store for VaultCore
 *
 * @param config - Vault configuration
 * @returns Vault store with reactive state and methods
 *
 * @example
 * ```ts
 * // stores.ts
 * export const vaultStore = createVaultStore({
 *   workerUrl: '/crypto.worker.js',
 *   environment: 'production'
 * });
 *
 * // Component.svelte
 * <script>
 *   import { vaultStore } from './stores';
 *
 *   async function handleLogin() {
 *     const result = await vaultStore.login('alice', 'password');
 *     if (result.success) {
 *       console.log('Logged in!');
 *     }
 *   }
 * </script>
 *
 * {#if $vaultStore.user}
 *   <p>Welcome {$vaultStore.user.profile.username}!</p>
 * {/if}
 * ```
 */
export function createVaultStore(config: VaultCoreConfig): VaultStore {
  let vaultInstance: VaultCore | null = null;

  const state = writable({
    vault: null as VaultCore | null,
    user: null as User | null,
    isLocked: true,
    vaultData: null as VaultData | null,
    permissions: [] as AppPermissions[],
    loading: {
      vault: false,
      permissions: false
    }
  });

  // Initialize vault
  (async () => {
    vaultInstance = new VaultCore(config);

    try {
      await vaultInstance.initialize();

      state.update(s => ({ ...s, vault: vaultInstance }));

      // Subscribe to auth changes
      vaultInstance.auth.onAuthStateChanged(user => {
        state.update(s => ({ ...s, user }));
      });

      vaultInstance.auth.onLockStateChanged(isLocked => {
        state.update(s => ({ ...s, isLocked }));
      });

      // Subscribe to vault updates
      vaultInstance.vault.onVaultUpdated(vaultData => {
        state.update(s => ({ ...s, vaultData }));
      });

      // Subscribe to permission updates
      vaultInstance.permissions.onPermissionsUpdated(() => {
        const currentState = get(state);
        if (currentState.user) {
          getAllPermissions(currentState.user.profile.username);
        }
      });

      vaultInstance.permissions.onPermissionsRevoked(() => {
        const currentState = get(state);
        if (currentState.user) {
          getAllPermissions(currentState.user.profile.username);
        }
      });
    } catch (error) {
      console.error('[createVaultStore] Initialization error:', error);
    }
  })();

  // Auth methods
  const login = async (username: string, password: string) => {
    if (!vaultInstance) throw new Error('Vault not initialized');
    return vaultInstance.auth.login(username, password);
  };

  const logout = async () => {
    if (!vaultInstance) return;
    return vaultInstance.auth.logout();
  };

  const unlockVault = async (pin: string) => {
    if (!vaultInstance) throw new Error('Vault not initialized');
    return vaultInstance.auth.unlockVault(pin);
  };

  const lockVault = async () => {
    if (!vaultInstance) return;
    return vaultInstance.auth.lockVault();
  };

  // Vault data methods
  const getVaultData = async (username: string) => {
    if (!vaultInstance) return null;

    state.update(s => ({ ...s, loading: { ...s.loading, vault: true } }));

    try {
      const data = await vaultInstance.vault.getVaultData(username);
      state.update(s => ({ ...s, vaultData: data, loading: { ...s.loading, vault: false } }));
      return data;
    } catch (error) {
      state.update(s => ({ ...s, loading: { ...s.loading, vault: false } }));
      throw error;
    }
  };

  const updateVaultData = async (username: string, data: VaultData) => {
    if (!vaultInstance) return;
    return vaultInstance.vault.updateVaultData(username, data);
  };

  // Identity methods
  const createIdentity = async (username: string, options: any) => {
    if (!vaultInstance) return null;
    return vaultInstance.identities.createIdentity(username, options);
  };

  const updateIdentity = async (username: string, identityIndex: number, updates: any) => {
    if (!vaultInstance) return;
    return vaultInstance.identities.updateIdentity(username, identityIndex, updates);
  };

  const deleteIdentity = async (username: string, identityIndex: number) => {
    if (!vaultInstance) return;
    return vaultInstance.identities.deleteIdentity(username, identityIndex);
  };

  const signEvent = async (username: string, event: any, identityIndex: number) => {
    if (!vaultInstance) return null;
    return vaultInstance.identities.signEvent(username, event, identityIndex);
  };

  const encrypt = async (username: string, plaintext: string, recipientPubkey: string, identityIndex: number) => {
    if (!vaultInstance) return '';
    return vaultInstance.identities.encrypt(username, plaintext, recipientPubkey, identityIndex);
  };

  const decrypt = async (username: string, ciphertext: string, senderPubkey: string, identityIndex: number) => {
    if (!vaultInstance) return '';
    return vaultInstance.identities.decrypt(username, ciphertext, senderPubkey, identityIndex);
  };

  // Permission methods
  const getAllPermissions = async (username: string) => {
    if (!vaultInstance) return;

    state.update(s => ({ ...s, loading: { ...s.loading, permissions: true } }));

    try {
      const permissions = await vaultInstance.permissions.getAllAppPermissions(username);
      state.update(s => ({
        ...s,
        permissions,
        loading: { ...s.loading, permissions: false }
      }));
    } catch (error) {
      state.update(s => ({ ...s, loading: { ...s.loading, permissions: false } }));
      throw error;
    }
  };

  const revokePermissions = async (username: string, origin: string) => {
    if (!vaultInstance) return;
    return vaultInstance.permissions.revokeAppPermissions(username, origin);
  };

  // Cleanup
  const destroy = () => {
    if (vaultInstance) {
      vaultInstance.destroy();
      vaultInstance = null;
    }
  };

  return {
    subscribe: state.subscribe,
    login,
    logout,
    unlockVault,
    lockVault,
    getVaultData,
    updateVaultData,
    createIdentity,
    updateIdentity,
    deleteIdentity,
    signEvent,
    encrypt,
    decrypt,
    getAllPermissions,
    revokePermissions,
    destroy
  };
}
