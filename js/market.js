// Marketplace module - handles app listing for Android and iOS separately
import { collection, query, orderBy, startAfter, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { PAGE_SIZE } from './constants.js';
import { escapeHTML, formatDate } from './utils.js';
import { cachedGetDocs, invalidateCache } from './cache.js';

let currentPlatformFilter = 'all'; // UI state for chips (not in URL)

// Platform configurations
const MARKET_CONFIG = {
  android: {
    store: 'google-play',
    platform: 'android',
    listId: 'market-app-list-android',
    btnLoadMoreId: 'btn-load-more-android',
    noMoreMsgId: 'no-more-msg-android',
    searchInputId: 'search-input-android',
    title: 'Google Play 市集',
    icon: 'rocket_launch'
  },
  ios: {
    store: 'app-store',
    platform: 'ios',
    listId: 'market-app-list-ios',
    btnLoadMoreId: 'btn-load-more-ios',
    noMoreMsgId: 'no-more-msg-ios',
    searchInputId: 'search-input-ios',
    title: 'App Store 市集',
    icon: '🍎'
  }
};

// State stored in object to avoid closure issues
const marketState = {
  android: { loadedApps: [], lastVisibleDoc: null },
  ios: { loadedApps: [], lastVisibleDoc: null }
};

export function setupMarket() {
  // Load both markets
  setupMarketPlatform('android');
  setupMarketPlatform('ios');
  
  // Expose for global access
  window.fetchMarketAppsAndroid = () => fetchMarketApps('android', true);
  window.fetchMarketAppsIos = () => fetchMarketApps('ios', true);
  
  // Debug: dump all loaded apps
  window.debugMarketApps = () => {
    console.log('=== Android Apps ===');
    marketState.android.loadedApps.forEach((app, i) => console.log(i, app));
    console.log('=== iOS Apps ===');
    marketState.ios.loadedApps.forEach((app, i) => console.log(i, app));
  };
}

function setupMarketPlatform(platformKey) {
  const config = MARKET_CONFIG[platformKey];
  const state = marketState[platformKey];
  
  // Load more button
  const btnLoadMore = document.getElementById(config.btnLoadMoreId);
  if (btnLoadMore) {
    btnLoadMore.onclick = () => fetchMarketApps(platformKey, false);
  }
  
  // Search input
  const searchInput = document.getElementById(config.searchInputId);
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase().trim();
      console.log('[Market Search] Platform:', platformKey, 'Keyword:', keyword, 'Loaded apps:', state.loadedApps.length);
      if (!keyword) {
        console.log('[Market Search] Empty keyword, showing all');
        return renderMarketApps(platformKey, state.loadedApps);
      }
      
      // Search all loaded apps
      const filtered = state.loadedApps.filter(app => {
        const nameMatch = app.name.toLowerCase().includes(keyword);
        const pkgMatch = app.packageName && app.packageName.toLowerCase().includes(keyword);
        const authorMatch = app.authorName && app.authorName.toLowerCase().includes(keyword);
        
        if (nameMatch || pkgMatch || authorMatch) {
          console.log('[Market Search] Match:', {
            name: app.name,
            packageName: app.packageName,
            authorName: app.authorName,
            nameMatch, pkgMatch, authorMatch, keyword
          });
        }
        return nameMatch || pkgMatch || authorMatch;
      });
      console.log('[Market Search] Filtered results:', filtered.length);
      renderMarketApps(platformKey, filtered);
    });
  }
  
  // Initial load
  fetchMarketApps(platformKey, true);
}

