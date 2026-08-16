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
  
  // Search input - debounced Firestore search
  const searchInput = document.getElementById(config.searchInputId);
  if (searchInput) {
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.toLowerCase().trim();
      
      // Clear previous debounce timer
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      
      // Debounce search by 300ms
      searchDebounceTimer = setTimeout(async () => {
        if (!keyword) {
          console.log('[Market Search] Empty keyword, showing all loaded apps');
          return renderMarketApps(platformKey, state.loadedApps);
        }
        
        console.log('[Market Search] Platform:', platformKey, 'Keyword:', keyword);
        
        try {
          // Search Firestore for apps matching keyword in name, packageName, or authorName
          // We need to do multiple queries since Firestore doesn't support OR across fields
          const platform = config.platform;
          const collectionName = 'apps';
          
          // Query 1: Search by name (using >= and <= for prefix matching)
          const nameQuery = query(
            collection(db, collectionName),
            where('status', '==', 'published'),
            where('platform', '==', platform),
            where('name', '>=', keyword),
            where('name', '<=', keyword + '\uf8ff'),
            orderBy('name'),
            limit(20)
          );
          
          // Query 2: Search by packageName
          const pkgQuery = query(
            collection(db, collectionName),
            where('status', '==', 'published'),
            where('platform', '==', platform),
            where('packageName', '>=', keyword),
            where('packageName', '<=', keyword + '\uf8ff'),
            orderBy('packageName'),
            limit(20)
          );
          
          // Query 3: Search by authorName
          const authorQuery = query(
            collection(db, collectionName),
            where('status', '==', 'published'),
            where('platform', '==', platform),
            where('authorName', '>=', keyword),
            where('authorName', '<=', keyword + '\uf8ff'),
            orderBy('authorName'),
            limit(20)
          );
          
          const [nameSnap, pkgSnap, authorSnap] = await Promise.all([
            getDocs(nameQuery),
            getDocs(pkgQuery),
            getDocs(authorQuery)
          ]);
          
          // Combine results, avoiding duplicates
          const seenIds = new Set();
          const searchResults = [];
          
          [...nameSnap.docs, ...pkgSnap.docs, ...authorSnap.docs].forEach(docSnap => {
            if (!seenIds.has(docSnap.id)) {
              seenIds.add(docSnap.id);
              searchResults.push({ id: docSnap.id, ...docSnap.data() });
            }
          });
          
          console.log('[Market Search] Firestore results:', searchResults.length);
          renderMarketApps(platformKey, searchResults);
        } catch (err) {
          console.error('[Market Search] Error:', err);
          // Fallback to client-side search on loaded apps
          const filtered = state.loadedApps.filter(app => {
            const nameMatch = app.name.toLowerCase().includes(keyword);
            const pkgMatch = app.packageName && app.packageName.toLowerCase().includes(keyword);
            const authorMatch = app.authorName && app.authorName.toLowerCase().includes(keyword);
            return nameMatch || pkgMatch || authorMatch;
          });
          renderMarketApps(platformKey, filtered);
        }
      }, 300);
    });
  }
  
  // Status filter
  const statusFilter = document.getElementById(`filter-status-${platformKey}`);
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      renderMarketApps(platformKey, state.loadedApps);
    });
  }
  
  // Sort filter
  const sortFilter = document.getElementById(`filter-sort-${platformKey}`);
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      renderMarketApps(platformKey, state.loadedApps);
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
    const store = platform === 'ios' ? 'app-store' : 'google-play';

    // Base query: must be published AND match the platform (check both platform and store fields)
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
    
    // Note: currentPlatformFilter is for the UI chips, but the base fetch must be platform-specific
    const results = await cachedGetDocs(collection(db, collectionName), constraintsArray, { 
      ttl: 5 * 60 * 1000, 
      collectionName, 
      skipCache: skipCache || !!state.lastVisibleDoc 
    });

    // Also fetch apps that have store field but not platform field
    const storeConstraintsArray = [
      { field: 'status', op: '==', value: 'published' },
      { field: 'store', op: '==', value: store }
    ];
    
    const storeResults = await cachedGetDocs(collection(db, collectionName), storeConstraintsArray, { 
      ttl: 5 * 60 * 1000, 
      collectionName: collectionName + '-store', 
      skipCache: skipCache || !!state.lastVisibleDoc 
    });

    // Combine results, avoiding duplicates by packageName
    const seenPackageNames = new Set();
    const combinedResults = [];
    
    [...results, ...storeResults].forEach(app => {
      if (!seenPackageNames.has(app.packageName)) {
        seenPackageNames.add(app.packageName);
        combinedResults.push(app);
      }
    });

    if (isInitial) {
      state.loadedApps = combinedResults;
    } else {
      state.loadedApps.push(...combinedResults);
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
  
  // Get filter values
  const statusFilter = document.getElementById(`filter-status-${platformKey}`);
  const sortFilter = document.getElementById(`filter-sort-${platformKey}`);
  const statusValue = statusFilter ? statusFilter.value : 'all';
  const sortValue = sortFilter ? sortFilter.value : 'auto';
  
  // Apply status filter
  let filteredApps = appsList;
  if (statusValue === 'open') {
    filteredApps = appsList.filter(app => !app.isClosed);
  } else if (statusValue === 'closed') {
    filteredApps = appsList.filter(app => app.isClosed === true);
  }
  
  // Apply sort
  if (sortValue === 'popular') {
    // 熱門：愛心數降序
    filteredApps.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  } else if (sortValue === 'rating') {
    // 評價：星星數降序，無星星用 3.5 計算
    filteredApps.sort((a, b) => {
      const ratingA = a.ratingCount ? (a.ratingSum / a.ratingCount) : 3.5;
      const ratingB = b.ratingCount ? (b.ratingSum / b.ratingCount) : 3.5;
      return ratingB - ratingA;
    });
  } else {
    // 自動：綜合權重
    // 權重：愛心數 * 1 + 星星數 * 2 + 該開發者參與的測試app數 * 5 (重權重)
    // 為了計算開發者參與的測試app數，我們需要先統計每個開發者的app數
    const authorAppCounts = {};
    appsList.forEach(app => {
      if (app.authorEmail) {
        authorAppCounts[app.authorEmail] = (authorAppCounts[app.authorEmail] || 0) + 1;
      }
    });
    
    filteredApps.sort((a, b) => {
      const likeA = a.likeCount || 0;
      const likeB = b.likeCount || 0;
      const ratingA = a.ratingCount ? (a.ratingSum / a.ratingCount) : 3.5;
      const ratingB = b.ratingCount ? (b.ratingSum / b.ratingCount) : 3.5;
      const authorCountA = a.authorEmail ? (authorAppCounts[a.authorEmail] || 0) : 0;
      const authorCountB = b.authorEmail ? (authorAppCounts[b.authorEmail] || 0) : 0;
      
      const scoreA = likeA * 1 + ratingA * 2 + authorCountA * 5;
      const scoreB = likeB * 1 + ratingB * 2 + authorCountB * 5;
      
      return scoreB - scoreA;
    });
  }
  
  marketList.innerHTML = '';

  if (filteredApps.length === 0) {
    marketList.innerHTML = '<div style="color: #888; grid-column: 1/-1; text-align: center; padding: 40px 0;">沒有找到相關的專案。</div>';
    return;
  }

  filteredApps.forEach((appData) => {
    const avgRating = appData.ratingCount ? (appData.ratingSum / appData.ratingCount).toFixed(1) : '尚無';
    const joinCount = appData.joinCount || 0;
    const MAX_TESTERS = 12;
    const progressPercent = Math.min(100, Math.round((joinCount / MAX_TESTERS) * 100));
    const isCompleted = joinCount >= MAX_TESTERS;
    const platform = appData.platform || (appData.store === 'app-store' ? 'ios' : 'android');
    
    // Debug: log platform detection
    console.log('[Market] App:', appData.name, 'platform field:', appData.platform, 'store field:', appData.store, 'computed platform:', platform);

    const card = document.createElement('div');
    card.className = 'app-card';
    // Pass the correct store based on the market tab's platform
    const appStore = config.store;
    card.onclick = () => window.openAppDetail(appData.packageName, appStore);

    card.innerHTML = `
          <div>
            <div class="app-header">
              <img class="app-icon" src="${escapeHTML(appData.iconUrl)}" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;">
              <div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <h3 class="app-title">${escapeHTML(appData.name)}</h3>
                  <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}">
                    ${platform === 'android' ? '<span class="material-symbols-outlined" style="font-size:12px;">android</span>' : '<span style="font-size:12px;">🍎</span>'}
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

            ${!appData.isClosed ? `
            <div class="progress-section">
              <div class="progress-text">
                <span>測試進度</span>
                <span style="color: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}; font-weight: 700;">${joinCount} / ${MAX_TESTERS} 人 (${progressPercent}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'};"></div>
              </div>
            </div>
            ` : `
            <div class="progress-section" style="padding-top: 8px;">
              <div class="progress-text">
                <span>測試人數</span>
                <span style="color: var(--md-sys-color-primary); font-weight: 700;">${joinCount} 人</span>
              </div>
            </div>
            `}
          </div>
        `;
    marketList.appendChild(card);
  });
}