// Application constants
export const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
export const DEFAULT_ICON = 'https://via.placeholder.com/58?text=App';
export const PAGE_SIZE = 10;

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