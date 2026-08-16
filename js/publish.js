// Publish module - handle new app submission
import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { m3Alert, m3Error, m3Success } from './m3-dialog.js';

// URL validation helper
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function validateImageUrl(url, fieldName) {
  if (!url) return true; // Optional fields
  if (!isValidUrl(url)) {
    throw new Error(`${fieldName} 格式無效，必須是 http:// 或 https:// 開頭`);
  }
  // Optional: HEAD request to verify accessibility (with timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
    // no-cors mode doesn't expose status, but if it doesn't throw, it's likely reachable
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`[Publish] Image URL validation warning for ${fieldName}:`, err.message);
      // Don't block on network errors, just warn
    }
  }
  return true;
}

export function setupPublish() {
  window.togglePlatformFields = togglePlatformFields;

  const appForm = document.getElementById('app-form');
  appForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.currentUser) return m3Alert('請先登入！');

    const platform = document.getElementById('app-platform').value;
    const packageName = document.getElementById('app-package-name').value.trim();
    const iconUrl = document.getElementById('app-icon-url').value.trim();
    const screenshotUrl1 = document.getElementById('app-screenshot-url-1').value.trim();
    const screenshotUrl2 = document.getElementById('app-screenshot-url-2').value.trim();
    const screenshotUrl3 = document.getElementById('app-screenshot-url-3').value.trim();

    if (!iconUrl) return m3Alert('請輸入 App 圖示網址！');

    // Validate URLs
    try {
      await validateImageUrl(iconUrl, 'App 圖示網址');
      await validateImageUrl(screenshotUrl1, '截圖 1');
      await validateImageUrl(screenshotUrl2, '截圖 2');
      await validateImageUrl(screenshotUrl3, '截圖 3');
    } catch (err) {
      return m3Alert(err.message, '網址格式錯誤');
    }

    let groupUrl = '';
    let storeUrl = '';
    let testFlightUrl = '';

    if (platform === 'android') {
      groupUrl = document.getElementById('group-url').value.trim();
      storeUrl = `https://play.google.com/apps/testing/${packageName}`;
    } else {
      testFlightUrl = document.getElementById('testflight-url').value.trim();
      storeUrl = testFlightUrl;
    }

    const isClosed = document.getElementById('app-is-closed').checked;

    // Check for duplicate packageName
    const appsRef = collection(db, 'apps');
    const dupQuery = query(appsRef, where('packageName', '==', packageName), where('platform', '==', platform));
    const dupSnap = await getDocs(dupQuery);
    if (!dupSnap.empty) {
      const existingApp = dupSnap.docs[0].data();
      return m3Alert(`此包名已被使用！\n已存在：${existingApp.name} (${existingApp.platform})`, '包名重複');
    }

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    submitBtn.innerText = '發布中...';

    try {
      const screenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);
      
      // Determine store field based on platform for backward compatibility
      const store = platform === 'ios' ? 'app-store' : 'google-play';
      
      await addDoc(collection(db, 'apps'), {
        name: document.getElementById('app-name').value,
        platform: platform,
        store: store,
        status: 'published',
        packageName: packageName,
        iconUrl: iconUrl,
        screenshotUrls: screenshotUrls,
        description: document.getElementById('app-desc').value,
        groupUrl: groupUrl,
        storeUrl: storeUrl,
        testFlightUrl: testFlightUrl,
        isClosed: isClosed,
        authorName: window.currentUser.displayName,
        authorUid: window.currentUser.uid,
        authorEmail: window.currentUser.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likeCount: 0,
        joinCount: 0,
        ratingSum: 0,
        ratingCount: 0
      });

      m3Success('App 專案刊登成功！');
      appForm.reset();
      window.fetchMarketApps?.(true);
      window.navigate('market-android');
    } catch (err) { 
      m3Error('發布失敗：' + err.message); 
    }
    finally {
      submitBtn.disabled = false;
      submitBtn.innerText = '發布 App 至市集';
    }
  });
}

function togglePlatformFields(formType) {
  const platformSelectId = formType === 'publish' ? 'app-platform' : `${formType}-app-platform`;
  const platform = document.getElementById(platformSelectId).value;
  const prefix = formType === 'publish' ? '' : formType + '-';
  const androidFields = document.getElementById(`${prefix}android-fields`);
  const iosFields = document.getElementById(`${prefix}ios-fields`);
  const labelPackageName = document.getElementById(`${prefix}label-package-name`);

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