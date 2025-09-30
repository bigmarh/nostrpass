import { Component, createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { useAuth } from '../providers/AuthProvider';
import { useCryptoWorker } from '../providers/CryptoWorkerProvider';

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: 'auth' | 'permission' | 'security' | 'crypto' | 'sync' | 'error';
  action: string;
  details: string;
  appName?: string;
  appId?: string;
  identityIndex?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export const AuditLog: Component = () => {
  const { user } = useAuth();
  const cryptoWorker = useCryptoWorker();
  const [events, setEvents] = createSignal<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [filter, setFilter] = createSignal<'all' | 'auth' | 'permission' | 'security' | 'crypto' | 'sync' | 'error'>('all');
  const [severityFilter, setSeverityFilter] = createSignal<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [sortBy, setSortBy] = createSignal<'timestamp' | 'type' | 'severity'>('timestamp');
  const [sortOrder, setSortOrder] = createSignal<'asc' | 'desc'>('desc');

  onMount(async () => {
    await loadAuditEvents();
  });

  const loadAuditEvents = async () => {
    const currentUser = user();
    if (!currentUser || !cryptoWorker) return;

    setIsLoading(true);
    try {
      // Load audit events from vault data
      const vaultData = await cryptoWorker.getVaultData({ 
        username: currentUser.profile.username 
      });
      
      const auditEvents = (vaultData as any)?.auditLog || [];
      setEvents(auditEvents.sort((a: AuditEvent, b: AuditEvent) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load audit events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addAuditEventInternal = async (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const currentUser = user();
    if (!currentUser || !cryptoWorker) return;

    const auditEvent: AuditEvent = {
      ...event,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };

    try {
      const vaultData = await cryptoWorker.getVaultData({ 
        username: currentUser.profile.username 
      });
      
      const updatedVaultData = {
        ...vaultData,
        auditLog: [...((vaultData as any)?.auditLog || []), auditEvent].slice(-1000) // Keep last 1000 events
      };
      
      await cryptoWorker.updateVaultData({ 
        username: currentUser.profile.username, 
        vaultData: updatedVaultData 
      });
      
      setEvents(prev => [auditEvent, ...prev].slice(0, 1000));
    } catch (error) {
      console.error('Failed to add audit event:', error);
    }
  };

  const filteredAndSortedEvents = createMemo(() => {
    let filtered = events().filter(event => {
      const matchesType = filter() === 'all' || event.type === filter();
      const matchesSeverity = severityFilter() === 'all' || event.severity === severityFilter();
      const matchesSearch = searchTerm() === '' || 
        event.action.toLowerCase().includes(searchTerm().toLowerCase()) ||
        event.details.toLowerCase().includes(searchTerm().toLowerCase()) ||
        (event.appName && event.appName.toLowerCase().includes(searchTerm().toLowerCase()));
      
      return matchesType && matchesSeverity && matchesSearch;
    });

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy()) {
        case 'timestamp':
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'severity':
          const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          aValue = severityOrder[a.severity];
          bValue = severityOrder[b.severity];
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

  const getEventIcon = (type: AuditEvent['type']) => {
    switch (type) {
      case 'auth': return '🔐';
      case 'permission': return '🔑';
      case 'security': return '🛡️';
      case 'crypto': return '🔒';
      case 'sync': return '🔄';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getSeverityColor = (severity: AuditEvent['severity']) => {
    switch (severity) {
      case 'low': return 'text-gray-600 dark:text-gray-400';
      case 'medium': return 'text-blue-600 dark:text-blue-400';
      case 'high': return 'text-yellow-600 dark:text-yellow-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getSeverityBg = (severity: AuditEvent['severity']) => {
    switch (severity) {
      case 'low': return 'bg-gray-100 dark:bg-gray-800';
      case 'medium': return 'bg-blue-100 dark:bg-blue-900/20';
      case 'high': return 'bg-yellow-100 dark:bg-yellow-900/20';
      case 'critical': return 'bg-red-100 dark:bg-red-900/20';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearAuditLog = async () => {
    if (!confirm('Are you sure you want to clear the audit log? This action cannot be undone.')) {
      return;
    }

    const currentUser = user();
    if (!currentUser || !cryptoWorker) return;

    try {
      const vaultData = await cryptoWorker.getVaultData({ 
        username: currentUser.profile.username 
      });
      
      const updatedVaultData = {
        ...vaultData,
        auditLog: []
      };
      
      await cryptoWorker.updateVaultData({ 
        username: currentUser.profile.username, 
        vaultData: updatedVaultData 
      });
      
      setEvents([]);
    } catch (error) {
      console.error('Failed to clear audit log:', error);
    }
  };

  const exportAuditLog = () => {
    const dataStr = JSON.stringify(events(), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nostrpass-audit-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Audit Log
          </h2>
          <div class="flex gap-2">
            <button
              onClick={loadAuditEvents}
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={exportAuditLog}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export
            </button>
            <button
              onClick={clearAuditLog}
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filters */}
        <div class="mb-6 space-y-4">
          <div class="flex gap-4 items-center flex-wrap">
            <div class="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filter()}
              onChange={(e) => setFilter(e.currentTarget.value as any)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="auth">Authentication</option>
              <option value="permission">Permissions</option>
              <option value="security">Security</option>
              <option value="crypto">Crypto</option>
              <option value="sync">Sync</option>
              <option value="error">Errors</option>
            </select>
            <select
              value={severityFilter()}
              onChange={(e) => setSeverityFilter(e.currentTarget.value as any)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="timestamp">Sort by Time</option>
              <option value="type">Sort by Type</option>
              <option value="severity">Sort by Severity</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {sortOrder() === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Events List */}
        <Show when={isLoading()}>
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading audit events...</p>
          </div>
        </Show>

        <Show when={!isLoading() && filteredAndSortedEvents().length === 0}>
          <div class="text-center py-12">
            <div class="text-4xl mb-4">📝</div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Events Found
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
              No audit events match your current filters.
            </p>
          </div>
        </Show>

        <Show when={!isLoading() && filteredAndSortedEvents().length > 0}>
          <div class="space-y-3">
            <For each={filteredAndSortedEvents()}>
              {(event) => (
                <div class={`p-4 rounded-lg border ${getSeverityBg(event.severity)} border-gray-200 dark:border-gray-700`}>
                  <div class="flex items-start gap-3">
                    <div class="text-2xl">{getEventIcon(event.type)}</div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <h4 class="font-medium text-gray-900 dark:text-white">
                          {event.action}
                        </h4>
                        <span class={`text-xs px-2 py-1 rounded ${getSeverityColor(event.severity)}`}>
                          {event.severity.toUpperCase()}
                        </span>
                        <Show when={event.appName}>
                          <span class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                            {event.appName}
                          </span>
                        </Show>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {event.details}
                      </p>
                      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                        <span>{formatTimestamp(event.timestamp)}</span>
                        <span>•</span>
                        <span>{event.type}</span>
                        <Show when={event.identityIndex !== undefined}>
                          <span>•</span>
                          <span>Identity {event.identityIndex}</span>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Summary */}
        <Show when={!isLoading() && events().length > 0}>
          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div class="text-center">
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  {events().length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Total Events</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">
                  {events().filter(e => e.severity === 'critical').length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Critical</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {events().filter(e => e.severity === 'high').length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">High</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {events().filter(e => e.type === 'permission').length}
                </div>
                <div class="text-gray-600 dark:text-gray-400">Permissions</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

// Export the addAuditEvent function for use in other components
export const addAuditEvent = async (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
  const currentUser = user();
  if (!currentUser || !cryptoWorker) return;

  const auditEvent: AuditEvent = {
    ...event,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now()
  };

  try {
    const vaultData = await cryptoWorker.getVaultData({ 
      username: currentUser.profile.username 
    });
    
    const updatedVaultData = {
      ...vaultData,
      auditLog: [...((vaultData as any)?.auditLog || []), auditEvent].slice(-1000) // Keep last 1000 events
    };
    
    await cryptoWorker.updateVaultData({ 
      username: currentUser.profile.username, 
      vaultData: updatedVaultData 
    });
  } catch (error) {
    console.error('Failed to add audit event:', error);
  }
};
