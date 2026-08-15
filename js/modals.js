// Modals module - feedback modal and edit app modal
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { uploadImagesToImgBB } from './utils.js';
import { m3Alert, m3Error, m3Success } from './m3-dialog.js';

export function setupModals() {
  // Feedback modal
  window.openFeedbackModal = openFeedbackModal;
  window.closeFeedbackModal = closeFeedbackModal;
  window.toggleRatingStarBox = toggleRatingStarBox;
  window.submitFeedback = submitFeedback;

  // Edit app modal
  window.openEditAppModal = openEditAppModal;
  window.closeEditAppModal = closeEditAppModal;
  
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
  if (!appId || !window.currentUser) return m3Alert('請先登入！');

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
    window.openAppDetail(appId);
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

    document.getElementById('edit-app-platform').value = appData.platform || 'android';
    document.getElementById('edit-app-name').value = appData.name || '';
    document.getElementById('edit-app-package-name').value = appData.packageName || '';
    document.getElementById('edit-group-url').value = appData.groupUrl || '';
    document.getElementById('edit-testflight-url').value = appData.storeUrl || '';
    document.getElementById('edit-app-desc').value = appData.description || '';

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
  const iconFile = document.getElementById('edit-app-icon-file').files[0];
  const screenshotFiles = document.getElementById('edit-app-screenshots-files').files;

  let groupUrl = '';
  let storeUrl = '';

  if (platform === 'android') {
    groupUrl = document.getElementById('edit-group-url').value.trim();
    storeUrl = `https://play.google.com/apps/testing/${packageName}`;
  } else {
    storeUrl = document.getElementById('edit-testflight-url').value.trim();
  }

  const submitBtn = document.getElementById('edit-btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerText = '更新中...';

  try {
    const updateData = {
      name: document.getElementById('edit-app-name').value,
      platform: platform,
      packageName: packageName,
      description: document.getElementById('edit-app-desc').value,
      groupUrl: groupUrl,
      storeUrl: storeUrl,
      updatedAt: serverTimestamp()
    };

    // Upload new images if provided
    if (iconFile || screenshotFiles.length > 0) {
      const { iconUrl, screenshotUrls } = await uploadImagesToImgBB(iconFile, screenshotFiles);
      if (iconUrl) updateData.iconUrl = iconUrl;
      if (screenshotUrls.length > 0) updateData.screenshotUrls = screenshotUrls;
    }

    await updateDoc(doc(db, 'apps', appId), updateData);
    m3Success('專案更新成功！');
    closeEditAppModal();
    window.openAppDetail(appId);
    window.loadMyApps?.();
    window.fetchMarketApps?.(true);
  } catch (err) {
    m3Error('更新失敗：' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = '更新專案';
  }
}