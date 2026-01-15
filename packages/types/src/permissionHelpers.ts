import type { PermissionLevel, PermissionCategories, AppPermissions } from './userTypes';

/**
 * Event kinds associated with each permission category
 */
export const PERMISSION_KINDS = {
  /** Social interactions - all common social activities */
  social: [
    0,   // Metadata (profile updates)
    1,   // Text notes (posts)
    3,   // Contacts (follows/unfollows)
    5,   // Event deletion
    6,   // Reposts
    7,   // Reactions (likes, etc.)
    8,   // Badge awards
    16,  // Generic re-usable parameterized replaceable event
    40,  // Channel creation
    41,  // Channel metadata
    42,  // Channel message
    43,  // Channel hide message
    44,  // Channel mute user
    1984, // Report
    10000, // Mute list
    10001, // Pin list
    10002, // Relay list metadata
    30000, // Follow sets
    30001, // Communities
    30002, // Community approval
    30003, // Community metadata
    30004, // Community post
    30005, // Community hide post
    30006, // Community mute user
    30007, // Community pin post
    30008, // Community bookmark
    30009, // Community roles
    30010, // Community user roles
    30011, // Community delete post
    30012, // Community delete user
    30013, // Community delete role
    30014, // Community delete bookmark
    30015, // Community delete pin
    30016, // Community delete mute
    30017, // Community delete hide
    30018, // Community delete approval
    30019, // Community delete metadata
    30020, // Community delete user role
    30021, // Community delete role
    30022, // Community delete bookmark
    30023, // Long-form content
    30024, // Draft long-form content
    30025, // Long-form content draft
    30026, // Long-form content published
    30027, // Long-form content updated
    30028, // Long-form content deleted
    30029, // Long-form content restored
    30030, // Long-form content archived
    30031, // Long-form content unarchived
    30032, // Long-form content pinned
    30033, // Long-form content unpinned
    30034, // Long-form content bookmarked
    30035, // Long-form content unbookmarked
    30036, // Long-form content liked
    30037, // Long-form content unliked
    30038, // Long-form content shared
    30039, // Long-form content unshared
    30040, // Long-form content reported
    30041, // Long-form content hidden
    30042, // Long-form content unhidden
    30043, // Long-form content muted
    30044, // Long-form content unmuted
    30045, // Long-form content blocked
    30046, // Long-form content unblocked
    30047, // Long-form content followed
    30048, // Long-form content unfollowed
    30049, // Long-form content subscribed
    30050, // Long-form content unsubscribed
    30051, // Long-form content favorited
    30052, // Long-form content unfavorited
    30053, // Long-form content starred
    30054, // Long-form content unstarred
    30055, // Long-form content tagged
    30056, // Long-form content untagged
    30057, // Long-form content categorized
    30058, // Long-form content uncategorized
    30059, // Long-form content featured
    30060, // Long-form content unfeatured
    30061, // Long-form content promoted
    30062, // Long-form content unpromoted
    30063, // Long-form content highlighted
    30064, // Long-form content unhighlighted
    30065, // Long-form content endorsed
    30066, // Long-form content unendorsed
    30067, // Long-form content recommended
    30068, // Long-form content unrecommended
    30069, // Long-form content suggested
    30070, // Long-form content unsuggested
    30071, // Long-form content trending
    30072, // Long-form content untrending
    30073, // Long-form content viral
    30074, // Long-form content unviral
    30075, // Long-form content popular
    30076, // Long-form content unpopular
    30077, // Long-form content controversial
    30078, // Long-form content uncontroversial
    30079, // Long-form content sensitive
    30080, // Long-form content insensitive
    30081, // Long-form content mature
    30082, // Long-form content immature
    30083, // Long-form content adult
    30084, // Long-form content non-adult
    30085, // Long-form content explicit
    30086, // Long-form content non-explicit
    30087, // Long-form content graphic
    30088, // Long-form content non-graphic
    30089, // Long-form content disturbing
    30090, // Long-form content non-disturbing
    30091, // Long-form content offensive
    30092, // Long-form content non-offensive
    30093, // Long-form content inappropriate
    30094, // Long-form content appropriate
    30095, // Long-form content unsuitable
    30096, // Long-form content suitable
    30097, // Long-form content objectionable
    30098, // Long-form content non-objectionable
    30099, // Long-form content problematic
    30100, // Long-form content non-problematic
  ] as const,
  
  /** Messaging - private communications */
  messaging: [
    4,   // Encrypted Direct Messages
    14,  // Direct message
    1059, // Nostr Connect
    1063, // File metadata
    1064, // HTTP auth
    1065, // Set stall
    1066, // Set product
    1067, // Profile badges
    1068, // Badge definition
    1069, // Create or update a stall
    1070, // Create or update products
    1071, // Create or update a stall
    1072, // Create or update products
    1073, // Create or update a stall
    1074, // Create or update products
    1075, // Create or update a stall
    1076, // Create or update products
    1077, // Create or update a stall
    1078, // Create or update products
    1079, // Create or update a stall
    1080, // Create or update products
    1081, // Create or update a stall
    1082, // Create or update products
    1083, // Create or update a stall
    1084, // Create or update products
    1085, // Create or update a stall
    1086, // Create or update products
    1087, // Create or update a stall
    1088, // Create or update products
    1089, // Create or update a stall
    1090, // Create or update products
    1091, // Create or update a stall
    1092, // Create or update products
    1093, // Create or update a stall
    1094, // Create or update products
    1095, // Create or update a stall
    1096, // Create or update products
    1097, // Create or update a stall
    1098, // Create or update products
    1099, // Create or update a stall
    1100, // Create or update products
  ] as const,
  
  /** General data signing - arbitrary data and authentication */
  signData: [
    1112, // Client authentication
    17472, // Application-specific data
    20000, // Parameterized replaceable event
    21000, // Parameterized replaceable event
    22000, // Parameterized replaceable event
    23000, // Parameterized replaceable event
    24000, // Parameterized replaceable event
    25000, // Parameterized replaceable event
    26000, // Parameterized replaceable event
    27000, // Parameterized replaceable event
    28000, // Parameterized replaceable event
    29000, // Parameterized replaceable event
    31000, // Parameterized replaceable event
    32000, // Parameterized replaceable event
    33000, // Parameterized replaceable event
    34000, // Parameterized replaceable event
    35000, // Parameterized replaceable event
    36000, // Parameterized replaceable event
    37000, // Parameterized replaceable event
    38000, // Parameterized replaceable event
    39000, // Parameterized replaceable event
    40000, // Parameterized replaceable event
    41000, // Parameterized replaceable event
    42000, // Parameterized replaceable event
    43000, // Parameterized replaceable event
    44000, // Parameterized replaceable event
    45000, // Parameterized replaceable event
    46000, // Parameterized replaceable event
    47000, // Parameterized replaceable event
    48000, // Parameterized replaceable event
    49000, // Parameterized replaceable event
    50000, // Parameterized replaceable event
  ] as const,
  
  /** Zaps and tips - lightning payments for social tipping */
  zaps: [
    9734, // Zap request
    9735, // Zap
  ] as const,

  /** Financial operations - wallet config and sensitive financial data */
  financial: [
    13194, // Wallet info
  ] as const,
} as const;

