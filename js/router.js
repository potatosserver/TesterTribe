// Hash-based router for deep linking
// URL Structure: #market/google-play, #market/app-store, #app/google-play/com.example.app, #app/google-play/appId, #dev/google-play/developerName
export const routes = {
  market: { template: 'market', handler: 'setupMarket' },
  appDetail: { template: 'app-detail', handler: 'setupDetail' },
  devProfile: { template: 'dev-profile', handler: 'setupDevProfile' },
  publish: { template: 'publish', handler: 'setupPublish' }
};

const STORE_MAPPING = {
  'google-play': 'android',
  'app-store': 'ios'
};

const REVERSE_STORE_MAPPING = {
  'android': 'google-play',
  'ios': 'app-store'
};

let currentRoute = null;
let routeParams = {};

export function initRouter() {
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange(); // Handle initial load
}

function handleHashChange() {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) {
    navigate('market', { store: 'google-play' });
    return;
  }

  const parts = hash.split('/');
  const routeName = parts[0];
  const route = routes[routeName];
  
  if (!route) {
    navigate('market', { store: 'google-play' });
    return;
  }

  const newParams = {};
  
  if (routeName === 'market') {
    // #market/google-play or #market/app-store
    const store = parts[1] || 'google-play';
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
  } else if (routeName === 'appDetail') {
    // #appDetail/google-play/com.example.app or #appDetail/google-play/appId
    const store = parts[1] || 'google-play';
    const identifier = parts[2];
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
    
    // Try to determine if it's a packageName (contains dots) or appId
    if (identifier && identifier.includes('.')) {
      // Likely a packageName like com.example.app
      newParams.packageName = identifier;
    } else {
      // Treat as appId (Firestore document ID)
      newParams.appId = identifier;
    }
  } else if (routeName === 'devProfile') {
    // #devProfile/google-play/developerName or #devProfile/google-play/uid
    const store = parts[1] || 'google-play';
    const authorIdentifier = parts[2];
    newParams.store = store;
    newParams.platform = STORE_MAPPING[store] || 'android';
    newParams.authorIdentifier = authorIdentifier;
  }

  // Always update route params and trigger switchTab
  routeParams = newParams;
  currentRoute = routeName;
  switchTab(routeName, newParams);
}

export function navigate(routeName, params = {}) {
  let hash = routeName;
  if (params.store) {
    hash += `/${params.store}`;
  }
  if (params.packageName) {
    hash += `/${encodeURIComponent(params.packageName)}`;
  }
  if (params.authorIdentifier) {
    hash += `/${encodeURIComponent(params.authorIdentifier)}`;
  }
  if (params.appId && routeName === 'appDetail') {
    hash += `/${encodeURIComponent(params.appId)}`;
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

export function getAppIdFromUrl() {
  return routeParams.appId;
}

export function getAuthorIdentifierFromUrl() {
  return routeParams.authorIdentifier;
}

// Helper to convert platform to store name
export function platformToStore(platform) {
  return REVERSE_STORE_MAPPING[platform] || 'google-play';
}

// Helper to convert store name to platform
export function storeToPlatform(store) {
  return STORE_MAPPING[store] || 'android';
}