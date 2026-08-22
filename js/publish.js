// Publish module - handle new app submission with wizard UI
import { db, auth } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { m3Alert, m3Error, m3Success, m3LoginRequired } from './m3-dialog.js';
import { setupFormValidation, toast } from './utils.js';

let isSubmitting = false;
let currentWizardStep = 1;
const TOTAL_STEPS = 5;

export function togglePlatformFields(formType) {
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

export function setupPublish() {
  window.togglePlatformFields = togglePlatformFields;

  const appForm = document.getElementById('app-form');
  
  // Prevent multiple initializations
  if (appForm?.dataset.initialized === 'true') {
    console.log('[Publish] Already initialized, skipping');
    return;
  }
  if (appForm) appForm.dataset.initialized = 'true';
  
  // Initialize wizard
  initWizard();
  
  // Setup custom email toggle
  const customEmailToggle = document.getElementById('app-custom-email-enabled');
  const customEmailFields = document.getElementById('custom-email-fields');
  const groupUrlField = document.getElementById('group-url').parentElement;
  if (customEmailToggle && customEmailFields) {
    customEmailToggle.addEventListener('change', () => {
      const isEnabled = customEmailToggle.checked;
      customEmailFields.style.display = isEnabled ? 'block' : 'none';
      if (groupUrlField) groupUrlField.style.display = isEnabled ? 'none' : 'block';
    });
  }
  
  // Setup "已完成封閉測試" toggle - hide group section when checked
  const closedTestToggle = document.getElementById('app-is-closed');
  const groupSection = document.getElementById('publish-group-section');
  if (closedTestToggle && groupSection) {
    closedTestToggle.addEventListener('change', () => {
      groupSection.style.display = closedTestToggle.checked ? 'none' : 'block';
    });
    // Initialize visibility based on current state
    groupSection.style.display = closedTestToggle.checked ? 'none' : 'block';
  }
  
  // Setup iOS "已完成封閉測試" toggle - show App Store link instead of TestFlight
  const closedTestToggleIos = document.getElementById('app-is-closed-ios');
  const iosTestflightSection = document.getElementById('ios-testflight-section');
  const iosAppstoreSection = document.getElementById('ios-appstore-section');
  if (closedTestToggleIos && iosTestflightSection && iosAppstoreSection) {
    closedTestToggleIos.addEventListener('change', () => {
      if (closedTestToggleIos.checked) {
        iosTestflightSection.style.display = 'none';
        iosAppstoreSection.style.display = 'block';
        // Make App Store URL required
        document.getElementById('appstore-url').required = true;
        document.getElementById('testflight-url').required = false;
      } else {
        iosTestflightSection.style.display = 'block';
        iosAppstoreSection.style.display = 'none';
        // Make TestFlight URL required
        document.getElementById('testflight-url').required = true;
        document.getElementById('appstore-url').required = false;
      }
    });
    // Initialize
    iosAppstoreSection.style.display = 'none';
    document.getElementById('testflight-url').required = true;
  }

  // Setup real-time form validation
  const validation = setupFormValidation(appForm, {
    platform: [
      { required: true, message: '請選擇平台' }
    ],
    name: [
      { required: true, message: '請輸入 App 名稱' },
      { minLength: 2, message: 'App 名稱至少 2 字元' },
      { maxLength: 100, message: 'App 名稱最多 100 字元' }
    ],
    packageName: [
      { required: true, message: '請輸入包名 / Bundle ID' },
      { pattern: /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, message: '包名格式錯誤 (如 com.example.app)' }
    ],
    groupUrl: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的網址' }
    ],
    testflightUrl: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的 TestFlight 連結' }
    ],
    appStoreUrl: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的 App Store 連結' }
    ],
    iconUrl: [
      { required: true, message: 'App 圖示網址為必填' },
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的圖片網址' }
    ],
    screenshotUrl1: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的圖片網址' }
    ],
    screenshotUrl2: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的圖片網址' }
    ],
    screenshotUrl3: [
      { pattern: /^https?:\/\/.+/, message: '請輸入有效的圖片網址' }
    ],
    description: [
      { required: true, message: '請填寫簡介與測試需求' },
      { minLength: 20, message: '描述至少 20 字元' },
      { maxLength: 5000, message: '描述最多 5000 字元' }
    ]
  });

  // Platform button selection
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.platform-btn').forEach(b => {
        b.dataset.selected = 'false';
      });
      btn.dataset.selected = 'true';
      document.getElementById('app-platform').value = btn.dataset.platform;
      // Update package name label
      const label = document.getElementById('label-package-name');
      if (btn.dataset.platform === 'android') {
        label.innerText = 'Android 應用程式包名 (Package Name)';
      } else {
        label.innerText = 'iOS Bundle ID';
      }
      validateStep(1);
    });
  });

  // Wizard navigation
  document.getElementById('wizard-next-1')?.addEventListener('click', () => goToStep(2));
  document.getElementById('wizard-next-2')?.addEventListener('click', () => goToStep(3));
  document.getElementById('wizard-next-3')?.addEventListener('click', () => goToStep(4));
  document.getElementById('wizard-next-4')?.addEventListener('click', () => goToStep(5));
  
  document.getElementById('wizard-back-2')?.addEventListener('click', () => goToStep(1));
  document.getElementById('wizard-back-3')?.addEventListener('click', () => goToStep(2));
  document.getElementById('wizard-back-4')?.addEventListener('click', () => goToStep(3));
  document.getElementById('wizard-back-5')?.addEventListener('click', () => goToStep(4));

  // Validate steps on input
  const step2Inputs = ['app-name', 'app-package-name'];
  step2Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateStep(2));
  });

  const step3Inputs = ['group-url', 'custom-email-url', 'testflight-url', 'appstore-url'];
  step3Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateStep(3));
  });

  const step4Inputs = ['app-icon-url', 'app-screenshot-url-1', 'app-screenshot-url-2', 'app-screenshot-url-3'];
  step4Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateStep(4));
  });

  document.getElementById('app-desc')?.addEventListener('input', () => validateStep(5));

  // Custom email toggle affects step 3 validation
  document.getElementById('app-custom-email-enabled')?.addEventListener('change', () => validateStep(3));
  document.getElementById('app-is-closed')?.addEventListener('change', () => validateStep(3));
  document.getElementById('app-is-closed-ios')?.addEventListener('change', () => validateStep(3));

  // Move button binding to the end to ensure DOM is ready
  const submitBtn = document.getElementById('btn-submit');
  if (!submitBtn) {
    console.error('[Publish] Critical Error: Submit button not found in DOM');
    return;
  }

  // Prevent multiple click handlers
  if (submitBtn.dataset.listenerAttached === 'true') {
    console.log('[Publish] Click listener already attached, skipping');
    return;
  }
  submitBtn.dataset.listenerAttached = 'true';

  submitBtn.addEventListener('click', async (e) => {
    console.log('[Publish] Submit button clicked');
    
    try {
      if (!window.currentUser) {
        console.error('[Publish] No current user found');
        return m3Alert('請先登入！');
      }
      console.log('[Publish] User authenticated:', window.currentUser.uid);

      // Validate all fields first
      console.log('[Publish] Running form validation...');
      if (!validation.validateAll()) {
        console.warn('[Publish] Form validation failed');
        toast.error('請修正表單錯誤後再送出');
        // Go to first invalid step
        goToFirstInvalidStep(validation);
        return;
      }
      console.log('[Publish] Form validation passed');

      const platform = document.getElementById('app-platform').value;
      const packageName = document.getElementById('app-package-name').value.trim();
      const iconUrl = document.getElementById('app-icon-url').value.trim();
      const screenshotUrl1 = document.getElementById('app-screenshot-url-1').value.trim();
      const screenshotUrl2 = document.getElementById('app-screenshot-url-2').value.trim();
      const screenshotUrl3 = document.getElementById('app-screenshot-url-3').value.trim();

      // Validate URLs (async check)
      try {
        console.log('[Publish] Validating image URLs...');
        await validateImageUrl(iconUrl, 'App 圖示網址');
        await validateImageUrl(screenshotUrl1, '截圖 1');
        await validateImageUrl(screenshotUrl2, '截圖 2');
        await validateImageUrl(screenshotUrl3, '截圖 3');
        console.log('[Publish] Image URLs validated');
      } catch (err) {
        console.error('[Publish] Image URL validation error:', err.message);
        return m3Alert(err.message, '網址格式錯誤');
      }

      const screenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);
      if (screenshotUrls.length > 3) {
        console.warn('[Publish] Too many screenshots');
        return m3Alert('最多只能上傳 3 張截圖', '截圖數量超過限制');
      }

      let groupUrl = '';
      let storeUrl = '';
      let testFlightUrl = '';
      let appStoreUrl = '';

      if (platform === 'android') {
        groupUrl = document.getElementById('group-url').value.trim();
        storeUrl = `https://play.google.com/apps/testing/${packageName}`;
      } else {
        testFlightUrl = document.getElementById('testflight-url').value.trim();
        appStoreUrl = document.getElementById('appstore-url').value.trim();
        storeUrl = testFlightUrl || appStoreUrl;
      }

      const isClosed = document.getElementById('app-is-closed').checked || document.getElementById('app-is-closed-ios').checked;
      const customEmailEnabled = document.getElementById('app-custom-email-enabled').checked;
      const customEmailInstruction = document.getElementById('custom-email-instruction').value.trim();
      const customEmailUrl = document.getElementById('custom-email-url').value.trim();

      // Check for duplicate packageName
      console.log('[Publish] Checking for duplicate packageName:', packageName);
      const appsRef = collection(db, 'apps');
      const dupQuery = query(appsRef, where('packageName', '==', packageName), where('platform', '==', platform));
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        const existingApp = dupSnap.docs[0].data();
        console.warn('[Publish] Duplicate app found:', existingApp.name);
        return m3Alert(`此包名已被使用！\n已存在：${existingApp.name} (${existingApp.platform})`, '包名重複');
      }
      console.log('[Publish] No duplicate found');

      submitBtn.disabled = true;
      submitBtn.innerText = '發布中...';

      console.log('[Publish] Attempting to add document to Firestore...');
      const finalScreenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);

      // Determine store field based on platform for backward compatibility
      const store = platform === 'ios' ? 'app-store' : 'google-play';

      await addDoc(collection(db, 'apps'), {
        name: document.getElementById('app-name').value,
        platform: platform,
        store: store,
        status: 'published',
        packageName: packageName,
        iconUrl: iconUrl,
        screenshotUrls: finalScreenshotUrls,
        description: document.getElementById('app-desc').value,
        groupUrl: groupUrl,
        storeUrl: storeUrl,
        testFlightUrl: testFlightUrl,
        appStoreUrl: appStoreUrl,
        isClosed: isClosed,
        customEmailEnabled: customEmailEnabled,
        customEmailInstruction: customEmailInstruction,
        customEmailUrl: customEmailUrl,
        authorName: window.currentUser.displayName,
        authorUid: window.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likeCount: 0,
        joinCount: 0,
        ratingSum: 0,
        ratingCount: 0
      });

      console.log('[Publish] Firestore addDoc successful');
      toast.success('App 專案刊登成功！');
      appForm.reset();
      validation.reset();
      resetWizard();
      window.fetchMarketApps?.(true);
      window.navigate('market-android');
    } catch (err) { 
      console.error('[Publish] Submission failed:', err); 
      toast.error('發布失敗：' + err.message); 
    }
    finally {
      console.log('[Publish] Submission process finished');
      submitBtn.disabled = false;
      submitBtn.innerText = '發布 App 至市集';
    }
  });
}

