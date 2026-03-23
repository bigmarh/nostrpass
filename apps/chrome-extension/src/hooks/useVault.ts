import { createMemo } from 'solid-js';
import { useCryptoWorker } from '../providers/CryptoWorkerProvider';
import { VaultService } from '../services/vaultService';

export function useVault() {
  const cryptoWorker = useCryptoWorker();
  
  const vaultService = createMemo(() => new VaultService(cryptoWorker));
  
  return vaultService();
}