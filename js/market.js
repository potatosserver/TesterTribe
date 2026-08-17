// Marketplace module - handles app listing for Android and iOS separately
import { collection, query, orderBy, startAfter, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { PAGE_SIZE } from './constants.js';
import { escapeHTML, formatDate } from './utils.js';
import { cachedGetDocs, invalidateCache } from './cache.js';
import { showSkeleton, hideSkeleton, createEmptyState, toast } from './utils.js';

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
  // Lazy‑load the market tabs. By default we only initialise the Android tab to avoid
  // unnecessary Firestore reads for the iOS tab when the user first opens the market.
  // The iOS platform can be loaded on demand via `window.loadIosMarket()` which is
  // called from the UI when the iOS tab is selected.
  setupMarketPlatform('android');

  // Expose helpers for on‑demand loading
  window.fetchMarketAppsAndroid = () => fetchMarketApps('android', true);
  window.fetchMarketAppsIos = () => fetchMarketApps('ios', true);
  window.loadIosMarket = () => {
    console.log('[Market Debug] loadIosMarket called, initialised:', marketState.ios.initialised);
    // Only initialize if not already initialized
    if (!marketState.ios.initialised) {
      marketState.ios.initialised = true;
      setupMarketPlatform('ios');
    }
  };

  // Debug: dump all loaded apps
  window.debugMarketApps = () => {
    console.log('=== Android Apps ===');
    marketState.android.loadedApps.forEach((app, i) => console.log(i, app));
    console.log('=== iOS Apps ===');
    marketState.ios.loadedApps.forEach((app, i) => console.log(i, app));
  };
}

