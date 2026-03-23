/**
 * Background Service Worker
 *
 * Handles all NIP-07 requests from content scripts and popup communication
 */

import type {
  ExtensionMessage,
  ExtensionResponse,
  PendingRequest,
  PermissionLevel,
} from '@/shared/types';
import {
  getAppPermissions,
  setAppPermissions,
  setPendingRequest,
  getPendingRequest,
} from './storage';
import {
  getAuthState,
  unlockVault,
  lockVault,
  getActivePrivateKey,
  getActivePublicKey,
  isUnlocked,
} from './session';
import {
  signEvent,
  signData,
  nip04EncryptMessage,
  nip04DecryptMessage,
  nip44EncryptMessage,
  nip44DecryptMessage,
} from './crypto';

// Permission resolvers for pending requests
const permissionResolvers = new Map<
  string,
  {
    resolve: (granted: boolean, level?: PermissionLevel) => void;
    reject: (error: Error) => void;
  }
>();

/**
 * Check permission for an action
 */
async function checkPermission(
  origin: string,
  action: string,
  identityIndex: number = 0
): Promise<{ allowed: boolean; needsPrompt: boolean; level?: PermissionLevel }> {
  const permissions = await getAppPermissions(origin, identityIndex);

  if (!permissions) {
    return { allowed: false, needsPrompt: true };
  }

  const level = permissions[action as keyof typeof permissions] as
    | PermissionLevel
    | undefined;

  if (level === 'ALLOW') {
    return { allowed: true, needsPrompt: false, level };
  }

  if (level === 'DENY') {
    return { allowed: false, needsPrompt: false, level };
  }

  // ASK_EVERYTIME or undefined
  return { allowed: false, needsPrompt: true, level };
}

/**
 * Request permission from user via popup
 */
async function requestPermission(
  request: PendingRequest
): Promise<{ granted: boolean; level?: PermissionLevel }> {
  // Store pending request
  await setPendingRequest(request);

  // Open popup
  try {
    await chrome.action.openPopup();
  } catch {
    // If popup fails to open, user might need to click the icon
    console.log('[NostrPass] Could not open popup automatically');
  }

  // Wait for resolution
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      permissionResolvers.delete(request.id);
      setPendingRequest(null);
      reject(new Error('Permission request timeout'));
    }, 60000);

    permissionResolvers.set(request.id, {
      resolve: (granted, level) => {
        clearTimeout(timeoutId);
        permissionResolvers.delete(request.id);
        setPendingRequest(null);
        resolve({ granted, level });
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        permissionResolvers.delete(request.id);
        setPendingRequest(null);
        reject(error);
      },
    });
  });
}

