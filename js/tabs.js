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
  }

  // Close dropdown if open
  window.closeProfileDropdown?.();

  // Navigate to update URL (but don't trigger hashchange loop)
  if (params.appId || params.authorUid) {
    const hash = tabName + (params.appId ? `/${params.appId}` : '') + (params.authorUid ? `/${params.authorUid}` : '');
    if (window.location.hash.slice(1) !== hash) {
      window.location.hash = hash;
    }
  } else if (window.location.hash.slice(1) !== tabName) {
    window.location.hash = tabName;
  }

  // Load data for specific tabs
  if (tabName === 'market') {
    window.fetchMarketApps?.(true);
  } else if (tabName === 'devProfile' && window.currentUser) {
    // dev-profile handles its own loading
  }
}

export function setupTabs() {
  window.switchTab = switchTab;
}