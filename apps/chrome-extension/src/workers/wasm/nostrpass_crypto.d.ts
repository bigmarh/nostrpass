/* tslint:disable */
/* eslint-disable */

export class NostrCrypto {
  free(): void;
  constructor();
  
  generateKeypair(): {
    privateKey: string;
    publicKey: string;
  };
  
  getPublicKey(privateKey: string): string;
  
  signEvent(event: {
    id?: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig?: string;
  }, privateKey: string): {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
  
  calculateEventId(event: {
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
  }): string;
  
  nip04Encrypt(
    plaintext: string,
    senderPrivateKey: string,
    recipientPublicKey: string
  ): string;
  
  nip04Decrypt(
    ciphertext: string,
    recipientPrivateKey: string,
    senderPublicKey: string
  ): string;
  
  deriveKeyFromPassword(
    password: string,
    salt?: string
  ): {
    key: string;
    salt: string;
  };
  
  encryptData(data: string, password: string): string;
  
  decryptData(encryptedData: string, password: string): string;
  
  generateXpriv(): string;
  
  deriveKeypairFromXpriv(xpriv: string, index: number): any;
  
  signMessage(message: string, privateKey: string): string;
}

export function init(): void;

export default function init(module_or_path?: any): Promise<any>;
