// Main entry point - imports all modules and initializes the app
import { initializeApp } from './app.js';
import { loadTemplates } from './template-loader.js';
import { setupAuth } from './auth.js';
import { setupTabs } from './tabs.js';
import { setupMarket } from './market.js';
import { setupDevProfile } from './dev-profile.js';
import { setupAccount } from './account.js';
import { setupPublish } from './publish.js';
import { setupDetail } from './detail.js';
import { setupModals } from './modals.js';
import { DEFAULT_AVATAR, DEFAULT_ICON, PAGE_SIZE } from './constants.js';

// Make constants globally available for templates
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
window.DEFAULT_ICON = DEFAULT_ICON;
window.PAGE_SIZE = PAGE_SIZE;

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  initializeApp();
});

// Global state
window.currentUser = null;
window.loadedMarketApps = [];
window.lastVisibleDoc = null;
window.currentEditingAppId = null;
window.currentDetailAppId = null;
window.currentFeedbackAppId = null;