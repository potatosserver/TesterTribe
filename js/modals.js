// Modals module - feedback modal and edit app modal (wizard-style)
import { addDoc, updateDoc, doc, getDoc, collection, serverTimestamp, deleteDoc, setDoc, query, where, getDocs, increment, deleteField } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { m3Alert, m3Error, m3Success, m3Confirm } from './m3-dialog.js';
import { escapeHTML, toast, setupFormValidation } from './utils.js';
import { getAppPlatform } from './constants.js';

// Edit wizard state
let editCurrentWizardStep = 1;
const EDIT_TOTAL_STEPS = 4;

// Navigation debounce for edit wizard
let isNavigating = false;
window.navigateEditWizard = (targetStep) => {
  if (isNavigating) return;
  isNavigating = true;
  goToEditStep(targetStep);
  setTimeout(() => { isNavigating = false; }, 300);
};

export function setupModals() {
  // Feedback modal
  window.openFeedbackModal = openFeedbackModal;
  window.closeFeedbackModal = closeFeedbackModal;
  window.toggleRatingStarBox = toggleRatingStarBox;
  window.submitFeedback = submitFeedback;

  // Edit app modal
  window.openEditAppModal = openEditAppModal;
  window.closeEditAppModal = closeEditAppModal;
  window.closeEditAppModalWithConfirm = closeEditAppModalWithConfirm;
  window.confirmDeleteApp = confirmDeleteApp;

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
    const feedbackRef = await addDoc(collection(db, 'apps', appId, 'feedbacks'), {
      type: type,
      content: content,
      rating: type === 'review' ? rating : null,
      authorUid: window.currentUser.uid,
      authorName: window.currentUser.displayName,
      authorPhoto: window.currentUser.photoURL,
      createdAt: serverTimestamp(),
      isPinned: false
    });

    // Update UI immediately without page reload
    const feedbackList = document.querySelector('.gp-section:last-child > div:last-child');
    if (feedbackList) {
      // Remove "no feedback" message if exists
      const noFeedbackMsg = feedbackList.querySelector('div[style*="text-align: center"]');
      if (noFeedbackMsg) noFeedbackMsg.remove();

      // Create new feedback element
      const starsHtml = type === 'review' ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
      const typeBadge = type === 'review'
        ? `<span class="type-badge type-review"><span style="color:#f59e0b;">${starsHtml}</span></span>`
        : type === 'bug'
          ? `<span class="type-badge type-bug"><span class="material-symbols-outlined" style="font-size:12px;">bug_report</span> Bug 回報</span>`
          : `<span class="type-badge type-suggestion"><span class="material-symbols-outlined" style="font-size:12px;">lightbulb</span> 功能建議</span>`;

      const newFeedbackHtml = `
        <div class="feedback-item" style="animation: slideIn 0.3s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 600; font-size: 0.9rem;">${escapeHTML(window.currentUser.displayName)}</span>
              ${type === 'review' ? `<span style="color:#f59e0b;">${starsHtml}</span>` : typeBadge}
            </div>
          </div>
          <div style="font-size:0.92rem; line-height:1.5; white-space:pre-line;">${escapeHTML(content)}</div>
        </div>
      `;
      feedbackList.insertAdjacentHTML('afterbegin', newFeedbackHtml);
    }

    // Update rating count and average if review
    if (type === 'review') {
      const appRef = doc(db, 'apps', appId);
      await updateDoc(appRef, {
        ratingCount: increment(1),
        ratingSum: increment(rating),
        newRatingScore: rating
      });

      try {
        await updateDoc(appRef, { newRatingScore: deleteField() });
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    toast('送出成功！', 'success');
    closeFeedbackModal();
  } catch (err) {
    m3Error('送出失敗：' + err.message);
  }
}

function openEditAppModal(docId) {
  window.currentEditingAppId = docId;
  const modal = document.getElementById('edit-app-modal');
  modal.classList.add('open');
  document.getElementById('edit-app-id').value = docId;

  // Add backdrop click handler to close modal (click gray area)
  const handleBackdropClick = (e) => {
    if (e.target === modal) {
      closeEditAppModalWithConfirm();
    }
  };
  modal.addEventListener('click', handleBackdropClick);
  // Store handler for cleanup
  modal._backdropHandler = handleBackdropClick;

  loadAppDataForEdit(docId);
}

function closeEditAppModal() {
  const modal = document.getElementById('edit-app-modal');
  // Remove backdrop click handler
  if (modal._backdropHandler) {
    modal.removeEventListener('click', modal._backdropHandler);
    modal._backdropHandler = null;
  }
  modal.classList.remove('open');
  window.currentEditingAppId = null;
  document.getElementById('edit-app-form').reset();
  resetEditWizard();
}

function closeEditAppModalWithConfirm() {
  const modal = document.getElementById('edit-app-modal');
  if (!modal || !modal.classList.contains('open')) return;

  m3Confirm('確定要關閉嗎？尚未儲存的變更將會遺失。', '關閉不儲存', {
    confirmText: '確定關閉',
    cancelText: '繼續編輯',
    destructive: true
  }).then(confirmed => {
    if (confirmed) {
      closeEditAppModal();
    }
  });
}

async function loadAppDataForEdit(docId) {
  try {
    const appSnap = await getDoc(doc(db, 'apps', docId));
    if (!appSnap.exists()) return;
    const appData = appSnap.data();

    const platform = getAppPlatform(appData);
    console.log('[Modals] App:', appData.name, 'platform field:', appData.platform, 'store field:', appData.store, 'computed platform:', platform);

    document.getElementById('edit-app-platform').value = platform;
    document.getElementById('edit-app-name').value = appData.name || '';
    document.getElementById('edit-app-package-name').value = appData.packageName || '';
    document.getElementById('edit-group-url').value = appData.groupUrl || '';
    document.getElementById('edit-testflight-url').value = appData.testFlightUrl || appData.storeUrl || '';
    document.getElementById('edit-appstore-url').value = appData.appStoreUrl || '';
    document.getElementById('edit-app-icon-url').value = appData.iconUrl || '';
    const screenshots = appData.screenshotUrls || [];
    document.getElementById('edit-app-screenshot-url-1').value = screenshots[0] || '';
    document.getElementById('edit-app-screenshot-url-2').value = screenshots[1] || '';
    document.getElementById('edit-app-screenshot-url-3').value = screenshots[2] || '';
    document.getElementById('edit-app-desc').value = appData.description || '';
    document.getElementById('edit-app-is-closed').checked = appData.isClosed === true;

    // Initialize iOS closed test checkbox based on isClosed
    document.getElementById('edit-app-is-closed-ios').checked = appData.isClosed === true;

    // Custom Email fields
    const customEmailEnabled = appData.customEmailEnabled === true;
    const customEmailToggle = document.getElementById('edit-app-custom-email-enabled');
    const customEmailFields = document.getElementById('edit-custom-email-fields');
    const groupUrlField = document.getElementById('edit-group-url').parentElement;
    if (customEmailToggle && customEmailFields) {
      customEmailToggle.checked = customEmailEnabled;
      customEmailFields.style.display = customEmailEnabled ? 'block' : 'none';
      if (groupUrlField) groupUrlField.style.display = customEmailEnabled ? 'none' : 'block';
      document.getElementById('edit-custom-email-instruction').value = appData.customEmailInstruction || '';
      document.getElementById('edit-custom-email-url').value = appData.customEmailUrl || '';
    }

    // Initialize iOS closed test toggle
    const iosClosedToggle = document.getElementById('edit-app-is-closed-ios');
    const iosTestflightSection = document.getElementById('edit-ios-testflight-section');
    const iosAppstoreSection = document.getElementById('edit-ios-appstore-section');
    if (iosClosedToggle && iosTestflightSection && iosAppstoreSection) {
      iosClosedToggle.addEventListener('change', () => {
        if (iosClosedToggle.checked) {
          iosTestflightSection.style.display = 'none';
          iosAppstoreSection.style.display = 'block';
          document.getElementById('edit-appstore-url').required = true;
          document.getElementById('edit-testflight-url').required = false;
        } else {
          iosTestflightSection.style.display = 'block';
          iosAppstoreSection.style.display = 'none';
          document.getElementById('edit-testflight-url').required = true;
          document.getElementById('edit-appstore-url').required = false;
        }
        validateEditStep(2);
      });
      // Initialize based on isClosed value
      if (appData.isClosed === true) {
        iosTestflightSection.style.display = 'none';
        iosAppstoreSection.style.display = 'block';
        document.getElementById('edit-appstore-url').required = true;
        document.getElementById('edit-testflight-url').required = false;
      } else {
        iosTestflightSection.style.display = 'block';
        iosAppstoreSection.style.display = 'none';
        document.getElementById('edit-testflight-url').required = true;
        document.getElementById('edit-appstore-url').required = false;
      }
    }

    // Setup closed test toggle for Android
    const closedTestToggle = document.getElementById('edit-app-is-closed');
    const groupSection = document.getElementById('edit-group-section');
    if (closedTestToggle && groupSection) {
      closedTestToggle.addEventListener('change', () => {
        groupSection.style.display = closedTestToggle.checked ? 'none' : 'block';
        validateEditStep(2);
      });
      groupSection.style.display = closedTestToggle.checked ? 'none' : 'block';
    }

    // Setup custom email toggle
    if (customEmailToggle && customEmailFields) {
      customEmailToggle.addEventListener('change', () => {
        const isEnabled = customEmailToggle.checked;
        customEmailFields.style.display = isEnabled ? 'block' : 'none';
        if (groupUrlField) groupUrlField.style.display = isEnabled ? 'none' : 'block';
        validateEditStep(2);
      });
    }

    // Initialize wizard
    initEditWizard();

    // Setup form validation
    setupEditFormValidation();

    // Validate all steps after loading data (so next buttons reflect current state)
    validateEditStep(1);
    validateEditStep(2);
    validateEditStep(3);
    validateEditStep(4);

    // Setup dirty tracking AFTER form is populated with initial data
    setupDirtyTracking();

    togglePlatformFields('edit');
  } catch (err) {
    console.error('載入編輯資料失敗:', err);
  }
}

// ========== Dirty Tracking Functions ==========

function captureFormState() {
  const form = document.getElementById('edit-app-form');
  const state = {};
  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'checkbox') {
      state[el.id] = el.checked;
    } else {
      state[el.id] = el.value;
    }
  });
  return state;
}

