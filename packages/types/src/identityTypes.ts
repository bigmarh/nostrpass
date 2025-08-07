/**
 * Identity types for managing multiple identities derived from master key
 */

/**
 * Simple identity structure
 */
export interface Identity {
  /** Identity nickname */
  nickname: string;
  /** Identity public key */  
  publicKey: string;
  /** Full BIP44 derivation path: m/44'/1237'/0'/0/${index} */
  path: string;
  /** Identity index */
  index: number;
  
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