// Developer profile module
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { escapeHTML, formatDate } from './utils.js';
import { getStoreFromUrl, getPlatformFromUrl, getAuthorIdentifierFromUrl } from './router.js';
import { m3Alert, m3Confirm, m3Error, m3Success } from './m3-dialog.js';

export function setupDevProfile() {
  window.openDevProfile = openDevProfile;
  window.deleteApp = deleteApp;
}

async function deleteApp(appId) {
  if (!window.currentUser) return m3Alert('請先登入！');
  const confirmed = await m3Confirm('確定要下架並刪除此專案嗎？此操作無法復原。', '確認刪除', { destructive: true });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'apps', appId));
    m3Success('專案已刪除');
    // Refresh the dev profile
    window.openDevProfile(window.currentUser.uid);
    window.fetchMarketApps?.(true);
  } catch (err) {
    console.error('刪除失敗:', err);
    m3Error('刪除失敗：' + err.message);
  }
}

async function openDevProfile(authorUid, authorName) {
  const store = getStoreFromUrl();
  const authorIdentifier = authorUid || getAuthorIdentifierFromUrl();
  
  if (!authorIdentifier) {
    window.switchTab('market');
    return;
  }

  window.navigate('dev-profile', { store, authorIdentifier: authorIdentifier });
  
  const loadingEl = document.getElementById('dev-profile-loading');
  const mainEl = document.getElementById('dev-profile-main');
  loadingEl.style.display = 'block';
  mainEl.style.display = 'none';
  document.getElementById('dev-empty-state').style.display = 'none';

  try {
    // Fetch user by UID (authorIdentifier could be UID or we need to look it up)
    const userSnap = await getDoc(doc(db, 'users', authorIdentifier));
    if (!userSnap.exists()) {
      // Try to find by display name if UID not found
      const usersQuery = query(collection(db, 'users'), where('displayName', '==', authorIdentifier));
      const usersSnapshot = await getDocs(usersQuery);
      if (!usersSnapshot.empty) {
        // Use the first match
        const matchedDoc = usersSnapshot.docs[0];
        // We'll use the matched doc's data but keep the original identifier for app queries
      } else {
        throw new Error('開發者不存在');
      }
    }
    const userData = userSnap.exists() ? userSnap.data() : {};
    const displayName = userData.displayName || authorName || '匿名開發者';
    const email = userData.email || '無公開信箱';
    const photoURL = userData.photoURL || '';
    const createdAt = userData.createdAt?.toDate ? userData.createdAt.toDate() : null;

    document.getElementById('dev-profile-name').innerText = escapeHTML(displayName);
    document.getElementById('dev-profile-email').innerText = escapeHTML(email);
    document.getElementById('dev-profile-avatar').src = photoURL || window.DEFAULT_AVATAR;
    
    // Store the actual UID for app queries
    const actualUid = userSnap.exists() ? userSnap.id : authorIdentifier;

    if (createdAt) {
      document.getElementById('dev-join-date').innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">calendar_today</span>
        ${formatDate(createdAt)} 加入
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
    const gridEl = document.getElementById('dev-apps-grid');
    gridEl.innerHTML = '';

    if (apps.length === 0) {
      document.getElementById('dev-empty-state').style.display = 'block';
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
      const platform = appData.platform || platform;

      const card = document.createElement('div');
      card.className = 'app-card';
      card.onclick = () => window.openAppDetail(appData.id);

      // For own profile, show edit/delete buttons in footer
      const footerActions = isOwnProfile ? `
        <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
          <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
            <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
            更新於：${formatDate(appData.updatedAt || appData.createdAt)}
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="event.stopPropagation(); window.openEditAppModal('${appData.id}')" class="btn btn-tonal" style="flex:1;">✏️ 編輯專案</button>
            <button onclick="event.stopPropagation(); window.deleteApp('${appData.id}')" class="btn btn-error" style="flex:1;">下架刪除</button>
          </div>
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
    document.getElementById('dev-apps-grid').innerHTML = '<div style="color: var(--md-sys-color-error); text-align: center; padding: 40px;">載入失敗，請稍後再試</div>';
  }
}