import { createWorkerClient } from '@nostrpass/worker-messenger';
import type { Identity, UserMasterKey } from '@nostrpass/types';

// Create worker client
const cryptoWorker = createWorkerClient(
  new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), { type: 'module' })
) as any;

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
 * Create a new identity from the master key
 */
export async function createIdentity(xpriv: string, nickname: string, index: number): Promise<Identity> {
  // Derive the keypair for this identity
  const derived = await cryptoWorker.deriveKeypairFromXpriv({ xpriv, index });
  
  console.log('Derived identity:', derived);
  
  // Handle if result is a Map (in case it wasn't converted in worker)
  let path: string;
  if (derived instanceof Map) {
    path = derived.get('path') || `m/44'/1237'/0'/0/${index}`;
  } else {
    path = derived.path || `m/44'/1237'/0'/0/${index}`;
  }
  
  const identity: Identity = {
    nickname,
    path,
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
export async function getIdentityKeypair(xpriv: string, identity: Identity): Promise<{ privateKey: string; publicKey: string }> {
  if (!identity.path) {
    throw new Error('Identity path is missing');
  }
  
  // Extract the index from the path (m/44'/1237'/0'/0/{index})
  const pathParts = identity.path.split('/');
  const index = parseInt(pathParts[pathParts.length - 1], 10);
  
  if (isNaN(index)) {
    throw new Error(`Invalid identity path: ${identity.path}`);
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