function setupDirtyTracking() {
  const form = document.getElementById('edit-app-form');
  const submitBtn = document.getElementById('edit-btn-submit');
  
  // Capture initial form state as baseline
  window.editOriginalData = captureFormState();
  
  form.querySelectorAll('input, textarea, select').forEach(el => {
    // Remove existing listener if any
    el.removeEventListener('input', checkDirty);
    el.removeEventListener('change', checkDirty);
    // Add new listeners
    el.addEventListener('input', checkDirty);
    el.addEventListener('change', checkDirty);
  });
  
  function checkDirty() {
    const currentState = captureFormState();
    const originalState = window.editOriginalData || {};
    let isDirty = false;
    
    for (const key in currentState) {
      if (currentState[key] !== originalState[key]) {
        isDirty = true;
        break;
      }
    }
    
    // Also check for keys in original but not in current (shouldn't happen but safe)
    for (const key in originalState) {
      if (!(key in currentState) || currentState[key] !== originalState[key]) {
        isDirty = true;
        break;
      }
    }
    
    if (submitBtn) {
      submitBtn.disabled = !isDirty;
      // Update aria-label to reflect state
      submitBtn.setAttribute('aria-label', isDirty ? '儲存變更' : '無變更可儲存');
    }
  }
}

function initEditWizard() {
  editCurrentWizardStep = 1;
  updateEditWizardUI();

  // Make wizard steps clickable
  document.querySelectorAll('#edit-app-modal .wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const step = parseInt(el.dataset.step);
      if (step < editCurrentWizardStep || validateEditStep(editCurrentWizardStep)) {
        // Use debounced navigation
        if (window.navigateEditWizard) {
          window.navigateEditWizard(step);
        } else {
          goToEditStep(step);
        }
      }
    });
  });

  // Single navigation buttons (fixed bottom bar)
  const nextBtn = document.getElementById('edit-wizard-next');
  const backBtn = document.getElementById('edit-wizard-back');
  const submitBtn = document.getElementById('edit-btn-submit');

  nextBtn?.addEventListener('click', () => {
    if (editCurrentWizardStep < EDIT_TOTAL_STEPS) {
      window.navigateEditWizard(editCurrentWizardStep + 1);
    }
  });

  backBtn?.addEventListener('click', () => {
    if (editCurrentWizardStep > 1) {
      window.navigateEditWizard(editCurrentWizardStep - 1);
    }
  });
}

