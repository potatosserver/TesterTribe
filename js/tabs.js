// Tab switching module
import { navigate } from './router.js';
import { m3LoginRequired } from './m3-dialog.js';

const PROTECTED_TABS = ['publish'];

export function switchTab(tabName, params = {}) {
  // Check if tab requires authentication
  if (PROTECTED_TABS.includes(tabName) && !window.currentUser) {
    m3LoginRequired('請先登入才能刊登 App 專案');
    return;
  }
  
  // Map market tabs
  let targetTabName = tabName;
  if (tabName === 'market-android') {
    targetTabName = 'market-android';
  } else if (tabName === 'market-ios') {
    targetTabName = 'market-ios';
  } else if (tabName === 'app') {
    targetTabName = 'app-detail'; // The view ID is view-app-detail
  }

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
  
  // Update URL hash
  navigate(tabName, params);
  
  // Update header active button state
  updateMarketTabUI(tabName);
  
  // Close dropdown if open
  window.closeProfileDropdown?.();
  
  // Load data for specific tabs
  if (tabName === 'market-android') {
    window.fetchMarketAppsAndroid?.();
  } else if (tabName === 'market-ios') {
    window.fetchMarketAppsIos?.();
  } else if ((tabName === 'devProfile' || tabName === 'dev-profile') && window.currentUser) {
    // dev-profile handles its own loading
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