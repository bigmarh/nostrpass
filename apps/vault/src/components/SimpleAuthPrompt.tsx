import { Component } from 'solid-js';
import type { Identity } from '@nostrpass/types';
import { nip19 } from 'nostr-tools';

interface SimpleAuthPromptProps {
  appOrigin: string;
  appName?: string;
  identity: Identity;
  identityIndex: number;
  onAuthorize: () => void;
  onDeny: () => void;
  onCustomize: () => void;
  permissions?: {
    getPublicKey?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    getRelays?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signEvent?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip04?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    nip44?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
    signData?: 'ALLOW' | 'ASK_EVERYTIME' | 'DENY';
  };
}

export const SimpleAuthPrompt: Component<SimpleAuthPromptProps> = (props) => {
  const getNpub = (identity: Identity) => {
    try {
      const npub = nip19.npubEncode(identity.publicKey);
      return npub.slice(0, 12) + '...' + npub.slice(-6);
    } catch {
      return identity.publicKey.slice(0, 16) + '...';
    }
  };

  const getIdentityName = () => {
    return props.identity.nickname || `Identity ${props.identityIndex + 1}`;
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'ALLOW': return <span class="text-green-500 mt-0.5">✓</span>;
      case 'DENY': return <span class="text-red-500 mt-0.5">✗</span>;
      default: return <span class="text-yellow-500 mt-0.5">?</span>;
    }
  };

  const getPermissionText = (level: string) => {
    switch (level) {
      case 'ALLOW': return 'Always allow';
      case 'DENY': return 'Always deny';
      default: return 'Ask each time';
    }
  };

  return (
    <div class="flex items-center justify-center w-full h-full p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div class="p-6">
          {/* Header */}
          <div class="mb-6 text-center">
            <div class="text-4xl mb-3">🔐</div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Connect Account?
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <strong>{props.appName || props.appOrigin}</strong> wants to connect with
            </p>
          </div>

          {/* Identity Card */}
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="font-medium text-gray-900 dark:text-white mb-1">
              {getIdentityName()}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {getNpub(props.identity)}
            </div>
          </div>

          {/* Permissions being requested */}
          <div class="mb-6">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
              Permissions Being Granted
            </div>
            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div class="flex items-start gap-2">
                {getPermissionIcon(props.permissions?.getPublicKey || 'ALLOW')}
                <div>
                  <div>Read your public key</div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    {getPermissionText(props.permissions?.getPublicKey || 'ALLOW')}
                  </div>
                </div>
              </div>
              <div class="flex items-start gap-2">
                {getPermissionIcon(props.permissions?.signEvent || 'ASK_EVERYTIME')}
                <div>
                  <div>Sign events</div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    {getPermissionText(props.permissions?.signEvent || 'ASK_EVERYTIME')}
                  </div>
                </div>
              </div>
              <div class="flex items-start gap-2">
                {getPermissionIcon(props.permissions?.nip04 || 'ASK_EVERYTIME')}
                <div>
                  <div>Encrypted messages (NIP-04)</div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    {getPermissionText(props.permissions?.nip04 || 'ASK_EVERYTIME')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div class="space-y-3">
            <div class="flex gap-3">
              <button
                onClick={props.onDeny}
                class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={props.onAuthorize}
                class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Connect
              </button>
            </div>

            {/* Customize link */}
            <button
              onClick={props.onCustomize}
              class="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
            >
              Customize permissions instead →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleAuthPrompt;
