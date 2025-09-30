import { Component, createSignal, Show, createEffect, For } from 'solid-js';
import { useAuth, useCryptoWorker, useEnvironment } from '../providers';
import { useNavigate, useParams } from '@solidjs/router';
import { PermissionsDashboard } from './PermissionsDashboard';
import RelaysSection from './RelaysSection';
import SessionsSection from './SessionsSection';
import { AuditLog } from './AuditLog';
import type { Identity } from '@nostrpass/types';
import { sanitizeDomain } from '@nostrpass/nostrHelpers';

type SettingsTab = 'identity' | 'permissions' | 'security' | 'audit';

export const Settings: Component = () => {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const cryptoWorker = useCryptoWorker();
  const env = useEnvironment();
  const [activeTab, setActiveTab] = createSignal<SettingsTab>('identity');
  const [currentIdentity, setCurrentIdentity] = createSignal<Identity | null>(null);
  const [identityPublicKey, setIdentityPublicKey] = createSignal<string>('');
  const [editingNickname, setEditingNickname] = createSignal(false);
  const [newNickname, setNewNickname] = createSignal('');
  const [identityIndex, setIdentityIndex] = createSignal(0);
  const [allIdentities, setAllIdentities] = createSignal<any[]>([]);
  const [activeIndexForApp, setActiveIndexForApp] = createSignal<number | null>(null);

  // Load specific identity from URL
  createEffect(async () => {
    const currentUser = user();
    const identityPubkey = currentIdentity()?.publicKey;
    if (!currentUser || !cryptoWorker || !identityPubkey) return;

    try {
      const vaultData = await cryptoWorker.getVaultData({ 
        username: currentUser.profile.username 
      });
      
      if (vaultData && vaultData.identities) {
        setAllIdentities(vaultData.identities);
        // Find the identity that matches the pubkey from URL
        let foundIndex = -1;
        let foundIdentity = null;
        
        // For now, since we only have one identity, we'll use the current one
        // In the future, we'll need to derive public keys for each identity
        // and match against the URL parameter
        if (identityPubkey === currentUser.publicKey) {
          foundIndex = 0;
          foundIdentity = vaultData.identities[foundIndex];
        } else {
          // Try to find by matching against stored identities
          // This will need to be enhanced when we have multiple identities with different keys
          vaultData.identities.forEach((identity: any, index: number) => {
            // TODO: Derive public key for each identity and compare
            if (index === 0 && identityPubkey === currentUser.publicKey) {
              foundIndex = index;
              foundIdentity = identity;
            }
          });
        }
        
        if (foundIdentity && foundIndex >= 0) {
          setIdentityIndex(foundIndex);
          setCurrentIdentity(foundIdentity);
          setNewNickname(foundIdentity.nickname || 'Personal');
          setIdentityPublicKey(identityPubkey);
          try {
            const appKey = sanitizeDomain(params.app);
            const ai = (vaultData as any).activeIdentityByApp?.[appKey];
            setActiveIndexForApp(typeof ai === 'number' ? ai : null);
          } catch {}
        } else {
          // Identity not found - redirect to dashboard
          navigate(`/${params.app}/dashboard`);
        }
      }
    } catch (error) {
    }
  });

  const handleBack = () => {
    navigate(`/${params.app}/dashboard`);
  };

  const saveIdentityNickname = async () => {
    const currentUser = user();
    if (!currentUser || !cryptoWorker || !currentIdentity()) return;

    try {
      const vaultData = await cryptoWorker.getVaultData({ 
        username: currentUser.profile.username 
      });
      
      if (vaultData && vaultData.identities[identityIndex()]) {
        // Update the identity nickname
        vaultData.identities[identityIndex()].nickname = newNickname();
        vaultData.updatedAt = Date.now();
        
        // Save to vault
        await cryptoWorker.updateVaultData({ 
          username: currentUser.profile.username, 
          vaultData 
        });
        
        // Update local state
        setCurrentIdentity({...vaultData.identities[identityIndex()]});
        setEditingNickname(false);
        
        // Sync to Nostr
        try {
          const vaultEvent = await cryptoWorker.saveVaultToNostr({ 
            username: currentUser.profile.username 
          });
          const { publishEvent } = await import('@nostrpass/nostrHelpers');
          await publishEvent(vaultEvent.event, env.getRelays());
        } catch (error) {
        }
      }
    } catch (error) {
    }
  };

  const makeActiveForThisApp = async (index: number) => {
    const currentUser = user();
    if (!currentUser || !cryptoWorker) return;
    try {
      const appKey = sanitizeDomain(params.app);
      const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      (vaultData as any).activeIdentityByApp = (vaultData as any).activeIdentityByApp || {};
      (vaultData as any).activeIdentityByApp[appKey] = index;
      (vaultData as any).updatedAt = Date.now();
      await cryptoWorker.updateVaultData({ username: currentUser.profile.username, vaultData });
      setActiveIndexForApp(index);
      // Optionally sync to Nostr in background
      try {
        const vaultEvent = await cryptoWorker.saveVaultToNostr({ username: currentUser.profile.username });
        const { publishEvent } = await import('@nostrpass/nostrHelpers');
        await publishEvent(vaultEvent.event, env.getRelays());
      } catch {}
    } catch {}
  };

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'identity', label: 'Identity', icon: '👤' },
    { id: 'permissions', label: 'App Permissions', icon: '🔒' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'audit', label: 'Audit Log', icon: '📝' }
  ];

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div class="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div class="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
            <Show when={currentIdentity()}>
              <span class="text-lg font-normal text-gray-600 dark:text-gray-400 ml-2">
                - {currentIdentity()?.nickname || 'Personal'}
              </span>
            </Show>
          </h1>
        </div>

        {/* Tab Navigation */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map(tab => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab() === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span class="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <Show when={activeTab() === 'identity'}>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Current Identity
            </h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Identity Name
                </label>
                <Show 
                  when={editingNickname()}
                  fallback={
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentIdentity()?.nickname || 'Personal'}
                        disabled
                        class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                      />
                      <button
                        onClick={() => setEditingNickname(true)}
                        class="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  }
                >
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      value={newNickname()}
                      onInput={(e) => setNewNickname(e.currentTarget.value)}
                      class="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter identity name"
                    />
                    <button
                      onClick={saveIdentityNickname}
                      class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingNickname(false);
                        setNewNickname(currentIdentity()?.nickname || 'Personal');
                      }}
                      class="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Public Key
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    value={identityPublicKey()}
                    disabled
                    class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 font-mono text-xs"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(identityPublicKey())}
                    class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Connected Apps
                </label>
                <div class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                  {Object.keys(currentIdentity()?.appPermissions || {}).length} apps
                </div>
              </div>
              <Show when={currentIdentity()?.settings}>
                <div>
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Identity Settings
                  </h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-gray-600 dark:text-gray-400">Theme</span>
                      <span class="text-sm text-gray-900 dark:text-white">
                        {currentIdentity()?.settings?.theme || 'System'}
                      </span>
                    </div>
                    <Show when={currentIdentity()?.settings?.defaultRelays}>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600 dark:text-gray-400">Custom Relays</span>
                        <span class="text-sm text-gray-900 dark:text-white">
                          {currentIdentity()?.settings?.defaultRelays?.length || 0}
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
              
              <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div class="space-y-4">
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Identities</h3>
                  <div class="grid gap-3">
                    <For each={allIdentities()}>
                      {(id, idx) => (
                        <div class={`flex items-center justify-between p-3 rounded-lg border ${activeIndexForApp() === idx() ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                          <div>
                            <div class="text-sm text-gray-900 dark:text-white font-medium">{id.nickname || (idx() === 0 ? 'Personal' : `Identity ${idx()}`)}</div>
                            <div class="text-xs text-gray-600 dark:text-gray-400">Index {idx()}</div>
                          </div>
                          <div class="flex items-center gap-2">
                            <Show when={activeIndexForApp() === idx()} fallback={
                              <button
                                onClick={() => makeActiveForThisApp(idx())}
                                class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Use for this app
                              </button>
                            }>
                              <span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</span>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
                    You are viewing settings for the "{currentIdentity()?.nickname || 'Personal'}" identity.
                    Each identity maintains its own permissions and settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'permissions'}>
          <PermissionsDashboard />
        </Show>

        <Show when={activeTab() === 'security'}>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Security Settings
            </h2>
            <div class="space-y-6">
              <SessionsSection />
              <RelaysSection />
              <div>
                <h3 class="font-medium mb-2 text-gray-900 dark:text-white">Session Timeout</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Your session will automatically lock after this period of inactivity
                </p>
                <select
                  value={user()?.profile.security?.sessionTimeout || 60}
                  onChange={(e) => {
                    const timeout = parseInt(e.currentTarget.value);
                    updateProfile({
                      security: {
                        ...user()?.profile.security,
                        sessionTimeout: timeout
                      }
                    });
                  }}
                  class="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                </select>
              </div>

              <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 class="font-medium mb-2 text-red-600 dark:text-red-400">Danger Zone</h3>
                <div class="flex gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/${params.app}/unlock?recovery=1`)}
                    class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Start Recovery
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const current = user();
                        if (current) {
                          const cw = useCryptoWorker();
                          if (cw) {
                            await cw.clearSession({ username: current.profile.username });
                          }
                        }
                        navigate(`/${params.app}/unlock`);
                      } catch {}
                    }}
                    class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    Lock Vault
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to log out?')) {
                        logout();
                        navigate(`/${params.app}`);
                      }
                    }}
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Log Out
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ DELETE ACCOUNT?\n\nThis will permanently delete your vault from this device.\n\nYour data on Nostr relays will remain (can be recovered with username).')) {
                        try {
                          await logout(true);
                          // Wait for deletion to complete
                          await new Promise(resolve => setTimeout(resolve, 200));
                          navigate(`/${params.app}`);
                        } catch (error) {
                          console.error('Failed to delete vault:', error);
                          alert('Failed to delete vault. Check console for details.');
                        }
                      }
                    }}
                    class="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors border-2 border-red-600"
                  >
                    Delete Local Vault
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'audit'}>
          <AuditLog />
        </Show>
      </div>
    </div>
  );
};