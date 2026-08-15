// Marketplace module - handles app listing, search, filtering
import { collection, query, orderBy, startAfter, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { PAGE_SIZE } from './constants.js';
import { escapeHTML, formatDate } from './utils.js';
import { cachedGetDocs, invalidateCache } from './cache.js';
import { getStoreFromUrl, getPlatformFromUrl, platformToStore, navigate } from './router.js';

let loadedMarketApps = [];
let lastVisibleDoc = null;
let currentPlatformFilter = 'all'; // UI state for chips (not in URL)

export function setupMarket() {
  // Expose switchMarketStore globally for inline onclick handlers
  window.switchMarketStore = switchMarketStore;

  // Get store from URL and update UI
  const store = getStoreFromUrl();
  updateStoreTabUI(store);

  // Load more button
  document.getElementById('btn-load-more').onclick = () => fetchMarketApps(false);

  // Search input
  document.getElementById('search-input').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    if (!keyword) return renderMarketApps(loadedMarketApps);
    renderMarketApps(loadedMarketApps.filter(app =>
      app.name.toLowerCase().includes(keyword) ||
      app.description.toLowerCase().includes(keyword) ||
      (app.packageName && app.packageName.toLowerCase().includes(keyword))
    ));
  });

  // Initial load
  fetchMarketApps(true);
}

function switchMarketStore(store) {
  updateStoreTabUI(store);
  navigate('market', { store });
  fetchMarketApps(true);
}

function updateStoreTabUI(store) {
  const marketTitle = document.getElementById('market-title');

  if (marketTitle) {
    marketTitle.textContent = store === 'google-play' ? 'Google Play 市集' : 'App Store 市集';
  }

  // Update header store buttons
  const headerGooglePlayBtn = document.getElementById('btn-store-google-play-header');
  const headerAppStoreBtn = document.getElementById('btn-store-app-store-header');
  if (headerGooglePlayBtn && headerAppStoreBtn) {
    headerGooglePlayBtn.classList.toggle('active', store === 'google-play');
    headerAppStoreBtn.classList.toggle('active', store === 'app-store');
  }
}

async function fetchMarketApps(isInitial = false) {
  const btnLoadMore = document.getElementById('btn-load-more');
  const noMoreMsg = document.getElementById('no-more-msg');

  if (isInitial) {
    loadedMarketApps = [];
    lastVisibleDoc = null;
    btnLoadMore.style.display = 'inline-flex';
    noMoreMsg.style.display = 'none';
  }

  btnLoadMore.disabled = true;

  try {
    // Read store from URL each time to ensure we get the current state
    const store = getStoreFromUrl();
    const platform = store === 'google-play' ? 'android' : 'ios';
    const collectionName = 'apps';

    // Base query: must be published AND match the platform from store
    let baseQuery = query(
      collection(db, collectionName),
      where('status', '==', 'published'),
      where('platform', '==', platform),
      orderBy('createdAt', 'desc')
    );

    let q = lastVisibleDoc
      ? query(baseQuery, startAfter(lastVisibleDoc), limit(PAGE_SIZE))
      : query(baseQuery, limit(PAGE_SIZE));

    // Use cached query with 5-minute TTL
    const constraintsArray = [
      { field: 'status', op: '==', value: 'published' },
      { field: 'platform', op: '==', value: platform }
    ];
    if (currentPlatformFilter !== 'all') {
      constraintsArray.push({ field: 'platform', op: '==', value: currentPlatformFilter });
    }
    const results = await cachedGetDocs(collection(db, collectionName), constraintsArray, { ttl: 5 * 60 * 1000, collectionName, skipCache: !!lastVisibleDoc });

    if (isInitial) {
      loadedMarketApps = results;
    } else {
      loadedMarketApps.push(...results);
    }

    // For pagination, we still need to do a real query to get the last visible doc
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
      return;
    }

    lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    renderMarketApps(loadedMarketApps);

    if (snapshot.docs.length < PAGE_SIZE) {
      btnLoadMore.style.display = 'none';
      noMoreMsg.style.display = 'block';
    } else {
      btnLoadMore.style.display = 'inline-flex';
      noMoreMsg.style.display = 'none';
    }
  } catch (err) {
    console.error(err);
  } finally {
    btnLoadMore.disabled = false;
  }
}

function renderMarketApps(appsList) {
  const marketList = document.getElementById('market-app-list');
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
                  開發者：<a href="javascript:void(0)" onclick="event.stopPropagation(); const store = getStoreFromUrl(); window.location.hash = 'dev-profile/' + store + '/' + encodeURIComponent(this.dataset.authorUid);" class="author-link" data-author-uid="${escapeHTML(appData.authorUid || '')}">${escapeHTML(appData.authorName) || '匿名'}</a>
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

          <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
            <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
              <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
              更新於：${formatDate(appData.updatedAt || appData.createdAt)}
            </div>
          </div>
        `;
    marketList.appendChild(card);
  });
}