/**
 * Default permission levels for new app connections
 */
export const DEFAULT_PERMISSIONS: PermissionCategories = {
  social: 'ALLOW',
  messaging: 'ASK_EVERYTIME',
  signData: 'ASK_EVERYTIME',
  zaps: 'ASK_EVERYTIME',  // Can be set to ALLOW for seamless tipping
  financial: 'ASK_EVERYTIME',
};

/**
 * Default getPublicKey permission (required for login)
 */
export const DEFAULT_GET_PUBLIC_KEY: PermissionLevel = 'ALLOW';

/**
 * Get the permission category for a given event kind
 */
export function getPermissionCategoryForKind(kind: number): keyof PermissionCategories | null {
  if (PERMISSION_KINDS.social.includes(kind as any)) {
    return 'social';
  }
  if (PERMISSION_KINDS.messaging.includes(kind as any)) {
    return 'messaging';
  }
  if (PERMISSION_KINDS.signData.includes(kind as any)) {
    return 'signData';
  }
  if (PERMISSION_KINDS.financial.includes(kind as any)) {
    return 'financial';
  }
  return null;
}

/**
 * Check if an event kind is allowed based on permission categories
 */
export function isKindAllowed(
  kind: number, 
  permissions: PermissionCategories
): boolean {
  const category = getPermissionCategoryForKind(kind);
  if (!category) {
    return false; // Unknown kind, deny by default
  }
  
  return permissions[category] === 'ALLOW';
}

/**
 * Check if an event kind needs permission prompt
 */
