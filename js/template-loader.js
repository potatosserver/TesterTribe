// Template loader - loads HTML templates from /templates directory
import { showSkeleton, hideSkeleton } from './utils.js';

const templateCache = {};

// Show skeleton while loading templates
function showTemplateSkeleton() {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div id="view-home" class="tab-content active">
        <div class="hero-banner">
          ${showSkeleton('hero')}
        </div>
        <div class="stats-grid">
          <div class="stat-card">${showSkeleton('stat')}</div>
          <div class="stat-card">${showSkeleton('stat')}</div>
          <div class="stat-card">${showSkeleton('stat')}</div>
        </div>
      </div>
      <div id="view-market-android" class="tab-content">
        <div class="hero-banner">${showSkeleton('hero')}</div>
        <div class="app-grid">${showSkeleton('card').repeat(6)}</div>
      </div>
      <div id="view-market-ios" class="tab-content">
        <div class="hero-banner">${showSkeleton('hero')}</div>
        <div class="app-grid">${showSkeleton('card').repeat(6)}</div>
      </div>
      <div id="view-app-detail" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-dev-profile" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-publish" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-login" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-terms" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-privacy" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-guidelines" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-contact" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
      <div id="view-404" class="tab-content">
        <div class="card">${showSkeleton('card')}</div>
      </div>
    `;
  }
}

// Error message template for failed template loads
function createErrorTemplate(name, error) {
  return `
    <div id="view-${name}" class="tab-content" style="display: flex; align-items: center; justify-content: center; min-height: 300px; padding: 24px;">
      <div class="card" style="text-align: center; max-width: 400px;">
        <div style="font-size: 48px; color: var(--md-sys-color-error, #f2b8b5); margin-bottom: 16px;">
          <span class="material-symbols-outlined">error_outline</span>
        </div>
        <h2 style="margin: 0 0 8px; color: var(--md-sys-color-on-surface, #fff);">載入失敗</h2>
        <p style="margin: 0 0 16px; color: var(--md-sys-color-on-surface-variant, #b0b0b0);">
          無法載入 ${name} 頁面
        </p>
        <p style="margin: 0 0 24px; font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant, #b0b0b0); font-family: monospace;">
          ${error?.message || '未知錯誤'}
        </p>
        <button class="btn btn-primary" onclick="window.location.reload()">
          <span class="material-symbols-outlined">refresh</span> 重新整理
        </button>
      </div>
    </div>
  `;
}

export async function loadTemplates() {
  // Show skeleton loaders immediately
  showTemplateSkeleton();
  
  const templates = [
    'header',
    'home',
    'market',
    'app-detail',
    'dev-profile',
    'publish',
    'modals',
    'login',
    'terms',
    'privacy',
    'guidelines',
    'contact',
    '404'
  ];

  // Fallback templates for critical pages if network fails
  const fallbackTemplates = {
    'header': `<header><div class="header-content"><div class="logo" onclick="window.navigate('home')"><span class="material-symbols-outlined">android</span> TesterTribe</div><button id="btn-login" class="btn btn-primary" onclick="window.switchTab('login')"><span class="material-symbols-outlined">login</span> 登入</button></div></header>`,
    'home': `<div id="view-home" class="tab-content active"><div class="hero-banner"><h1 class="hero-title">歡迎來到 TesterTribe</h1><p class="hero-subtitle">Android & iOS 測試員互助平台</p></div><div class="stats-grid"><div class="stat-card"><div id="stat-projects" class="stat-number">0</div><div class="stat-label">專案總數</div></div><div class="stat-card"><div id="stat-developers" class="stat-number">0</div><div class="stat-label">開發者數</div></div><div class="stat-card"><div id="stat-tests" class="stat-number">0</div><div class="stat-label">測試總數</div></div></div></div>`,
    'market': `<div id="view-market-android" class="tab-content active"><div class="hero-banner"><h1 class="hero-title">Google Play 市集</h1></div><div id="market-app-list-android" class="app-grid"></div></div><div id="view-market-ios" class="tab-content"><div class="hero-banner"><h1 class="hero-title">App Store 市集</h1></div><div id="market-app-list-ios" class="app-grid"></div></div>`,
    'app-detail': `<div id="view-app-detail" class="tab-content"><div id="detail-content">載入中...</div></div>`,
    'dev-profile': `<div id="view-dev-profile" class="tab-content"><div id="dev-profile-content"><div id="dev-profile-loading">載入中...</div><div id="dev-profile-main" style="display:none;"></div></div></div>`,
    'publish': `<div id="view-publish" class="tab-content"><div class="card"><h2>刊登新測試 App 專案</h2><form id="app-form"><div class="form-group"><label>App 名稱</label><input type="text" id="app-name" class="form-control" required></div><button type="submit" class="btn btn-primary">發布</button></form></div></div>`,
    'modals': `<div id="feedback-modal" style="display:none;"></div><div id="edit-app-modal" style="display:none;"></div>`,
    'login': `<div id="view-login" class="tab-content"><div class="card"><h2>登入</h2><button id="btn-login-page" class="btn btn-primary">使用 Google 登入</button></div></div>`,
    'terms': `<div id="view-terms" class="tab-content"><div class="card"><h2>服務條款</h2><p>內容載入中...</p></div></div>`,
    'privacy': `<div id="view-privacy" class="tab-content"><div class="card"><h2>隱私權政策</h2><p>內容載入中...</p></div></div>`,
    'guidelines': `<div id="view-guidelines" class="tab-content"><div class="card"><h2>社群準則</h2><p>內容載入中...</p></div></div>`,
    'contact': `<div id="view-contact" class="tab-content"><div class="card"><h2>聯絡我們</h2><p>內容載入中...</p></div></div>`,
    '404': `<div id="view-404" class="tab-content"><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 40px 20px;"><div style="font-size: 8rem; color: var(--md-sys-color-outline-variant); margin-bottom: 16px; line-height: 1;">404</div><h1 style="font-size: 2rem; font-weight: 700; margin: 0 0 12px; color: var(--md-sys-color-on-surface);">找不到頁面</h1><p style="font-size: 1.1rem; color: var(--md-sys-color-secondary); margin: 0 0 32px; max-width: 400px;">抱歉，您訪問的頁面不存在或已被移除。<br>請確認網址是否正確，或返回首頁繼續瀏覽。</p><button class="btn btn-primary" onclick="window.navigate('home')" style="min-width: 160px;"><span class="material-symbols-outlined" style="font-size: 20px;">home</span> 返回首頁</button><button class="btn btn-tonal" onclick="window.navigate('market-android')" style="min-width: 160px; margin-top: 12px;"><span class="material-symbols-outlined" style="font-size: 20px;">store</span> 瀏覽市集</button></div></div>`
  };

  const loadResults = await Promise.allSettled(
    templates.map(async (name) => {
      try {
        const response = await fetch(`../templates/${name}.html`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        templateCache[name] = await response.text();
      } catch (err) {
        console.warn(`Failed to load template: ${name}, using fallback`, err);
        templateCache[name] = fallbackTemplates[name] || createErrorTemplate(name, err);
      }
    })
  );

  // Check if any critical template failed
  const criticalTemplates = ['header', 'home', 'market', 'app-detail', 'dev-profile', 'publish', 'modals', 'login'];
  const hasCriticalFailure = criticalTemplates.some(name => templateCache[name] === '');
  
  if (hasCriticalFailure) {
    console.error('Critical template(s) failed to load, app may not function correctly');
  }

  // Inject templates into DOM
  document.getElementById('header-container').innerHTML = templateCache['header'];
  document.getElementById('main-content').innerHTML = 
    templateCache['home'] + 
    templateCache['market'] + 
    templateCache['app-detail'] + 
    templateCache['dev-profile'] + 
    templateCache['publish'] +
    templateCache['login'] +
    templateCache['terms'] +
    templateCache['privacy'] +
    templateCache['guidelines'] +
    templateCache['contact'] +
    templateCache['404'];
  document.getElementById('modal-container').innerHTML = templateCache['modals'];
}

export function getTemplate(name) {
  return templateCache[name] || '';
}