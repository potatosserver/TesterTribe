// Marketplace module - handles app listing, search, filtering
import { collection, query, orderBy, startAfter, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';
import { PAGE_SIZE } from './constants.js';
import { escapeHTML, formatDate } from './utils.js';
import { cachedGetDocs, invalidateCache } from './cache.js';
import { getStoreFromUrl, getPlatformFromUrl, platformToStore, navigate } from './router.js';

let loadedMarketApps = [];
let lastVisibleDoc = null;
let currentPlatformFilter = 'all';
let currentStore = 'google-play';

export function setupMarket() {
  // Get store from URL or default
  currentStore = getStoreFromUrl();
  const platform = getPlatformFromUrl();
  
  window.loadedMarketApps = loadedMarketApps;
  window.lastVisibleDoc = lastVisibleDoc;
  window.filterPlatform = filterPlatform;
  window.fetchMarketApps = fetchMarketApps;
  window.renderMarketApps = renderMarketApps;
  window.switchMarketStore = switchMarketStore;

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

  // Update store tab UI
  updateStoreTabUI(currentStore);

  // Initial load
  fetchMarketApps(true);
}

function switchMarketStore(store) {
  currentStore = store;
  currentPlatformFilter = 'all';
  updateStoreTabUI(store);
  navigate('market', { store });
  fetchMarketApps(true);
}

function updateStoreTabUI(store) {
  const googlePlayBtn = document.getElementById('btn-store-google-play');
  const appStoreBtn = document.getElementById('btn-store-app-store');
  const marketTitle = document.getElementById('market-title');
  
  if (googlePlayBtn && appStoreBtn) {
    googlePlayBtn.classList.toggle('active', store === 'google-play');
    appStoreBtn.classList.toggle('active', store === 'app-store');
  }
  
  if (marketTitle) {
    marketTitle.textContent = store === 'google-play' ? 'Google Play 市集' : 'App Store 市集';
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
    // Use separate collections: apps_google_play and apps_app_store
    const collectionName = currentStore === 'google-play' ? 'apps_google_play' : 'apps_app_store';
    
    let baseQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    
    // For platform filter within a store (should be redundant but kept for flexibility)
    if (currentPlatformFilter !== 'all') {
      baseQuery = query(baseQuery, where('platform', '==', currentPlatformFilter));
    }
    
    let q = lastVisibleDoc 
      ? query(baseQuery, startAfter(lastVisibleDoc), limit(PAGE_SIZE))
      : query(baseQuery, limit(PAGE_SIZE));

    // Use cached query with 5-minute TTL
    const constraintsArray = [{ field: 'createdAt', op: 'desc' }];
    if (currentPlatformFilter !== 'all') {
      constraintsArray.push({ field: 'platform', op: '==', value: currentPlatformFilter });
    }
    const results = await cachedGetDocs(collection(db, collectionName), constraintsArray, { ttl: 5 * 60 * 1000, skipCache: !!lastVisibleDoc });
    
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
  }
  finally { 
    btnLoadMore.disabled = false; 
  }
}

function filterPlatform(platform, btn) {
  currentPlatformFilter = platform;
  document.querySelectorAll('.chips-group .chip-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fetchMarketApps(true);
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
    const progressPercent = Math.min(100, Math.round((joinCount / 20) * 100));
    const isUrgent = joinCount < 20;
    const platform = appData.platform || 'android';

    const card = document.createElement('div');
    card.className = 'app-card';
    card.onclick = () => window.openAppDetail(appData.id);

    card.innerHTML = `
      ${isUrgent ? `<div class="urgent-tag"><span class="material-symbols-outlined" style="font-size:14px;">bolt</span> 急需測試</div>` : ''}

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
              開發者：<a href="javascript:void(0)" onclick="event.stopPropagation(); window.openDevProfile('${appData.authorUid}', '${escapeHTML(appData.authorName)}')" class="author-link">${escapeHTML(appData.authorName) || '匿名'}</a>
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
            <span>${joinCount} / 20 人 (${progressPercent}%)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
      </div>

      <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
        <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
          <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
          更新於：${formatDate(appData.updatedAt || appData.createdAt)}
        </div>
        <button class="btn btn-primary" style="width: auto; min-width: 120px; flex-shrink: 0;">查看專案詳情</button>
      </div>
    `;
    marketList.appendChild(card);
  });
}