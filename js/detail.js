// Detail module - app detail view with Google Play style layout
import { doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { escapeHTML, formatDate } from './utils.js';
import { getPackageNameFromUrl, getStoreFromUrl, platformToStore } from './router.js';
import { m3Alert, m3Error, m3Success, m3Confirm } from './m3-dialog.js';

export function setupDetail() {
  window.openAppDetail = openAppDetail;
  window.handleToggleLikeDetail = handleToggleLikeDetail;
  window.toggleJoinTestDetail = toggleJoinTestDetail;
  window.togglePinFeedback = togglePinFeedback;
  window.openFeedbackModal = openFeedbackModal;
  window.openScreenshotLightbox = openScreenshotLightbox;
}

function getStepChecks(appId) {
  if (!window.currentUser) return {};
  try {
    const key = `stepChecks_${appId}_${window.currentUser.uid}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch { return {}; }
}

function setStepCheck(appId, stepNum, checked) {
  if (!window.currentUser) return;
  const key = `stepChecks_${appId}_${window.currentUser.uid}`;
  const checks = getStepChecks(appId);
  checks[stepNum] = checked;
  localStorage.setItem(key, JSON.stringify(checks));
}

function clearStepChecks(appId) {
  if (!window.currentUser) return;
  const key = `stepChecks_${appId}_${window.currentUser.uid}`;
  localStorage.removeItem(key);
}

async function openAppDetail(appId, storeFromCard) {
  const store = storeFromCard || getStoreFromUrl();
  const pkgName = appId || getPackageNameFromUrl();
  const platform = store === 'app-store' ? 'ios' : 'android';
  
  if (!pkgName) {
    window.navigate('market-android');
    return;
  }
  
  window.navigate('app', { store, packageName: pkgName });
  
  window.currentDetailAppId = pkgName;
  
  const detailContent = document.getElementById('detail-content');
  detailContent.innerHTML = '<div style="text-align:center; padding:40px;">載入專案資訊中...</div>';
  
  try {
    // Find app by packageName AND platform to avoid cross-store contamination
    const appsQuery = query(
      collection(db, 'apps'), 
      where('packageName', '==', pkgName),
      where('platform', '==', platform)
    );
    const appsSnap = await getDocs(appsQuery);
    
    if (appsSnap.empty) return detailContent.innerHTML = '找不到該專案。';
    
    const appSnap = appsSnap.docs[0];
    const id = appSnap.id;
    const appData = appSnap.data();
    const screenshots = appData.screenshotUrls || [];
    const avgRating = appData.ratingCount ? (appData.ratingSum / appData.ratingCount).toFixed(1) : '尚無';
    const joinCount = appData.joinCount || 0;
    const MAX_TESTERS = 12;
    const progressPercent = Math.min(100, Math.round((joinCount / MAX_TESTERS) * 100));
    const isCompleted = joinCount >= MAX_TESTERS;
    const appDataPlatform = appData.platform || (appData.store === 'app-store' ? 'ios' : 'android');
    
    // Debug: log platform detection
    console.log('[Detail] App:', appData.name, 'platform field:', appData.platform, 'store field:', appData.store, 'computed platform:', appDataPlatform);
    
    const isAppAuthor = window.currentUser && (window.currentUser.uid === appData.authorUid);
    
    const REQUIRED_STEPS = appDataPlatform === 'ios' ? 1 : 3;
    
    let isLiked = false;
    let isJoined = false;
    
    if (window.currentUser) {
      const [likeSnap, testerSnap] = await Promise.all([
        getDoc(doc(db, 'apps', id, 'likes', window.currentUser.uid)),
        getDoc(doc(db, 'apps', id, 'testers', window.currentUser.uid))
      ]);
      isLiked = likeSnap.exists();
      isJoined = testerSnap.exists();
    }
    
    const stepChecks = getStepChecks(id);
    
    function getStepChecked(stepNum, appId) {
      return stepChecks[stepNum] || false;
    }
    
    const feedbackQ = query(collection(db, 'apps', id, 'feedbacks'));
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
          typeBadge = `<span class="type-badge type-review"><span style="color:#f59e0b;">${starsHtml}</span></span>`;
        } else if (fb.type === 'bug') {
          typeBadge = `<span class="type-badge type-bug"><span class="material-symbols-outlined" style="font-size:12px;">bug_report</span> Bug 回報</span>`;
        } else {
          typeBadge = `<span class="type-badge type-suggestion"><span class="material-symbols-outlined" style="font-size:12px;">lightbulb</span> 功能建議</span>`;
        }
        
        feedbackListHtml += `
          <div class="feedback-item ${isPinned ? 'pinned' : ''}">
            ${isPinned ? `<div class="pinned-badge"><span class="material-symbols-outlined" style="font-size:14px;">push_pin</span> 開發者置頂留言</div>` : ''}
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600; font-size: 0.9rem;">${escapeHTML(fb.authorName)}</span>
                ${fb.type === 'review' ? `<span style="color:#f59e0b;">${'★'.repeat(fb.rating || 5) + '☆'.repeat(5 - (fb.rating || 5))}</span>` : typeBadge}
              </div>
              <div style="display:flex; gap:8px;">
                ${isAppAuthor ? `
                  <button onclick="window.togglePinFeedback('${id}', '${fb.id}', ${isPinned})" class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem;">
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
          <div class="gp-header" style="display: flex; align-items: stretch; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0; min-height: 100%;">
              <img class="gp-icon" src="${escapeHTML(appData.iconUrl)}" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;" style="width: 72px; height: 72px; border-radius: 20px; box-shadow: var(--md-elevation-1);">
              <span class="platform-badge ${platform === 'android' ? 'platform-android' : 'platform-ios'}" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                ${platform === 'android' ? '<span class="material-symbols-outlined" style="font-size:14px;">android</span>' : '<span style="font-size:14px;">🍎</span>'}
                ${platform === 'android' ? 'Android' : 'iOS'}
              </span>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
              <h1 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(appData.name)}</h1>
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                包名：<code>${escapeHTML(appData.packageName) || '無'}</code>
              </div>
              <div style="font-size: 0.85rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                開發者：<a href="javascript:void(0)" onclick="window.navigate('dev-profile', { store: '${appData.store || (appData.platform === 'ios' ? 'app-store' : 'google-play')}', authorEmail: '${escapeHTML(appData.authorEmail || '')}' })" class="author-link">${escapeHTML(appData.authorName) || '匿名'}</a>
              </div>
            </div>
          </div>
          
          ${screenshots.length > 0 ? `
            <div class="gp-section">
              <h3 class="gp-section-title">
                <span class="material-symbols-outlined">smartphone</span> 畫面截圖
              </h3>
              <div class="detail-screenshots">
                ${screenshots.map(url => `<img src="${escapeHTML(url)}" class="detail-screenshot-img" onclick="openScreenshotLightbox('${escapeHTML(url)}')">`).join('')}
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
            <div class="gp-steps-with-sidebar">
              <div class="gp-action-buttons">
                ${!appData.isClosed && platform === 'android' ? `
                  <!-- Step 1-2: Guide + Link wrapped together in one box -->
                  <div class="gp-step-group">
                    <div class="gp-step-guide">
                      <div>點擊頁面中央上方的「<strong>加入群組</strong>」按鈕。</div>
                      <div>在彈出視窗中確認您的資訊，點選右下角完成加入。</div>
                    </div>
                    <div class="gp-step-btn" data-step="1" data-url="${escapeHTML(appData.groupUrl)}">
                      <span class="gp-step-check" data-step="1" ${getStepChecked(1, id) ? 'checked' : ''}></span>
                      <span class="gp-step-content">
                        <span class="material-symbols-outlined">group_add</span>
                        <span>加入 Google 測試群組</span>
                        <span class="material-symbols-outlined gp-step-link-icon">open_in_new</span>
                      </span>
                    </div>
                  </div>
                  
                  <!-- Step 3: Guide + Link wrapped together in one box -->
                  <div class="gp-step-group">
                    <div class="gp-step-guide">
                      <div>點擊頁面中的「<strong>成為測試人員 (Become a Tester)</strong>」按鈕。</div>
                    </div>
                    <div class="gp-step-btn" data-step="2" data-url="${escapeHTML(testingOptInUrl)}">
                      <span class="gp-step-check" data-step="2" ${getStepChecked(2, id) ? 'checked' : ''}></span>
                      <span class="gp-step-content">
                        <span class="material-symbols-outlined">person_add</span>
                        <span>成為測試人員 (Opt-in)</span>
                        <span class="material-symbols-outlined gp-step-link-icon">open_in_new</span>
                      </span>
                    </div>
                  </div>
                ` : ''}
                ${platform === 'android' ? `
                  <!-- Step 4: Download link (always shown for Android) -->
                  <div class="gp-step-btn" data-step="${!appData.isClosed ? '3' : '1'}" data-url="${escapeHTML(playStoreUrl)}">
                    <span class="gp-step-check" data-step="${!appData.isClosed ? '3' : '1'}" ${getStepChecked(!appData.isClosed ? 3 : 1, id) ? 'checked' : ''}></span>
                    <span class="gp-step-content">
                      <span class="material-symbols-outlined">download</span>
                      <span>${!appData.isClosed ? '前往 Google Play 商店下載測試版 App' : '前往 Google Play 商店下載 App'}</span>
                      <span class="material-symbols-outlined gp-step-link-icon">open_in_new</span>
                    </span>
                  </div>
                ` : `
                  <div class="gp-step-btn" data-step="1" data-url="${escapeHTML(appData.storeUrl || appData.testFlightUrl)}">
                    <span class="gp-step-check" data-step="1" ${getStepChecked(1, id) ? 'checked' : ''}></span>
                    <span class="gp-step-content">
                      <span class="material-symbols-outlined">flight_takeoff</span>
                      <span>加入 TestFlight 測試</span>
                      <span class="material-symbols-outlined gp-step-link-icon">open_in_new</span>
                    </span>
                  </div>
                `}
              </div>
              
              <!-- Sidebar info moved here -->
              <div class="gp-sidebar-inline">
                <div class="gp-sidebar-card">
                  <div class="timestamp-box">
                    <div>📅 <strong>上架時間：</strong>${formatDate(appData.createdAt)}</div>
                    <div>✏️ <strong>最後編輯：</strong>${formatDate(appData.updatedAt || appData.createdAt)}</div>
                  </div>
                  
                  <div class="gp-sidebar-item">
                    <div class="gp-sidebar-label">愛心收藏</div>
                    <button onclick="window.handleToggleLikeDetail('${id}')" class="btn ${isLiked ? 'btn-like-active' : 'btn-tonal'}" id="btn-detail-like-${id}" style="width:100%; padding:10px;">
                      <span class="material-symbols-outlined">favorite</span>
                      <span id="detail-like-text">${isLiked ? '已按讚' : '點擊按讚'}</span> (<span id="detail-like-count">${appData.likeCount || 0}</span>)
                    </button>
                  </div>
                  
                  <hr class="gp-divider">
                  
                  ${!appData.isClosed ? `
                  <div class="gp-sidebar-item">
                    <div class="gp-sidebar-label">
                      ${platform === 'ios' ? 'TestFlight 測試進度' : 'Google 封閉測試進度'} 
                      <span id="detail-progress-text" style="color: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}; font-weight: 700;">
                        ${joinCount} / ${MAX_TESTERS} 人 (${progressPercent}%)
                      </span>
                    </div>
                    <div class="progress-bar-bg" style="margin-bottom:12px;">
                      <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'};"></div>
                    </div>
                    <button onclick="window.toggleJoinTestDetail('${id}', ${isJoined})" class="btn ${isJoined ? 'btn-error' : (isCompleted ? 'btn-tonal' : 'btn-primary')}" style="width:100%; padding:12px;" ${isCompleted && !isJoined ? 'disabled' : ''}>
                      <span class="material-symbols-outlined">${isJoined ? 'cancel' : (isCompleted ? 'check_circle' : 'check_circle')}</span>
                      ${isJoined ? '已加入測試 (點擊退出)' : (isCompleted ? '測試名額已滿' : '回報已加入測試')}
                    </button>
                  </div>
                  ` : `
                  <div class="gp-sidebar-item">
                    <div class="gp-sidebar-label">
                      ${platform === 'ios' ? 'TestFlight 測試人數' : 'Google 測試人數'} 
                      <span style="color: var(--md-sys-color-primary); font-weight: 700;">
                        ${joinCount} 人
                      </span>
                    </div>
                  </div>
                  `}
                </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- 社群評價與反饋：放在 gp-main 內部，寬度自動與左側同寬 -->
                        <div class="bottom-reviews-section">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
                            <div>
                              <h3 style="font-size: 1.25rem; font-weight: 800; margin: 0; display:flex; align-items:center; gap:8px;">
                                <span class="material-symbols-outlined" style="color:var(--md-sys-color-primary);">forum</span>
                                社群評價與反饋 ${appData.ratingCount && appData.ratingCount > 0 ? `<span style="color:#999;">(</span><span style="color:#f59e0b; font-weight: 700;">${(appData.ratingSum / appData.ratingCount).toFixed(1)}</span> <span class="material-symbols-outlined" style="font-size:18px; color:#f59e0b;">star</span><span style="color:#999;">)</span>` : '<span style="color:#999;">(尚無評價)</span>'}
                              </h3>
                              <p style="font-size: 0.85rem; color: #666; margin: 4px 0 0 0;">共有 ${appData.ratingCount || 0} 位測試人員評價</p>
                            </div>
            
                            ${isAppAuthor ? `
                              <button class="btn btn-tonal" disabled style="opacity:0.7;">開發者無法評分</button>
                            ` : `
                              <button onclick="window.openFeedbackModal('${id}')" class="btn btn-primary">
                                <span class="material-symbols-outlined">${myExistingFeedback ? 'edit_note' : 'rate_review'}</span> 
                                ${myExistingFeedback ? '更新我的評論 / 反饋' : '發表評論 / 回報 Bug'}
                              </button>
                            `}
                          </div>
          
                          <div>${feedbackListHtml}</div>
                        </div>

                      </div>
                    `;
    
    // Attach click handlers for step buttons
    setTimeout(() => {
      document.querySelectorAll('.gp-step-btn').forEach(btn => {
        // Skip if already bound
        if (btn.dataset.stepBound === 'true') return;
        btn.dataset.stepBound = 'true';
        
        const step = btn.dataset.step;
        const url = btn.dataset.url;
        const checkbox = btn.querySelector('.gp-step-check');
        const stepNum = parseInt(step);
        
        const isCompleted = () => {
          const stepChecks = getStepChecks(id);
          return stepChecks[stepNum] === true;
        };
        
        const isPrevCompleted = () => {
          if (stepNum <= 1) return true;
          const stepChecks = getStepChecks(id);
          return stepChecks[stepNum - 1] === true;
        };
        
        // Single click handler for the entire step button (div)
        btn.addEventListener('click', async (e) => {
          console.log('[StepBtn] Click:', { step: stepNum, url, target: e.target.tagName, targetClass: e.target.className });
          
          if (!window.currentUser) {
            await m3LoginRequired('請先登入才能操作測試步驟');
            return;
          }
          
          const completed = isCompleted();
          const isChecked = checkbox.classList.contains('checked');
          
          console.log('[StepBtn] State:', { step: stepNum, completed, isChecked });
          
          if (!isChecked) {
            // Trying to check
            if (!isPrevCompleted()) {
              await m3Alert(`請先完成步驟 ${stepNum - 1} 再勾選此步驟。`, '順序錯誤');
              return;
            }
            console.log('[StepBtn] Checking step', stepNum);
            checkbox.classList.add('checked');
            setStepCheck(id, stepNum, true);
          } else if (completed && url) {
            // Already checked and step completed - open the link
            console.log('[StepBtn] Opening URL:', url);
            window.open(url, '_blank');
          } else {
            console.log('[StepBtn] No action - checked but not completed');
          }
        });
      });
    }, 0);
  } catch (err) { 
    console.error('載入詳情失敗:', err); 
  }
}

async function handleToggleLikeDetail(appId) {
  if (!window.currentUser) return m3LoginRequired('請先登入才能按讚');
  
  const appRef = doc(db, 'apps', appId);
  const appSnap = await getDoc(appRef);
  const appData = appSnap.data();
  console.log('Author check:', { appId, exists: appSnap.exists(), appData, authorUid: appData?.authorUid, currentUid: window.currentUser?.uid });
  if (appSnap.exists() && appData && appData.authorUid === window.currentUser.uid) {
    m3Alert('開發者無法為自己的專案按讚！', '無法按讚');
    return;
  }
  
  const likeRef = doc(db, 'apps', appId, 'likes', window.currentUser.uid);
  const likeSnap = await getDoc(likeRef);
  
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(appRef, { likeCount: Math.max(0, (await getDoc(appRef)).data()?.likeCount - 1 || 0) });
  } else {
    await setDoc(likeRef, { createdAt: serverTimestamp() });
    await updateDoc(appRef, { likeCount: ((await getDoc(appRef)).data()?.likeCount || 0) + 1 });
  }
  const store = getStoreFromUrl();
  window.openAppDetail(appId, store);
}

async function toggleJoinTestDetail(appId, isJoined) {
  if (!window.currentUser) return m3LoginRequired('請先登入才能回報已加入測試');
  
  const appRef = doc(db, 'apps', appId);
  const appSnap = await getDoc(appRef);
  const appData = appSnap.data();
  const platform = appData?.platform || (appData?.store === 'app-store' ? 'ios' : 'android');
  const isClosed = appData?.isClosed === true;
  const REQUIRED_STEPS = platform === 'ios' ? 1 : 3;
  
  if (!isJoined) {
    const appSnap2 = await getDoc(doc(db, 'apps', appId));
    const appData2 = appSnap2.data();
    const currentJoinCount = appData2?.joinCount || 0;
    const MAX_TESTERS = 12;
    if (currentJoinCount >= MAX_TESTERS) {
      m3Alert(`測試名額已滿（${MAX_TESTERS} 人），無法加入。`, '名額已滿');
      return;
    }
    
    // If app is closed, skip step validation
    if (!isClosed) {
      const stepChecks = getStepChecks(appId);
      let allStepsCompleted = true;
      for (let i = 1; i <= REQUIRED_STEPS; i++) {
        if (stepChecks[i] !== true) {
          allStepsCompleted = false;
          break;
        }
      }
      
      if (!allStepsCompleted) {
        let nextStep = 1;
        for (let i = 1; i <= REQUIRED_STEPS; i++) {
          if (stepChecks[i] !== true) {
            nextStep = i;
            break;
          }
        }
        
        m3Alert(`請先按順序完成所有測試步驟（步驟 ${nextStep} 尚未完成），再回報已加入測試。`, '步驟未完成');
        return;
      }
      
      const confirmed = await m3Confirm('確定已完成所有步驟並下載測試版 App？', '確認加入測試', {
        confirmText: '已下載完成',
        cancelText: '取消',
        destructive: false
      });
      
      if (!confirmed) return;
    }
  } else {
    clearStepChecks(appId);
  }
  
  const testerRef = doc(db, 'apps', appId, 'testers', window.currentUser.uid);
  
  try {
    if (isJoined) {
      await deleteDoc(testerRef);
      const appSnap = await getDoc(appRef);
      const currentCount = appSnap.data()?.joinCount || 0;
      await updateDoc(appRef, { joinCount: Math.max(0, currentCount - 1) });
    } else {
      await setDoc(testerRef, { joinedAt: serverTimestamp() });
      const appSnap = await getDoc(appRef);
      const currentCount = appSnap.data()?.joinCount || 0;
      await updateDoc(appRef, { joinCount: currentCount + 1 });
    }
  } catch (err) {
    console.error('更新測試狀態失敗:', err);
    m3Error('操作失敗：' + err.message);
    return;
  }
  
  const store = getStoreFromUrl();
  window.openAppDetail(appId, store);
}

async function togglePinFeedback(appId, feedbackId, isPinned) {
  if (!window.currentUser) return;
  const fbRef = doc(db, 'apps', appId, 'feedbacks', feedbackId);
  await updateDoc(fbRef, { isPinned: !isPinned });
  const store = getStoreFromUrl();
  window.openAppDetail(appId, store);
}

function openFeedbackModal(appId) {
  window.currentFeedbackAppId = appId;
  document.getElementById('feedback-modal').style.display = 'flex';
  document.getElementById('feedback-type').value = 'review';
  document.getElementById('feedback-content').value = '';
  document.getElementById('rating-stars-box').style.display = 'block';
  document.querySelectorAll('.gp-star-btn').forEach(btn => btn.classList.remove('active'));
}

function openScreenshotLightbox(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  overlay.onclick = () => overlay.remove();
  
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
  img.onclick = (e) => e.stopPropagation();
  
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  
  // Close on ESC
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);
}