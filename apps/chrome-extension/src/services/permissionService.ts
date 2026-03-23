import type { AppPermissions, PermissionLevel } from '@nostrpass/types';
import { vaultDataService } from './vaultDataService';

export interface PermissionRequest {
  origin: string;
  appName?: string;
  action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
  // Data being requested
  event?: any; // Full event object for signEvent
  data?: string; // Data for signData
  pubkey?: string; // Recipient for nip04
  ciphertext?: string; // Encrypted content for nip04 decrypt
  plaintext?: string; // Plaintext for nip04 encrypt
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



  async getAppPermissions(username: string, origin: string, identityIndex?: number): Promise<AppPermissions | null> {
    return vaultDataService.getAppPermissions(username, origin, identityIndex);
  }

  async checkPermission(
    username: string,
    origin: string,
    action: PermissionRequest['action'],
    eventKind?: number
  ): Promise<PermissionCheckResult> {
    const result = await vaultDataService.checkPermission(username, origin, action, eventKind);
    
    return {
      allowed: result.allowed,
      level: result.level as PermissionLevel,
      needsPrompt: result.needsPrompt
    };
  }

  async saveAppPermissions(
    username: string,
    origin: string,
    permissions: Partial<AppPermissions>,
    appName?: string,
    identityIndex?: number
  ): Promise<void> {
    await vaultDataService.saveAppPermissions(username, origin, permissions, appName, identityIndex);
  }

  async grantSessionPermission(
    username: string,
    origin: string,
    action: 'signEvent' | 'signData',
    eventKind?: number,
    sessionDurationMinutes: number = 60
  ): Promise<void> {
    await vaultDataService.grantSessionPermission(username, origin, action, eventKind, sessionDurationMinutes);
  }

  async updateLastUsed(username: string, origin: string): Promise<void> {
    const appPerms = await this.getAppPermissions(username, origin);
    if (!appPerms) return;

    // Update last used timestamp
    const updatedPerms = {
      ...appPerms,
      lastUsedAt: Date.now()
    };

    await vaultDataService.saveAppPermissions(username, origin, updatedPerms);
  }

  async revokeAppPermissions(username: string, origin: string): Promise<void> {
    // Get current permissions and remove the origin
    const vaultData = await vaultDataService.getVaultData(username);
    if (!vaultData?.identities) return;
    const identity = vaultData.identities.find((id: any) => id?.appPermissions && id.appPermissions[origin]);
    
    if (identity?.appPermissions?.[origin]) {
      delete identity.appPermissions[origin];
      // Update the first matching identity
      const index = vaultData.identities.findIndex((id: any) => id === identity);
      if (index >= 0) {
        await vaultDataService.updateIdentity(username, index, { appPermissions: identity.appPermissions });
        await vaultDataService.syncToNostr(username);
      }
    }
  }

  async getAllAppPermissions(username: string): Promise<AppPermissions[]> {
    const vaultData = await vaultDataService.getVaultData(username, { forceRefresh: true });
    if (!vaultData?.identities || vaultData.identities.length === 0) return [];

    // Use the first identity (identity selection is per-tab and not persisted)
    const identity = vaultData.identities[0];

    if (!identity?.appPermissions) return [];

    return Object.values(identity.appPermissions);
  }

  async switchIdentity(_username: string, _newIdentityIndex: number): Promise<void> {
    // No-op; identity is per-app/tab now
    return;
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