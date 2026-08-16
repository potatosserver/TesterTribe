// Main entry point - imports all modules and initializes the app
import { initializeApp } from './app.js';
import { loadTemplates } from './template-loader.js';
import { setupAuth } from './auth.js';
import { setupTabs } from './tabs.js';
import { setupLogin } from './auth.js';
import { initRouter, navigate } from './router.js';
import { setupMarket } from './market.js';

// Make constants globally available for templates
import { DEFAULT_AVATAR, DEFAULT_ICON, PAGE_SIZE } from './constants.js';
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
window.DEFAULT_ICON = DEFAULT_ICON;
window.PAGE_SIZE = PAGE_SIZE;

// Mobile drawer functions
window.toggleMobileDrawer = function() {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const hamburger = document.getElementById('hamburger-btn');
  if (drawer && backdrop && hamburger) {
    const isOpening = !drawer.classList.contains('active');
    drawer.classList.toggle('active');
    backdrop.classList.toggle('active');
    hamburger.classList.toggle('active', isOpening);
    document.body.style.overflow = drawer.classList.contains('active') ? 'hidden' : '';
  }
};

window.closeMobileDrawer = function(event) {
  // If event is from backdrop or close button, close drawer
  if (event && (event.target.id === 'drawer-backdrop' || event.target.id === 'mobile-drawer')) {
    // Allow - event.stopPropagation() on content prevents this
  } else if (!event) {
    // Manual close
  } else {
    // Click on content, don't close
    return;
  }
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const hamburger = document.getElementById('hamburger-btn');
  if (drawer && backdrop && hamburger) {
    drawer.classList.remove('active');
    backdrop.classList.remove('active');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Close drawer on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('mobile-drawer');
    if (drawer && drawer.classList.contains('active')) {
      window.closeMobileDrawer();
    }
  }
});

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  initializeApp();
  setupAuth(); // Initialize auth (profile dropdown, logout, etc.)
  setupTabs(); // Initialize tab switching
  setupLogin(); // Initialize login page button
  setupMarket(); // Initialize market (must be before initRouter)
  await initRouter();
});