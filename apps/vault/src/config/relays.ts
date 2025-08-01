/**
 * Relay configuration for different environments and use cases
 */

export interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
  requiresAuth?: boolean;
  requiresPow?: boolean;
  powDifficulty?: number;
  priority?: number; // Lower number = higher priority
}

// Relays known to work well for vault storage (low/no PoW requirements)
export const VAULT_FRIENDLY_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.damus.io',
    read: true,
    write: true,
    requiresPow: false,
    priority: 1
  },
  {
    url: 'wss://relay.nostr.band',
    read: true,
    write: true,
    requiresPow: false,
    priority: 2
  },
  {
    url: 'wss://nos.lol',
    read: true,
    write: true,
    requiresPow: false,
    priority: 3
  },
  {
    url: 'wss://relay.snort.social',
    read: true,
    write: true,
    requiresPow: true,
    powDifficulty: 10, // Usually lower than 28
    priority: 4
  }
];

// Get relay URLs based on priority and PoW requirements
export function getVaultRelays(maxPowDifficulty: number = 0): string[] {
  return VAULT_FRIENDLY_RELAYS
    .filter(relay => {
      // Skip relays that require PoW above our threshold
      if (relay.requiresPow && relay.powDifficulty && relay.powDifficulty > maxPowDifficulty) {
        return false;
      }
      return relay.write;
    })
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))
    .map(relay => relay.url);
}

// Production recommendation for vault storage
export const PRODUCTION_VAULT_RELAYS = getVaultRelays(0); // No PoW relays only