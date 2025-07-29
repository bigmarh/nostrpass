interface KeyPair {
    publicKey: string;
    privateKey: Uint8Array;
  }
  
  interface NostrEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
  }



  export type { KeyPair, NostrEvent };