function setupMarketPlatform(platformKey) {
  console.log('[Market Debug] setupMarketPlatform called:', platformKey);
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
        
        // Add loading state to search box
        searchInput.classList.add('loading');
        
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
        } finally {
          searchInput.classList.remove('loading');
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
  
  // Mobile filter bottom sheet
  const filterToggleBtn = document.getElementById(`btn-filter-${platformKey}`);
  if (filterToggleBtn) {
    // Show button on mobile
    const checkMobile = () => {
      filterToggleBtn.style.display = window.innerWidth < 768 ? 'inline-flex' : 'none';
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    filterToggleBtn.addEventListener('click', () => {
      const bottomSheet = createBottomSheet({
        title: '篩選與排序',
        content: `
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div>
              <label style="font-weight: 600; margin-bottom: 8px; display: block;">狀態篩選</label>
              <select id="bottom-filter-status-${platformKey}" class="form-control">
                <option value="all">全部</option>
                <option value="open">招募中</option>
                <option value="closed">已結束</option>
              </select>
            </div>
            <div>
              <label style="font-weight: 600; margin-bottom: 8px; display: block;">排序方式</label>
              <select id="bottom-filter-sort-${platformKey}" class="form-control">
                <option value="auto">自動（綜合權重）</option>
                <option value="popular">熱門（愛心數）</option>
                <option value="rating">評價（星星數）</option>
              </select>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <button id="bottom-filter-reset-${platformKey}" class="btn btn-outlined" style="flex: 1;">重置</button>
              <button id="bottom-filter-apply-${platformKey}" class="btn btn-primary" style="flex: 1;">套用</button>
            </div>
          </div>
        `,
        onClose: () => {}
      });
      
      // Sync current values
      const bottomStatus = bottomSheet.querySelector(`#bottom-filter-status-${platformKey}`);
      const bottomSort = bottomSheet.querySelector(`#bottom-filter-sort-${platformKey}`);
      if (bottomStatus) bottomStatus.value = statusFilter.value;
      if (bottomSort) bottomSort.value = sortFilter.value;
      
      // Apply button
      bottomSheet.querySelector(`#bottom-filter-apply-${platformKey}`).addEventListener('click', () => {
        statusFilter.value = bottomStatus.value;
        sortFilter.value = bottomSort.value;
        renderMarketApps(platformKey, state.loadedApps);
        bottomSheet.remove();
      });
      
      // Reset button
      bottomSheet.querySelector(`#bottom-filter-reset-${platformKey}`).addEventListener('click', () => {
        bottomStatus.value = 'all';
        bottomSort.value = 'auto';
      });
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
  const marketList = document.getElementById(config.listId);
  
  // Use skipCache for initial load to ensure fresh data
  const skipCache = isInitial;

  // Prevent duplicate initial loads (e.g., if both the platform init and a manual call run)
  if (isInitial) {
    if (state.initialLoaded) {
      // Already loaded once – skip resetting UI and re‑fetching data
      return;
    }
    // Note: state.initialLoaded is set to true ONLY after successful fetch
    // Reset the appropriate state
    state.loadedApps = [];
    state.lastVisibleDoc = null;
    btnLoadMore.style.display = 'inline-flex';
    noMoreMsg.style.display = 'none';
    
    // Show skeleton loaders for initial load
    marketList.innerHTML = '';
    showSkeleton(marketList, 'app-card', 6);
  }

  btnLoadMore.disabled = true;

  try {
    const platform = config.platform;
    const collectionName = 'apps';
    // The original implementation performed two separate cached queries:
    // 1) filter by `platform`
    // 2) filter by `store`
    // This caused duplicate network traffic because most documents contain both fields.
    // We can safely rely on the `platform` field alone (it is always set) and drop the
    // second query, thereby halving the number of Firestore reads.

    // Base query: must be published AND match the platform.
    // Both Android and iOS use the `platform` field (data shows it's correctly set for both).
    // Using `platform` allows us to use the existing Firestore composite index.
    const baseQuery = query(
      collection(db, collectionName),
      where('status', '==', 'published'),
      where('platform', '==', platform),
      orderBy('createdAt', 'desc')
    );

    // Pagination query – if we have a last visible document we start after it.
    const q = state.lastVisibleDoc
      ? query(baseQuery, startAfter(state.lastVisibleDoc), limit(PAGE_SIZE))
      : query(baseQuery, limit(PAGE_SIZE));

    // Perform a single Firestore query (with pagination) and use its snapshot both for data
    // and for determining the last visible document. This eliminates the previous double
    // request caused by calling `cachedGetDocs` and then `getDocs` separately.
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
      renderMarketApps(platformKey, state.loadedApps);
      return;
    }

    // Convert documents to plain objects
    const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (isInitial) {
      state.loadedApps = docsData;
    } else {
      state.loadedApps.push(...docsData);
    }

    // Update pagination cursor
    state.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    if (isInitial) {
      state.initialLoaded = true;
    }

    renderMarketApps(platformKey, state.loadedApps);

    if (snapshot.docs.length < PAGE_SIZE) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
    } else {
      btnLoadMore.style.display = 'inline-flex';
      noMoreMsg.style.display = 'none';
    }
  } catch (err) {
    console.error('[Market Fetch Error] Platform:', platformKey, 'Error details:', err);
    if (err.message && err.message.includes('index')) {
      console.error('[Market Fetch Error] Missing Firestore Index. Please check the link in the console to create it.');
    }
    toast.error(`載入${config.title}資料失敗`);
  } finally {
    btnLoadMore.disabled = false;
  }
}

function renderMarketApps(platformKey, appsList) {
  console.log('[Market Debug] renderMarketApps called:', { platformKey, appsCount: appsList.length });
  const config = MARKET_CONFIG[platformKey];
  const marketList = document.getElementById(config.listId);
  if (!marketList) return;

  // Debug: log what apps are being rendered for iOS
  if (platformKey === 'ios') {
    console.log('[Market Debug] renderMarketApps iOS received:', appsList.map(a => ({ name: a.name, platform: a.platform, store: a.store })));
  }
  
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
  
  // Clear skeleton loaders
  marketList.innerHTML = '';

  if (filteredApps.length === 0) {
    // Determine if this is a "no results" (filtered) or "empty store" (initial) state
    const searchInput = document.getElementById(config.searchInputId);
    const statusFilter = document.getElementById(`filter-status-${platformKey}`);
    const sortFilter = document.getElementById(`filter-sort-${platformKey}`);
    
    const isFiltered = (searchInput && searchInput.value.trim() !== '') || 
                       (statusFilter && statusFilter.value !== 'all');

    const emptyConfig = isFiltered ? {
      icon: 'search_off',
      title: '沒有找到相關的專案',
      description: '嘗試調整篩選條件或搜尋關鍵字',
      action: {
        label: '清除篩選',
        onClick: () => {
          if (statusFilter) statusFilter.value = 'all';
          if (sortFilter) sortFilter.value = 'auto';
          if (searchInput) searchInput.value = '';
          renderMarketApps(platformKey, appsList);
        }
      }
    } : {
      icon: 'storefront',
      title: '市集目前空空如也',
      description: '還沒有開發者刊登專案，快來成為第一個分享者吧！',
      action: {
        label: '立即刊登',
        onClick: () => {
          window.navigate('publish');
        }
      }
    };

    const emptyState = createEmptyState(emptyConfig);
    marketList.appendChild(emptyState);
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
              <img class="app-icon" src="${escapeHTML(appData.iconUrl)}" loading="lazy" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;">
              <div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <h3 class="app-title">${escapeHTML(appData.name)}</h3>
                  <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}">
                    ${platform === 'android' ? '<span class="material-symbols-outlined" style="font-size:12px;">android</span>' : '<span style="font-size:12px;">🍎</span>'}
                    ${platform === 'android' ? 'Android' : 'iOS'}
                  </span>
                </div>
                <div style="font-size: 0.8rem; color:#666; margin-top: 2px;">
                  開發者：<a href="javascript:void(0)" onclick="event.stopPropagation(); window.navigate('dev-profile', { authorUid: '${escapeHTML(appData.authorUid || '')}' });" class="author-link">${escapeHTML(appData.authorName) || '匿名'}</a>
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