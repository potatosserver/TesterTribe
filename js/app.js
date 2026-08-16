// App initialization - sets up all feature modules
import { setupAuth } from './auth.js';
import { setupTabs } from './tabs.js';
import { setupMarket } from './market.js';
import { setupDevProfile } from './dev-profile.js';
import { setupPublish } from './publish.js';
import { setupDetail } from './detail.js';
import { setupModals } from './modals.js';
import { setupHome } from './home.js';

export function initializeApp() {
  // Initialize all modules
  setupAuth();
  setupTabs();
  setupMarket();
  setupDevProfile();
  setupPublish();
  setupDetail();
  setupModals();
  setupHome();
}

// Placeholder setup functions for static pages
export function setupTerms() {}
export function setupPrivacy() {}
export function setupGuidelines() {}
export function setupContact() {}