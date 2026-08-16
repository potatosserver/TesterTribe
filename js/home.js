// Home page module - handles home page functionality
import { collection } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { cachedGetDocs } from './cache.js';

export function setupHome() {
  // Load statistics for home page
  loadHomeStats();
  
  // Expose for global access
  window.refreshHomeStats = loadHomeStats;
}

async function loadHomeStats() {
  try {
    // Fetch all apps to calculate stats
    const apps = await cachedGetDocs(collection(db, 'apps'), [], { 
      ttl: 5 * 60 * 1000, 
      collectionName: 'all-apps',
      skipCache: false 
    });
    
    // Debug: log platform distribution
    console.log('[Home Stats] Total apps:', apps.length);
    const platformCounts = {};
    apps.forEach(app => {
      const platform = app.platform || app.store || 'unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    console.log('[Home Stats] Platform distribution:', platformCounts);
    
    // Total apps (projects)
    const totalApps = apps.length;
    document.getElementById('stat-projects').textContent = totalApps.toLocaleString();
    
    // Unique developers (by authorEmail)
    const uniqueDevelopers = new Set(apps.map(p => p.authorEmail).filter(Boolean));
    document.getElementById('stat-developers').textContent = uniqueDevelopers.size.toLocaleString();
    
    // Total tests (sum of joinCount from each app)
    const totalTests = apps.reduce((sum, p) => sum + (p.joinCount || 0), 0);
    document.getElementById('stat-tests').textContent = totalTests.toLocaleString();
    
    // Platform-specific stats - handle both 'platform' and 'store' fields for backward compatibility
    const androidApps = apps.filter(p => p.platform === 'android' || p.store === 'google-play');
    const iosApps = apps.filter(p => p.platform === 'ios' || p.store === 'app-store');
    
    console.log('[Home Stats] Android apps:', androidApps.length, 'iOS apps:', iosApps.length);
    console.log('[Home Stats] iOS apps data:', JSON.stringify(iosApps.map(a => ({ name: a.name, platform: a.platform, store: a.store, authorEmail: a.authorEmail, authorUid: a.authorUid })), null, 2));
    
    const androidDevelopers = new Set(androidApps.map(p => p.authorEmail).filter(Boolean));
    const iosDevelopers = new Set(iosApps.map(p => p.authorEmail).filter(Boolean));
    
    console.log('[Home Stats] Android developers:', androidDevelopers.size, 'iOS developers:', iosDevelopers.size);
    console.log('[Home Stats] iOS developer emails:', Array.from(iosDevelopers));
    
    document.getElementById('android-project-count').textContent = androidApps.length.toLocaleString();
    document.getElementById('android-dev-count').textContent = androidDevelopers.size.toLocaleString();
    document.getElementById('ios-project-count').textContent = iosApps.length.toLocaleString();
    document.getElementById('ios-dev-count').textContent = iosDevelopers.size.toLocaleString();
    
  } catch (error) {
    console.error('Failed to load home stats:', error);
    // Set default values on error
    document.getElementById('stat-projects').textContent = '0';
    document.getElementById('stat-developers').textContent = '0';
    document.getElementById('stat-tests').textContent = '0';
    document.getElementById('android-project-count').textContent = '0';
    document.getElementById('android-dev-count').textContent = '0';
    document.getElementById('ios-project-count').textContent = '0';
    document.getElementById('ios-dev-count').textContent = '0';
  }
}