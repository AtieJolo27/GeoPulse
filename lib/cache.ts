/**
 * Simple cache utility using the global `localStorage` object.
 *
 * The app already polyfills `localStorage` via expo-sqlite (see supabaseClient.ts),
 * so this works on both web and native Expo Go without needing AsyncStorage.
 *
 * Provides cache-first, then background-refresh pattern for sensor data.
 * This reduces loading jitter and allows offline browsing of last-known data.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Set a cached value with a TTL (time-to-live).
 */
export async function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now() + ttlMs,
  };
  try {
    localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (error) {
    console.warn(`Cache set failed for key "${key}":`, error);
  }
}

/**
 * Get a cached value. Returns null if not found or expired.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.timestamp) {
      // Expired
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn(`Cache get failed for key "${key}":`, error);
    return null;
  }
}

/**
 * Clear a specific cache key.
 */
export async function clearCache(key: string): Promise<void> {
  try {
    localStorage.removeItem(`cache_${key}`);
  } catch (error) {
    console.warn(`Cache clear failed for key "${key}":`, error);
  }
}

/**
 * Clear all caches (prefixed with "cache_").
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cache_')) {
        keys.push(k);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.warn('Clear all caches failed:', error);
  }
}

// Standard cache keys used across the app
export const CACHE_KEYS = {
  SENSOR_READINGS: 'sensor_readings',
  CROP_PREDICTIONS: 'crop_predictions',
  FERTILIZER_PREDICTIONS: 'fertilizer_predictions',
  SOIL_HISTORY: 'soil_history',
  IRRIGATION_RECOMMENDATIONS: 'irrigation_recommendations',
} as const;