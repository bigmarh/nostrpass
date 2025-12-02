import { Component, createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useAuth } from '../providers/AuthProvider';
import { PermissionService } from '../services/permissionService';
import { vaultDataService } from '../services/vaultDataService';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';
import { getActiveIdentity } from '../utils/activeIdentityManager';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';

export const PermissionsDashboard: Component = () => {
  const { user } = useAuth();
  const params = useParams();
  const [permissions, setPermissions] = createSignal<AppPermissions[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [editingApp, setEditingApp] = createSignal<string | null>(null);
  const [selectedApps, setSelectedApps] = createSignal<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = createSignal<PermissionLevel | 'revoke' | null>(null);
  const [showBulkActions, setShowBulkActions] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal('');
  const [sortBy, setSortBy] = createSignal<'name' | 'granted' | 'lastUsed'>('lastUsed');
  const [sortOrder, setSortOrder] = createSignal<'asc' | 'desc'>('desc');
  const permissionService = PermissionService.getInstance();

  // Helper to get app origin from appId (sanitized domain)
  const getAppOrigin = (appId: string): string => {
    try {
      // Try to reconstruct origin from sanitized domain
      const domain = desanitizeDomain(appId);
      // Default to https, but check if it's localhost
      if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
        return `http://${domain}`;
      }
      return `https://${domain}`;
    } catch {
      // Fallback: use appId as-is (it might already be an origin)
      return appId.startsWith('http') ? appId : `https://${appId}`;
    }
  };

  onMount(async () => {
    await loadPermissions();
  });

  // Computed properties for filtering and sorting
  const filteredAndSortedPermissions = createMemo(() => {
    let filtered = permissions().filter(app => 
      app.appName?.toLowerCase().includes(searchTerm().toLowerCase()) ||
      app.appId.toLowerCase().includes(searchTerm().toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy()) {
        case 'name':
          aValue = a.appName || a.appId;
          bValue = b.appName || b.appId;
          break;
        case 'granted':
          aValue = a.grantedAt;
          bValue = b.grantedAt;
          break;
        case 'lastUsed':
          aValue = a.lastUsedAt;
          bValue = b.lastUsedAt;
          break;
        default:
          return 0;
      }

      if (sortOrder() === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  });

  const hasSelectedApps = createMemo(() => selectedApps().size > 0);
  const allAppsSelected = createMemo(() => 
    filteredAndSortedPermissions().length > 0 && 
    filteredAndSortedPermissions().every(app => selectedApps().has(app.appId))
  );

  const loadPermissions = async () => {
    const currentUser = user();
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const appId = params.app;
      if (!appId) {
        setPermissions([]);
        return;
      }
      // Load only this app's permissions for the active identity
      // Get active identity from localStorage (per-browser, not synced)
      const appOrigin = getAppOrigin(appId);
      const identityIndex = getActiveIdentity(currentUser.profile.username, appOrigin) ?? (await vaultDataService.getVaultData(currentUser.profile.username, { forceRefresh: true }))?.activeIdentityByApp?.[appId] ?? undefined;
      const appPerm = await permissionService.getAppPermissions(
        currentUser.profile.username,
        appId,
        identityIndex
      );
      setPermissions(appPerm ? [appPerm] : []);
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

      const updates: any = {};
      
      if (permissionType === 'signEvent' && eventKind !== null) {
        // Map event kinds to permission categories
        const { getPermissionCategoryForKind } = await import('@nostrpass/types');
        const category = getPermissionCategoryForKind(eventKind);
        if (category) {
          updates.permissions = {
            ...app.permissions,
            [category]: level
          };
        }
      } else if (permissionType === 'signData') {
        updates.permissions = {
          ...app.permissions,
          signData: level
        };
      } else if (permissionType === 'getPublicKey') {
        updates.getPublicKey = level;
      } else if (permissionType === 'social') {
        updates.permissions = {
          ...app.permissions,
          social: level
        };
      } else if (permissionType === 'messaging') {
        updates.permissions = {
          ...app.permissions,
          messaging: level
        };
      } else if (permissionType === 'zaps') {
        updates.permissions = {
          ...app.permissions,
          zaps: level
        };
      } else if (permissionType === 'financial') {
        updates.permissions = {
          ...app.permissions,
          financial: level
        };
      }

      // Get active identity from localStorage (per-browser, not synced)
      const appOrigin = getAppOrigin(appId);
      const identityIndex = getActiveIdentity(currentUser.profile.username, appOrigin) ?? (await vaultDataService.getVaultData(currentUser.profile.username, { forceRefresh: true }))?.activeIdentityByApp?.[appId] ?? undefined;
      await permissionService.saveAppPermissions(
        currentUser.profile.username,
        appId,
        updates,
        app.appName,
        identityIndex
      );

      await loadPermissions();

      // Best-effort sync to Nostr in background
      vaultDataService
        .syncToNostr(currentUser.profile.username)
        .catch((err) => console.error('Failed to sync permissions to Nostr:', err));
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

  const toggleAppSelection = (appId: string) => {
    const newSelected = new Set(selectedApps());
    if (newSelected.has(appId)) {
      newSelected.delete(appId);
    } else {
      newSelected.add(appId);
    }
    setSelectedApps(newSelected);
  };

  const toggleAllAppsSelection = () => {
    if (allAppsSelected()) {
      setSelectedApps(new Set());
    } else {
      setSelectedApps(new Set(filteredAndSortedPermissions().map(app => app.appId)));
    }
  };

  const executeBulkAction = async () => {
    const currentUser = user();
    if (!currentUser || !bulkAction()) return;

    const action = bulkAction()!;
    const appsToUpdate = Array.from(selectedApps());

    if (action === 'revoke') {
      if (!confirm(`Are you sure you want to revoke permissions for ${appsToUpdate.length} app(s)?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to set all permissions to "${getPermissionLevelLabel(action)}" for ${appsToUpdate.length} app(s)?`)) {
        return;
      }
    }

    try {
      for (const appId of appsToUpdate) {
        if (action === 'revoke') {
          await permissionService.revokeAppPermissions(
            currentUser.profile.username,
            appId
          );
        } else {
          const app = permissions().find(p => p.appId === appId);
          if (app) {
            const updates = {
              getPublicKey: action,
              permissions: {
                social: action,
                messaging: action,
                signData: action,
                zaps: action,
                financial: action
              }
            };
            // Get active identity from localStorage (per-browser, not synced)
            const appOrigin = getAppOrigin(appId);
            const identityIndex = getActiveIdentity(currentUser.profile.username, appOrigin) ?? (await vaultDataService.getVaultData(currentUser.profile.username, { forceRefresh: true }))?.activeIdentityByApp?.[appId] ?? undefined;
            await permissionService.saveAppPermissions(
              currentUser.profile.username,
              appId,
              updates,
              app.appName,
              identityIndex
            );
          }
        }
      }
      
      await loadPermissions();
      setSelectedApps(new Set());
      setBulkAction(null);
      setShowBulkActions(false);
    } catch (error) {
      console.error('Failed to execute bulk action:', error);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('lastUsed');
    setSortOrder('desc');
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
      case 'ASK_EVERYTIME':
        return 'Ask Every Time';
      case 'DENY':
        return 'Always Deny';
      default:
        return 'Not Set';
    }
  };

  const permissionLevels: PermissionLevel[] = ['ALLOW', 'ASK_EVERYTIME', 'DENY'];

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            App Permissions
          </h2>
          <div class="flex gap-2">
            <button
              onClick={() => setShowBulkActions(!showBulkActions())}
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Bulk Actions
            </button>
            <button
              onClick={loadPermissions}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div class="mb-6 space-y-4">
          <div class="flex gap-4 items-center">
            <div class="flex-1">
              <input
                type="text"
                placeholder="Search apps..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="name">Sort by Name</option>
              <option value="granted">Sort by Granted Date</option>
              <option value="lastUsed">Sort by Last Used</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {sortOrder() === 'asc' ? '↑' : '↓'}
            </button>
            <button
              onClick={clearFilters}
              class="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>

          {/* Bulk Actions Panel */}
          <Show when={showBulkActions()}>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-medium text-gray-900 dark:text-white">
                  Bulk Actions ({selectedApps().size} selected)
                </h3>
                <button
                  onClick={() => setShowBulkActions(false)}
                  class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <div class="flex gap-2 items-center">
                <button
                  onClick={toggleAllAppsSelection}
                  class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  {allAppsSelected() ? 'Deselect All' : 'Select All'}
                </button>
                <select
                  value={bulkAction() || ''}
                  onChange={(e) => setBulkAction(e.currentTarget.value as any || null)}
                  class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Choose action...</option>
                  <option value="ALLOW">Always Allow</option>
                  <option value="ASK_EVERYTIME">Ask Every Time</option>
                  <option value="DENY">Always Deny</option>
                  <option value="revoke">Revoke All</option>
                </select>
                <button
                  onClick={executeBulkAction}
                  disabled={!bulkAction() || selectedApps().size === 0}
                  class="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </Show>
        </div>
        
        <Show when={isLoading()}>
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading permissions...</p>
          </div>
        </Show>

        <Show when={!isLoading() && permissions().length === 0}>
          <div class="text-center py-12">
            <div class="text-6xl mb-4">🔒</div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No App Permissions
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              This app is not authorized for the current identity.
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Authorize the app to set default permissions and make this identity active.
            </p>
          </div>
        </Show>

        <Show when={!isLoading() && permissions().length > 0 && filteredAndSortedPermissions().length === 0}>
          <div class="text-center py-12">
            <div class="text-4xl mb-4">🔍</div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Apps Found
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              No apps match your current search criteria.
            </p>
            <button
              onClick={clearFilters}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </Show>

        <Show when={!isLoading() && filteredAndSortedPermissions().length > 0}>
          <div class="space-y-4">
            <For each={filteredAndSortedPermissions()}>
              {(app) => (
                <div class={`border rounded-lg overflow-hidden transition-all ${selectedApps().has(app.appId) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50">
                    <div class="flex items-start gap-3">
                      <Show when={showBulkActions()}>
                        <input
                          type="checkbox"
                          checked={selectedApps().has(app.appId)}
                          onChange={() => toggleAppSelection(app.appId)}
                          class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </Show>
                      
                      <div class="flex-1">
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

                    {/* Permission Categories */}
                    <div class="space-y-3">
                      {/* Social Permission */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>👥</span>
                          <span class="text-sm font-medium">Social</span>
                        </div>
                        <Show 
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.permissions?.social)}`}>
                              {getPermissionLevelLabel(app.permissions?.social)}
                            </span>
                          }
                        >
                          <select
                            value={app.permissions?.social || 'ASK_EVERYTIME'}
                            onChange={(e) => updatePermissionLevel(app.appId, 'social', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>

                      {/* Messaging Permission */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>💬</span>
                          <span class="text-sm font-medium">Messaging</span>
                        </div>
                        <Show 
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.permissions?.messaging)}`}>
                              {getPermissionLevelLabel(app.permissions?.messaging)}
                            </span>
                          }
                        >
                          <select
                            value={app.permissions?.messaging || 'ASK_EVERYTIME'}
                            onChange={(e) => updatePermissionLevel(app.appId, 'messaging', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>

                      {/* Sign Data Permission */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>✍️</span>
                          <span class="text-sm font-medium">Sign Data</span>
                        </div>
                        <Show
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.permissions?.signData)}`}>
                              {getPermissionLevelLabel(app.permissions?.signData)}
                            </span>
                          }
                        >
                          <select
                            value={app.permissions?.signData || 'ASK_EVERYTIME'}
                            onChange={(e) => updatePermissionLevel(app.appId, 'signData', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>

                      {/* Zaps Permission */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>⚡</span>
                          <span class="text-sm font-medium">Zaps</span>
                        </div>
                        <Show
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.permissions?.zaps)}`}>
                              {getPermissionLevelLabel(app.permissions?.zaps)}
                            </span>
                          }
                        >
                          <select
                            value={app.permissions?.zaps || 'ASK_EVERYTIME'}
                            onChange={(e) => updatePermissionLevel(app.appId, 'zaps', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>

                      {/* Financial Permission */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span>💰</span>
                          <span class="text-sm font-medium">Financial</span>
                        </div>
                        <Show
                          when={editingApp() === app.appId}
                          fallback={
                            <span class={`px-2 py-1 text-xs rounded ${getPermissionLevelColor(app.permissions?.financial)}`}>
                              {getPermissionLevelLabel(app.permissions?.financial)}
                            </span>
                          }
                        >
                          <select
                            value={app.permissions?.financial || 'ASK_EVERYTIME'}
                            onChange={(e) => updatePermissionLevel(app.appId, 'financial', null, e.currentTarget.value as PermissionLevel)}
                            class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <For each={permissionLevels}>
                              {(level) => <option value={level}>{getPermissionLevelLabel(level)}</option>}
                            </For>
                          </select>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Summary Section */}
        <Show when={!isLoading() && filteredAndSortedPermissions().length > 0}>
          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div class="text-center">
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  {filteredAndSortedPermissions().length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Total Apps</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {filteredAndSortedPermissions().filter(app => 
                    app.getPublicKey === 'ALLOW' && 
                    Object.values(app.permissions || {}).every(p => p === 'ALLOW')
                  ).length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Fully Trusted</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {filteredAndSortedPermissions().filter(app => 
                    app.getPublicKey === 'ASK_EVERYTIME' || 
                    Object.values(app.permissions || {}).some(p => p === 'ASK_EVERYTIME')
                  ).length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Ask Every Time</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};