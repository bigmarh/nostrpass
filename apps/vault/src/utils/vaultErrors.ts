export class VaultError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export class VaultNotFoundError extends VaultError {
  constructor(username?: string) {
    super(
      `Vault not found${username ? ` for user: ${username}` : ''}`,
      'VAULT_NOT_FOUND'
    );
  }
}

export class VaultLockedError extends VaultError {
  constructor() {
    super('Vault is locked. Please unlock with password.', 'VAULT_LOCKED');
  }
}

export class InvalidPasswordError extends VaultError {
  constructor() {
    super('Invalid password', 'INVALID_PASSWORD');
  }
}

export class InvalidPinError extends VaultError {
  constructor() {
    super('Invalid PIN', 'INVALID_PIN');
  }
}

export class SessionExpiredError extends VaultError {
  constructor() {
    super('Session has expired. Please unlock vault again.', 'SESSION_EXPIRED');
  }
}

export class NetworkError extends VaultError {
  constructor(message: string, details?: any) {
    super(`Network error: ${message}`, 'NETWORK_ERROR', details);
  }
}

export class EncryptionError extends VaultError {
  constructor(message: string) {
    super(`Encryption error: ${message}`, 'ENCRYPTION_ERROR');
  }
}

export class SyncError extends VaultError {
  constructor(message: string, details?: any) {
    super(`Sync error: ${message}`, 'SYNC_ERROR', details);
  }
}

export class WorkerError extends VaultError {
  constructor(message: string, details?: any) {
    super(`Worker error: ${message}`, 'WORKER_ERROR', details);
  }
}

export function isVaultError(error: any): error is VaultError {
  return error instanceof VaultError;
}

export function handleVaultError(error: any): VaultError {
  if (isVaultError(error)) {
    return error;
  }

  // Check for specific error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('vault not found') || message.includes('no vault found')) {
      return new VaultNotFoundError();
    }
    
    if (message.includes('session not unlocked') || message.includes('vault is locked')) {
      return new VaultLockedError();
    }
    
    if (message.includes('invalid password')) {
      return new InvalidPasswordError();
    }
    
    if (message.includes('invalid pin')) {
      return new InvalidPinError();
    }
    
    if (message.includes('session expired')) {
      return new SessionExpiredError();
    }
    
    if (message.includes('network') || message.includes('relay')) {
      return new NetworkError(error.message);
    }
    
    if (message.includes('encrypt') || message.includes('decrypt')) {
      return new EncryptionError(error.message);
    }
    
    if (message.includes('worker')) {
      return new WorkerError(error.message);
    }
  }

  // Generic error
  return new VaultError(
    error?.message || 'An unknown error occurred',
    'UNKNOWN_ERROR',
    error
  );
}