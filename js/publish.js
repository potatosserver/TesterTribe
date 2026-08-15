// Publish module - handle new app submission
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';
import { IMGBB_API_KEY } from './constants.js';
import { uploadImagesToImgBB } from './utils.js';

export function setupPublish() {
  window.togglePlatformFields = togglePlatformFields;

  const appForm = document.getElementById('app-form');
  appForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.currentUser) return alert('請先登入！');

    const platform = document.getElementById('app-platform').value;
    const packageName = document.getElementById('app-package-name').value.trim();
    const iconFile = document.getElementById('app-icon-file').files[0];
    const screenshotFiles = document.getElementById('app-screenshots-files').files;

    if (!iconFile) return alert('請選擇 App 圖示！');

    let groupUrl = '';
    let storeUrl = '';

    if (platform === 'android') {
      groupUrl = document.getElementById('group-url').value.trim();
      storeUrl = `https://play.google.com/apps/testing/${packageName}`;
    } else {
      storeUrl = document.getElementById('testflight-url').value.trim();
    }

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    submitBtn.innerText = '圖片上傳中...';

    try {
      const { iconUrl, screenshotUrls } = await uploadImagesToImgBB(iconFile, screenshotFiles);

      await addDoc(collection(db, 'apps'), {
        name: document.getElementById('app-name').value,
        platform: platform,
        status: 'published',
        packageName: packageName,
        iconUrl: iconUrl,
        screenshotUrls: screenshotUrls,
        description: document.getElementById('app-desc').value,
        groupUrl: groupUrl,
        storeUrl: storeUrl,
        authorName: window.currentUser.displayName,
        authorUid: window.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likeCount: 0,
        joinCount: 0,
        ratingSum: 0,
        ratingCount: 0
      });

      alert('App 專案刊登成功！');
      appForm.reset();
      window.fetchMarketApps?.(true);
      window.switchTab('market');
    } catch (err) { 
      alert('發布失敗：' + err.message); 
    }
    finally {
      submitBtn.disabled = false;
      submitBtn.innerText = '發布 App 至市集';
    }
  });
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