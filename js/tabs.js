// Tab switching module
import { navigate } from './router.js';

export function switchTab(tabName, params = {}) {
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