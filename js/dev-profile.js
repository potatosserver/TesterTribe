// Developer profile module
import { collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { escapeHTML, formatDate, formatDateOnly } from './utils.js';
import { getAuthorEmailFromUrl, getAuthorUidFromUrl } from './router.js';
import { m3Alert, m3Confirm, m3Error, m3Success } from './m3-dialog.js';
import { createEmptyState, showSkeleton, hideSkeleton, toast } from './utils.js';

// Ensure detail module is loaded for openAppDetail
import { setupDetail } from './detail.js';
setupDetail();

export function setupDevProfile() {
  window.openDevProfile = openDevProfile;
}

async function openDevProfile() {
  // Get author identifier from URL params (set by applyRoute)
  // Prefer UID for efficient lookup, fallback to email for backward compatibility
  const authorUidFromUrl = getAuthorUidFromUrl();
  const authorEmailFromUrl = getAuthorEmailFromUrl();
  const authorIdentifier = authorUidFromUrl || authorEmailFromUrl;
  
  if (!authorIdentifier) {
    window.navigate('market-android');
    return;
  }
  
  const loadingEl = document.getElementById('dev-profile-loading');
  const mainEl = document.getElementById('dev-profile-main');
  const gridEl = document.getElementById('dev-apps-grid');
  const emptyStateEl = document.getElementById('dev-empty-state');
  
  loadingEl.style.display = 'block';
  mainEl.style.display = 'none';
  emptyStateEl.style.display = 'none';
  gridEl.innerHTML = '';

  // Show skeleton loaders for hero stats and app cards
  showSkeleton('#dev-stat-apps', 'stat');
  showSkeleton('#dev-stat-testers', 'stat');
  showSkeleton('#dev-stat-likes', 'stat');
  showSkeleton('#dev-profile-name', 'title');
  showSkeleton('#dev-profile-email', 'text');
  showSkeleton('#dev-join-date', 'text');
  showSkeleton('#dev-profile-avatar', 'avatar');
  // Show 3 skeleton cards
  for (let i = 0; i < 3; i++) {
    const skeletonCard = showSkeleton(gridEl, 'app-card');
    gridEl.appendChild(skeletonCard);
  }

  try {
    // Fetch user by UID (preferred) or Email (fallback)
    let userSnap;
    let actualUid;
      
    if (authorUidFromUrl) {
      // Direct UID lookup - most efficient
      userSnap = await getDoc(doc(db, 'users', authorUidFromUrl));
      if (!userSnap.exists()) {
        throw new Error('找不到該開發者');
      }
      actualUid = userSnap.id;
    } else if (authorEmailFromUrl) {
      // Fallback to email query for backward compatibility
      const usersQuery = query(collection(db, 'users'), where('email', '==', authorEmailFromUrl));
      const usersSnapshot = await getDocs(usersQuery);
      if (usersSnapshot.empty) {
        throw new Error('找不到該開發者');
      }
      const matchedDoc = usersSnapshot.docs[0];
      userSnap = matchedDoc;
      actualUid = matchedDoc.id;
    } else {
      throw new Error('無效的開發者識別碼');
    }
      
    const userData = userSnap.data();
    const displayName = userData.displayName || userData.authorName || '匿名開發者';
    const photoURL = userData.photoURL || '';
    const createdAt = userData.createdAt?.toDate ? userData.createdAt.toDate() : null;

    // Handle email visibility: only show if the viewer is the owner
    let email = '';
    if (window.currentUser && window.currentUser.uid === actualUid) {
      try {
        const privateSnap = await getDoc(doc(db, 'users', actualUid, 'private', 'contact'));
        if (privateSnap.exists()) {
          email = privateSnap.data().email || '';
        }
      } catch (err) {
        console.error('無法讀取私有信箱資料:', err);
      }
    }

    // Hide skeletons and show actual content
    hideSkeleton('#dev-stat-apps');
    hideSkeleton('#dev-stat-testers');
    hideSkeleton('#dev-stat-likes');
    hideSkeleton('#dev-profile-name');
    hideSkeleton('#dev-profile-email');
    hideSkeleton('#dev-join-date');
    hideSkeleton('#dev-profile-avatar');
    // Clear skeleton cards
    gridEl.innerHTML = '';

    document.getElementById('dev-profile-name').innerText = escapeHTML(displayName);
    document.getElementById('dev-profile-email').innerText = escapeHTML(email);
    document.getElementById('dev-profile-avatar').src = photoURL || window.DEFAULT_AVATAR;
    
    if (createdAt) {
      document.getElementById('dev-join-date').innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
        ${formatDateOnly(createdAt)} 加入
      `;
    } else {
      document.getElementById('dev-join-date').innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
        日期未知
      `;
    }

    // Check if this is the current user's own profile
    const isOwnProfile = window.currentUser && window.currentUser.uid === actualUid;

    // Fetch apps by this author from the unified 'apps' collection
    const q = query(collection(db, 'apps'), where('authorUid', '==', actualUid));
    const snapshot = await getDocs(q);
    const apps = [];
    snapshot.forEach(docSnap => apps.push({ id: docSnap.id, ...docSnap.data() }));

    // Calculate stats
    let totalTesters = 0;
    let totalLikes = 0;
    apps.forEach(app => {
      totalTesters += app.joinCount || 0;
      totalLikes += app.likeCount || 0;
    });

    document.getElementById('dev-stat-apps').innerText = apps.length;
    document.getElementById('dev-stat-testers').innerText = totalTesters;
    document.getElementById('dev-stat-likes').innerText = totalLikes;
    document.getElementById('dev-total-apps').innerText = apps.length;

    // Render apps
    gridEl.innerHTML = '';

    if (apps.length === 0) {
      // Use new empty state component
      const emptyState = createEmptyState({
        icon: 'folder_open',
        title: '目前沒有發布任何專案',
        description: '這位開發者尚未在 TesterTribe 刊登封閉測試專案',
        action: {
          label: '瀏覽市集其他專案',
          onClick: () => window.navigate('market-android')
        }
      });
      gridEl.appendChild(emptyState);
      loadingEl.style.display = 'none';
      mainEl.style.display = 'block';
      return;
    }

    // Sort by update time (newest first)
    apps.sort((a, b) => {
      const timeA = (a.updatedAt || a.createdAt)?.toMillis?.() || 0;
      const timeB = (b.updatedAt || b.createdAt)?.toMillis?.() || 0;
      return timeB - timeA;
    });

    apps.forEach((appData) => {
      const avgRating = appData.ratingCount ? (appData.ratingSum / appData.ratingCount).toFixed(1) : '尚無';
      const joinCount = appData.joinCount || 0;
      const MAX_TESTERS = 12;
      const progressPercent = Math.min(100, Math.round((joinCount / MAX_TESTERS) * 100));
      const isCompleted = joinCount >= MAX_TESTERS;
      const platform = appData.platform || (appData.store === 'app-store' ? 'ios' : 'android');
      
      // Debug: log platform detection
      console.log('[DevProfile] App:', appData.name, 'platform field:', appData.platform, 'store field:', appData.store, 'computed platform:', platform);

      const card = document.createElement('div');
      card.className = 'app-card';
      // Pass the correct store based on app's platform/store field
      const appStore = appData.store || (appData.platform === 'ios' ? 'app-store' : 'google-play');
      card.onclick = () => window.openAppDetail(appData.packageName, appStore);

      // For own profile, show edit button in footer
      const footerActions = isOwnProfile ? `
        <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
          <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
            <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
            更新於：${formatDate(appData.updatedAt || appData.createdAt)}
          </div>
          <button onclick="event.stopPropagation(); window.openEditAppModal('${appData.id}')" class="btn btn-tonal" style="flex:1;">
            <span class="material-symbols-outlined" style="font-size: 18px;">edit</span> 編輯專案
          </button>
        </div>
      ` : `
        <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
          <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
            <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
            更新於：${formatDate(appData.updatedAt || appData.createdAt)}
          </div>
        </div>
      `;

      card.innerHTML = `
        <div>
          <div class="app-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: nowrap; overflow-x: auto;">
            <img class="app-icon" src="${escapeHTML(appData.iconUrl)}" loading="lazy" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;" style="width: 56px; height: 56px; border-radius: 16px; box-shadow: var(--md-elevation-1); flex-shrink: 0;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: nowrap; overflow-x: auto;">
                <h3 class="app-title" style="margin: 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(appData.name)}</h3>
                <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}" style="white-space: nowrap;">
                  ${platform === 'android' ? '<span class="material-symbols-outlined" style="font-size:12px;">android</span>' : '<span style="font-size:12px;">🍎</span>'}
                  ${platform === 'android' ? 'Android' : 'iOS'}
                </span>
              </div>
              <div style="font-size: 0.75rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                包名：<code>${escapeHTML(appData.packageName) || '無'}</code>
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

        ${footerActions}
      `;
      gridEl.appendChild(card);
    });

    loadingEl.style.display = 'none';
    mainEl.style.display = 'block';
  } catch (err) { 
    console.error(err);
    loadingEl.style.display = 'none';
    mainEl.style.display = 'block';
    gridEl.innerHTML = '';
    const errorState = createEmptyState({
      icon: 'error_outline',
      title: '載入失敗',
      description: '無法載入開發者資料，請稍後再試',
      action: {
        label: '重新整理',
        onClick: () => window.openDevProfile()
      }
    });
    gridEl.appendChild(errorState);
  }
}