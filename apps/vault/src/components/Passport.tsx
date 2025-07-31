import { createSignal, For, createMemo, onMount, createEffect, Show } from 'solid-js';
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../contexts/AuthContext";
import logger from "../utils/logger";
import keyService from '../services/keyService';
import { nip19 } from 'nostr-tools';
import DataDebugger from './DataDebugger';
import { getLastUsedIdentity, storeAppRequest } from '../utils/appRequestStorage';
import AddIdentityModal from './AddIdentityModal';

const PassportList = () => {
    const { 
        user,
        userData, 
        isVaultLocked,
        currentApp, 
        appSpecificIdentity, 
        updateAppSpecificIdentity,
        handleLogout,
        backToApp
    } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showAddIdentityModal, setShowAddIdentityModal] = createSignal(false);

    const [dismissedConnections, setDismissedConnections] = createSignal<Record<string, string[]>>({});

    // Load dismissed connections from localStorage
    onMount(() => {
        if(!user()){
            navigate('/');
        }
        if(!userData.hasKeys){
            navigate('/key-setup');
        }
        console.log("onMount PassportList")
        const stored = localStorage.getItem('dismissedConnections');
        if (stored) {
            try {
                setDismissedConnections(JSON.parse(stored));
            } catch (e) {
                logger.error('Failed to parse dismissed connections', e);
            }
        }
    });

    createEffect(() => {
        console.log("user", user());
        console.log("userData.credentials", userData.credentials);
    });

    // Get the current active identity - now purely app-specific 
    const currentActiveIdentity = createMemo(() => {
        const appSpecific = appSpecificIdentity();
        
        // If there's only one identity and no specific active identity, auto-select it
        if (!appSpecific && userData.identities?.length === 1) {
            const singleIdentity = userData.identities[0];
            // Automatically set this as the active identity
            updateAppSpecificIdentity(singleIdentity.publicKey);
            return singleIdentity.publicKey;
        }
        
        // Only use app-specific identity - no global fallback
        return appSpecific || null;
    });

    const isActiveIdentity = (publicKey: string) => {
        return currentActiveIdentity() === publicKey;
    };

    // Check if connection notification is dismissed for current app and identity
    const isConnectionDismissed = () => {
        const dismissed = dismissedConnections();
        const currentActive = currentActiveIdentity();
        if (!currentActive) return false;
        
        const identityDismissals = dismissed[currentActive];
        const appDomain = currentApp;
        return identityDismissals?.includes(appDomain) || false;
    };

    // Dismiss connection notification
    const dismissConnection = () => {
        const current = dismissedConnections();
        const currentActive = currentActiveIdentity();
        if (!currentActive) return;
        
        const appDomain = currentApp;
        const updated = {
            ...current,
            [currentActive]: [...(current[currentActive] || []), appDomain]
        };
        setDismissedConnections(updated);
        localStorage.setItem('dismissedConnections', JSON.stringify(updated));
    };

    const toggleVaultLock = () => {
        logger.debug('toggleVaultLock');
        if (isVaultLocked()) {
            navigate('/unlock');
        } else {
            keyService.lock();
        }
    }

    // Filter and sort identities based on search query
    const filteredIdentities = createMemo(() => {
        const query = searchQuery().toLowerCase();
        let identities = userData.identities || [];

        // Filter if there's a search query
        if (query) {
            identities = identities.filter(identity => {
                // Search by nickname
                if (identity.nickname?.toLowerCase().includes(query)) return true;

                // Search by public key (hex format)
                if (identity.publicKey?.toLowerCase().includes(query)) return true;

                // Search by npub format
                try {
                    const npub = identity.publicKey.startsWith('npub')
                        ? identity.publicKey
                        : nip19.npubEncode(identity.publicKey);
                    if (npub.toLowerCase().includes(query)) return true;
                } catch (e) {
                    // Ignore encoding errors
                }

                return false;
            });
        }

        // Sort by created at
        return [...identities].sort((a, b) => {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    });

    const isConnectedToApp = (publicKey: string, domain: string) => {
        console.log(domain)
        return userData.appConnections?.[publicKey]?.[domain]
    }

    // Helper function to determine if we should show connection prompts
    // Don't show connection prompts if:
    // 1. No currentApp (vault accessed directly)
    // 2. currentApp is the vault itself (localhost:5102, localhost:5103, etc.)
    const shouldShowConnectionPrompts = () => {
        if (!currentApp) return false;
        
        // Check if currentApp is the vault itself (any localhost port)
        if (currentApp.includes('localhost:') && currentApp.includes('510')) {
            return false;
        }
        
        // For production, also exclude the vault's production domain
        if (currentApp === 'nostrpass.com' || currentApp === 'vault.nostrpass.com') {
            return false;
        }
        
        return true;
    }

    const selectIdentity = (publicKey: string) => {
        // Use the AuthContext method to update app-specific identity
        updateAppSpecificIdentity(publicKey);
        
        // Clear dismissed connections for the new active identity when switching
        // This gives the user another chance to connect if they previously dismissed
        const current = dismissedConnections();
        const updated = { ...current };
        delete updated[publicKey];
        setDismissedConnections(updated);
        localStorage.setItem('dismissedConnections', JSON.stringify(updated));
    }

    return (
        <div class="bg-white text-black border border-gray-700 rounded-lg p-4">
            <header class="mb-4">
                {/* Top row - Action buttons */}
                <div class="flex justify-between bg-gray-200 rounded-lg p-1 items-center gap-2 mb-3">
                    <div class="flex items-center  gap-2">
                        <button onClick={toggleVaultLock} class={`text-black hover:text-gray-600 border ${isVaultLocked() ? 'bg-gray-100 border-gray-600' : 'bg-gray-800 text-white border-gray-800'} rounded-lg px-2 py-1 flex items-center gap-2 transition-all`}>{isVaultLocked() ? 'Unlock' : 'Lock'}
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
                        {/* Back to App button - only show if currentApp exists */}
                        {currentApp && (
                            <button
                                onClick={backToApp}
                                class="text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white rounded-lg p-2 flex items-center gap-2 transition-all"
                                title={`Back to ${currentApp}`}
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
                <div class="flex justify-between items-center gap-2 mb-3">{userData.username.toUpperCase()}<br/> <span class="text-xs text-gray-500">Digital Passport</span></div>

                {/* Bottom row - Search and Add */}
                <div class="flex justify-between items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search by name or public key..."
                        class="w-full text-sm p-2 pr-8 rounded-lg border border-gray-300 focus:outline-none focus:border-gray-700 transition-colors"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    />
                    <button
                        onClick={() => setShowAddIdentityModal(true)}
                        class="bg-gray-800 text-white rounded-lg p-2 hover:bg-gray-700 transition-colors border border-gray-800"
                        title="Add new identity"
                    >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Show notification if active identity isn't connected to current app */}
            {shouldShowConnectionPrompts() && currentActiveIdentity() && !isConnectedToApp(currentActiveIdentity()!, currentApp) && !isConnectionDismissed() && (
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div class="flex flex-col  justify-between">
                        <div class="flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span class="text-sm text-amber-800">
                                Your active identity is not connected to {currentApp}
                            </span>
                        </div>
                        <div class="flex items-end justify-end gap-2">
                            <button
                                onClick={dismissConnection}
                                class="text-sm text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 px-3 py-1 rounded-lg transition-colors"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={() => {
                                    // Ensure we have app request data for connection
                                    if (currentApp) {
                                        const appRequestData = {
                                            appDomain: currentApp,
                                            appName: currentApp,
                                            permissions: ['getPublicKey', 'signEvent']
                                        };
                                        storeAppRequest(appRequestData);
                                    }
                                    navigate('/simple-app-permissions');
                                }}
                                class="text-sm bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition-colors"
                            >
                                Connect Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main>
                {/* Search bar with clear button */}
                <div class="relative mb-2">

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
                
                {/* Clear search link */}
                {searchQuery() && (
                    <div class="mb-4">
                        <button
                            onClick={() => setSearchQuery('')}
                            class="text-sm text-gray-600 hover:text-gray-800 underline transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Identity list */}
                <div class="flex flex-col gap-2">
                    <h4 class="text-gray-500 text-sm font-bold">Identities</h4>
                    <For each={filteredIdentities()}>
                        {(identity) => {
                            const isActive = () => isActiveIdentity(identity.publicKey);
                            return (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectIdentity(identity.publicKey);
                                    }}
                                    class={`flex cursor-pointer border rounded-lg p-4 justify-between items-center hover:shadow-md transition-all ${isActive() ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'
                                        }`}
                                >
                                    <div class="flex flex-col justify-start  gap-2">
                                        <span class="font-medium text-gray-900">{identity.nickname}</span>
                                        <span class="text-gray-500 text-xs font-mono">
                                            {(() => {
                                                try {
                                                    const npub = identity.publicKey.startsWith('npub')
                                                        ? identity.publicKey
                                                        : nip19.npubEncode(identity.publicKey);
                                                    return `(${npub.substring(0, 8)}...)`;
                                                } catch (e) {
                                                    return `(${identity.publicKey.substring(0, 4)}...)`;
                                                }
                                            })()}
                                        </span>
                                    </div>

                                    <div class="flex flex-col justify-end items-end gap-3">
                                        <div class="flex items-center gap-2">
                                            {/* Slide switch */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectIdentity(identity.publicKey);
                                                }}
                                                class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive() ? 'bg-gray-700' : 'bg-gray-300'
                                                    } hover:opacity-80`}
                                                title={isActive() ? 'Active identity' : 'Click to activate'}
                                            >
                                                <span class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive() ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>

                                            {/* Settings button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/settings/${encodeURIComponent(identity.publicKey)}`);
                                                }}
                                                class="p-1 hover:bg-gray-100 rounded transition-colors border border-gray-200 hover:border-gray-300"
                                                title="Settings"
                                            >
                                                <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="flex gap-2 items-center">
                                            {/* is connected to app */}
                                            {shouldShowConnectionPrompts() && (
                                                <>
                                                    {isConnectedToApp(identity.publicKey, currentApp) ? (
                                                        <span class="text-gray-800 text-xs font-medium">Connected</span>
                                                    ) : (
                                                        <div class="flex items-center gap-2">
                                                            {isActive() && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        logger.debug('Connect button clicked', { currentApp, identity: identity.publicKey });
                                                                        // Ensure we have app request data for connection
                                                                        if (currentApp) {
                                                                            const appRequestData = {
                                                                                appDomain: currentApp,
                                                                                appName: currentApp,
                                                                                permissions: ['getPublicKey', 'signEvent']
                                                                            };
                                                                            storeAppRequest(appRequestData);
                                                                            logger.debug('Stored app request, navigating to permissions');
                                                                        }
                                                                        navigate('/simple-app-permissions');
                                                                    }}
                                                                    class="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                                                                >
                                                                    Connect to {currentApp}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                        </div>
                                    </div>

                                </div>
                            );
                        }}
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
               {/*  <DataDebugger /> */}
            </main>
            {/* Results count */}
            {searchQuery() && (
                <footer class="mt-4 text-sm text-gray-600">
                    Found {filteredIdentities().length} of {userData.identities?.length || 0} identities
                </footer>
            )}

            {/* Add Identity Modal */}
            <Show when={showAddIdentityModal()}>
                <AddIdentityModal
                    onClose={() => setShowAddIdentityModal(false)}
                    onSuccess={() => {
                        setShowAddIdentityModal(false);
                        // The AuthContext addIdentity method already calls refreshUserData(),
                        // so the new identity will automatically appear in the list
                    }}
                />
            </Show>

        </div>
    );
};

export default PassportList;