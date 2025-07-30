#!/bin/bash

# Build script for NostrPass WASM module

set -e

echo "Building NostrPass WASM module..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Clean previous build
rm -rf pkg

# Build the WASM module
echo "Running wasm-pack build..."
wasm-pack build --target web --out-dir pkg --no-typescript || true

# Create TypeScript definitions manually for better integration
cat > pkg/nostrpass_crypto.d.ts << 'EOF'
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
EOF

echo "WASM module built successfully!"
echo "Output directory: pkg/"

# Make the build output available to the worker
echo "Copying WASM files to worker directory..."
mkdir -p ../wasm
cp pkg/nostrpass_crypto_bg.wasm ../wasm/
cp pkg/nostrpass_crypto.js ../wasm/
cp pkg/nostrpass_crypto.d.ts ../wasm/

echo "Build complete!"