function initWizard() {
  // Set up initial state
  updateWizardUI();
  
  // Make wizard steps clickable for navigation
  document.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const step = parseInt(el.dataset.step);
      if (step < currentWizardStep || validateStep(currentWizardStep)) {
        goToStep(step);
      }
    });
  });
  
  // Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (currentWizardStep < TOTAL_STEPS) {
        const nextBtn = document.getElementById(`wizard-next-${currentWizardStep}`);
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
      }
    }
  });
}

function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  
  // Validate current step before moving forward
  if (step > currentWizardStep && !validateStep(currentWizardStep)) {
    return;
  }
  
  currentWizardStep = step;
  updateWizardUI();
}

function validateStep(step) {
  const platform = document.getElementById('app-platform').value;
  let isValid = true;
  
  // Helper to check if any field in current step has validation error
  const hasValidationError = (fieldIds) => {
    return fieldIds.some(id => {
      const el = document.getElementById(id);
      return el && el.classList.contains('error');
    });
  };

  switch (step) {
    case 1:
      isValid = !!platform;
      break;
    case 2:
      isValid = document.getElementById('app-name').value.trim().length >= 2 &&
                document.getElementById('app-package-name').value.trim().length > 0 &&
                !hasValidationError(['app-name', 'app-package-name']);
      break;
    case 3:
      if (platform === 'android') {
        const closed = document.getElementById('app-is-closed').checked;
        const customEmail = document.getElementById('app-custom-email-enabled').checked;
        if (!closed && !customEmail) {
          isValid = document.getElementById('group-url').value.trim().length > 0 &&
                    !hasValidationError(['group-url']);
        } else if (!closed && customEmail) {
          isValid = document.getElementById('custom-email-url').value.trim().length > 0 &&
                    document.getElementById('custom-email-instruction').value.trim().length > 0 &&
                    !hasValidationError(['custom-email-url']);
        } else {
          // Closed test - no link required
          isValid = true;
        }
      } else {
        const closed = document.getElementById('app-is-closed-ios').checked;
        if (closed) {
          isValid = document.getElementById('appstore-url').value.trim().length > 0 &&
                    !hasValidationError(['appStoreUrl']);
        } else {
          isValid = document.getElementById('testflight-url').value.trim().length > 0 &&
                    !hasValidationError(['testflightUrl']);
        }
      }
      break;
    case 4:
      // Icon URL is required
      const iconUrl = document.getElementById('app-icon-url').value.trim();
      if (!iconUrl) {
        isValid = false;
      } else {
        // Validate icon URL format
        try {
          new URL(iconUrl);
          // Validate screenshot URLs if provided
          const screenshotUrls = [
            document.getElementById('app-screenshot-url-1').value.trim(),
            document.getElementById('app-screenshot-url-2').value.trim(),
            document.getElementById('app-screenshot-url-3').value.trim()
          ];
          for (const url of screenshotUrls) {
            if (url) {
              new URL(url); // Will throw if invalid
            }
          }
          // Also check for validation errors from real-time validation
          isValid = !hasValidationError(['iconUrl', 'screenshotUrl1', 'screenshotUrl2', 'screenshotUrl3']);
        } catch {
          isValid = false;
        }
      }
      break;
    case 5:
      isValid = document.getElementById('app-desc').value.trim().length >= 20 &&
                !hasValidationError(['description']);
      break;
  }
  
  const nextBtn = document.getElementById(`wizard-next-${step}`);
  if (nextBtn) nextBtn.disabled = !isValid;
  
  return isValid;
}