function goToEditStep(step) {
  if (step < 1 || step > EDIT_TOTAL_STEPS) return;

  // Validate current step before moving forward
  if (step > editCurrentWizardStep && !validateEditStep(editCurrentWizardStep)) {
    return;
  }

  editCurrentWizardStep = step;
  updateEditWizardUI();
}

function validateEditStep(step) {
  const platform = document.getElementById('edit-app-platform').value;
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
      isValid = document.getElementById('edit-app-name').value.trim().length >= 2 &&
                document.getElementById('edit-app-package-name').value.trim().length > 0 &&
                !hasValidationError(['edit-app-name', 'edit-app-package-name']);
      break;
    case 2:
      if (platform === 'android') {
        const closed = document.getElementById('edit-app-is-closed').checked;
        const customEmail = document.getElementById('edit-app-custom-email-enabled').checked;
        if (!closed && !customEmail) {
          isValid = document.getElementById('edit-group-url').value.trim().length > 0 &&
                    !hasValidationError(['edit-group-url']);
        } else if (!closed && customEmail) {
          isValid = document.getElementById('edit-custom-email-url').value.trim().length > 0 &&
                    document.getElementById('edit-custom-email-instruction').value.trim().length > 0 &&
                    !hasValidationError(['edit-custom-email-url']);
        } else {
          // Closed test - no link required
          isValid = true;
        }
      } else {
        const closed = document.getElementById('edit-app-is-closed-ios').checked;
        if (closed) {
          isValid = document.getElementById('edit-appstore-url').value.trim().length > 0 &&
                    !hasValidationError(['edit-appStoreUrl']);
        } else {
          isValid = document.getElementById('edit-testflight-url').value.trim().length > 0 &&
                    !hasValidationError(['edit-testflightUrl']);
        }
      }
      break;
    case 3:
      // Icon URL is required
      const iconUrl = document.getElementById('edit-app-icon-url').value.trim();
      if (!iconUrl) {
        isValid = false;
      } else {
        try {
          new URL(iconUrl);
          const screenshotUrls = [
            document.getElementById('edit-app-screenshot-url-1').value.trim(),
            document.getElementById('edit-app-screenshot-url-2').value.trim(),
            document.getElementById('edit-app-screenshot-url-3').value.trim()
          ];
          for (const url of screenshotUrls) {
            if (url) {
              new URL(url);
            }
          }
          isValid = !hasValidationError(['edit-iconUrl', 'edit-screenshotUrl1', 'edit-screenshotUrl2', 'edit-screenshotUrl3']);
        } catch {
          isValid = false;
        }
      }
      break;
    case 4:
      isValid = document.getElementById('edit-app-desc').value.trim().length >= 20 &&
                !hasValidationError(['edit-description']);
      break;
  }

  const nextBtn = document.getElementById('edit-wizard-next');
  const backBtn = document.getElementById('edit-wizard-back');
  const submitBtn = document.getElementById('edit-btn-submit');

  if (nextBtn && backBtn && submitBtn) {
    // All three buttons always visible, just toggle disabled state
    if (editCurrentWizardStep === 1) {
      backBtn.disabled = true;
      nextBtn.disabled = !isValid;
      submitBtn.disabled = true;
    } else if (editCurrentWizardStep === EDIT_TOTAL_STEPS) {
      backBtn.disabled = false;
      nextBtn.disabled = true;
      // Submit button: enabled only if step is valid AND form is dirty
      const isDirty = submitBtn.getAttribute('aria-label') === '儲存變更';
      submitBtn.disabled = !isValid || !isDirty;
    } else {
      backBtn.disabled = false;
      nextBtn.disabled = !isValid;
      submitBtn.disabled = true;
    }
  }

  return isValid;
}

