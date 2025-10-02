import { Component, Show, createSignal } from 'solid-js';
import { desanitizeDomain } from '@nostrpass/nostrHelpers';
import type { AppPermissions, PermissionLevel } from '@nostrpass/types';

interface PermissionsSectionProps {
    appId: string;
    appPermissions: AppPermissions | null;
    isVaultLocked: boolean;
    isSavingPermission: boolean;
    permissionSaveError: string | null;
    onPermissionChange: (permissionType: string, newLevel: PermissionLevel) => Promise<void>;
    onDisconnect: () => void;
}

export const PermissionsSection: Component<PermissionsSectionProps> = (props) => {
    const [showPublicKeyDetails, setShowPublicKeyDetails] = createSignal(false);
    const [showSocialDetails, setShowSocialDetails] = createSignal(false);
    const [showMessagingDetails, setShowMessagingDetails] = createSignal(false);
    const [showSignDataDetails, setShowSignDataDetails] = createSignal(false);
    const [showFinancialDetails, setShowFinancialDetails] = createSignal(false);

    return (
        <div class="space-y-6">
            <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Permissions</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    What {desanitizeDomain(props.appId)} can do with this identity
                </p>
            </div>
            
            <Show 
                when={props.appId}
                fallback={
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        No app currently connected
                    </p>
                }
            >
                <div class="space-y-2">
                    <Show when={props.appPermissions} fallback={
                        <p class="text-sm text-gray-400 dark:text-gray-500 py-2">Loading permissions...</p>
                    }>
                        {/* Public Key Access */}
                        <div class="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-4 transition-colors">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Public Key Access</span>
                                            <button
                                                onClick={() => setShowPublicKeyDetails(!showPublicKeyDetails())}
                                                class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                                title="Learn more"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Show when={showPublicKeyDetails()}>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                                Allows the app to read your public key for identification
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                                <select 
                                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={props.appPermissions?.getPublicKey || 'ALLOW'}
                                    onChange={(e) => props.onPermissionChange('getPublicKey', e.currentTarget.value as PermissionLevel)}
                                    disabled={props.isSavingPermission || props.isVaultLocked}
                                >
                                    <option value="ALLOW">Always Allow</option>
                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                    <option value="DENY">Always Deny</option>
                                </select>
                            </div>
                        </div>

                        {/* Social Interactions */}
                        <div class="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-4 transition-colors">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Social Interactions</span>
                                            <button
                                                onClick={() => setShowSocialDetails(!showSocialDetails())}
                                                class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                                title="Learn more"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Show when={showSocialDetails()}>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                                Posts, follows, reactions, profile updates, and social activities
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                                <select 
                                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={props.appPermissions?.permissions?.social || 'ALLOW'}
                                    onChange={(e) => props.onPermissionChange('social', e.currentTarget.value as PermissionLevel)}
                                    disabled={props.isSavingPermission || props.isVaultLocked}
                                >
                                    <option value="ALLOW">Always Allow</option>
                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                    <option value="DENY">Always Deny</option>
                                </select>
                            </div>
                        </div>

                        {/* Private Messaging */}
                        <div class="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-4 transition-colors">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Private Messaging</span>
                                            <button
                                                onClick={() => setShowMessagingDetails(!showMessagingDetails())}
                                                class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                                title="Learn more"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Show when={showMessagingDetails()}>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                                Encrypted direct messages and private communications
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                                <select 
                                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={props.appPermissions?.permissions?.messaging || 'ASK_EVERYTIME'}
                                    onChange={(e) => props.onPermissionChange('messaging', e.currentTarget.value as PermissionLevel)}
                                    disabled={props.isSavingPermission || props.isVaultLocked}
                                >
                                    <option value="ALLOW">Always Allow</option>
                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                    <option value="DENY">Always Deny</option>
                                </select>
                            </div>
                        </div>

                        {/* Data Signing */}
                        <div class="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-4 transition-colors">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Data Signing</span>
                                            <button
                                                onClick={() => setShowSignDataDetails(!showSignDataDetails())}
                                                class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                                title="Learn more"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Show when={showSignDataDetails()}>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                                Authentication, data signing, and app-specific operations
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                                <select 
                                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={props.appPermissions?.permissions?.signData || 'ASK_EVERYTIME'}
                                    onChange={(e) => props.onPermissionChange('signData', e.currentTarget.value as PermissionLevel)}
                                    disabled={props.isSavingPermission}
                                >
                                    <option value="ALLOW">Always Allow</option>
                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                    <option value="DENY">Always Deny</option>
                                </select>
                            </div>
                        </div>

                        {/* Financial Operations */}
                        <div class="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-4 transition-colors">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Financial Operations</span>
                                            <button
                                                onClick={() => setShowFinancialDetails(!showFinancialDetails())}
                                                class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                                                title="Learn more"
                                            >
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                        <Show when={showFinancialDetails()}>
                                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                                Payments, zaps, and sensitive financial data
                                            </p>
                                        </Show>
                                    </div>
                                </div>
                                <select 
                                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={props.appPermissions?.permissions?.financial || 'ASK_EVERYTIME'}
                                    onChange={(e) => props.onPermissionChange('financial', e.currentTarget.value as PermissionLevel)}
                                    disabled={props.isSavingPermission}
                                >
                                    <option value="ALLOW">Always Allow</option>
                                    <option value="ASK_EVERYTIME">Ask Each Time</option>
                                    <option value="DENY">Always Deny</option>
                                </select>
                            </div>
                        </div>
                    </Show>
                    
                    <Show when={props.permissionSaveError}>
                        <p class={`text-sm mt-2 ${props.permissionSaveError?.includes('Successfully') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {props.permissionSaveError}
                        </p>
                    </Show>
                    
                    <Show when={props.isSavingPermission}>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
                            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Saving...
                        </p>
                    </Show>
                </div>
                
                {/* Disconnect Button */}
                <div class="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={props.onDisconnect}
                        class="w-full px-4 py-3 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={props.isVaultLocked}
                    >
                        {props.isVaultLocked ? 'Unlock vault to disconnect' : 'Disconnect from this app'}
                    </button>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        This will remove all permissions for {desanitizeDomain(props.appId)} from this identity
                    </p>
                </div>
            </Show>
        </div>
    );
}; 