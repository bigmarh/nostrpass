/**
 * NostrPass Protocol Configuration
 *
 * This module provides configuration for the NostrPass protocol,
 * allowing it to be used with different vault implementations and namespaces.
 */

export interface NostrPassConfig {
  /**
   * The namespace used for event tags and identification.
   * This allows multiple vault implementations to coexist on Nostr.
   *
   * Examples: 'nostrpass.com', 'myvault.io', 'self-hosted.local'
   *
   * @default 'nostrpass.com'
   */
  namespace: string;

  /**
   * The environment name for data isolation.
   * Different environments have separate event namespaces.
   *
   * @default 'production'
   */
  environment: string;

  /**
   * Default Nostr relays to use for event publishing/fetching.
   *
   * @default ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
   */
  relays: string[];

  /**
   * Enable debug logging
   *
   * @default false
   */
  debug: boolean;
}

/**
 * Global configuration instance
 */
let globalConfig: NostrPassConfig = {
  namespace: 'nostrpass.com',
  environment: 'production',
  relays: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band'
  ],
  debug: false
};

/**
 * Configure the NostrPass protocol
 *
 * @param config - Partial configuration to merge with defaults
 *
 * @example
 * ```typescript
 * // Use a custom vault namespace
 * configureNostrPass({
 *   namespace: 'myvault.io',
 *   environment: 'production'
 * });
 * ```
 */
export function configureNostrPass(config: Partial<NostrPassConfig>): void {
  globalConfig = { ...globalConfig, ...config };

  if (globalConfig.debug) {
    console.log('[NostrPass] Configuration updated:', globalConfig);
  }
}

/**
 * Get the current NostrPass configuration
 *
 * @returns Current configuration
 */
export function getNostrPassConfig(): NostrPassConfig {
  return { ...globalConfig };
}

/**
 * Get the namespace for event tags
 *
 * @returns Current namespace (e.g., 'nostrpass.com')
 */
export function getNamespace(): string {
  return globalConfig.namespace;
}

/**
 * Get the environment name
 *
 * @returns Current environment (e.g., 'production', 'development')
 */
export function getEnvironment(): string {
  // Check runtime environment first
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Fall back to configured environment
  return globalConfig.environment;
}

/**
 * Get default relays
 *
 * @returns Array of relay URLs
 */
export function getDefaultRelays(): string[] {
  return [...globalConfig.relays];
}

/**
 * Set debug mode
 *
 * @param enabled - Enable or disable debug logging
 */
export function setDebugMode(enabled: boolean): void {
  globalConfig.debug = enabled;
}

/**
 * Check if debug mode is enabled
 *
 * @returns True if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return globalConfig.debug;
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  globalConfig = {
    namespace: 'nostrpass.com',
    environment: 'production',
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ],
    debug: false
  };
}
