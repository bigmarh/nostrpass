/**
 * Simple logging utility for workers
 * Provides consistent log formatting with optional level filtering
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = (import.meta.env.MODE === 'production') ? 'warn' : 'debug';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
  return `[${timestamp}] ${emoji} [${context}] ${message}`;
}

export const logger = {
  debug(context: string, message: string, data?: any) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', context, message), data || '');
    }
  },

  info(context: string, message: string, data?: any) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', context, message), data || '');
    }
  },

  warn(context: string, message: string, data?: any) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', context, message), data || '');
    }
  },

  error(context: string, message: string, error?: any) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', context, message), error || '');
    }
  }
};