export function needsPermissionPrompt(
  kind: number,
  permissions: PermissionCategories
): boolean {
  const category = getPermissionCategoryForKind(kind);
  if (!category) {
    return true; // Unknown kind, ask by default
  }
  
  return permissions[category] === 'ASK_EVERYTIME';
}

/**
 * Create default permissions for a new app
 */
export function createDefaultAppPermissions(appId: string, appName?: string) {
  return {
    appId,
    appName: appName || appId,
    grantedAt: Date.now(),
    lastUsedAt: Date.now(),
    permissions: { ...DEFAULT_PERMISSIONS },
    getPublicKey: DEFAULT_GET_PUBLIC_KEY,
  };
}

export function normalizeAppPermissions(
  input: any,
  appId?: string,
  appName?: string
): AppPermissions {
  const base = createDefaultAppPermissions(appId || input?.appId || input?.appDomain || 'unknown', appName || input?.appName);

  const legacyPermissions = input?.permissions;
  const normalized: AppPermissions = {
    ...base,
    ...input,
    appId: input?.appId || input?.appDomain || base.appId,
    appName: input?.appName || appName || base.appName,
    grantedAt: input?.grantedAt || input?.createdAt || base.grantedAt,
    lastUsedAt: input?.lastUsedAt || input?.lastUsed || base.lastUsedAt,
    permissions: {
      ...base.permissions,
      ...(legacyPermissions?.social ? { social: legacyPermissions.social } : {}),
      ...(legacyPermissions?.messaging ? { messaging: legacyPermissions.messaging } : {}),
      ...(legacyPermissions?.signData ? { signData: legacyPermissions.signData } : {}),
      ...(legacyPermissions?.zaps ? { zaps: legacyPermissions.zaps } : {}),
      ...(legacyPermissions?.financial ? { financial: legacyPermissions.financial } : {})
    },
    getPublicKey: input?.getPublicKey ?? legacyPermissions?.getPublicKey ?? base.getPublicKey
  };

  // Legacy fallbacks for older permission shapes
  if (!legacyPermissions && input?.permissions && typeof input.permissions === 'object') {
    normalized.permissions = {
      ...normalized.permissions,
      ...(input.permissions.social ? { social: input.permissions.social } : {}),
      ...(input.permissions.messaging ? { messaging: input.permissions.messaging } : {}),
      ...(input.permissions.signData ? { signData: input.permissions.signData } : {}),
      ...(input.permissions.zaps ? { zaps: input.permissions.zaps } : {}),
      ...(input.permissions.financial ? { financial: input.permissions.financial } : {})
    };
  }

  if (!legacyPermissions && typeof input?.permissions === 'object') {
    if (input.permissions.signEvent) {
      normalized.signEvent = input.permissions.signEvent;
    }
    if (input.permissions.nip04) {
      normalized.nip04 = input.permissions.nip04;
    }
    if (input.permissions.nip44) {
      normalized.nip44 = input.permissions.nip44;
    }
  }

  if (input?.signEvent) normalized.signEvent = input.signEvent;
  if (input?.signData) normalized.signData = input.signData;
  if (input?.nip04) normalized.nip04 = input.nip04;
  if (input?.nip44) normalized.nip44 = input.nip44;
  if (input?.getRelays) normalized.getRelays = input.getRelays;

  return normalized;
}

/**
 * Get human-readable labels for permission levels
 */
export function getPermissionLevelLabel(level: PermissionLevel): string {
  switch (level) {
    case 'ALLOW':
      return 'Always Allow';
    case 'ASK_EVERYTIME':
      return 'Ask Every Time';
    case 'DENY':
      return 'Always Deny';
    default:
      return 'Unknown';
  }
}

/**
 * Get human-readable descriptions for permission categories
 */
export function getPermissionCategoryDescription(category: keyof PermissionCategories): string {
  switch (category) {
    case 'social':
      return 'All social interactions: posts, follows, reactions, reposts, profile updates, communities, and more';
    case 'messaging':
      return 'Private communications: encrypted messages, direct messages, and private data';
    case 'signData':
      return 'General data signing: authentication, arbitrary data, and application-specific data';
    case 'zaps':
      return 'Lightning tips and zaps: send small payments to appreciate content (kinds 9734, 9735)';
    case 'financial':
      return 'Financial configuration: wallet settings and sensitive financial metadata';
    default:
      return 'Unknown permission category';
  }
} 