function updateEditWizardUI() {
  // Hide all steps
  for (let i = 1; i <= EDIT_TOTAL_STEPS; i++) {
    const stepEl = document.getElementById(`edit-wizard-step-${i}`);
    if (stepEl) stepEl.style.display = 'none';
  }

  // Show current step
  const currentStepEl = document.getElementById(`edit-wizard-step-${editCurrentWizardStep}`);
  if (currentStepEl) currentStepEl.style.display = 'block';

  // Update progress indicator using data attributes for CSS
  document.querySelectorAll('#edit-app-modal .wizard-step').forEach((el, index) => {
    const stepNum = index + 1;

    el.removeAttribute('data-completed');
    el.removeAttribute('data-current');

    if (stepNum < editCurrentWizardStep) {
      el.dataset.completed = 'true';
    } else if (stepNum === editCurrentWizardStep) {
      el.dataset.current = 'true';
    }
  });

  // Show/hide platform-specific fields for step 2
  if (editCurrentWizardStep === 2) {
    const platform = document.getElementById('edit-app-platform').value;
    const androidFields = document.getElementById('edit-android-fields');
    const iosFields = document.getElementById('edit-ios-fields');
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

function resetEditWizard() {
  editCurrentWizardStep = 1;
  updateEditWizardUI();

  // Reset platform toggle
  const platform = document.getElementById('edit-app-platform').value;
  if (platform === 'android') {
    document.getElementById('edit-android-fields').style.display = 'block';
    document.getElementById('edit-ios-fields').style.display = 'none';
  } else {
    document.getElementById('edit-android-fields').style.display = 'none';
    document.getElementById('edit-ios-fields').style.display = 'block';
  }

  // Reset visibility
  const groupSection = document.getElementById('edit-group-section');
  if (groupSection) groupSection.style.display = 'block';
  document.getElementById('edit-app-is-closed').checked = false;
  document.getElementById('edit-app-custom-email-enabled').checked = false;
  document.getElementById('edit-custom-email-fields').style.display = 'none';
  if (document.getElementById('edit-group-url')) {
    document.getElementById('edit-group-url').parentElement.style.display = 'block';
  }

  // Reset iOS
  document.getElementById('edit-app-is-closed-ios').checked = false;
  const iosTestflightSection = document.getElementById('edit-ios-testflight-section');
  const iosAppstoreSection = document.getElementById('edit-ios-appstore-section');
  if (iosTestflightSection) iosTestflightSection.style.display = 'block';
  if (iosAppstoreSection) iosAppstoreSection.style.display = 'none';
  if (document.getElementById('edit-testflight-url')) document.getElementById('edit-testflight-url').required = true;
  if (document.getElementById('edit-appstore-url')) document.getElementById('edit-appstore-url').required = false;

  // Disable next buttons
  for (let i = 1; i < EDIT_TOTAL_STEPS; i++) {
    const btn = document.getElementById(`edit-wizard-next-${i}`);
    if (btn) btn.disabled = true;
  }
}

function setupEditFormValidation() {
  const editForm = document.getElementById('edit-app-form');
  if (!editForm) return;

  // Prevent multiple initializations
  if (editForm.dataset.validationInitialized === 'true') {
    return;
  }
  editForm.dataset.validationInitialized = 'true';

  const validation = setupFormValidation(editForm, {
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

  // Validate steps on input
  const step1Inputs = ['edit-app-name', 'edit-app-package-name'];
  step1Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateEditStep(1));
  });

  const step2Inputs = ['edit-group-url', 'edit-custom-email-url', 'edit-testflight-url', 'edit-appstore-url'];
  step2Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateEditStep(2));
  });

  const step3Inputs = ['edit-app-icon-url', 'edit-app-screenshot-url-1', 'edit-app-screenshot-url-2', 'edit-app-screenshot-url-3'];
  step3Inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateEditStep(3));
  });

  document.getElementById('edit-app-desc')?.addEventListener('input', () => validateEditStep(4));

  // Toggle listeners for step 2 validation
  document.getElementById('edit-app-custom-email-enabled')?.addEventListener('change', () => validateEditStep(2));
  document.getElementById('edit-app-is-closed')?.addEventListener('change', () => validateEditStep(2));
  document.getElementById('edit-app-is-closed-ios')?.addEventListener('change', () => validateEditStep(2));

  // Submit handler
  const submitBtn = document.getElementById('edit-btn-submit');
  if (!submitBtn) {
    console.error('[Modals] Critical Error: Submit button not found in DOM');
    return;
  }

  if (submitBtn.dataset.listenerAttached === 'true') {
    return;
  }
  submitBtn.dataset.listenerAttached = 'true';

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('[Modals] Edit submit button clicked');

    try {
      if (!window.currentEditingAppId || !window.currentUser) return;

      // Validate all fields first
      console.log('[Modals] Running form validation...');
      if (!validation.validateAll()) {
        console.warn('[Modals] Form validation failed');
        toast.error('請修正表單錯誤後再送出');
        goToFirstInvalidEditStep(validation);
        return;
      }
      console.log('[Modals] Form validation passed');

      const appId = window.currentEditingAppId;
      const platform = document.getElementById('edit-app-platform').value;
      const packageName = document.getElementById('edit-app-package-name').value.trim();
      const iconUrl = document.getElementById('edit-app-icon-url').value.trim();
      const screenshotUrl1 = document.getElementById('edit-app-screenshot-url-1').value.trim();
      const screenshotUrl2 = document.getElementById('edit-app-screenshot-url-2').value.trim();
      const screenshotUrl3 = document.getElementById('edit-app-screenshot-url-3').value.trim();

      // Validate URLs (async check)
      try {
        console.log('[Modals] Validating image URLs...');
        await validateImageUrl(iconUrl, 'App 圖示網址');
        await validateImageUrl(screenshotUrl1, '截圖 1');
        await validateImageUrl(screenshotUrl2, '截圖 2');
        await validateImageUrl(screenshotUrl3, '截圖 3');
        console.log('[Modals] Image URLs validated');
      } catch (err) {
        console.error('[Modals] Image URL validation error:', err.message);
        return m3Alert(err.message, '網址格式錯誤');
      }

      const screenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);
      if (screenshotUrls.length > 3) {
        console.warn('[Modals] Too many screenshots');
        return m3Alert('最多只能上傳 3 張截圖', '截圖數量超過限制');
      }

      let groupUrl = '';
      let storeUrl = '';
      let testFlightUrl = '';
      let appStoreUrl = '';

      if (platform === 'android') {
        groupUrl = document.getElementById('edit-group-url').value.trim();
        storeUrl = `https://play.google.com/apps/testing/${packageName}`;
      } else {
        testFlightUrl = document.getElementById('edit-testflight-url').value.trim();
        appStoreUrl = document.getElementById('edit-appstore-url').value.trim();
        storeUrl = testFlightUrl || appStoreUrl;
      }

      const isClosed = document.getElementById('edit-app-is-closed').checked || document.getElementById('edit-app-is-closed-ios').checked;
      const customEmailEnabled = document.getElementById('edit-app-custom-email-enabled').checked;
      const customEmailInstruction = document.getElementById('edit-custom-email-instruction').value.trim();
      const customEmailUrl = document.getElementById('edit-custom-email-url').value.trim();

      // Check for duplicate packageName
      console.log('[Modals] Checking for duplicate packageName:', packageName);
      const appsRef = collection(db, 'apps');
      const dupQuery = query(appsRef, where('packageName', '==', packageName), where('platform', '==', platform));
      const dupSnap = await getDocs(dupQuery);
      const existingApp = dupSnap.docs.find(doc => doc.id !== appId);
      if (existingApp) {
        const data = existingApp.data();
        console.warn('[Modals] Duplicate app found:', data.name);
        return m3Alert(`此包名已被使用！\n已存在：${data.name} (${data.platform})`, '包名重複');
      }
      console.log('[Modals] No duplicate found');

      submitBtn.disabled = true;
      submitBtn.innerText = '更新中...';

      console.log('[Modals] Attempting to update document in Firestore...');
      const finalScreenshotUrls = [screenshotUrl1, screenshotUrl2, screenshotUrl3].filter(url => url);

      // Determine store field based on platform for backward compatibility
      const store = platform === 'ios' ? 'app-store' : 'google-play';

      await updateDoc(doc(db, 'apps', appId), {
        name: document.getElementById('edit-app-name').value,
        platform: platform,
        store: store,
        packageName: packageName,
        iconUrl: iconUrl,
        screenshotUrls: finalScreenshotUrls,
        description: document.getElementById('edit-app-desc').value,
        groupUrl: groupUrl,
        storeUrl: storeUrl,
        testFlightUrl: testFlightUrl,
        appStoreUrl: appStoreUrl,
        isClosed: isClosed,
        customEmailEnabled: customEmailEnabled,
        customEmailInstruction: customEmailInstruction,
        customEmailUrl: customEmailUrl,
        updatedAt: serverTimestamp()
      });

      console.log('[Modals] Firestore updateDoc successful');
      toast.success('專案更新成功！');
      // Reset dirty tracking after successful save
      window.editOriginalData = captureFormState();
      // submitBtn is already declared in outer scope
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '儲存';
        submitBtn.setAttribute('aria-label', '無變更可儲存');
      }
      closeEditAppModal();

      // Navigate back to the current user's developer profile
      if (window.currentUser) {
        window.navigate('dev-profile', { authorUid: window.currentUser.uid });
      } else {
        window.navigate('market-android');
      }

      window.loadMyApps?.();
      window.fetchMarketApps?.(true);
    } catch (err) {
      console.error('[Modals] Submission failed:', err);
      toast.error('更新失敗：' + err.message);
    } finally {
      console.log('[Modals] Submission process finished');
      submitBtn.disabled = false;
      submitBtn.innerText = '儲存';
    }
  });
}

function goToFirstInvalidEditStep(validation) {
  const errors = validation.getErrors();
  if (!errors || errors.length === 0) return;

  const firstError = errors[0];
  let targetStep = 1;

  if (['name', 'packageName'].includes(firstError.field)) targetStep = 1;
  else if (['groupUrl', 'customEmailUrl', 'testflightUrl', 'appStoreUrl'].includes(firstError.field)) targetStep = 2;
  else if (['iconUrl', 'screenshotUrl1', 'screenshotUrl2', 'screenshotUrl3'].includes(firstError.field)) targetStep = 3;
  else if (['description'].includes(firstError.field)) targetStep = 4;

  goToEditStep(targetStep);
}

// URL validation helper (copied from publish.js)
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`[Modals] Image URL validation warning for ${fieldName}:`, err.message);
    }
  }
  return true;
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
      window.navigate('dev-profile', { authorUid: window.currentUser.uid });
    } else {
      window.navigate('market-android');
    }

    window.loadMyApps?.();
    window.fetchMarketApps?.(true);
  } catch (err) {
    m3Error('刪除失敗：' + err.message);
  }
}