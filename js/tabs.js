// Tab switching module
import { navigate } from './router.js';
import { m3Alert } from './m3-dialog.js';

const PROTECTED_TABS = ['publish'];

export function switchTab(tabName, params = {}) {
  // Check if tab requires authentication
  if (PROTECTED_TABS.includes(tabName) && !window.currentUser) {
    m3Alert('請先登入才能刊登 App 專案！', '需要登入', { confirmText: '登入' });
    // Redirect to login page
    setTimeout(() => {
      window.navigate('login');
    }, 0);
    return;
  }
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show selected tab
  const targetTab = document.getElementById(`view-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  } else {
    console.warn(`Tab view not found: view-${tabName}`);
  }
  
  // Close dropdown if open
  window.closeProfileDropdown?.();
  
  // Load data for specific tabs
  if (tabName === 'market') {
    window.fetchMarketApps?.(true);
  } else if ((tabName === 'devProfile' || tabName === 'dev-profile') && window.currentUser) {
    // dev-profile handles its own loading
  }
}

export function setupTabs() {
  window.switchTab = switchTab;
}