/**
 * Handle incoming messages from content script
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  const origin = message.origin || sender.tab?.url || '';
  const identityIndex =
    (message.data?.identityIndex as number | undefined) ?? 0;

  try {
    switch (message.type) {
      case 'getAuthState': {
        const state = await getAuthState();
        return { success: true, data: state };
      }

      case 'unlock': {
        const pin = message.data?.pin as string;
        if (!pin) {
          return { success: false, error: 'PIN required' };
        }
        const result = await unlockVault(pin);
        if (result.success) {
          return { success: true, data: { unlocked: true } };
        }
        return { success: false, error: result.error };
      }

      case 'lock': {
        await lockVault();
        return { success: true, data: { locked: true } };
      }

      case 'getPendingRequest': {
        const pending = await getPendingRequest();
        return { success: true, data: pending };
      }

      case 'resolvePermission': {
        const { requestId, granted, level, savePreference } = message.data as {
          requestId: string;
          granted: boolean;
          level?: PermissionLevel;
          savePreference?: boolean;
        };

        const resolver = permissionResolvers.get(requestId);
        if (resolver) {
          resolver.resolve(granted, level);
        }

        // Save preference if requested
        if (savePreference && level) {
          const pending = await getPendingRequest();
          if (pending) {
            await setAppPermissions(
              pending.origin,
              {
                origin: pending.origin,
                [pending.type]: level,
              },
              identityIndex
            );
          }
        }

        return { success: true };
      }

      case 'getPublicKey': {
        // Check if unlocked
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        // Check permission
        const permCheck = await checkPermission(
          origin,
          'getPublicKey',
          identityIndex
        );
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'getPublicKey',
            origin,
            data: {},
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const publicKey = await getActivePublicKey(identityIndex);
        if (!publicKey) {
          return { success: false, error: 'No active identity' };
        }

        return { success: true, data: publicKey };
      }

      case 'signEvent': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const event = message.data?.event as {
          kind: number;
          created_at: number;
          tags: string[][];
          content: string;
        };

        if (!event) {
          return { success: false, error: 'Event required' };
        }

        // Check permission
        const permCheck = await checkPermission(
          origin,
          'signEvent',
          identityIndex
        );
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'signEvent',
            origin,
            data: { event },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const signedEvent = signEvent(event, privateKey);
        return { success: true, data: signedEvent };
      }

      case 'signData': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const dataMessage = message.data?.message as string;
        if (!dataMessage) {
          return { success: false, error: 'Message required' };
        }

        // Check permission
        const permCheck = await checkPermission(
          origin,
          'signData',
          identityIndex
        );
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'signData',
            origin,
            data: { message: dataMessage },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const signature = signData(dataMessage, privateKey);
        return { success: true, data: signature };
      }

      case 'getRelays': {
        // For now, return empty relays - could be configurable later
        return { success: true, data: {} };
      }

      case 'nip04.encrypt': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const { pubkey, plaintext } = message.data as {
          pubkey: string;
          plaintext: string;
        };

        if (!pubkey || !plaintext) {
          return { success: false, error: 'Missing pubkey or plaintext' };
        }

        // Check permission
        const permCheck = await checkPermission(origin, 'nip04', identityIndex);
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'nip04.encrypt',
            origin,
            data: { pubkey },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const ciphertext = await nip04EncryptMessage(
          plaintext,
          privateKey,
          pubkey
        );
        return { success: true, data: ciphertext };
      }

      case 'nip04.decrypt': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const { pubkey, ciphertext } = message.data as {
          pubkey: string;
          ciphertext: string;
        };

        if (!pubkey || !ciphertext) {
          return { success: false, error: 'Missing pubkey or ciphertext' };
        }

        // Check permission
        const permCheck = await checkPermission(origin, 'nip04', identityIndex);
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'nip04.decrypt',
            origin,
            data: { pubkey },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const decrypted = await nip04DecryptMessage(
          ciphertext,
          privateKey,
          pubkey
        );
        return { success: true, data: decrypted };
      }

      case 'nip44.encrypt': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const { pubkey, plaintext } = message.data as {
          pubkey: string;
          plaintext: string;
        };

        if (!pubkey || !plaintext) {
          return { success: false, error: 'Missing pubkey or plaintext' };
        }

        // Check permission
        const permCheck = await checkPermission(origin, 'nip44', identityIndex);
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'nip44.encrypt',
            origin,
            data: { pubkey },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const ciphertext = nip44EncryptMessage(plaintext, privateKey, pubkey);
        return { success: true, data: ciphertext };
      }

      case 'nip44.decrypt': {
        if (!(await isUnlocked())) {
          return { success: false, error: 'Vault is locked', errorCode: 'LOCKED' };
        }

        const { pubkey, ciphertext } = message.data as {
          pubkey: string;
          ciphertext: string;
        };

        if (!pubkey || !ciphertext) {
          return { success: false, error: 'Missing pubkey or ciphertext' };
        }

        // Check permission
        const permCheck = await checkPermission(origin, 'nip44', identityIndex);
        if (!permCheck.allowed && permCheck.needsPrompt) {
          const permResult = await requestPermission({
            id: message.requestId || `req-${Date.now()}`,
            type: 'nip44.decrypt',
            origin,
            data: { pubkey },
            timestamp: Date.now(),
          });

          if (!permResult.granted) {
            return {
              success: false,
              error: 'Permission denied',
              errorCode: 'PERMISSION_DENIED',
            };
          }
        } else if (!permCheck.allowed) {
          return {
            success: false,
            error: 'Permission denied',
            errorCode: 'PERMISSION_DENIED',
          };
        }

        const privateKey = await getActivePrivateKey(identityIndex);
        if (!privateKey) {
          return { success: false, error: 'No active identity' };
        }

        const decrypted = nip44DecryptMessage(ciphertext, privateKey, pubkey);
        return { success: true, data: decrypted };
      }

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    console.error('[NostrPass] Error handling message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

console.log('[NostrPass] Background service worker initialized');
