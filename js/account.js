// Account module - my apps management
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';
import { escapeHTML, formatDate } from './utils.js';

export function setupAccount() {
  window.loadMyApps = loadMyApps;
  window.deleteApp = deleteApp;
  window.openEditAppModal = openEditAppModal;
  window.openAppDetail = window.openAppDetail; // will be overridden by detail.js
}

async function loadMyApps() {
  if (!window.currentUser) return;
  const myList = document.getElementById('my-app-list');
  myList.innerHTML = '載入中...';

  const q = query(collection(db, 'apps'), where('authorUid', '==', window.currentUser.uid));
  const snapshot = await getDocs(q);
  
  myList.innerHTML = '';
  if (snapshot.empty) return myList.innerHTML = '<div style="color: #888;">你尚未刊登任何 App 專案。</div>';

  snapshot.forEach((docSnap) => {
    const appData = docSnap.data();
    const card = document.createElement('div');
    card.className = 'app-card';
    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between;">
          <div class="app-header">
            <img class="app-icon" src="${escapeHTML(appData.iconUrl)}" onerror="this.onerror=null; this.src=window.DEFAULT_ICON;">
            <div>
              <h3 class="app-title">${escapeHTML(appData.name)}</h3>
              <div style="font-size: 0.8rem; color:#666;">刊登中 (${appData.platform === 'android' ? 'Android' : 'iOS'})</div>
            </div>
          </div>
          <button onclick="event.stopPropagation(); window.deleteApp('${docSnap.id}')" class="btn btn-error" style="padding: 6px 12px; font-size: 0.8rem;">下架刪除</button>
        </div>
      </div>
      <div class="card-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--md-sys-color-outline-variant);">
        <div class="app-meta-time" style="margin: 0; white-space: nowrap;">
          <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
          更新於：${formatDate(appData.updatedAt || appData.createdAt)}
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.openEditAppModal('${docSnap.id}')" class="btn btn-tonal" style="flex:1;">✏️ 編輯專案</button>
          <button onclick="window.openAppDetail('${docSnap.id}')" class="btn btn-primary" style="flex:1;">詳情頁</button>
        </div>
      </div>
    `;
    myList.appendChild(card);
  });
}

async function deleteApp(docId) {
  if (confirm('確定要下架刪除這個 App 嗎？')) {
    await deleteDoc(doc(db, 'apps', docId));
    alert('刪除成功！');
    loadMyApps();
    window.fetchMarketApps?.(true);
  }
}

window.openEditAppModal = openEditAppModal;

function openEditAppModal(docId) {
  window.currentEditingAppId = docId;
  // This will be implemented in modals.js with data loading
  document.getElementById('edit-app-modal').style.display = 'flex';
  document.getElementById('edit-app-id').value = docId;
  loadAppDataForEdit(docId);
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