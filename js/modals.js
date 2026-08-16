// Modals module - feedback modal and edit app modal
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp, deleteDoc, setDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { m3Alert, m3Error, m3Success, m3Confirm } from './m3-dialog.js';
import { getStoreFromUrl } from './router.js';

export function setupModals() {
  // Feedback modal
  window.openFeedbackModal = openFeedbackModal;
  window.closeFeedbackModal = closeFeedbackModal;
  window.toggleRatingStarBox = toggleRatingStarBox;
  window.submitFeedback = submitFeedback;

  // Edit app modal
  window.openEditAppModal = openEditAppModal;
  window.closeEditAppModal = closeEditAppModal;
  window.confirmDeleteApp = confirmDeleteApp;
  
  // Form handlers
  document.getElementById('edit-app-form').addEventListener('submit', handleEditAppSubmit);

  // Star rating
  document.querySelectorAll('.gp-star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.value);
      document.querySelectorAll('.gp-star-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.value) <= value);
      });
    });
  });
}

function openFeedbackModal(appId) {
  if (!window.currentUser) return m3LoginRequired('請先登入才能發表評論或回報問題');
  
  window.currentFeedbackAppId = appId;
  document.getElementById('feedback-modal').style.display = 'flex';
  document.getElementById('feedback-type').value = 'review';
  document.getElementById('feedback-content').value = '';
  document.getElementById('rating-stars-box').style.display = 'block';
  document.querySelectorAll('.gp-star-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('feedback-content-label').innerText = '內容';
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal').style.display = 'none';
  window.currentFeedbackAppId = null;
}

function toggleRatingStarBox() {
  const type = document.getElementById('feedback-type').value;
  const starsBox = document.getElementById('rating-stars-box');
  const label = document.getElementById('feedback-content-label');
  
  if (type === 'review') {
    starsBox.style.display = 'block';
    label.innerText = '評論內容';
  } else {
    starsBox.style.display = 'none';
    label.innerText = type === 'bug' ? 'Bug 描述與重現步驟' : '功能建議內容';
  }
}

async function submitFeedback() {
  const appId = window.currentFeedbackAppId;
  if (!appId || !window.currentUser) return m3LoginRequired('請先登入才能發表評論或回報問題');
  
  const type = document.getElementById('feedback-type').value;
  const content = document.getElementById('feedback-content').value.trim();
  if (!content) return m3Alert('請填寫內容！');

  let rating = 5;
  if (type === 'review') {
    const activeStars = document.querySelectorAll('.gp-star-btn.active');
    rating = activeStars.length || 5;
  }

  try {
    await addDoc(collection(db, 'apps', appId, 'feedbacks'), {
      type: type,
      content: content,
      rating: type === 'review' ? rating : null,
      authorUid: window.currentUser.uid,
      authorName: window.currentUser.displayName,
      authorPhoto: window.currentUser.photoURL,
      createdAt: serverTimestamp(),
      isPinned: false
    });

    if (type === 'review') {
      const appRef = doc(db, 'apps', appId);
      const appSnap = await getDoc(appRef);
      const data = appSnap.data() || {};
      const newCount = (data.ratingCount || 0) + 1;
      const newSum = (data.ratingSum || 0) + rating;
      await updateDoc(appRef, { ratingCount: newCount, ratingSum: newSum });
    }

    m3Success('送出成功！');
    closeFeedbackModal();
    const store = getStoreFromUrl();
    window.openAppDetail(appId, store);
  } catch (err) {
    m3Error('送出失敗：' + err.message);
  }
}

function openEditAppModal(docId) {
  window.currentEditingAppId = docId;
  document.getElementById('edit-app-modal').style.display = 'flex';
  document.getElementById('edit-app-id').value = docId;
  loadAppDataForEdit(docId);
}

function closeEditAppModal() {
  document.getElementById('edit-app-modal').style.display = 'none';
  window.currentEditingAppId = null;
  document.getElementById('edit-app-form').reset();
}

async function loadAppDataForEdit(docId) {
  try {
    const appSnap = await getDoc(doc(db, 'apps', docId));
    if (!appSnap.exists()) return;
    const appData = appSnap.data();

    const platform = appData.platform || (appData.store === 'app-store' ? 'ios' : 'android');
    console.log('[Modals] App:', appData.name, 'platform field:', appData.platform, 'store field:', appData.store, 'computed platform:', platform);
    
    document.getElementById('edit-app-platform').value = platform;
    document.getElementById('edit-app-name').value = appData.name || '';
    document.getElementById('edit-app-package-name').value = appData.packageName || '';
    document.getElementById('edit-group-url').value = appData.groupUrl || '';
    document.getElementById('edit-testflight-url').value = appData.testFlightUrl || appData.storeUrl || '';
    document.getElementById('edit-app-icon-url').value = appData.iconUrl || '';
    const screenshots = appData.screenshotUrls || [];
    document.getElementById('edit-app-screenshot-url-1').value = screenshots[0] || '';
    document.getElementById('edit-app-screenshot-url-2').value = screenshots[1] || '';
    document.getElementById('edit-app-screenshot-url-3').value = screenshots[2] || '';
    document.getElementById('edit-app-desc').value = appData.description || '';
    document.getElementById('edit-app-is-closed').checked = appData.isClosed === true;

    togglePlatformFields('edit');
  } catch (err) {
    console.error('載入編輯資料失敗:', err);
  }
}

function togglePlatformFields(formType) {
  const platform = document.getElementById(`${formType}-app-platform`).value;
  const androidFields = document.getElementById(`${formType}-android-fields`);
  const iosFields = document.getElementById(`${formType}-ios-fields`);
  const labelPackageName = document.getElementById(`${formType}-label-package-name`);

  if (platform === 'android') {
    androidFields.style.display = 'block';
    iosFields.style.display = 'none';
    labelPackageName.innerText = 'Android 應用程式包名 (Package Name)';
  } else {
    androidFields.style.display = 'none';
    iosFields.style.display = 'block';
    labelPackageName.innerText = 'iOS Bundle ID';
  }
}

async function handleEditAppSubmit(e) {
  e.preventDefault();
  if (!window.currentEditingAppId || !window.currentUser) return;

  const appId = window.currentEditingAppId;
  const platform = document.getElementById('edit-app-platform').value;
  const packageName = document.getElementById('edit-app-package-name').value.trim();
  const iconUrl = document.getElementById('edit-app-icon-url').value.trim();
  const screenshotUrl1 = document.getElementById('edit-app-screenshot-url-1').value.trim();
  const screenshotUrl2 = document.getElementById('edit-app-screenshot-url-2').value.trim();
  const screenshotUrl3 = document.getElementById('edit-app-screenshot-url-3').value.trim();

  // Check for duplicate packageName (excluding current app)
  const appsRef = collection(db, 'apps');
  const dupQuery = query(appsRef, where('packageName', '==', packageName), where('platform', '==', platform));
  const dupSnap = await getDocs(dupQuery);
  const existingApp = dupSnap.docs.find(doc => doc.id !== appId);
  if (existingApp) {
    const data = existingApp.data();
    return m3Alert(`此包名已被使用！\n已存在：${data.name} (${data.platform})`, '包名重複');
  }

  let groupUrl = '';
  let storeUrl = '';
  let testFlightUrl = '';

  if (platform === 'android') {
    groupUrl = document.getElementById('edit-group-url').value.trim();
    storeUrl = `https://play.google.com/apps/testing/${packageName}`;
  } else {
    testFlightUrl = document.getElementById('edit-testflight-url').value.trim();
    storeUrl = testFlightUrl;
  }

  const isClosed = document.getElementById('edit-app-is-closed').checked;

  const submitBtn = document.getElementById('edit-btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerText = '更新中...';

  try {
    const screenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);
    
    // Determine store field based on platform for backward compatibility
    const store = platform === 'ios' ? 'app-store' : 'google-play';
    
    const updateData = {
      name: document.getElementById('edit-app-name').value,
      platform: platform,
      store: store,
      packageName: packageName,
      iconUrl: iconUrl,
      screenshotUrls: screenshotUrls,
      description: document.getElementById('edit-app-desc').value,
      groupUrl: groupUrl,
      storeUrl: storeUrl,
      testFlightUrl: testFlightUrl,
      isClosed: isClosed,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, 'apps', appId), updateData);
    m3Success('專案更新成功！');
    closeEditAppModal();
    
    // Navigate back to the current user's developer profile
    if (window.currentUser) {
      const store = getStoreFromUrl();
      window.navigate('dev-profile', { store, authorUid: window.currentUser.uid });
    } else {
      window.navigate('market-android');
    }
    
    window.loadMyApps?.();
    window.fetchMarketApps?.(true);
  } catch (err) {
    m3Error('更新失敗：' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = '更新專案';
  }
}

async function confirmDeleteApp() {
  const appId = window.currentEditingAppId;
  if (!appId) return;
  
  const confirmed = await m3Confirm('確定要下架並刪除此專案嗎？此操作無法復原。', '確認刪除');
  if (!confirmed) return;
  
  try {
    await deleteDoc(doc(db, 'apps', appId));
    m3Success('專案已刪除');
    closeEditAppModal();
    
    // Navigate back to the current user's developer profile
    if (window.currentUser) {
      const store = getStoreFromUrl();
      window.navigate('dev-profile', { store, authorUid: window.currentUser.uid });
    } else {
      window.navigate('market-android');
    }
    
    window.loadMyApps?.();
    window.fetchMarketApps?.(true);
  } catch (err) {
    m3Error('刪除失敗：' + err.message);
  }
}