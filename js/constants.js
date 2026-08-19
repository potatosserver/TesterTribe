// Application constants
export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
export const DEFAULT_ICON = 'https://via.placeholder.com/58?text=App';
export const PAGE_SIZE = 10;

// Firebase SDK version - centralized for consistency across all modules
export const FIREBASE_SDK_VERSION = '12.17.1';
export const FIREBASE_CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

// Platform detection utility - single source of truth
export function getAppPlatform(appData) {
  return appData.platform || (appData.store === 'app-store' ? 'ios' : 'android');
}

// Fallback image URLs (centralized for easy maintenance)
export const FALLBACK_IMAGES = {
  avatar: DEFAULT_AVATAR,
  icon: DEFAULT_ICON,
  screenshot: 'https://via.placeholder.com/400x225?text=Screenshot',
  banner: 'https://via.placeholder.com/1200x400?text=Banner'
};

// App status constants
export const APP_STATUS = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
  CLOSED: 'closed'
};

// Platform constants
export const PLATFORM = {
  ANDROID: 'android',
  IOS: 'ios'
};

// Store constants
export const STORE = {
  GOOGLE_PLAY: 'google-play',
  APP_STORE: 'app-store'
};

// Rating constants
export const RATING = {
  MIN: 1,
  MAX: 5,
  DEFAULT: 3.5
};

// Test limits
export const TEST_LIMITS = {
  MAX_TESTERS: 12
};