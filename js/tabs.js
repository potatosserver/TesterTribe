// Tab switching module
export function setupTabs() {
  window.switchTab = (tabName) => {
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

    // Load data for specific tabs
    if (tabName === 'market') {
      window.fetchMarketApps?.(true);
    } else if (tabName === 'account' && window.currentUser) {
      window.loadMyApps?.();
    }
  };
}