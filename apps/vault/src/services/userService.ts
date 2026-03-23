import type { UserMasterKey } from '@nostrpass/types';
import { STORAGE_INDEX, identityPath } from '@nostrpass/types';
import { getCryptoWorker } from './cryptoWorkerSingleton';

// Get shared worker client
const cryptoWorker = getCryptoWorker() as any;

/**
 * Create a new user with master key and initial "Personal" identity
 */
export async function createUser(): Promise<UserMasterKey> {
  // Generate a new master key (xpriv)
  const result = await cryptoWorker.generateXpriv();
  const xpriv = result.xpriv;

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
    path = derived.get('path') || identityPath(index);
    publicKey = derived.get('publicKey');
  } else {
    path = derived.path || identityPath(index);
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
