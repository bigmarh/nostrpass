import { createMemo } from 'solid-js';
import { useVault } from './useVault';
import { VaultStorageService } from '../services/vaultStorageService';

// Default relays - should come from config
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net'
];

export function useVaultStorage(relays: string[] = DEFAULT_RELAYS) {
  const vaultService = useVault();
  
  const storageService = createMemo(() => new VaultStorageService({
    relays,
    vaultService
  }));
  
  return storageService();
}