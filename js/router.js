import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
// URL Structure: /market/android, /market/ios, /app/android/com.example.app, /dev-profile/userId, /login, /home, /terms, /privacy, /guidelines, /contact
export const routes = {
  'home': { template: 'home', handler: 'setupHome' },
  'market': { template: 'market', handler: 'setupMarket' },
  'market-android': { template: 'market', handler: 'setupMarket' },
  'market-ios': { template: 'market', handler: 'setupMarket' },
  'app': { template: 'app-detail', handler: 'setupDetail' },
  'dev-profile': { template: 'dev-profile', handler: 'setupDevProfile' },
  'publish': { template: 'publish', handler: 'setupPublish' },
  'login': { template: 'login', handler: 'setupLogin' },
  'terms': { template: 'terms', handler: 'setupTerms' },
  'privacy': { template: 'privacy', handler: 'setupPrivacy' },
  'guidelines': { template: 'guidelines', handler: 'setupGuidelines' },
  'contact': { template: 'contact', handler: 'setupContact' },
  '404': { template: '404', handler: null }
};

const STORE_MAPPING = {
  'google-play': 'android',
  'app-store': 'ios'
};

const REVERSE_STORE_MAPPING = {
  'android': 'android',
  'ios': 'ios'
};

let currentRoute = null;
let routeParams = {};
let authReady = false;

// Wait for auth state to be determined
function waitForAuth() {
  return new Promise((resolve) => {
    if (authReady) {
      resolve();
      return;
    }
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, () => {
      authReady = true;
      unsubscribe();
      resolve();
    });
    // Timeout fallback
    setTimeout(() => {
      authReady = true;
      unsubscribe();
      resolve();
    }, 3000);
  });
}

export async function initRouter() {
  window.navigate = navigate; // Mount to window for global access
  window.getStoreFromUrl = getStoreFromUrl;
  window.getPlatformFromUrl = getPlatformFromUrl;
  window.getPackageNameFromUrl = getPackageNameFromUrl;
  window.getAuthorEmailFromUrl = getAuthorEmailFromUrl;
  window.addEventListener('popstate', handlePopState);
  await waitForAuth();
  handlePopState(); // Handle initial load after auth is ready
}

export function handlePopState() {
  const path = window.location.pathname;
  // Remove leading slash and split
  const parts = path.split('/').filter(p => p);
  const routeName = parts[0] || 'home';
  const route = routes[routeName];
  
  if (!route) {
    // Replace current history entry instead of pushing new one
    window.history.replaceState({}, '', '/404');
    // Apply 404 route
    applyRoute('404', {});
    return;
  }

  // Check if route requires authentication
  const PROTECTED_ROUTES = ['publish'];
  // Use auth.currentUser directly to avoid race condition with window.currentUser
  const auth = getAuth();
  if (PROTECTED_ROUTES.includes(routeName) && !auth.currentUser) {
    // Replace current history entry instead of pushing new one
    window.history.replaceState({}, '', '/login');
    // Show alert after navigation
    setTimeout(() => {
      import('./m3-dialog.js').then(({ m3Alert }) => {
        m3Alert('請先登入才能刊登 App 專案！', '需要登入', { confirmText: '登入' });
      });
    }, 0);
    applyRoute('login', {});
    return;
  }

  // Special handling for login page: if already logged in, redirect to own dev profile
  if (routeName === 'login' && auth.currentUser) {
    // Replace current history entry - new URL structure without store
    window.history.replaceState({}, '', `/dev-profile/${encodeURIComponent(auth.currentUser.uid)}`);
    applyRoute('dev-profile', { authorUid: auth.currentUser.uid });
    return;
  }

  const newParams = {};
  
  if (routeName === 'home') {
    // Home route - no additional params needed
  } else if (routeName === 'market-android' || routeName === 'market-ios') {
    const platform = routeName === 'market-android' ? 'android' : 'ios';
    const store = routeName === 'market-android' ? 'google-play' : 'app-store';
    newParams.platform = platform;
    newParams.store = store;
  } else if (routeName === 'market') {
    // Legacy redirect
    navigate('market-android');
    return;
  } else if (routeName === 'app') {
    const store = parts[1] || 'google-play';
    const packageName = parts[2];
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
    if (packageName) {
      newParams.packageName = decodeURIComponent(packageName);
    }
  } else if (routeName === 'dev-profile') {
    // New URL structure: /dev-profile/{authorUid}
    const identifier = parts[1];
    if (identifier) {
      // Check if it's a UID (no @) or email (has @)
      if (identifier.includes('@')) {
        newParams.authorEmail = decodeURIComponent(identifier);
        // Mark for URL migration to UID-based URL
        newParams._migrateToUid = true;
      } else {
        newParams.authorUid = decodeURIComponent(identifier);
      }
    }
  } else if (routeName === 'terms' || routeName === 'privacy' || routeName === 'guidelines' || routeName === 'contact') {
    // Static pages - no additional params needed
  }

  applyRoute(routeName, newParams);
}

