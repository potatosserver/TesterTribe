// Tab switching module
import { navigate } from './router.js';
import { m3LoginRequired } from './m3-dialog.js';

const PROTECTED_TABS = ['publish'];

// Tab name to view ID mapping (single source of truth)
const TAB_VIEW_MAP = {
  'home': 'home',
  'market-android': 'market-android',
  'market-ios': 'market-ios',
  'app': 'app-detail',
  'dev-profile': 'dev-profile',
  'publish': 'publish',
  'login': 'login',
  'terms': 'terms',
  'privacy': 'privacy',
  'guidelines': 'guidelines',
  'contact': 'contact',
  '404': '404'
};

// Internal flag to prevent navigate() loop
let isInternalNavigation = false;

export function switchTab(tabName, params = {}, internal = false) {
  // Check if tab requires authentication (only for user-initiated navigation)
  if (!internal && PROTECTED_TABS.includes(tabName) && !window.currentUser) {
    m3LoginRequired('請先登入才能刊登 App 專案');
    return;
  }
  
  // Map tab names to view IDs using centralized map
  const targetTabName = TAB_VIEW_MAP[tabName] || tabName;

  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show selected tab
  const targetTab = document.getElementById(`view-${targetTabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  } else {
    console.warn(`Tab view not found: view-${targetTabName}`);
  }
  
  // Update URL only for user-initiated navigation
  if (!internal) {
    navigate(tabName, params);
  }
  
  // Update header active button state
  updateMarketTabUI(tabName);
  
  // Close dropdown if open
  window.closeProfileDropdown?.();
  
  // Load data for specific tabs
  if (tabName === 'market-android') {
    console.log('[Tabs Debug] market-android tab selected, ensureMarketPlatform exists:', typeof window.ensureMarketPlatform);
    if (typeof window.ensureMarketPlatform === 'function') {
      window.ensureMarketPlatform('android');
    } else {
      console.warn('[Tabs Debug] market module not loaded yet, importing market.js');
      import('./market.js').then(mod => {
        if (typeof mod.setupMarket === 'function') mod.setupMarket();
        if (typeof window.ensureMarketPlatform === 'function') {
          window.ensureMarketPlatform('android');
        }
      });
    }
  } else if (tabName === 'market-ios') {
    console.log('[Tabs Debug] market-ios tab selected, ensureMarketPlatform exists:', typeof window.ensureMarketPlatform);
    if (typeof window.ensureMarketPlatform === 'function') {
      window.ensureMarketPlatform('ios');
    } else {
      console.warn('[Tabs Debug] market module not loaded yet, importing market.js');
      import('./market.js').then(mod => {
        if (typeof mod.setupMarket === 'function') mod.setupMarket();
        if (typeof window.ensureMarketPlatform === 'function') {
          window.ensureMarketPlatform('ios');
        }
      });
    }
  } else if (tabName === 'dev-profile' && window.currentUser) {
    // dev-profile handles its own loading
  } else if (tabName === 'home') {
    window.refreshHomeStats?.();
  }
}

function updateMarketTabUI(tabName) {
  const androidBtn = document.getElementById('btn-market-android');
  const iosBtn = document.getElementById('btn-market-ios');
  if (androidBtn && iosBtn) {
    androidBtn.classList.toggle('active', tabName === 'market-android');
    iosBtn.classList.toggle('active', tabName === 'market-ios');
  }
  // Update mobile nav items
  const mobileAndroidBtn = document.querySelector('.mobile-nav-item[onclick*="market-android"]');
  const mobileIosBtn = document.querySelector('.mobile-nav-item[onclick*="market-ios"]');
  if (mobileAndroidBtn && mobileIosBtn) {
    mobileAndroidBtn.classList.toggle('active', tabName === 'market-android');
    mobileIosBtn.classList.toggle('active', tabName === 'market-ios');
  }
}

export function setupTabs() {
  window.switchTab = switchTab;
}