function goToFirstInvalidStep(validation) {
  const errors = validation.getErrors();
  if (!errors || errors.length === 0) return;
  
  // Find which step the first error belongs to
  const firstError = errors[0];
  let targetStep = 1;
  
  if (['name', 'packageName'].includes(firstError.field)) targetStep = 2;
  else if (['groupUrl', 'customEmailUrl', 'testflightUrl', 'appStoreUrl'].includes(firstError.field)) targetStep = 3;
  else if (['iconUrl', 'screenshotUrl1', 'screenshotUrl2', 'screenshotUrl3'].includes(firstError.field)) targetStep = 4;
  else if (['description'].includes(firstError.field)) targetStep = 5;
  
  goToStep(targetStep);
}

function updateWizardUI() {
  // Hide all steps
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const stepEl = document.getElementById(`wizard-step-${i}`);
    if (stepEl) stepEl.style.display = 'none';
  }
  
  // Show current step
  const currentStepEl = document.getElementById(`wizard-step-${currentWizardStep}`);
  if (currentStepEl) currentStepEl.style.display = 'block';
  
  // Update progress indicator using data attributes for CSS
  document.querySelectorAll('.wizard-step').forEach((el, index) => {
    const stepNum = index + 1;
    
    el.removeAttribute('data-completed');
    el.removeAttribute('data-current');
    
    if (stepNum < currentWizardStep) {
      el.dataset.completed = 'true';
    } else if (stepNum === currentWizardStep) {
      el.dataset.current = 'true';
    }
  });
  
  // Show/hide platform-specific fields for step 3
  if (currentWizardStep === 3) {
    const platform = document.getElementById('app-platform').value;
    const androidFields = document.getElementById('android-fields');
    const iosFields = document.getElementById('ios-fields');
    if (androidFields && iosFields) {
      if (platform === 'android') {
        androidFields.style.display = 'block';
        iosFields.style.display = 'none';
      } else {
        androidFields.style.display = 'none';
        iosFields.style.display = 'block';
      }
    }
  }
}

