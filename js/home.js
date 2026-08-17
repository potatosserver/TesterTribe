// Home page module - handles home page functionality
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';

/**
 * 只使用一次 Firestore 請求取得所有 app 資料，然後在前端一次性計算所有統計。
 * 這樣可以把原本多次的 `cachedGetDocs`、分批讀取等操作全部合併成 **1 次** `getDocs` 呼叫。
 */
export function setupHome() {
  // 直接載入一次統計資料
  loadHomeStats();
  // 讓外部可以手動重新載入（例如開發除錯）
  window.refreshHomeStats = loadHomeStats;
}

async function loadHomeStats() {
  try {
    // 1️⃣ 只發出一次請求，取得所有 app（只取必要欄位以減少傳輸量）
    const snap = await getDocs(collection(db, 'apps'));
    const apps = [];
    snap.forEach(doc => {
      const data = doc.data();
      // 只保留我們需要的欄位，避免不必要的資料傳輸
      apps.push({
        platform: data.platform,
        store: data.store,
        authorUid: data.authorUid,
        joinCount: data.joinCount || 0
      });
    });

    // -----------------------------------------------------------------
    // 以下全部在前端一次性完成統計，沒有額外的 Firestore 呼叫
    // -----------------------------------------------------------------
    const totalApps = apps.length;
    const uniqueDevelopers = new Set(apps.map(a => a.authorUid).filter(Boolean));
    const totalTests = apps.reduce((sum, a) => sum + (a.joinCount || 0), 0);

    // 平台判斷（兼容舊資料）
    const getPlatform = (app) => {
      if (app.platform === 'android' || app.platform === 'ios') return app.platform;
      if (app.store === 'google-play') return 'android';
      if (app.store === 'app-store') return 'ios';
      return 'unknown';
    };

    const androidApps = [];
    const iosApps = [];
    const androidDevs = new Set();
    const iosDevs = new Set();

    apps.forEach(app => {
      const plat = getPlatform(app);
      if (plat === 'android') {
        androidApps.push(app);
        if (app.authorUid) androidDevs.add(app.authorUid);
      } else if (plat === 'ios') {
        iosApps.push(app);
        if (app.authorUid) iosDevs.add(app.authorUid);
      }
    });

    // 更新 UI
    document.getElementById('stat-projects').textContent = totalApps.toLocaleString();
    document.getElementById('stat-developers').textContent = uniqueDevelopers.size.toLocaleString();
    document.getElementById('stat-tests').textContent = totalTests.toLocaleString();
    document.getElementById('android-project-count').textContent = androidApps.length.toLocaleString();
    document.getElementById('android-dev-count').textContent = androidDevs.size.toLocaleString();
    document.getElementById('ios-project-count').textContent = iosApps.length.toLocaleString();
    document.getElementById('ios-dev-count').textContent = iosDevs.size.toLocaleString();
  } catch (error) {
    console.error('Failed to load home stats:', error);
    // 若發生錯誤，全部顯示 0，保持 UI 不會卡住
    const zero = '0';
    document.getElementById('stat-projects').textContent = zero;
    document.getElementById('stat-developers').textContent = zero;
    document.getElementById('stat-tests').textContent = zero;
    document.getElementById('android-project-count').textContent = zero;
    document.getElementById('android-dev-count').textContent = zero;
    document.getElementById('ios-project-count').textContent = zero;
    document.getElementById('ios-dev-count').textContent = zero;
  }
}