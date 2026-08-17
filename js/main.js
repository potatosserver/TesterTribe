// Main entry point - imports all modules and initializes the app
import { initializeApp } from './app.js';
import { loadTemplates } from './template-loader.js';
import { setupAuth, initAuthPersistence } from './auth.js';
import { setupTabs } from './tabs.js';
import { setupLogin } from './auth.js';
import { initRouter, navigate } from './router.js';
import { 
  setupLazyImages, 
  trapFocus, 
  animateCountUpElements,
  toast 
} from './utils.js';

// Make constants globally available for templates
import { DEFAULT_AVATAR, DEFAULT_ICON, PAGE_SIZE } from './constants.js';
window.DEFAULT_AVATAR = DEFAULT_AVATAR;
window.DEFAULT_ICON = DEFAULT_ICON;
window.PAGE_SIZE = PAGE_SIZE;

// Make toast globally available
window.toast = toast;

// Initialize auth persistence early (before any auth operations)
initAuthPersistence();

// Mobile drawer functions
let drawerFocusCleanup = null;

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
    
    // Focus trap for accessibility
    if (isOpening) {
      drawerFocusCleanup = trapFocus(drawer);
    } else if (drawerFocusCleanup) {
      drawerFocusCleanup();
      drawerFocusCleanup = null;
    }
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
    if (drawerFocusCleanup) {
      drawerFocusCleanup();
      drawerFocusCleanup = null;
    }
  }
};

// Go to market function (used by header logo click)
window.goToMarket = function() {
  const store = window.getStoreFromUrl();
  window.navigate('market', {store});
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }
  
  // / - Focus search (on market page)
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  }
  
  // G - Go to Home
  if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
    const store = window.getStoreFromUrl();
    window.navigate('home', {store});
  }
  
  // M - Go to Market
  if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
    const store = window.getStoreFromUrl();
    window.navigate('market', {store});
  }
  
  // P - Go to Publish
  if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
    window.navigate('publish');
  }
  
  // D - Go to Dev Profile (if logged in)
  if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
    if (window.currentUser) {
      window.navigate('dev-profile');
    }
  }
});

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  initializeApp();
  setupTabs(); // Initialize tab switching
  setupLogin(); // Initialize login page button
  await initRouter();
  
  // Handle redirect result after router is initialized (navigate is available)
  const { handleRedirectResult } = await import('./auth.js');
  handleRedirectResult();
  
  // Initialize lazy loading for images
  setupLazyImages();
  
  // Initialize count-up animations for hero stats
  animateCountUpElements('.stat-number[data-count]', { duration: 1500 });
  
  // Initialize count-up for platform stats on home page
  animateCountUpElements('#android-project-count, #android-dev-count, #ios-project-count, #ios-dev-count', { duration: 1200 });
  
  // Initialize count-up for dev profile stats
  animateCountUpElements('#dev-stat-apps, #dev-stat-testers, #dev-stat-likes', { duration: 1200 });
  
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);
      })
      .catch((error) => {
        console.log('[SW] Registration failed:', error);
      });
  }
});