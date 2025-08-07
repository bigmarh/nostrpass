import type { Identity, UserMasterKey } from '@nostrpass/types';
import { getCryptoWorker } from './cryptoWorkerSingleton';

// Get shared worker client
const cryptoWorker = getCryptoWorker() as any;

/**
 * Create a new user with master key and initial "Personal" identity
 */
export async function createUser(): Promise<UserMasterKey> {
  // Generate a new master key (xpriv)
  const { xpriv } = await cryptoWorker.generateXpriv();
  
  // Create the initial "Personal" identity at index 0
  const personalIdentity = await createIdentity(xpriv, 'Personal', 0);
  
  const userMasterKey: UserMasterKey = {
    xpriv,
    identities: [personalIdentity]
  };
  
  return userMasterKey;
}

/**
 * Get the storage identity keypair for vault storage
 * Uses a dedicated derivation path that won't conflict with user identities
 * Path: m/44'/1237'/1'/0/0 (account 1 for storage)
 */
export async function getStorageKeypair(xpriv: string): Promise<{ privateKey: string; publicKey: string }> {
  // Use a special index (2^31 - 1) which is the maximum for non-hardened derivation
  // This ensures it won't conflict with user identities which start from 0
  const STORAGE_INDEX = 2147483647; // Max value for BIP32 non-hardened index
  
  const derived = await cryptoWorker.deriveKeypairFromXpriv({ xpriv, index: STORAGE_INDEX });
  
  // Handle if result is a Map
  if (derived instanceof Map) {
    return {
      privateKey: derived.get('privateKey'),
      publicKey: derived.get('publicKey')
    };
  }
  
  return {
    privateKey: derived.privateKey,
    publicKey: derived.publicKey
  };
}

/**
 * Create a new identity from the master key
 */
export async function createIdentity(xpriv: string, nickname: string, index: number): Promise<any> {
  // Derive the keypair for this identity
  const derived = await cryptoWorker.deriveKeypairFromXpriv({ xpriv, index });
  
  
  // Handle if result is a Map (in case it wasn't converted in worker)
  let path: string;
  let publicKey: string;
  if (derived instanceof Map) {
    path = derived.get('path') || `m/44'/1237'/0'/0/${index}`;
    publicKey = derived.get('publicKey');
  } else {
    path = derived.path || `m/44'/1237'/0'/0/${index}`;
    publicKey = derived.publicKey;
  }
  
  // Return identity with public key for vault storage
  const identity = {
    nickname,
    path,
    publicKey,
    index,
    createdAt: Date.now()
  };
  
  return identity;
}

/**
 * Add a new identity to an existing user
 */
export async function addIdentity(userMasterKey: UserMasterKey, nickname: string): Promise<UserMasterKey> {
  // Find the next available index
  const nextIndex = userMasterKey.identities.length;
  
  // Create the new identity
  const newIdentity = await createIdentity(userMasterKey.xpriv, nickname, nextIndex);
  
  // Return updated user master key
  return {
    ...userMasterKey,
    identities: [...userMasterKey.identities, newIdentity]
  };
}

/**
 * Get the keypair for a specific identity
 */
export async function getIdentityKeypair(xpriv: string, identity: any): Promise<{ privateKey: string; publicKey: string }> {
  // Use index if available, otherwise extract from path
  let index: number;
  
  if (identity.index !== undefined) {
    index = identity.index;
  } else if (identity.path) {
    // Extract the index from the path (m/44'/1237'/0'/0/{index})
    const pathParts = identity.path.split('/');
    index = parseInt(pathParts[pathParts.length - 1], 10);
    
    if (isNaN(index)) {
      throw new Error(`Invalid identity path: ${identity.path}`);
    }
  } else {
    throw new Error('Identity must have either index or path');
  }
  
  const derived = await cryptoWorker.deriveKeypairFromXpriv({ xpriv, index });
  
  // Handle if result is a Map
  if (derived instanceof Map) {
    return {
      privateKey: derived.get('privateKey'),
      publicKey: derived.get('publicKey')
    };
  }
  
  return {
    privateKey: derived.privateKey,
    publicKey: derived.publicKey
  };
}