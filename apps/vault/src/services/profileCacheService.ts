/**
 * Profile Cache Service
 *
 * Caches identity profiles in localStorage for fast access and to prevent UI flickering.
 * Stores profile pictures (as data URLs) and metadata for quick display before vault loads.
 */

interface CachedProfile {
  picture?: string;
  name?: string;
  about?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
}

interface ProfileCacheData {
  [username: string]: {
    [publicKey: string]: CachedProfile;
  };
}

const CACHE_KEY = 'nostrpass_profile_cache';
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit for localStorage

class ProfileCacheService {
  private cache: ProfileCacheData = {};

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
      }
    } catch (error) {
      console.error('[ProfileCache] Failed to load from localStorage:', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to localStorage with size check
   */
  private saveToLocalStorage(): void {
    try {
      const serialized = JSON.stringify(this.cache);

      // Check size limit
      if (serialized.length > MAX_CACHE_SIZE) {
        console.warn('[ProfileCache] Cache size exceeds limit, pruning old entries');
        this.pruneCache();
        return;
      }

      localStorage.setItem(CACHE_KEY, serialized);
    } catch (error) {
      console.error('[ProfileCache] Failed to save to localStorage:', error);

      // If quota exceeded, try to prune
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.pruneCache();
      }
    }
  }

  /**
   * Prune cache by removing entries (oldest first logic could be added)
   */
  private pruneCache(): void {
    // Simple strategy: clear entire cache if too large
    // Could be improved to only remove oldest/largest entries
    this.cache = {};
    localStorage.removeItem(CACHE_KEY);
  }

  /**
   * Cache profiles for a user's identities
   */
  cacheProfiles(username: string, identities: Array<{ publicKey: string; profile?: CachedProfile }>): void {
    if (!this.cache[username]) {
      this.cache[username] = {};
    }

    identities.forEach(identity => {
      if (identity.profile) {
        this.cache[username][identity.publicKey] = identity.profile;
      }
    });

    this.saveToLocalStorage();
  }

  /**
   * Get cached profile for a specific identity
   */
  getProfile(username: string, publicKey: string): CachedProfile | null {
    return this.cache[username]?.[publicKey] || null;
  }

  /**
   * Get all cached profiles for a user
   */
  getAllProfiles(username: string): { [publicKey: string]: CachedProfile } {
    return this.cache[username] || {};
  }

  /**
   * Update a single profile in cache
   */
  updateProfile(username: string, publicKey: string, profile: CachedProfile): void {
    if (!this.cache[username]) {
      this.cache[username] = {};
    }

    this.cache[username][publicKey] = profile;
    this.saveToLocalStorage();
  }

  /**
   * Remove a profile from cache
   */
  removeProfile(username: string, publicKey: string): void {
    if (this.cache[username]) {
      delete this.cache[username][publicKey];
      this.saveToLocalStorage();
    }
  }

  /**
   * Clear all cached profiles for a user
   */
  clearUser(username: string): void {
    delete this.cache[username];
    this.saveToLocalStorage();
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache = {};
    localStorage.removeItem(CACHE_KEY);
  }
}

// Singleton instance
export const profileCacheService = new ProfileCacheService();
