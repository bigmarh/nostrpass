/**
 * Identity types for managing multiple identities derived from master key
 */

/**
 * Simple identity structure
 */
export interface Identity {
  /** Identity nickname */
  nickname: string;
  
  /** Full BIP44 derivation path: m/44'/1237'/0'/0/${index} */
  path: string;
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