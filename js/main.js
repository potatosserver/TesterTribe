// Main entry point - imports all modules and initializes the app
import { initializeApp } from './app.js';
import { loadTemplates } from './template-loader.js';
import { setupAuth } from './auth.js';
import { setupTabs } from './tabs.js';
import { initRouter, navigate } from './router.js';

// Make constants globally available for templates
import { DEFAULT_AVATAR, DEFAULT_ICON, PAGE_SIZE } from './constants.js';
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
window.DEFAULT_ICON = DEFAULT_ICON;
window.PAGE_SIZE = PAGE_SIZE;

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  initializeApp();
  setupTabs(); // Initialize tab switching
  initRouter();
});