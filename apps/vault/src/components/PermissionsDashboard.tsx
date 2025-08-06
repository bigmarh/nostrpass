import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { useAuth } from '../providers/AuthProvider';
import { PermissionService } from '../services/permissionService';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';

export const PermissionsDashboard: Component = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = createSignal<AppPermissions[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [editingApp, setEditingApp] = createSignal<string | null>(null);
  const permissionService = PermissionService.getInstance();

  onMount(async () => {
    await loadPermissions();
  });

  const loadPermissions = async () => {
    const currentUser = user();
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const allPermissions = await permissionService.getAllAppPermissions(
        currentUser.profile.username
      );
      setPermissions(allPermissions);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePermissionLevel = async (appId: string, permissionType: string, eventKind: number | null, level: PermissionLevel) => {
    const currentUser = user();
    if (!currentUser) return;

    try {
      const app = permissions().find(p => p.appId === appId);
      if (!app) return;

      const updates: Partial<AppPermissions> = {};
      
      if (permissionType === 'signEvent' && eventKind !== null) {
        updates.kinds = { ...app.kinds, [eventKind]: level };
      } else if (permissionType === 'signData') {
        updates.signData = level;
      } else if (permissionType === 'getPublicKey') {
        updates.getPublicKey = level;
      } else if (permissionType === 'nip04') {
        updates.nip04 = level;
      } else if (permissionType === 'getRelays') {
        updates.getRelays = level;
      }

      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        appId,
        updates,
        app.appName
      );

      await loadPermissions();
    } catch (error) {
      console.error('Failed to update permission:', error);
    }
  };

  const revokePermission = async (appId: string) => {
    const currentUser = user();
    if (!currentUser) return;

    if (!confirm('Are you sure you want to revoke all permissions for this app?')) {
      return;
    }

    try {
      await permissionService.revokeAppPermissions(
        currentUser.profile.username,
        appId
      );
      await loadPermissions();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPermissionLevelColor = (level: PermissionLevel | undefined) => {
    switch (level) {
      case 'ALLOW':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'ASK_PER_SESSION':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'ASK_EVERYTIME':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'DENY':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  const getPermissionLevelLabel = (level: PermissionLevel | undefined) => {
    switch (level) {
      case 'ALLOW':
        return 'Always Allow';
      case 'ASK_PER_SESSION':
        return 'Ask Per Session';
      case 'ASK_EVERYTIME':
        return 'Ask Every Time';
      case 'DENY':
        return 'Always Deny';
      default:
        return 'Not Set';
    }
  };

  const permissionLevels: PermissionLevel[] = ['ALLOW', 'ASK_PER_SESSION', 'ASK_EVERYTIME', 'DENY'];

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          App Permissions
        </h2>
        
        <Show when={isLoading()}>
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading permissions...</p>
          </div>
        </Show>

        <Show when={!isLoading() && permissions().length === 0}>
          <div class="text-center py-8">
            <div class="text-4xl mb-4">🔒</div>
            <p class="text-gray-600 dark:text-gray-400">
              No apps have been granted permissions yet
            </p>
          </div>
        </Show>

        <Show when={!isLoading() && permissions().length > 0}>
          <div class="space-y-6">
            <For each={permissions()}>
              {(app) => (
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50">
                    <div class="flex justify-between items-start">
                      <div class="flex-1">
                        <h3 class="font-semibold text-lg text-gray-900 dark:text-white">
                          {app.appName || app.appId}
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {app.appId}
                        </p>
                        <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          <span>Granted: {formatDate(app.grantedAt)}</span>
                          <span class="mx-2">•</span>
                          <span>Last used: {formatDate(app.lastUsedAt)}</span>
                        </div>
                      </div>
                      
                      <div class="flex gap-2">
                        <button
                          onClick={() => setEditingApp(editingApp() === app.appId ? null : app.appId)}
                          class="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                        >
                          {editingApp() === app.appId ? 'Done' : 'Edit'}
                        </button>
                        <button
                          onClick={() => revokePermission(app.appId)}
                          class="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
                        >
                          Revoke All
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="p-4 space-y-3">
                    {/* Basic Permissions */}
                    <Show when={app.getPublicKey !== undefined}>
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>👤</span>
                          <span class="text-sm font-medium">Read Public Key</span>
                        </div>
                        <Show 
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.getPublicKey)}`}>
                              {getPermissionLevelLabel(app.getPublicKey)}
                            </span>
                          }
                        >
                          <select
                            value={app.getPublicKey}
                            onChange={(e) => updatePermissionLevel(app.appId, 'getPublicKey', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>
                    </Show>

                    {/* Sign Data Permission */}
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span>📝</span>
                        <span class="text-sm font-medium">Sign Data</span>
                      </div>
                      <Show 
                        when={editingApp() === app.appId}
                        fallback={
                          <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.signData)}`}>
                            {getPermissionLevelLabel(app.signData)}
                          </span>
                        }
                      >
                        <select
                          value={app.signData}
                          onChange={(e) => updatePermissionLevel(app.appId, 'signData', null, e.currentTarget.value as PermissionLevel)}
                          class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        >
                          <For each={permissionLevels}>
                            {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                          </For>
                        </select>
                      </Show>
                    </div>

                    {/* Event Kinds */}
                    <Show when={Object.keys(app.kinds).length > 0}>
                      <div class="border-t pt-3 mt-3">
                        <div class="text-sm font-medium mb-2">Event Signing Permissions:</div>
                        <div class="space-y-2">
                          <For each={Object.entries(app.kinds)}>
                            {([kind, level]) => (
                              <div class="flex items-center justify-between pl-4">
                                <div class="flex items-center gap-2">
                                  <span>✍️</span>
                                  <span class="text-sm">Kind {kind}</span>
                                </div>
                                <Show 
                                  when={editingApp() === app.appId}
                                  fallback={
                                    <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(level)}`}>
                                      {getPermissionLevelLabel(level)}
                                    </span>
                                  }
                                >
                                  <select
                                    value={level}
                                    onChange={(e) => updatePermissionLevel(app.appId, 'signEvent', parseInt(kind), e.currentTarget.value as PermissionLevel)}
                                    class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                  >
                                    <For each={permissionLevels}>
                                      {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                                    </For>
                                  </select>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* Additional Permissions */}
                    <Show when={app.nip04 !== undefined}>
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>🔐</span>
                          <span class="text-sm font-medium">Encrypt/Decrypt (NIP-04)</span>
                        </div>
                        <Show 
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.nip04)}`}>
                              {getPermissionLevelLabel(app.nip04)}
                            </span>
                          }
                        >
                          <select
                            value={app.nip04}
                            onChange={(e) => updatePermissionLevel(app.appId, 'nip04', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>
                    </Show>

                    <Show when={app.getRelays !== undefined}>
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>📡</span>
                          <span class="text-sm font-medium">Access Relay List</span>
                        </div>
                        <Show 
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.getRelays)}`}>
                              {getPermissionLevelLabel(app.getRelays)}
                            </span>
                          }
                        >
                          <select
                            value={app.getRelays}
                            onChange={(e) => updatePermissionLevel(app.appId, 'getRelays', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};