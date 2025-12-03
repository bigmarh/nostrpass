/**
 * Debug logging utility
 *
 * In development: All logs are output to console
 * In production: Logs are silent unless explicitly enabled
 *
 * To enable debug logs in production, run in browser console:
 *   localStorage.setItem('nostrpass:debug', 'true')
 */

// Check if we're in production and if debug is explicitly enabled
const isProduction = import.meta.env.PROD;
const isDebugEnabled = typeof window !== 'undefined' &&
  window.localStorage?.getItem('nostrpass:debug') === 'true';

// Only log in development, or in production if explicitly enabled
const shouldLog = !isProduction || isDebugEnabled;

/**
 * Debug log - silent in production unless debug flag is set
 */
export const debug = shouldLog ? console.log.bind(console) : () => {};

/**
 * Debug error - always logs errors (critical for debugging issues)
 */
export const debugError = console.error.bind(console);

/**
 * Debug warn - always logs warnings
 */
export const debugWarn = console.warn.bind(console);

/**
 * Debug info - silent in production unless debug flag is set
 */
export const debugInfo = shouldLog ? console.info.bind(console) : () => {};
