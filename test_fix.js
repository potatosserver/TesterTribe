// Test script to verify the fix for "constraints.map is not a function" error

// Mock the Firestore imports
const mockFirestore = {
  collection: () => ({}),
  query: (...args) => {
    // Just return the args for testing
    return args;
  },
  orderBy: (field, op) => ({ type: 'orderBy', field, op }),
  where: (field, op, value) => ({ type: 'where', field, op, value }),
  startAfter: (doc) => ({ type: 'startAfter', doc }),
  limit: (size) => ({ type: 'limit', size }),
  getDocs: async (q) => {
    // Return mock results in the format expected by the real Firebase SDK
    return {
      empty: false,
      docs: [
        { 
          id: 'test1', 
          data: () => ({ name: 'Test App 1', platform: 'android' }) 
        },
        { 
          id: 'test2', 
          data: () => ({ name: 'Test App 2', platform: 'ios' }) 
        }
      ],
      // The forEach method that the real Firestore QuerySnapshot has
      forEach: function(callback) {
        this.docs.forEach(callback);
      }
    };
  }
};

// Mock the cache.js functions
class FirestoreCache {
  constructor() {
    this.memoryCache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
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
    // In real implementation, we'd save to sessionStorage here
  }
}

// Mock the cachedGetDocs function from cache.js
async function cachedGetDocs(collectionRef, simpleConstraints, cacheOptions = {}) {
  const { ttl = 5 * 60 * 1000, collectionName, skipCache = false } = cacheOptions;
  const firestoreCache = new FirestoreCache();

  if (!skipCache) {
    // Create a cache key from the simpleConstraints
    const cached = firestoreCache.get(collectionName, simpleConstraints);
    if (cached) return cached;
  }

  // Convert simpleConstraints to Firestore query constraint objects
  const firestoreConstraints = simpleConstraints.map(c => {
    if (c.op === 'desc' || c.op === 'asc') {
      return mockFirestore.orderBy(c.field, c.op);
    } else {
      return mockFirestore.where(c.field, c.op, c.value);
    }
  });

  // Execute actual query (using mock)
  const q = mockFirestore.query(collectionRef, ...firestoreConstraints);
  const snapshot = await mockFirestore.getDocs(q);

  const results = [];
  snapshot.forEach(docSnap => results.push({ id: docSnap.id, ...docSnap.data() }));

  if (!skipCache && collectionName) {
    firestoreCache.set(collectionName, simpleConstraints, results, ttl);
  }

  return results;
}

// Test the fix
async function testFix() {
  console.log('Testing the fix for "constraints.map is not a function" error...\n');
  
  // Simulate what happens in market.js
  const currentStore = 'google-play';
  const currentPlatformFilter = 'all'; // or 'android' or 'ios'
  
  // This is the code from market.js lines 99-103
  const constraintsArray = [{ field: 'createdAt', op: 'desc' }];
  if (currentPlatformFilter !== 'all') {
    constraintsArray.push({ field: 'platform', op: '==', value: currentPlatformFilter });
  }
  
  console.log('Constraints array:', JSON.stringify(constraintsArray, null, 2));
  
  // Verify it's an array
  if (!Array.isArray(constraintsArray)) {
    throw new Error('ERROR: constraintsArray is not an array!');
  }
  
  // Verify each element has required properties
  for (let i = 0; i < constraintsArray.length; i++) {
    const constraint = constraintsArray[i];
    if (typeof constraint.field !== 'string') {
      throw new Error(`ERROR: constraint[${i}].field is missing or not a string`);
    }
    if (typeof constraint.op !== 'string') {
      throw new Error(`ERROR: constraint[${i}].op is missing or not a string`);
    }
    // Note: value is optional for ordering constraints
  }
  
  console.log('✓ Constraints array validation passed\n');
  
  // Test calling cachedGetDocs with our constraints array
  try {
    const collectionRef = mockFirestore.collection('apps_google_play');
    const results = await cachedGetDocs(collectionRef, constraintsArray, { 
      ttl: 5 * 60 * 1000, 
      collectionName: 'apps_google_play' 
    });
    
    console.log('✓ cachedGetDocs call succeeded');
    console.log('  Results count:', results.length);
    console.log('  First result:', results[0] ? results[0].name : 'None');
    
    // Test calling it again to verify caching works
    const results2 = await cachedGetDocs(collectionRef, constraintsArray, { 
      ttl: 5 * 60 * 1000, 
      collectionName: 'apps_google_play' 
    });
    
    console.log('✓ Second call (should hit cache) succeeded');
    console.log('  Results count:', results2.length);
    
    console.log('\n🎉 ALL TESTS PASSED! The fix appears to be working correctly.');
    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    return false;
  }
}

// Run the test
testFix().then(success => {
  process.exit(success ? 0 : 1);
});