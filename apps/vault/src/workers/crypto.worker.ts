import { createWorkerHost } from '@nostrpass/worker-messenger';
import init, { NostrCrypto } from './wasm/nostrpass_crypto.js';

// Initialize WASM module
let wasmReady = false;
let cryptoInstance: NostrCrypto | null = null;

async function ensureWasmReady() {
  if (!wasmReady) {
    // Load WASM module
    await init();
    cryptoInstance = new NostrCrypto();
    wasmReady = true;
    console.log('WASM module initialized in worker');
  }
  if (!cryptoInstance) {
    throw new Error('WASM crypto instance not initialized');
  }
  return cryptoInstance;
}

interface GenerateKeypairParams {
  seed?: string;
}

interface GenerateKeypairResult {
  publicKey: string;
  privateKey: string;
}

interface SignEventParams {
  event: {
    id?: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
    sig?: string;
  };
  privateKey: string;
}

interface SignEventResult {
  event: {
    id: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: string;
    sig: string;
  };
}

interface EncryptParams {
  plaintext: string;
  recipientPubkey: string;
  privateKey: string;
}

interface DecryptParams {
  ciphertext: string;
  senderPubkey: string;
  privateKey: string;
}

interface DeriveKeyParams {
  password: string;
  salt?: string;
}

interface DeriveKeyResult {
  key: string;
  salt: string;
}

interface EncryptDataParams {
  data: string;
  password: string;
}

interface DecryptDataParams {
  encryptedData: string;
  password: string;
}

interface GenerateXprivResult {
  xpriv: string;
}

interface DeriveKeypairFromXprivParams {
  xpriv: string;
  index: number;
}

interface DeriveKeypairFromXprivResult {
  privateKey: string;
  publicKey: string;
  path: string;
}

interface SignMessageParams {
  message: string;
  privateKey: string;
}

interface SignMessageResult {
  signature: string;
}

const handlers = {
  generateKeypair: async (_params: GenerateKeypairParams): Promise<GenerateKeypairResult> => {
    const crypto = await ensureWasmReady();
    return crypto.generateKeypair();
  },

  signEvent: async (params: SignEventParams): Promise<SignEventResult> => {
    const crypto = await ensureWasmReady();
    const signedEvent = crypto.signEvent(params.event, params.privateKey);
    return { event: signedEvent };
  },

  signMessage: async (params: SignMessageParams): Promise<SignMessageResult> => {
    const crypto = await ensureWasmReady();
    return { signature: crypto.signMessage(params.message, params.privateKey) };
  },

  calculateEventId: async (params: { event: any }): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.calculateEventId(params.event);
  },

  getPublicKey: async (params: { privateKey: string }): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.getPublicKey(params.privateKey);
  },

  encrypt: async (params: EncryptParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.nip04Encrypt(
      params.plaintext,
      params.privateKey,
      params.recipientPubkey
    );
  },

  decrypt: async (params: DecryptParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.nip04Decrypt(
      params.ciphertext,
      params.privateKey,
      params.senderPubkey
    );
  },

  deriveKey: async (params: DeriveKeyParams): Promise<DeriveKeyResult> => {
    const crypto = await ensureWasmReady();
    return crypto.deriveKeyFromPassword(params.password, params.salt);
  },

  encryptData: async (params: EncryptDataParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.encryptData(params.data, params.password);
  },

  decryptData: async (params: DecryptDataParams): Promise<string> => {
    const crypto = await ensureWasmReady();
    return crypto.decryptData(params.encryptedData, params.password);
  },

  generateXpriv: async (): Promise<GenerateXprivResult> => {
    const crypto = await ensureWasmReady();
    return { xpriv: crypto.generateXpriv() };
  },

  deriveKeypairFromXpriv: async (params: DeriveKeypairFromXprivParams): Promise<DeriveKeypairFromXprivResult> => {
    const crypto = await ensureWasmReady();
    return crypto.deriveKeypairFromXpriv(params.xpriv, params.index);
  },
};

export type CryptoWorkerMethods = typeof handlers;

// Initialize the worker host
createWorkerHost(handlers as any);

// Pre-initialize WASM on worker startup
ensureWasmReady()
  .then(() => {
    console.log('WASM crypto module ready');
  })
  .catch(console.error);