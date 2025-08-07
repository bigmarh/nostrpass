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
        <div class="border-t pt-6">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Permissions</h3>
            <Show 
                when={props.appId}
                fallback={
                    <p class="text-sm text-gray-500">
                        No app currently connected
                    </p>
                }
            >
                <div class="space-y-3">
                    <p class="text-xs text-gray-600">
                        What {desanitizeDomain(props.appId)} can do with this identity:
                    </p>
                    
                    {/* Permission Categories */}
                    <div class="space-y-3">
                        <Show when={props.appPermissions} fallback={
                            <p class="text-xs text-gray-500 py-2">Loading permissions...</p>
                        }>
                            {/* Public Key Access */}
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        <span class="text-sm font-medium text-gray-900">Public Key Access</span>
                                        <button
                                            onClick={() => setShowPublicKeyDetails(!showPublicKeyDetails())}
                                            class="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            title="Learn more about this permission"
                                        >
                                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <select 
                                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                        value={props.appPermissions?.getPublicKey || 'ALLOW'}
                                        onChange={(e) => props.onPermissionChange('getPublicKey', e.currentTarget.value as PermissionLevel)}
                                        disabled={props.isSavingPermission || props.isVaultLocked}
                                    >
                                        <option value="ALLOW">Always Allow</option>
                                        <option value="ASK_EVERYTIME">Ask Each Time</option>
                                        <option value="DENY">Always Deny</option>
                                    </select>
                                </div>
                                <Show when={showPublicKeyDetails()}>
                                    <div class="mt-2 pt-2 border-t border-gray-100">
                                        <p class="text-xs text-gray-600 mb-2">
                                            Allows the app to read your public key for identification and authentication
                                        </p>
                                    </div>
                                </Show>
                            </div>

                            {/* Social Interactions */}
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span class="text-sm font-medium text-gray-900">Social Interactions</span>
                                        <button
                                            onClick={() => setShowSocialDetails(!showSocialDetails())}
                                            class="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            title="Learn more about this permission"
                                        >
                                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <select 
                                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                        value={props.appPermissions?.permissions?.social || 'ALLOW'}
                                        onChange={(e) => props.onPermissionChange('social', e.currentTarget.value as PermissionLevel)}
                                        disabled={props.isSavingPermission || props.isVaultLocked}
                                    >
                                        <option value="ALLOW">Always Allow</option>
                                        <option value="ASK_EVERYTIME">Ask Each Time</option>
                                        <option value="DENY">Always Deny</option>
                                    </select>
                                </div>
                                <Show when={showSocialDetails()}>
                                    <div class="mt-2 pt-2 border-t border-gray-100">
                                        <p class="text-xs text-gray-600 mb-2">
                                            Posts, follows, reactions, reposts, profile updates, communities, and other social activities
                                        </p>
                                        <div class="text-xs text-gray-500 space-y-1">
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Text notes and posts (kind 1)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Profile updates (kind 0)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Follows and contacts (kind 3)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Reactions and reposts (kinds 6, 7)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Communities and long-form content</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            {/* Messaging */}
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <span class="text-sm font-medium text-gray-900">Private Messaging</span>
                                        <button
                                            onClick={() => setShowMessagingDetails(!showMessagingDetails())}
                                            class="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            title="Learn more about this permission"
                                        >
                                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <select 
                                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                        value={props.appPermissions?.permissions?.messaging || 'ASK_EVERYTIME'}
                                        onChange={(e) => props.onPermissionChange('messaging', e.currentTarget.value as PermissionLevel)}
                                        disabled={props.isSavingPermission || props.isVaultLocked}
                                    >
                                        <option value="ALLOW">Always Allow</option>
                                        <option value="ASK_EVERYTIME">Ask Each Time</option>
                                        <option value="DENY">Always Deny</option>
                                    </select>
                                </div>
                                <Show when={showMessagingDetails()}>
                                    <div class="mt-2 pt-2 border-t border-gray-100">
                                        <p class="text-xs text-gray-600 mb-2">
                                            Encrypted direct messages and private communications
                                        </p>
                                        <div class="text-xs text-gray-500 space-y-1">
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Encrypted direct messages (kind 4)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Direct messages (kind 14)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Nostr Connect authentication</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            {/* Data Signing */}
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span class="text-sm font-medium text-gray-900">Data Signing</span>
                                        <button
                                            onClick={() => setShowSignDataDetails(!showSignDataDetails())}
                                            class="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            title="Learn more about this permission"
                                        >
                                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <select 
                                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                        value={props.appPermissions?.permissions?.signData || 'ASK_EVERYTIME'}
                                        onChange={(e) => props.onPermissionChange('signData', e.currentTarget.value as PermissionLevel)}
                                        disabled={props.isSavingPermission}
                                    >
                                        <option value="ALLOW">Always Allow</option>
                                        <option value="ASK_EVERYTIME">Ask Each Time</option>
                                        <option value="DENY">Always Deny</option>
                                    </select>
                                </div>
                                <Show when={showSignDataDetails()}>
                                    <div class="mt-2 pt-2 border-t border-gray-100">
                                        <p class="text-xs text-gray-600 mb-2">
                                            Authentication, arbitrary data signing, and application-specific data
                                        </p>
                                        <div class="text-xs text-gray-500 space-y-1">
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Client authentication (kind 1112)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Application-specific data (kind 17472)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Arbitrary data signing</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            {/* Financial Operations */}
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        <span class="text-sm font-medium text-gray-900">Financial Operations</span>
                                        <button
                                            onClick={() => setShowFinancialDetails(!showFinancialDetails())}
                                            class="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            title="Learn more about this permission"
                                        >
                                            <svg class="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <select 
                                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                                        value={props.appPermissions?.permissions?.financial || 'ASK_EVERYTIME'}
                                        onChange={(e) => props.onPermissionChange('financial', e.currentTarget.value as PermissionLevel)}
                                        disabled={props.isSavingPermission}
                                    >
                                        <option value="ALLOW">Always Allow</option>
                                        <option value="ASK_EVERYTIME">Ask Each Time</option>
                                        <option value="DENY">Always Deny</option>
                                    </select>
                                </div>
                                <Show when={showFinancialDetails()}>
                                    <div class="mt-2 pt-2 border-t border-gray-100">
                                        <p class="text-xs text-gray-600 mb-2">
                                            Payments, zaps, and sensitive financial data
                                        </p>
                                        <div class="text-xs text-gray-500 space-y-1">
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Zap requests and payments (kinds 9734, 9735)</span>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <span>Wallet information (kind 13194)</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                        
                        <Show when={props.permissionSaveError}>
                            <p class={`text-xs mt-2 ${props.permissionSaveError?.includes('Successfully') ? 'text-green-600' : 'text-red-600'}`}>
                                {props.permissionSaveError}
                            </p>
                        </Show>
                        
                        <Show when={props.isSavingPermission}>
                            <p class="text-xs text-gray-500 mt-2">Saving...</p>
                        </Show>
                        
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <button
                                onClick={props.onDisconnect}
                                class="w-full px-4 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200 hover:bg-red-100 transition-colors"
                                disabled={props.isVaultLocked}
                            >
                                {props.isVaultLocked ? 'Unlock vault to disconnect' : 'Disconnect from this app'}
                            </button>
                            <p class="text-xs text-gray-500 mt-2">
                                This will remove all permissions for {desanitizeDomain(props.appId)} from this identity
                            </p>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}; 