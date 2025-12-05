import { Component, createSignal, Show, createEffect, For } from 'solid-js';
import { useAuth, useCryptoWorker, useEnvironment } from '../providers';
import { useNavigate, useParams } from '@solidjs/router';
import { PermissionsDashboard } from './PermissionsDashboard';
import RelaysSection from './RelaysSection';
import SessionsSection from './SessionsSection';
import { AuditLog } from './AuditLog';
import type { Identity } from '@nostrpass/types';
import { sanitizeDomain, desanitizeDomain } from '@nostrpass/nostrHelpers';
import { getActiveIdentity, setActiveIdentity } from '../utils/activeIdentityManager';

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
          // Try to find by matching public keys
          // Currently only handles the default identity (index 0)
          vaultData.identities.forEach((identity: any, index: number) => {
            // Match by public key - worker handles key derivation
            if (identity.publicKey === identityPubkey) {
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
            // Get active identity from localStorage (per-browser, not synced)
            const appOrigin = (() => {
              try {
                const domain = desanitizeDomain(appKey);
                if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
                  return `http://${domain}`;
                }
                return `https://${domain}`;
              } catch {
                return appKey.startsWith('http') ? appKey : `https://${appKey}`;
              }
            })();
            const ai = getActiveIdentity(currentUser.profile.username, appOrigin) ?? (vaultData as any).activeIdentityByApp?.[appKey];
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
          // PRE model: identity nickname updates will be event-sourced soon
          console.log('[Settings] PRE model: nickname updated locally');
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
      // Set active identity in localStorage (per-browser, not synced)
      const appOrigin = (() => {
        try {
          const domain = desanitizeDomain(appKey);
          if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
            return `http://${domain}`;
          }
          return `https://${domain}`;
        } catch {
          return appKey.startsWith('http') ? appKey : `https://${appKey}`;
        }
      })();
      await setActiveIdentity(currentUser.profile.username, appOrigin, index);

      const vaultData = await cryptoWorker.getVaultData({ username: currentUser.profile.username });
      (vaultData as any).activeIdentityByApp = (vaultData as any).activeIdentityByApp || {};
      (vaultData as any).activeIdentityByApp[appKey] = index;
      (vaultData as any).updatedAt = Date.now();
      await cryptoWorker.updateVaultData({ username: currentUser.profile.username, vaultData });
      setActiveIndexForApp(index);
      // Optionally sync to Nostr in background
      try {
        // PRE model: active identity will be event-sourced soon
        console.log('[Settings] PRE model: active identity updated locally');
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
      <div class="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div class="flex items-center gap-3 mb-8">
          <button
            onClick={handleBack}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
            <Show when={currentIdentity()}>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {currentIdentity()?.nickname || 'Personal'}
              </p>
            </Show>
          </div>
        </div>

        {/* Tab Navigation */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 overflow-hidden">
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map(tab => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  activeTab() === tab.id
                    ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-900 dark:border-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
          <div class="space-y-4">
            {/* Identity Details Card */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Identity Details
                </h2>
              </div>
              <div class="p-6 space-y-5">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Identity Name
                </label>
                <Show
                  when={editingNickname()}
                  fallback={
                    <div class="flex items-center gap-2">
                      <div class="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                        {currentIdentity()?.nickname || 'Personal'}
                      </div>
                      <button
                        onClick={() => setEditingNickname(true)}
                        class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                      class="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                      placeholder="Enter identity name"
                    />
                    <button
                      onClick={saveIdentityNickname}
                      class="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingNickname(false);
                        setNewNickname(currentIdentity()?.nickname || 'Personal');
                      }}
                      class="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Public Key
                </label>
                <div class="flex items-center gap-2">
                  <div class="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-600 dark:text-gray-400 font-mono text-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="truncate">{identityPublicKey()}</div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(identityPublicKey())}
                    class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Connected Apps
                </label>
                <div class="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {Object.keys(currentIdentity()?.appPermissions || {}).length} apps
                </div>
              </div>
              </div>
            </div>

            {/* All Identities Card */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  All Identities
                </h2>
              </div>
              <div class="p-6">
                <div class="space-y-2">
                  <For each={allIdentities()}>
                    {(id, idx) => (
                      <div class={`flex items-center justify-between p-4 rounded-lg border transition-all ${activeIndexForApp() === idx() ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-900' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        <div class="flex items-center gap-3">
                          <div class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${activeIndexForApp() === idx() ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                            {id.nickname?.slice(0, 2).toUpperCase() || (idx() === 0 ? 'PE' : `I${idx()}`)}
                          </div>
                          <div>
                            <div class="text-sm text-gray-900 dark:text-white font-medium">{id.nickname || (idx() === 0 ? 'Personal' : `Identity ${idx()}`)}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Identity #{idx()}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <Show when={activeIndexForApp() === idx()} fallback={
                            <button
                              onClick={() => makeActiveForThisApp(idx())}
                              class="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                            >
                              Use for this app
                            </button>
                          }>
                            <span class="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Active</span>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                  Each identity maintains its own permissions and settings for different apps.
                </p>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'permissions'}>
          <PermissionsDashboard />
        </Show>

        <Show when={activeTab() === 'security'}>
          <div class="space-y-4">
            {/* Sessions & Relays */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Sessions & Relays
                </h2>
              </div>
              <div class="p-6 space-y-6">
                <SessionsSection />
                <RelaysSection />
              </div>
            </div>

            {/* Session Timeout */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <h2 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Session Timeout
                </h2>
              </div>
              <div class="p-6">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                  class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                </select>
              </div>
            </div>

            {/* Danger Zone */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900 shadow-sm overflow-hidden">
              <div class="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900">
                <h2 class="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Danger Zone
                </h2>
              </div>
              <div class="p-6">
                <div class="space-y-3">
                  <button
                    onClick={() => navigate(`/${params.app}/unlock?recovery=1`)}
                    class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-left"
                  >
                    Start Recovery Process
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
                    class="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
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
                    class="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Log Out
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ DELETE ACCOUNT?\n\nThis will permanently delete your vault from this device.\n\nYour data on Nostr relays will remain (can be recovered with username).')) {
                        try {
                          await logout();
                          await new Promise(resolve => setTimeout(resolve, 200));
                          navigate(`/${params.app}`);
                        } catch (error) {
                          console.error('Failed to delete vault:', error);
                          alert('Failed to delete vault. Check console for details.');
                        }
                      }
                    }}
                    class="w-full px-4 py-3 bg-gray-900 dark:bg-red-900 text-white rounded-lg hover:bg-black dark:hover:bg-red-800 transition-colors border-2 border-red-600 text-sm font-medium"
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