async function fetchMarketApps(platformKey, isInitial = false) {
  const config = MARKET_CONFIG[platformKey];
  const state = marketState[platformKey];
  const btnLoadMore = document.getElementById(config.btnLoadMoreId);
  const noMoreMsg = document.getElementById(config.noMoreMsgId);
  
  // Use skipCache for initial load to ensure fresh data
  const skipCache = isInitial;

  if (isInitial) {
    // Reset the appropriate state
    state.loadedApps = [];
    state.lastVisibleDoc = null;
    btnLoadMore.style.display = 'inline-flex';
    noMoreMsg.style.display = 'none';
  }

  btnLoadMore.disabled = true;

  try {
    const platform = config.platform;
    const collectionName = 'apps';

    // Base query: must be published AND match the platform
    let baseQuery = query(
      collection(db, collectionName),
      where('status', '==', 'published'),
      where('platform', '==', platform),
      orderBy('createdAt', 'desc')
    );

    let q = state.lastVisibleDoc
      ? query(baseQuery, startAfter(state.lastVisibleDoc), limit(PAGE_SIZE))
      : query(baseQuery, limit(PAGE_SIZE));

    // Use cached query with 5-minute TTL
    const constraintsArray = [
      { field: 'status', op: '==', value: 'published' },
      { field: 'platform', op: '==', value: platform }
    ];
    if (currentPlatformFilter !== 'all') {
      constraintsArray.push({ field: 'platform', op: '==', value: currentPlatformFilter });
    }
    const results = await cachedGetDocs(collection(db, collectionName), constraintsArray, { 
      ttl: 5 * 60 * 1000, 
      collectionName, 
      skipCache: skipCache || !!state.lastVisibleDoc 
    });

    if (isInitial) {
      state.loadedApps = results;
    } else {
      state.loadedApps.push(...results);
    }

    // For pagination, we still need to do a real query to get the last visible doc
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
      return;
    }

    state.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    renderMarketApps(platformKey, state.loadedApps);

    if (snapshot.docs.length < PAGE_SIZE) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
    } else {
      btnLoadMore.style.display = 'inline-flex';
      noMoreMsg.style.display = 'none';
    }
  } catch (err) {
    console.error('Fetch market apps error:', err);
  } finally {
    btnLoadMore.disabled = false;
  }
}

function renderMarketApps(platformKey, appsList) {
  const config = MARKET_CONFIG[platformKey];
  const marketList = document.getElementById(config.listId);
  if (!marketList) return;
  
  marketList.innerHTML = '';

  if (appsList.length === 0) {
    marketList.innerHTML = '<div style="color: #888; grid-column: 1/-1; text-align: center; padding: 40px 0;">沒有找到相關的專案。</div>';
    return;
  }

  appsList.forEach((appData) => {
    const avgRating = appData.ratingCount ? (appData.ratingSum / appData.ratingCount).toFixed(1) : '尚無';
    const joinCount = appData.joinCount || 0;
    const MAX_TESTERS = 12;
    const progressPercent = Math.min(100, Math.round((joinCount / MAX_TESTERS) * 100));
    const isCompleted = joinCount >= MAX_TESTERS;
    const platform = appData.platform || 'android';

    const card = document.createElement('div');
    card.className = 'app-card';
    card.onclick = () => window.openAppDetail(appData.id);

    card.innerHTML = `
          <div>
            <div class="app-header">
              <img class="app-icon" src="${escapeHTML(appData.iconUrl)}" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;">
              <div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <h3 class="app-title">${escapeHTML(appData.name)}</h3>
                  <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}">
                    <span class="material-symbols-outlined" style="font-size:12px;">${platform === 'android' ? 'android' : 'phone_iphone'}</span>
                    ${platform === 'android' ? 'Android' : 'iOS'}
                  </span>
                </div>
                <div style="font-size: 0.8rem; color:#666; margin-top: 2px;">
                  開發者：<a href="javascript:void(0)" onclick="event.stopPropagation(); const store = '${config.store}'; window.location.hash = 'dev-profile/' + store + '/' + encodeURIComponent(this.dataset.authorUid);" class="author-link" data-author-uid="${escapeHTML(appData.authorUid || '')}">${escapeHTML(appData.authorName) || '匿名'}</a>
                </div>
              </div>
            </div>

            <div class="stats-row">
              <span class="badge-pill badge-star"><span class="material-symbols-outlined" style="font-size:14px;">star</span> ${avgRating}</span>
              <span class="badge-pill badge-like"><span class="material-symbols-outlined" style="font-size:14px;">favorite</span> ${appData.likeCount || 0}</span>
            </div>

            <div class="progress-section">
              <div class="progress-text">
                <span>測試進度</span>
                <span style="color: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}; font-weight: 700;">${joinCount} / ${MAX_TESTERS} 人 (${progressPercent}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'};"></div>
              </div>
            </div>
          </div>
        `;
    marketList.appendChild(card);
  });
}