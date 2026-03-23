/**
 * Chrome Extension constants
 */

// Storage keys
export const STORAGE_KEYS = {
  VAULT_DATA: 'vaultData',
  SESSION: 'session',
  PENDING_REQUEST: 'pendingRequest',
  SETTINGS: 'settings',
} as const;

// Message event names (for page <-> content script communication)
export const MESSAGE_EVENTS = {
  REQUEST: 'nostrpass-request',
  RESPONSE: 'nostrpass-response',
} as const;

// Timeouts
export const TIMEOUTS = {
  PERMISSION_PROMPT: 60000, // 60 seconds
  SESSION_LOCK: 300000, // 5 minutes of inactivity
} as const;

// Extension info
export const EXTENSION_INFO = {
  NAME: 'NostrPass',
  VERSION: '1.0.0',
} as const;
