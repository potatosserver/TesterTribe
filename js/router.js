import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
// URL Structure: #market/android, #market/ios, #app/google-play/com.example.app, #dev-profile/google-play/user%40email.com, #login, #home, #terms, #privacy, #guidelines, #contact
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
  'contact': { template: 'contact', handler: 'setupContact' }
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
  window.addEventListener('hashchange', handleHashChange);
  await waitForAuth();
  handleHashChange(); // Handle initial load after auth is ready
}

export function handleHashChange() {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) {
    navigate('home');
    return;
  }

  const parts = hash.split('/');
  const routeName = parts[0];
  const route = routes[routeName];
  
  if (!route) {
    navigate('market-android');
    return;
  }

  // Check if route requires authentication
  const PROTECTED_ROUTES = ['publish'];
  if (PROTECTED_ROUTES.includes(routeName) && !window.currentUser) {
    navigate('login');
    // Show alert after navigation
    setTimeout(() => {
      import('./m3-dialog.js').then(({ m3Alert }) => {
        m3Alert('請先登入才能刊登 App 專案！', '需要登入', { confirmText: '登入' });
      });
    }, 0);
    return;
  }

  // Special handling for login page: if already logged in, redirect to own dev profile
  // Use getAuth().currentUser directly since window.currentUser might not be set yet
  const auth = getAuth();
  if (routeName === 'login' && auth.currentUser) {
    const store = getStoreFromUrl();
    window.navigate('dev-profile', { store, authorEmail: auth.currentUser.email });
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
    const store = parts[1] || 'google-play';
    const email = parts[2];
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
    if (email) {
      newParams.authorEmail = decodeURIComponent(email);
    }
  } else if (routeName === 'terms' || routeName === 'privacy' || routeName === 'guidelines' || routeName === 'contact') {
    // Static pages - no additional params needed
  }

  routeParams = newParams;
  currentRoute = routeName;
  switchTab(routeName, newParams);
  
  // Load data for detail and dev-profile tabs when navigating via URL
  if (routeName === 'app') {
    const store = getStoreFromUrl();
    window.openAppDetail(getPackageNameFromUrl(), store);
  } else if (routeName === 'dev-profile') {
    window.openDevProfile();
  }
}

export function navigate(routeName, params = {}) {
  let hash = routeName;
  
  if (routeName === 'home') {
    // No additional params needed
  } else if (routeName === 'market-android' || routeName === 'market-ios') {
    // No additional params needed
  } else if (routeName === 'app') {
    const store = params.store || 'google-play';
    hash += `/${store}`;
    if (params.packageName) {
      hash += `/${encodeURIComponent(params.packageName)}`;
    }
  } else if (routeName === 'dev-profile') {
    const store = params.store || 'google-play';
    hash += `/${store}`;
    if (params.authorEmail) {
      hash += `/${encodeURIComponent(params.authorEmail)}`;
    }
  }
  
  window.location.hash = hash;
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