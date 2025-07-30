import type { 
  NostrUserData, 
  AppPermissions 
} from '@nostrpass/types';

/**
 * Nostr event kinds for user data
 */
export const USER_DATA_KIND = 30078; // Parameterized replaceable event
export const VAULT_KIND = 30079; // Separate kind for vault data

/**
 * Create a deterministic identifier for user data events
 */
export function getUserDataIdentifier(pubkey: string, environment: string): string {
  return `nostrpass:user:${environment}:${pubkey}`;
}

/**
 * Create a deterministic identifier for vault events
 */
export function getVaultIdentifier(pubkey: string, environment: string): string {
  return `nostrpass:vault:${environment}:${pubkey}`;
}

/**
 * Serialize user data for storage on Nostr
 */
export function serializeUserData(data: NostrUserData): string {
  // Convert Map to array for serialization if needed
  const serializable = {
    ...data,
    appPermissions: data.appPermissions.map(perm => ({
      ...perm,
      // Ensure all dates are numbers
      grantedAt: Number(perm.grantedAt),
      lastUsedAt: Number(perm.lastUsedAt),
    })),
  };
  
  return JSON.stringify(serializable);
}

/**
 * Deserialize user data from Nostr
 */
export function deserializeUserData(content: string): NostrUserData {
  const parsed = JSON.parse(content);
  
  return {
    ...parsed,
    profile: {
      ...parsed.profile,
      createdAt: Number(parsed.profile.createdAt),
      updatedAt: Number(parsed.profile.updatedAt),
    },
    appPermissions: parsed.appPermissions.map((perm: any) => ({
      ...perm,
      grantedAt: Number(perm.grantedAt),
      lastUsedAt: Number(perm.lastUsedAt),
    })),
  };
}

/**
 * Create tags for user data event
 */
export function createUserDataTags(pubkey: string, environment: string): string[][] {
  return [
    ['d', getUserDataIdentifier(pubkey, environment)],
    ['client', 'nostrpass'],
    ['environment', environment],
  ];
}

/**
 * Create tags for vault event
 */
export function createVaultTags(pubkey: string, environment: string): string[][] {
  return [
    ['d', getVaultIdentifier(pubkey, environment)],
    ['client', 'nostrpass'],
    ['environment', environment],
  ];
}

/**
 * Check if an event is a valid NostrPass user data event
 */
export function isValidUserDataEvent(event: any, expectedPubkey: string): boolean {
  if (!event || event.kind !== USER_DATA_KIND) return false;
  if (event.pubkey !== expectedPubkey) return false;
  
  const dTag = event.tags?.find((tag: string[]) => tag[0] === 'd');
  if (!dTag) return false;
  
  const clientTag = event.tags?.find((tag: string[]) => tag[0] === 'client');
  if (clientTag?.[1] !== 'nostrpass') return false;
  
  return true;
}

/**
 * Check if an event is a valid NostrPass vault event
 */
export function isValidVaultEvent(event: any, expectedPubkey: string): boolean {
  if (!event || event.kind !== VAULT_KIND) return false;
  if (event.pubkey !== expectedPubkey) return false;
  
  const dTag = event.tags?.find((tag: string[]) => tag[0] === 'd');
  if (!dTag) return false;
  
  const clientTag = event.tags?.find((tag: string[]) => tag[0] === 'client');
  if (clientTag?.[1] !== 'nostrpass') return false;
  
  return true;
}

/**
 * Merge user data with conflict resolution
 */
export function mergeUserData(
  local: NostrUserData, 
  remote: NostrUserData
): NostrUserData {
  // Use latest profile based on updatedAt
  const profile = local.profile.updatedAt >= remote.profile.updatedAt 
    ? local.profile 
    : remote.profile;
  
  // Merge app permissions - keep most recent per app
  const appPermissionsMap = new Map<string, AppPermissions>();
  
  [...local.appPermissions, ...remote.appPermissions].forEach(perm => {
    const existing = appPermissionsMap.get(perm.appId);
    if (!existing || perm.lastUsedAt > existing.lastUsedAt) {
      appPermissionsMap.set(perm.appId, perm);
    }
  });
  
  // Use latest vault reference
  const vaultReference = (local.sync?.lastSyncAt || 0) >= (remote.sync?.lastSyncAt || 0)
    ? local.vaultReference
    : remote.vaultReference;
  
  return {
    profile,
    appPermissions: Array.from(appPermissionsMap.values()),
    vaultReference,
    sync: {
      deviceId: local.sync?.deviceId || 'unknown',
      lastSyncAt: Date.now(),
      conflictStrategy: 'merge',
    },
  };
}