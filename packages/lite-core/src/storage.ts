import type { KeyValueStore } from './types';

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class BrowserLocalStorageStore implements KeyValueStore {
  constructor(private readonly prefix = 'nostrpass-lite') {}

  private withPrefix(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = globalThis.localStorage?.getItem(this.withPrefix(key));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    globalThis.localStorage?.setItem(this.withPrefix(key), JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(this.withPrefix(key));
  }
}
