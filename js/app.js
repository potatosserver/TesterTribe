// App initialization - sets up all feature modules
import { setupTabs } from './tabs.js';
// Market, detail, publish, dev‑profile, and modals are now loaded lazily via the router.
// We keep the imports only for type‑checking / future explicit loads if needed.
import { setupHome } from './home.js';

export function initializeApp() {
  // Initialize all modules
  setupTabs();
  setupHome();
}

// Placeholder setup functions for static pages
export function setupTerms() {}
export function setupPrivacy() {}
export function setupGuidelines() {}
export function setupContact() {}