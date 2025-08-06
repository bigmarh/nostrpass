import type { AppPermissions, PermissionLevel, Identity } from '@nostrpass/types';
import { getCryptoWorker } from './cryptoWorkerSingleton';

export interface PermissionRequest {
  origin: string;
  appName?: string;
  action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
}

export interface PermissionCheckResult {
  allowed: boolean;
  level: PermissionLevel;
  needsPrompt: boolean;
  sessionGranted?: boolean;
}

export class PermissionService {
  private static instance: PermissionService;
  
  static getInstance(): PermissionService {
    if (!this.instance) {
      this.instance = new PermissionService();
    }
    return this.instance;
  }

  private async getCurrentIdentity(username: string): Promise<{ identity: Identity; index: number } | null> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    const vaultData = await cryptoWorker.getVaultData({ username });
    if (!vaultData) return null;

    const index = vaultData.currentIdentityIndex ?? 0;
    const identity = vaultData.identities[index];
    
    if (!identity) return null;
    
    return { identity, index };
  }

  async getAppPermissions(username: string, origin: string): Promise<AppPermissions | null> {
    const identityData = await this.getCurrentIdentity(username);
    if (!identityData) return null;

    // Check identity's app permissions
    if (identityData.identity.appPermissions?.[origin]) {
      return identityData.identity.appPermissions[origin];
    }

    return null;
  }

  async checkPermission(
    username: string,
    origin: string,
    action: PermissionRequest['action'],
    eventKind?: number
  ): Promise<PermissionCheckResult> {
    const appPerms = await this.getAppPermissions(username, origin);
    
    if (!appPerms) {
      return {
        allowed: false,
        level: 'ASK_EVERYTIME',
        needsPrompt: true
      };
    }

    let permissionLevel: PermissionLevel = 'DENY';
    
    // Check the specific permission level based on action
    if (action === 'signEvent' && eventKind !== undefined) {
      // Check event kind specific permission
      permissionLevel = appPerms.kinds[eventKind] || 'ASK_EVERYTIME';
    } else if (action === 'signData') {
      permissionLevel = appPerms.signData;
    } else if (action === 'getPublicKey') {
      permissionLevel = appPerms.getPublicKey || 'ASK_EVERYTIME';
    } else if (action === 'nip04') {
      permissionLevel = appPerms.nip04 || 'ASK_EVERYTIME';
    } else if (action === 'getRelays') {
      permissionLevel = appPerms.getRelays || 'ASK_EVERYTIME';
    }

    // Check session permissions for ASK_PER_SESSION
    let sessionGranted = false;
    if (permissionLevel === 'ASK_PER_SESSION' && appPerms.sessionPermissions) {
      const now = Date.now();
      if (appPerms.sessionPermissions.expiresAt > now) {
        if (action === 'signEvent' && eventKind !== undefined) {
          sessionGranted = appPerms.sessionPermissions.kinds[eventKind] === true;
        } else if (action === 'signData') {
          sessionGranted = appPerms.sessionPermissions.signData === true;
        }
      }
    }

    return {
      allowed: permissionLevel === 'ALLOW' || (permissionLevel === 'ASK_PER_SESSION' && sessionGranted),
      level: permissionLevel,
      needsPrompt: permissionLevel === 'ASK_EVERYTIME' || 
                   (permissionLevel === 'ASK_PER_SESSION' && !sessionGranted),
      sessionGranted
    };
  }

  async saveAppPermissions(
    username: string,
    origin: string,
    permissions: Partial<AppPermissions>,
    appName?: string
  ): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    const vaultData = await cryptoWorker.getVaultData({ username });
    if (!vaultData) throw new Error('Vault data not found');

    const identityData = await this.getCurrentIdentity(username);
    if (!identityData) throw new Error('No current identity');

    const { identity, index } = identityData;
    
    // Initialize app permissions for identity if needed
    if (!identity.appPermissions) {
      identity.appPermissions = {};
    }

    const existingPerms = identity.appPermissions[origin];
    
    const updatedPermissions: AppPermissions = {
      appId: origin,
      appName: appName || existingPerms?.appName,
      grantedAt: existingPerms?.grantedAt || Date.now(),
      lastUsedAt: Date.now(),
      kinds: permissions.kinds || existingPerms?.kinds || {},
      signData: permissions.signData || existingPerms?.signData || 'DENY',
      getPublicKey: permissions.getPublicKey || existingPerms?.getPublicKey,
      nip04: permissions.nip04 || existingPerms?.nip04,
      getRelays: permissions.getRelays || existingPerms?.getRelays,
      sessionPermissions: permissions.sessionPermissions || existingPerms?.sessionPermissions
    };

    // Update the identity's permissions
    identity.appPermissions[origin] = updatedPermissions;
    
    // Update the identity in vault data
    vaultData.identities[index] = identity;
    vaultData.updatedAt = Date.now();

    await cryptoWorker.updateVaultData({ username, vaultData });

    try {
      const vaultEvent = await cryptoWorker.saveVaultToNostr({ username });
      const { publishEvent } = await import('@nostrpass/nostrHelpers');
      const { getRelays } = await import('../providers/EnvironmentProvider');
      await publishEvent(vaultEvent.event, getRelays());
    } catch (error) {
      console.error('Failed to sync permissions to Nostr:', error);
    }
  }

  async grantSessionPermission(
    username: string,
    origin: string,
    action: 'signEvent' | 'signData',
    eventKind?: number,
    sessionDurationMinutes: number = 60
  ): Promise<void> {
    const appPerms = await this.getAppPermissions(username, origin);
    if (!appPerms) return;

    const expiresAt = Date.now() + (sessionDurationMinutes * 60 * 1000);
    
    if (!appPerms.sessionPermissions) {
      appPerms.sessionPermissions = {
        kinds: {},
        signData: false,
        expiresAt
      };
    }

    if (action === 'signEvent' && eventKind !== undefined) {
      appPerms.sessionPermissions.kinds[eventKind] = true;
    } else if (action === 'signData') {
      appPerms.sessionPermissions.signData = true;
    }

    appPerms.sessionPermissions.expiresAt = expiresAt;

    await this.saveAppPermissions(username, origin, appPerms);
  }

  async updateLastUsed(username: string, origin: string): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    const identityData = await this.getCurrentIdentity(username);
    if (!identityData) return;

    const { identity } = identityData;
    
    if (!identity.appPermissions?.[origin]) return;

    identity.appPermissions[origin].lastUsedAt = Date.now();
    
    const vaultData = await cryptoWorker.getVaultData({ username });
    if (!vaultData) return;
    
    vaultData.identities[identityData.index] = identity;
    vaultData.updatedAt = Date.now();

    await cryptoWorker.updateVaultData({ username, vaultData });
  }

  async revokeAppPermissions(username: string, origin: string): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    const vaultData = await cryptoWorker.getVaultData({ username });
    if (!vaultData) return;

    const identityData = await this.getCurrentIdentity(username);
    if (!identityData) return;

    const { identity, index } = identityData;
    
    if (identity.appPermissions?.[origin]) {
      delete identity.appPermissions[origin];
      vaultData.identities[index] = identity;
      vaultData.updatedAt = Date.now();
      await cryptoWorker.updateVaultData({ username, vaultData });
    }

    try {
      const vaultEvent = await cryptoWorker.saveVaultToNostr({ username });
      const { publishEvent } = await import('@nostrpass/nostrHelpers');
      const { getRelays } = await import('../providers/EnvironmentProvider');
      await publishEvent(vaultEvent.event, getRelays());
    } catch (error) {
      console.error('Failed to sync permission revocation to Nostr:', error);
    }
  }

  async getAllAppPermissions(username: string): Promise<AppPermissions[]> {
    const identityData = await this.getCurrentIdentity(username);
    if (!identityData) return [];

    const { identity } = identityData;
    
    if (!identity.appPermissions) return [];

    return Object.values(identity.appPermissions);
  }

  async switchIdentity(username: string, newIdentityIndex: number): Promise<void> {
    const cryptoWorker = getCryptoWorker();
    if (!cryptoWorker) throw new Error('Crypto worker not ready');

    const vaultData = await cryptoWorker.getVaultData({ username });
    if (!vaultData) throw new Error('Vault data not found');

    if (!vaultData.identities[newIdentityIndex]) {
      throw new Error('Identity not found');
    }

    vaultData.currentIdentityIndex = newIdentityIndex;
    vaultData.updatedAt = Date.now();

    await cryptoWorker.updateVaultData({ username, vaultData });
  }

  isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    try {
      const url = new URL(origin);
      return allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
        }
        return url.origin === allowed;
      });
    } catch {
      return false;
    }
  }
}

export const permissionService = new PermissionService();