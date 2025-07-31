import { Component, Show, createSignal, For, createMemo, onMount, createEffect } from 'solid-js';
import { useAuth, useMessenger } from '../providers';
import { useParams, useNavigate } from '@solidjs/router';
import { nip19 } from 'nostr-tools';

export const Dashboard: Component = () => {
    const { user, logout } = useAuth();
    const { send } = useMessenger();
    const params = useParams();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);
    const [isVaultLocked, setIsVaultLocked] = createSignal(false);

    // For now, we'll create a single identity from the user's data
    // In the future, this can be expanded to support multiple identities
    const identities = createMemo(() => {
        const currentUser = user();
        if (!currentUser) return [];
        
        // Get npub from public key
        let npub = '';
        try {
            npub = nip19.npubEncode(currentUser.publicKey);
        } catch (e) {
            npub = currentUser.publicKey;
        }
        
        return [{
            nickname: 'Personal',
            publicKey: currentUser.publicKey,
            npub: npub,
            createdAt: new Date(currentUser.profile.createdAt).toISOString(),
            isActive: true
        }];
    });

    const filteredIdentities = createMemo(() => {
        const query = searchQuery().toLowerCase();
        let results = identities();

        if (query) {
            results = results.filter(identity => {
                if (identity.nickname?.toLowerCase().includes(query)) return true;
                if (identity.publicKey?.toLowerCase().includes(query)) return true;
                if (identity.npub?.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        return results;
    });

    const handleLogout = () => {
        logout();
        navigate(`/${params.app}`);
    };

    const handleHideVault = () => {
        send('HIDE_VAULT');
    };

    const toggleVaultLock = () => {
        setIsVaultLocked(!isVaultLocked());
        // In the future, implement actual vault locking logic
    };

    const backToApp = () => {
        send('HIDE_VAULT');
    };

    const desanitizeDomain = (domain: string) => {
        return domain.replace(/_/g, '.');
    };

    return (
        <div class="min-h-screen bg-gray-100 p-4">
            <div class="max-w-2xl mx-auto">
                <div class="bg-white text-black border border-gray-700 rounded-lg p-4">
                    <header class="mb-4">
                        {/* Top row - Action buttons */}
                        <div class="flex justify-between bg-gray-200 rounded-lg p-1 items-center gap-2 mb-3">
                            <div class="flex items-center gap-2">
                                <button 
                                    onClick={toggleVaultLock} 
                                    class={`text-black hover:text-gray-600 border ${isVaultLocked() ? 'bg-gray-100 border-gray-600' : 'bg-gray-800 text-white border-gray-800'} rounded-lg px-2 py-1 flex items-center gap-2 transition-all`}
                                >
                                    {isVaultLocked() ? 'Unlock' : 'Lock'}
                                    <span class="w-4 h-4">
                                        {isVaultLocked() ? (
                                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a5 5 0 0 1 5 5v2.005c.77.015 1.246.07 1.635.268a2.5 2.5 0 0 1 1.092 1.092C20 11.9 20 12.6 20 14v3c0 1.4 0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C18.1 21 17.4 21 16 21H8c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C4 19.1 4 18.4 4 17v-3c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.092c.389-.199.865-.253 1.635-.268V8a5 5 0 0 1 5-5m3 5v2H9V8a3 3 0 1 1 6 0" fill="currentColor" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fill-rule="evenodd" clip-rule="evenodd" d="M7 10.005V7a5 5 0 0 1 10 0 1 1 0 1 1-2 0 3 3 0 1 0-6 0v3h7c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.092 1.092C20 11.9 20 12.6 20 14v3c0 1.4 0 2.1-.273 2.635a2.5 2.5 0 0 1-1.092 1.092C18.1 21 17.4 21 16 21H8c-1.4 0-2.1 0-2.635-.273a2.5 2.5 0 0 1-1.093-1.092C4 19.1 4 18.4 4 17v-3c0-1.4 0-2.1.272-2.635a2.5 2.5 0 0 1 1.093-1.092c.389-.199.865-.253 1.635-.268" fill="currentColor" />
                                            </svg>
                                        )}
                                    </span> 
                                </button>
                                {/* Back to App button */}
                                {params.app && (
                                    <button
                                        onClick={backToApp}
                                        class="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white rounded-lg p-2 flex items-center gap-2 transition-all"
                                        title={`Back to ${desanitizeDomain(params.app)}`}
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        <span class="text-sm">Back to App</span>
                                    </button>
                                )}
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    onClick={handleLogout}
                                    class="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white rounded-lg p-2 flex items-center gap-2 transition-all"
                                    title="Logout"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span class="text-sm">Logout</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="flex justify-between items-center gap-2 mb-3">
                            <div>
                                <div class="font-semibold text-lg">{user()?.profile.username.toUpperCase()}</div>
                                <span class="text-xs text-gray-500">Digital Passport</span>
                            </div>
                        </div>

                        {/* Bottom row - Search */}
                        <div class="flex justify-between items-center gap-2">
                            <div class="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search by name or public key..."
                                    class="w-full text-sm p-2 pr-8 rounded-lg border border-gray-300 focus:outline-none focus:border-gray-700 transition-colors"
                                    value={searchQuery()}
                                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                />
                                {searchQuery() && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAddIdentityModal(true)}
                                class="bg-gray-800 text-white rounded-lg p-2 hover:bg-gray-700 transition-colors border border-gray-800"
                                title="Add new identity (coming soon)"
                                disabled
                            >
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </header>

                    <main>
                        {/* Identity list */}
                        <div class="flex flex-col gap-2">
                            <h4 class="text-gray-500 text-sm font-bold">Identities</h4>
                            <For each={filteredIdentities()}>
                                {(identity) => (
                                    <div
                                        class={`flex cursor-pointer border rounded-lg p-4 justify-between items-center hover:shadow-md transition-all ${
                                            identity.isActive ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <div class="flex flex-col justify-start gap-2">
                                            <span class="font-medium text-gray-900">{identity.nickname}</span>
                                            <span class="text-gray-500 text-xs font-mono">
                                                ({identity.npub.substring(0, 8)}...)
                                            </span>
                                        </div>

                                        <div class="flex flex-col justify-end items-end gap-3">
                                            <div class="flex items-center gap-2">
                                                {/* Slide switch */}
                                                <button
                                                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                        identity.isActive ? 'bg-gray-700' : 'bg-gray-300'
                                                    } hover:opacity-80`}
                                                    title={identity.isActive ? 'Active identity' : 'Click to activate'}
                                                    disabled
                                                >
                                                    <span class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        identity.isActive ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                </button>

                                                {/* Settings button */}
                                                <button
                                                    onClick={() => navigate(`/${params.app}/settings`)}
                                                    class="p-1 hover:bg-gray-100 rounded transition-colors border border-gray-200 hover:border-gray-300"
                                                    title="Settings"
                                                >
                                                    <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div class="flex gap-2 items-center">
                                                {params.app && (
                                                    <span class="text-gray-800 text-xs font-medium">
                                                        Connected to {desanitizeDomain(params.app)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>

                            {/* Empty state */}
                            {filteredIdentities().length === 0 && (
                                <div class="text-center py-8 text-gray-500">
                                    {searchQuery()
                                        ? `No identities found matching "${searchQuery()}"`
                                        : 'No identities yet'
                                    }
                                </div>
                            )}
                        </div>

                        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                            <p class="text-sm text-blue-800">
                                🔒 Your vault is secured with your password. Your private keys are encrypted and stored locally.
                            </p>
                        </div>
                    </main>

                    {/* Results count */}
                    {searchQuery() && (
                        <footer class="mt-4 text-sm text-gray-600">
                            Found {filteredIdentities().length} of {identities().length} identities
                        </footer>
                    )}
                </div>
            </div>
        </div>
    );
};