function resetWizard() {
  currentWizardStep = 1;
  updateWizardUI();
  
  // Reset platform buttons
  document.querySelectorAll('.platform-btn').forEach(b => {
    b.dataset.selected = 'false';
  });
  document.getElementById('app-platform').value = '';
  
  // Reset visibility
  const groupSection = document.getElementById('publish-group-section');
  if (groupSection) groupSection.style.display = 'block';
  document.getElementById('app-is-closed').checked = false;
  document.getElementById('app-custom-email-enabled').checked = false;
  document.getElementById('custom-email-fields').style.display = 'none';
  if (document.getElementById('group-url')) {
    document.getElementById('group-url').parentElement.style.display = 'block';
  }
  
  // Reset iOS
  document.getElementById('app-is-closed-ios').checked = false;
  const iosTestflightSection = document.getElementById('ios-testflight-section');
  const iosAppstoreSection = document.getElementById('ios-appstore-section');
  if (iosTestflightSection) iosTestflightSection.style.display = 'block';
  if (iosAppstoreSection) iosAppstoreSection.style.display = 'none';
  document.getElementById('testflight-url').required = true;
  document.getElementById('appstore-url').required = false;
  
  // Disable next buttons
  for (let i = 1; i < TOTAL_STEPS; i++) {
    const btn = document.getElementById(`wizard-next-${i}`);
    if (btn) btn.disabled = true;
  }
}

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