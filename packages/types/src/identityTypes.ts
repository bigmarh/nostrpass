/**
 * Identity types for managing multiple identities derived from master key
 */

/**
 * Identity structure - supports both HD-derived and BYOK (imported) identities
 *
 * HD identities: derived from xpriv using BIP44 path
 * BYOK identities: user imports their own nsec (encrypted with PIN)
 */
export interface Identity {
  /** Identity nickname */
  nickname: string;
  /** Identity public key */
  publicKey: string;
  /** Identity index in the array */
  index: number;

  /**
   * Full BIP44 derivation path: m/44'/1237'/0'/0/${index}
   * Only present for HD-derived identities, undefined for BYOK
   */
  path?: string;

  /**
   * BYOK (Bring Your Own Key) fields
   * Only present for imported identities
   */
  /** Whether this is an imported (BYOK) identity */
  isImported?: boolean;
  /** nsec encrypted with PIN using same salt as xpriv - only for BYOK */
  encryptedNsec?: string;
  /** Timestamp when identity was imported - only for BYOK */
  importedAt?: number;

  /** App permissions for this identity */
  appPermissions?: Record<string, import('./userTypes').AppPermissions>;

  /** Identity-specific settings */
  settings?: {
    /** Theme preference for this identity */
    theme?: 'light' | 'dark' | 'system';

    /** Default relays for this identity */
    defaultRelays?: string[];

    /** Other identity-specific preferences */
    preferences?: Record<string, any>;
  };

  /** Nostr profile metadata (NIP-01 kind 0) */
  profile?: {
    /** Display name */
    name?: string;
    /** Profile picture as data URL (e.g., data:image/png;base64,...) */
    picture?: string;
    /** About/bio text */
    about?: string;
    /** NIP-05 identifier (name@domain.com) */
    nip05?: string;
    /** Banner image as data URL */
    banner?: string;
    /** Website URL */
    website?: string;
    /** Lightning address or LNURL */
    lud16?: string;
    /** Display name */
    display_name?: string;
  };

  /** When identity was created (HD) or imported (BYOK) */
  createdAt?: number;

  /** Whether identity is archived (soft delete) */
  archived?: boolean;
  /** When identity was archived */
  archivedAt?: number;
}

/**
 * User's master key data
 */
export interface UserMasterKey {
  /** Extended private key (xpriv) for deriving identities */
  xpriv: string;
  
  /** List of identities */
  identities: Identity[];
}