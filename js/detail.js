// Detail module - app detail view with Google Play style layout
import { doc, getDoc, collection, query, getDocs, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';
import { escapeHTML, formatDate } from './utils.js';
import { getAppIdFromUrl, getStoreFromUrl, platformToStore } from './router.js';

export function setupDetail() {
  window.openAppDetail = openAppDetail;
  window.handleToggleLikeDetail = handleToggleLikeDetail;
  window.toggleJoinTestDetail = toggleJoinTestDetail;
  window.togglePinFeedback = togglePinFeedback;
  window.openFeedbackModal = openFeedbackModal;
}

async function openAppDetail(appId) {
  // Get the store from the current URL (this works whether we are in the market or in the appDetail)
  const store = getStoreFromUrl();
  // If appId is provided, use it; otherwise, try to get it from the URL
  const id = appId || getAppIdFromUrl();
  if (!id) {
    window.switchTab('market');
    return;
  }

  // If we were given an appId (i.e., we are not just refreshing the current appDetail), then update the URL to include the store and appId
  if (appId) {
    window.switchTab('appDetail', { store, appId: id });
  } else {
    // We are just refreshing, so we don't need to change the URL, just stay on the current tab
    window.switchTab('appDetail');
  }

  window.currentDetailAppId = id;
  
  const detailContent = document.getElementById('detail-content');
  detailContent.innerHTML = '<div style="text-align:center; padding:40px;">載入專案資訊中...</div>';

  try {
    const appSnap = await getDoc(doc(db, 'apps', appId));
    if (!appSnap.exists()) return detailContent.innerHTML = '找不到該專案。';

    const appData = appSnap.data();
    const screenshots = appData.screenshotUrls || [];
    const avgRating = appData.ratingCount ? (appData.ratingSum / appData.ratingCount).toFixed(1) : '尚無';
    const joinCount = appData.joinCount || 0;
    const progressPercent = Math.min(100, Math.round((joinCount / 20) * 100));
    const platform = appData.platform || 'android';
    const isAppAuthor = window.currentUser && (window.currentUser.uid === appData.authorUid);

    let isLiked = false;
    let isJoined = false;

    if (window.currentUser) {
      const [likeSnap, testerSnap] = await Promise.all([
        getDoc(doc(db, 'apps', appId, 'likes', window.currentUser.uid)),
        getDoc(doc(db, 'apps', appId, 'testers', window.currentUser.uid))
      ]);
      isLiked = likeSnap.exists();
      isJoined = testerSnap.exists();
    }

    const feedbackQ = query(collection(db, 'apps', appId, 'feedbacks'));
    const feedbackSnap = await getDocs(feedbackQ);
    let rawFeedbacks = [];

    feedbackSnap.forEach(fSnap => {
      rawFeedbacks.push({ id: fSnap.id, ...fSnap.data() });
    });

    rawFeedbacks.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    const myExistingFeedback = window.currentUser ? rawFeedbacks.find(fb => fb.authorUid === window.currentUser.uid) : null;

    let feedbackListHtml = '';
    if (rawFeedbacks.length === 0) {
      feedbackListHtml = '<div style="color: #888; text-align: center; padding: 20px 0;">目前尚無社群評論，成為第一個發表評論的人吧！</div>';
    } else {
      rawFeedbacks.forEach((fb) => {
        const isPinned = fb.isPinned || false;

        let typeBadge = '';
        if (fb.type === 'review') {
          const starsHtml = '★'.repeat(fb.rating || 5) + '☆'.repeat(5 - (fb.rating || 5));
          typeBadge = `<span class="type-badge type-review"><span style="color:#f59e0b;">${starsHtml}</span> (${fb.rating} 星)</span>`;
        } else if (fb.type === 'bug') {
          typeBadge = `<span class="type-badge type-bug"><span class="material-symbols-outlined" style="font-size:12px;">bug_report</span> Bug 回報</span>`;
        } else {
          typeBadge = `<span class="type-badge type-suggestion"><span class="material-symbols-outlined" style="font-size:12px;">lightbulb</span> 功能建議</span>`;
        }

        feedbackListHtml += `
          <div class="feedback-item ${isPinned ? 'pinned' : ''}">
            ${isPinned ? `<div class="pinned-badge"><span class="material-symbols-outlined" style="font-size:14px;">push_pin</span> 開發者置頂留言</div>` : ''}
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div>${typeBadge} <span style="font-size:0.8rem; color:#888; margin-left:8px;">來自：${escapeHTML(fb.authorName)}</span></div>
              
              <div style="display:flex; gap:8px;">
                ${isAppAuthor ? `
                  <button onclick="window.togglePinFeedback('${appId}', '${fb.id}', ${isPinned})" class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem;">
                    <span class="material-symbols-outlined" style="font-size:14px;">push_pin</span> ${isPinned ? '取消置頂' : '置頂此留言'}
                  </button>
                ` : ''}
              </div>
            </div>

            <div style="font-size:0.92rem; line-height:1.5; white-space:pre-line;">${escapeHTML(fb.content)}</div>
          </div>
        `;
      });
    }

    const testingOptInUrl = `https://play.google.com/apps/testing/${escapeHTML(appData.packageName)}`;
    const playStoreUrl = `https://play.google.com/store/apps/details?id=${escapeHTML(appData.packageName)}`;

    detailContent.innerHTML = `
      <div class="gp-layout">
        
        <div class="gp-main">
          <div class="gp-header">
            <img class="gp-icon" src="${escapeHTML(appData.iconUrl)}" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0;">${escapeHTML(appData.name)}</h1>
                <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}">
                  <span class="material-symbols-outlined" style="font-size:14px;">${platform === 'android' ? 'android' : 'phone_iphone'}</span>
                  ${platform === 'android' ? 'Android' : 'iOS'}
                </span>
              </div>
              <div style="font-size: 0.9rem; color: #666;">
                包名：<code>${escapeHTML(appData.packageName) || '無'}</code> | 開發者：<a href="javascript:void(0)" onclick="window.openDevProfile('${appData.authorUid}', '${escapeHTML(appData.authorName)}')" class="author-link">${escapeHTML(appData.authorName) || '匿名'}</a>
                ${isAppAuthor ? `<button onclick="window.openEditAppModal('${appId}')" class="btn btn-tonal" style="padding:2px 10px; font-size:0.8rem; margin-left:8px;">✏️ 編輯專案</button>` : ''}
              </div>
            </div>
          </div>

          ${screenshots.length > 0 ? `
            <div class="gp-section">
              <h3 class="gp-section-title">
                <span class="material-symbols-outlined">smartphone</span> 畫面截圖
              </h3>
              <div class="detail-screenshots">
                ${screenshots.map(url => `<img src="${escapeHTML(url)}" class="detail-screenshot-img" onclick="window.open('${escapeHTML(url)}', '_blank')">`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="gp-section">
            <h3 class="gp-section-title">
              <span class="material-symbols-outlined">description</span> 簡介與測試需求
            </h3>
            <p class="gp-description">${escapeHTML(appData.description)}</p>
          </div>

          <div class="gp-section">
            <h3 class="gp-section-title">
              <span class="material-symbols-outlined">link</span> 測試步驟連結
            </h3>
            <div class="gp-action-buttons">
              ${platform === 'android' ? `
                <a href="${escapeHTML(appData.groupUrl)}" target="_blank" class="btn btn-tonal gp-btn-link">1. 加入 Google 測試群組</a>
                <a href="${testingOptInUrl}" target="_blank" class="btn btn-tonal gp-btn-link">2. 成為測試人員 (Opt-in)</a>
                <a href="${playStoreUrl}" target="_blank" class="btn btn-primary gp-btn-link">3. 前往 Google Play 商店下載測試版 App</a>
              ` : `
                <a href="${escapeHTML(appData.storeUrl)}" target="_blank" class="btn btn-primary gp-btn-link">加入 TestFlight 測試</a>
              `}
            </div>
          </div>
        </div>

        <!-- 右側邊欄 -->
        <div class="gp-sidebar">
          <div class="gp-sidebar-card">
            
            <div class="timestamp-box">
              <div>📅 <strong>上架時間：</strong>${formatDate(appData.createdAt)}</div>
              <div>✏️ <strong>最後編輯：</strong>${formatDate(appData.updatedAt || appData.createdAt)}</div>
            </div>

            <div class="gp-sidebar-item">
              <div class="gp-sidebar-label">愛心收藏</div>
              <button onclick="window.handleToggleLikeDetail('${appId}')" class="btn ${isLiked ? 'btn-like-active' : 'btn-tonal'}" id="btn-detail-like-${appId}" style="width:100%; padding:10px;">
                <span class="material-symbols-outlined">favorite</span>
                <span id="detail-like-text">${isLiked ? '已按讚' : '點擊按讚'}</span> (<span id="detail-like-count">${appData.likeCount || 0}</span>)
              </button>
            </div>

            <hr class="gp-divider">

            <div class="gp-sidebar-item">
              <div class="gp-sidebar-label">Google 封閉測試進度 (${joinCount} / 20 人)</div>
              <div class="progress-bar-bg" style="margin-bottom:12px;">
                <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
              </div>
              <button onclick="window.toggleJoinTestDetail('${appId}', ${isJoined})" class="btn ${isJoined ? 'btn-error' : 'btn-primary'}" style="width:100%; padding:12px;">
                <span class="material-symbols-outlined">${isJoined ? 'cancel' : 'check_circle'}</span>
                ${isJoined ? '已加入測試 (點擊退出)' : '回報已加入測試'}
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- 最下方獨立區塊：社群評價 -->
      <div class="bottom-reviews-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800; margin: 0; display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-outlined" style="color:var(--md-sys-color-primary);">forum</span>
              社群評價與反饋 (平均 <span class="material-symbols-outlined" style="font-size:20px; color:#f59e0b;">star</span> ${avgRating})
            </h3>
            <p style="font-size: 0.85rem; color: #666; margin: 4px 0 0 0;">共有 ${appData.ratingCount || 0} 位測試人員評價</p>
          </div>

          ${isAppAuthor ? `
            <button class="btn btn-tonal" disabled style="opacity:0.7;">開發者無法評分</button>
          ` : `
            <button onclick="window.openFeedbackModal('${appId}')" class="btn btn-primary">
              <span class="material-symbols-outlined">${myExistingFeedback ? 'edit_note' : 'rate_review'}</span> 
              ${myExistingFeedback ? '更新我的評論 / 反饋' : '發表評論 / 回報 Bug'}
            </button>
          `}
        </div>

        <div>${feedbackListHtml}</div>
      </div>
    `;
  } catch (err) { 
    console.error('載入詳情失敗:', err); 
  }
}

async function handleToggleLikeDetail(appId) {
  if (!window.currentUser) return alert('請先登入！');
  
  const likeRef = doc(db, 'apps', appId, 'likes', window.currentUser.uid);
  const likeSnap = await getDoc(likeRef);
  const appRef = doc(db, 'apps', appId);

  if (likeSnap.exists()) {
    // Unlike
    await deleteDoc(likeRef);
    await updateDoc(appRef, { likeCount: Math.max(0, (await getDoc(appRef)).data()?.likeCount - 1 || 0) });
  } else {
    // Like
    await setDoc(likeRef, { createdAt: serverTimestamp() });
    await updateDoc(appRef, { likeCount: ((await getDoc(appRef)).data()?.likeCount || 0) + 1 });
  }
  window.openAppDetail(appId); // Refresh
}

async function toggleJoinTestDetail(appId, isJoined) {
  if (!window.currentUser) return alert('請先登入！');
  
  const testerRef = doc(db, 'apps', appId, 'testers', window.currentUser.uid);
  
  if (isJoined) {
    await deleteDoc(testerRef);
  } else {
    await setDoc(testerRef, { joinedAt: serverTimestamp() });
  }
  window.openAppDetail(appId); // Refresh
}

async function togglePinFeedback(appId, feedbackId, isPinned) {
  if (!window.currentUser) return;
  const fbRef = doc(db, 'apps', appId, 'feedbacks', feedbackId);
  await updateDoc(fbRef, { isPinned: !isPinned });
  window.openAppDetail(appId);
}

function openFeedbackModal(appId) {
  window.currentFeedbackAppId = appId;
  document.getElementById('feedback-modal').style.display = 'flex';
  document.getElementById('feedback-type').value = 'review';
  document.getElementById('feedback-content').value = '';
  document.getElementById('rating-stars-box').style.display = 'block';
  document.querySelectorAll('.gp-star-btn').forEach(btn => btn.classList.remove('active'));
}