// Internal: apply route without pushing history (used by popstate and initial load)
function applyRoute(routeName, newParams) {
  routeParams = newParams;
  currentRoute = routeName;
  // internal navigation to avoid pushing history again
  switchTab(routeName, newParams, true);

  // Load data for detail and dev‑profile tabs when navigating via URL
  if (routeName === 'app') {
    // Dynamically import the detail module only when needed
    import('./detail.js')
      .then(mod => {
        // setupDetail() attaches openAppDetail to window
        if (typeof mod.setupDetail === 'function') mod.setupDetail();
        const store = getStoreFromUrl();
        // skipNavigation=true because navigate() was already called (or this is initial load from popstate)
        if (typeof window.openAppDetail === 'function') {
          window.openAppDetail(getPackageNameFromUrl(), store, true);
        }
      })
      .catch(err => console.error('[Router] Failed to load detail module:', err));
  } else if (routeName === 'dev-profile') {
    // Lazy‑load dev‑profile module and ensure it is initialised before use
    import('./dev-profile.js')
      .then(mod => {
        if (typeof mod.setupDevProfile === 'function') {
          mod.setupDevProfile();
        }
        if (typeof window.openDevProfile === 'function') {
          window.openDevProfile();
        } else if (typeof mod.openDevProfile === 'function') {
          mod.openDevProfile();
        }
      })
      .catch(err => console.error('[Router] Failed to load dev‑profile module:', err));
  }
}

export function navigate(routeName, params = {}) {
  let path = '/' + routeName;
  const newParams = {};
  
  if (routeName === 'home') {
    // No additional params needed
  } else if (routeName === 'market-android' || routeName === 'market-ios') {
    const platform = routeName === 'market-android' ? 'android' : 'ios';
    const store = routeName === 'market-android' ? 'google-play' : 'app-store';
    newParams.platform = platform;
    newParams.store = store;

    import('./market.js')
      .then(mod => {
        if (typeof mod.setupMarket === 'function') {
          mod.setupMarket();
        }
        if (typeof window.ensureMarketPlatform === 'function') {
          window.ensureMarketPlatform(platform);
        }
      })
      .catch(err => console.error('[Router] Failed to load market module:', err));
  } else if (routeName === 'market') {
    // Legacy redirect - use replaceState to avoid history pollution
    window.history.replaceState({}, '', '/market-android');
    applyRoute('market-android', { platform: 'android', store: 'google-play' });
    return;
  } else if (routeName === 'app') {
    const store = params.store || 'google-play';
    path += `/${store}`;
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
    if (params.packageName) {
      path += `/${encodeURIComponent(params.packageName)}`;
      newParams.packageName = params.packageName;
    }
  } else if (routeName === 'dev-profile') {
    // New URL structure: /dev-profile/{authorUid} (no store)
    if (params.authorUid) {
      path += `/${encodeURIComponent(params.authorUid)}`;
      newParams.authorUid = params.authorUid;
    } else if (params.authorEmail) {
      // Backward compatibility: support authorEmail in URL
      path += `/${encodeURIComponent(params.authorEmail)}`;
      newParams.authorEmail = params.authorEmail;
    }
    // Lazy‑load the dev‑profile module and initialise it before use
    import('./dev-profile.js')
      .then(mod => {
        // Ensure the global helper is set (idempotent)
        if (typeof mod.setupDevProfile === 'function') {
          mod.setupDevProfile();
        }
        if (typeof mod.openDevProfile === 'function') {
          mod.openDevProfile();
        }
      })
      .catch(err => console.error('[Router] Failed to load dev‑profile module:', err));
  } else if (routeName === 'login') {
    // No additional params needed
  } else if (routeName === 'terms' || routeName === 'privacy' || routeName === 'guidelines' || routeName === 'contact') {
    // Static pages - no additional params needed
  }
  
  window.history.pushState({}, '', path);
  // Apply route directly without re-parsing (avoids double applyRoute)
  applyRoute(routeName, newParams);
}

// Getters for modules
export function getCurrentRoute() {
  return currentRoute;
}

export function getRouteParams() {
  return routeParams;
}

export function getStoreFromUrl() {
  return routeParams.store || 'google-play';
}

export function getPlatformFromUrl() {
  return routeParams.platform || 'android';
}

export function getPackageNameFromUrl() {
  return routeParams.packageName;
}

export function getAuthorEmailFromUrl() {
  return routeParams.authorEmail;
}

export function getAuthorUidFromUrl() {
  return routeParams.authorUid;
}

// Helper to convert platform to store name
export function platformToStore(platform) {
  return REVERSE_STORE_MAPPING[platform] || 'google-play';
}

// Helper to convert store name to platform
export function storeToPlatform(store) {
  return STORE_MAPPING[store] || 'android';
}

// Attach to window for global use in inline event handlers
window.getStoreFromUrl = getStoreFromUrl;
window.getPlatformFromUrl = getPlatformFromUrl;
window.getPackageNameFromUrl = getPackageNameFromUrl;
window.getAuthorEmailFromUrl = getAuthorEmailFromUrl;
window.getRouteParams = () => routeParams;