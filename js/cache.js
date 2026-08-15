// Firestore Cache Layer - Reduces redundant database calls
// Uses in-memory cache with TTL and sessionStorage persistence

class FirestoreCache {
  constructor() {
    this.memoryCache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.loadFromSessionStorage();
  }

  // Generate cache key from collection, query constraints
  getCacheKey(collectionName, constraints = []) {
    const constraintStr = constraints.map(c => {
      // For ordering constraints, there is no value
      if (c.op === 'desc' || c.op === 'asc') {
        return `${c.field}_${c.op}`;
      }
      return `${c.field}_${c.op}_${c.value}`;
    }).join('|');
    return `${collectionName}:${constraintStr}`;
  }

  // Load cache from sessionStorage on init
  loadFromSessionStorage() {
    try {
      const stored = sessionStorage.getItem('firestore_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, value]) => {
          if (value.expires > now) {
            this.memoryCache.set(key, value);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load cache from sessionStorage:', e);
    }
  }

  // Save cache to sessionStorage
  saveToSessionStorage() {
    try {
      const now = Date.now();
      const toStore = {};
      this.memoryCache.forEach((value, key) => {
        if (value.expires > now) {
          toStore[key] = value;
        }
      });
      sessionStorage.setItem('firestore_cache', JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to save cache to sessionStorage:', e);
    }
  }

  // Get cached data if valid
  get(collectionName, constraints = []) {
    const key = this.getCacheKey(collectionName, constraints);
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      console.log(`[Cache HIT] ${key}`);
      return cached.data;
    }
    console.log(`[Cache MISS] ${key}`);
    return null;
  }

  // Set cache with TTL
  set(collectionName, constraints, data, ttl = this.defaultTTL) {
    const key = this.getCacheKey(collectionName, constraints);
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttl
    });
    this.saveToSessionStorage();
  }

  // Invalidate cache for a collection (or specific query)
  invalidate(collectionName, constraints = null) {
    if (constraints) {
      const key = this.getCacheKey(collectionName, constraints);
      this.memoryCache.delete(key);
    } else {
      // Invalidate all keys for this collection
      const prefix = `${collectionName}:`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
    }
    this.saveToSessionStorage();
  }

  // Clear all cache
  clear() {
    this.memoryCache.clear();
    sessionStorage.removeItem('firestore_cache');
  }
}

// Singleton instance
export const firestoreCache = new FirestoreCache();

// Helper to wrap Firestore queries with caching
export async function cachedGetDocs(collectionRef, simpleConstraints, cacheOptions = {}) {
  const { ttl = 5 * 60 * 1000, collectionName, skipCache = false } = cacheOptions;

  // Import Firestore functions we need - USE SAME VERSION AS ELSEWHERE
  const { query, getDocs, orderBy, where } = await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');

  if (!skipCache) {
    // Create a cache key from the simpleConstraints
    const cached = firestoreCache.get(collectionName, simpleConstraints);
    if (cached) return cached;
  }

  // Convert simpleConstraints to Firestore query constraint objects
  const firestoreConstraints = simpleConstraints.map(c => {
    if (c.op === 'desc' || c.op === 'asc') {
      return orderBy(c.field, c.op);
    } else {
      return where(c.field, c.op, c.value);
    }
  });

  // Execute actual query
  const q = query(collectionRef, ...firestoreConstraints);
  const snapshot = await getDocs(q);

  const results = [];
  snapshot.forEach(docSnap => results.push({ id: docSnap.id, ...docSnap.data() }));

  if (!skipCache && collectionName) {
    firestoreCache.set(collectionName, simpleConstraints, results, ttl);
  }

  return results;
}

// Invalidate cache when data is modified
export function invalidateCache(collectionName, constraints = null) {
  firestoreCache.invalidate(collectionName, constraints);
}

export default firestoreCache;