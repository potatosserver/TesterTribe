// App initialization - sets up all feature modules
import { setupAuth } from './auth.js';
import { setupTabs } from './tabs.js';
import { setupMarket } from './market.js';
import { setupDevProfile } from './dev-profile.js';
import { setupAccount } from './account.js';
import { setupPublish } from './publish.js';
import { setupDetail } from './detail.js';
import { setupModals } from './modals.js';

export function initializeApp() {
  // Initialize all modules
  setupAuth();
  setupTabs();
  setupMarket();
  setupDevProfile();
  setupAccount();
  setupPublish();
  setupDetail();
  setupModals();
}