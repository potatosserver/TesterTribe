// Utility functions
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#96;');
}

export function formatDate(timestamp) {
  if (!timestamp) return '未知時間';
  let date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return '未知時間';
  }
  return date.toLocaleString('zh-TW', { 
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).replace(/\//g, '/');
}

export function formatDateOnly(timestamp) {
  if (!timestamp) return '未知日期';
  let date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return '未知日期';
  }
  return date.toLocaleDateString('zh-TW', { 
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/\//g, '/');
}

/* ========== Toast Notification System ========== */
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', '通知訊息');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, options = {}) {
  const {
    type = 'info', // 'success' | 'error' | 'warning' | 'info'
    title = '',
    duration = 4000,
    closable = true,
    onClose = null
  } = options;

  const container = ensureToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  
  const icons = {
    success: '<span class="material-symbols-outlined">check_circle</span>',
    error: '<span class="material-symbols-outlined">error</span>',
    warning: '<span class="material-symbols-outlined">warning</span>',
    info: '<span class="material-symbols-outlined">info</span>'
  };
  
  const progressDuration = duration;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHTML(title)}</div>` : ''}
      <div class="toast-message">${escapeHTML(message)}</div>
    </div>
    ${closable ? '<button class="toast-close" aria-label="關閉通知"><span class="material-symbols-outlined">close</span></button>' : ''}
    <div class="toast-progress" style="animation-duration: ${progressDuration}ms;"></div>
  `;
  
  const closeBtn = toast.querySelector('.toast-close');
  const progressBar = toast.querySelector('.toast-progress');
  
  const closeToast = () => {
    toast.classList.add('hiding');
    progressBar.style.animationPlayState = 'paused';
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (onClose) onClose();
    }, { once: true });
  };
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeToast);
  }
  
  // Auto dismiss
  const autoDismissTimer = setTimeout(closeToast, duration);
  
  // Pause on hover
  toast.addEventListener('mouseenter', () => {
    clearTimeout(autoDismissTimer);
    progressBar.style.animationPlayState = 'paused';
  });
  
  toast.addEventListener('mouseleave', () => {
    progressBar.style.animationPlayState = 'running';
    const remainingTime = progressDuration * (1 - parseFloat(getComputedStyle(progressBar).width) / 100);
    setTimeout(closeToast, remainingTime);
  });
  
  container.appendChild(toast);
  
  // Limit max toasts
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length > 5) {
    toasts[0].classList.add('hiding');
    toasts[0].addEventListener('animationend', () => toasts[0].remove(), { once: true });
  }
  
  return { close: closeToast };
}

// Convenience methods
export const toast = {
  success: (message, options) => showToast(message, { ...options, type: 'success' }),
  error: (message, options) => showToast(message, { ...options, type: 'error' }),
  warning: (message, options) => showToast(message, { ...options, type: 'warning' }),
  info: (message, options) => showToast(message, { ...options, type: 'info' })
};

/* ========== Skeleton Loader Helpers ========== */
export function createSkeleton(type, options = {}) {
  const { count = 1, className = '' } = options;
  const skeletons = [];
  
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = `skeleton ${className}`;
    
    switch (type) {
      case 'text':
        el.classList.add('skeleton-text');
        break;
      case 'title':
        el.classList.add('skeleton-title');
        break;
      case 'avatar':
        el.classList.add('skeleton-avatar');
        break;
      case 'btn':
        el.classList.add('skeleton-btn');
        break;
      case 'card':
        el.classList.add('skeleton-card');
        el.innerHTML = `
          <div class="skeleton-card-header">
            <div class="skeleton skeleton-avatar"></div>
            <div>
              <div class="skeleton skeleton-title" style="width: 60%;"></div>
              <div class="skeleton skeleton-text" style="width: 40%;"></div>
            </div>
          </div>
          <div class="skeleton-card-body">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 70%;"></div>
          </div>
        `;
        break;
      case 'app-card':
        el.classList.add('skeleton-card');
        el.style.padding = '22px';
        el.innerHTML = `
          <div class="skeleton-card-header">
            <div class="skeleton skeleton-avatar" style="width: 58px; height: 58px; border-radius: var(--md-shape-corner-medium);"></div>
            <div style="flex: 1; min-width: 0;">
              <div class="skeleton skeleton-title" style="width: 70%;"></div>
              <div class="skeleton skeleton-text" style="width: 50%; margin-top: 8px;"></div>
            </div>
          </div>
          <div class="skeleton-card-body" style="margin-top: 12px;">
            <div class="skeleton skeleton-text" style="width: 100%; height: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 100%; height: 8px; margin-top: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 60%; height: 8px; margin-top: 8px;"></div>
          </div>
          <div class="skeleton skeleton-btn" style="margin-top: 16px;"></div>
        `;
        break;
      case 'hero':
        el.classList.add('skeleton-hero');
        el.innerHTML = `
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div style="display: flex; gap: 16px; justify-content: center; margin-top: 24px; flex-wrap: wrap;">
            <div class="skeleton skeleton-btn" style="width: 180px;"></div>
            <div class="skeleton skeleton-btn" style="width: 180px;"></div>
          </div>
        `;
        break;
      case 'stats':
        el.classList.add('skeleton-stat');
        el.innerHTML = `
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
        `;
        break;
      default:
        el.classList.add('skeleton-text');
    }
    
    skeletons.push(el);
  }
  
  return count === 1 ? skeletons[0] : skeletons;
}

export function showSkeleton(container, type, count = 1) {
  // If first arg is a string, treat it as type and return HTML string (for template literals)
  if (typeof container === 'string') {
    count = type || 1;
    type = container;
    const skeletons = createSkeleton(type, { count });
    if (Array.isArray(skeletons)) {
      return skeletons.map(s => s.outerHTML).join('');
    }
    return skeletons.outerHTML;
  }
  
  // Otherwise, container is a DOM element
  container.innerHTML = '';
  const skeletons = createSkeleton(type, { count });
  if (Array.isArray(skeletons)) {
    skeletons.forEach(s => container.appendChild(s));
    return skeletons;
  } else {
    container.appendChild(skeletons);
    return skeletons;
  }
}

export function hideSkeleton(container) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (el) el.innerHTML = '';
}

/* ========== Empty State Helper ========== */
export function createEmptyState(options = {}) {
  const {
    icon = 'inbox',
    title = '暫無資料',
    description = '',
    actionText = '',
    actionCallback = null,
    className = ''
  } = options;
  
  const container = document.createElement('div');
  container.className = `empty-state ${className}`;
  container.innerHTML = `
    <span class="empty-state-icon material-symbols-outlined">${escapeHTML(icon)}</span>
    <h3 class="empty-state-title">${escapeHTML(title)}</h3>
    ${description ? `<p class="empty-state-desc">${escapeHTML(description)}</p>` : ''}
    ${actionText && actionCallback ? `
      <button class="btn btn-primary empty-state-action">${escapeHTML(actionText)}</button>
    ` : ''}
  `;
  
  const btn = container.querySelector('.empty-state-action');
  if (btn && actionCallback) {
    btn.addEventListener('click', actionCallback);
  }
  
  return container;
}

/* ========== Form Validation ========== */
export function validateField(field, rules) {
  const value = field.value.trim();
  const errors = [];
  
  for (const rule of rules) {
    if (rule.required && !value) {
      errors.push(rule.message || '此欄位為必填');
      continue;
    }
    if (!value) continue; // Skip other rules if empty and not required
    
    if (rule.minLength && value.length < rule.minLength) {
      errors.push(rule.message || `至少需要 ${rule.minLength} 字元`);
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push(rule.message || `最多 ${rule.maxLength} 字元`);
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(rule.message || '格式不正確');
    }
    if (rule.custom && !rule.custom(value)) {
      errors.push(rule.message || '驗證失敗');
    }
  }
  
  const formGroup = field.closest('.form-group');
  const errorEl = formGroup?.querySelector('.form-error');
  
  if (errors.length > 0) {
    field.classList.add('error');
    if (errorEl) {
      errorEl.textContent = errors[0];
      errorEl.classList.add('visible');
    }
    if (formGroup) formGroup.classList.add('has-error');
    return false;
  } else {
    field.classList.remove('error');
    if (errorEl) {
      errorEl.classList.remove('visible');
    }
    if (formGroup) formGroup.classList.remove('has-error');
    return true;
  }
}

export function setupFormValidation(form, fieldRules) {
  const fields = Object.keys(fieldRules);
  
  // Real-time validation on input/blur
  fields.forEach(fieldName => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    
    const rules = fieldRules[fieldName];
    
    field.addEventListener('blur', () => validateField(field, rules));
    field.addEventListener('input', () => {
      // Only validate on input if field already has error
      if (field.classList.contains('error')) {
        validateField(field, rules);
      }
    });
  });
  
  // Validate all on submit
  form.addEventListener('submit', (e) => {
    let isValid = true;
    fields.forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field && !validateField(field, fieldRules[fieldName])) {
        isValid = false;
      }
    });
    
    if (!isValid) {
      e.preventDefault();
      // Focus first error field
      const firstError = form.querySelector('.form-control.error');
      if (firstError) firstError.focus();
    }
    
    return isValid;
  });
  
  return {
    validateAll: () => {
      let isValid = true;
      fields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && !validateField(field, fieldRules[fieldName])) {
          isValid = false;
        }
      });
      return isValid;
    },
    reset: () => {
      fields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) {
          field.classList.remove('error');
          const errorEl = field.closest('.form-group')?.querySelector('.form-error');
          if (errorEl) errorEl.classList.remove('visible');
          const formGroup = field.closest('.form-group');
          if (formGroup) formGroup.classList.remove('has-error');
        }
      });
    }
  };
}

/* ========== Count-up Animation ========== */
export function animateCountUp(element, start, end, duration = 1500, options = {}) {
  const { 
    decimals = 0, 
    separator = ',', 
    prefix = '', 
    suffix = '',
    easing = 'easeOutCubic',
    onComplete = null
  } = options;
  
  const startTime = performance.now();
  const difference = end - start;
  
  const easingFunctions = {
    linear: t => t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutQuart: t => 1 - Math.pow(1 - t, 4),
    easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
  };
  
  const ease = easingFunctions[easing] || easingFunctions.easeOutCubic;
  
  function formatNumber(num) {
    const fixed = num.toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return prefix + parts.join('.') + suffix;
  }
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = ease(progress);
    const current = start + difference * easedProgress;
    
    element.textContent = formatNumber(current);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatNumber(end);
      if (onComplete) onComplete();
    }
  }
  
  requestAnimationFrame(update);
}

export function animateCountUpElements(selector, options = {}) {
  const elements = document.querySelectorAll(selector);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const endValue = parseFloat(el.dataset.count || el.textContent.replace(/[^\d.-]/g, '')) || 0;
        const startValue = parseFloat(el.dataset.start) || 0;
        animateCountUp(el, startValue, endValue, options.duration, options);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  
  elements.forEach(el => observer.observe(el));
}

/* ========== Image Lazy Loading Enhancement ========== */
export function setupLazyImages(selector = 'img[loading="lazy"]') {
  const images = document.querySelectorAll(selector);
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px 0px', threshold: 0.01 });
    
    images.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    images.forEach(img => img.classList.add('loaded'));
  }
}

/* ========== Mobile Drawer Focus Trap ========== */
export function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable], summary, audio[controls], video[controls]'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  function handleTab(e) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  element.addEventListener('keydown', handleTab);
  
  // Focus first element on open
  if (firstElement) firstElement.focus();
  
  return () => {
    element.removeEventListener('keydown', handleTab);
  };
}

/* ========== Bottom Sheet (Mobile Filter) ========== */
export function createBottomSheet(options = {}) {
  const {
    title = '',
    content = '',
    actions = [],
    className = ''
  } = options;
  
  const backdrop = document.createElement('div');
  backdrop.className = 'bottom-sheet-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    z-index: 1100;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  
  const sheet = document.createElement('div');
  sheet.className = `bottom-sheet ${className}`;
  sheet.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: var(--md-sys-color-surface-container-low);
    border-radius: var(--md-shape-corner-large) var(--md-shape-corner-large) 0 0;
    box-shadow: var(--md-elevation-2);
    z-index: 1101;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  `;
  
  sheet.innerHTML = `
    <div class="bottom-sheet-handle" style="
      width: 40px; height: 4px; background: var(--md-sys-color-outline-variant);
      border-radius: 2px; margin: 12px auto 8px; cursor: grab;
    "></div>
    ${title ? `<div class="bottom-sheet-header" style="padding: 0 20px 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant); display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">${escapeHTML(title)}</h3>
      <button class="bottom-sheet-close" aria-label="關閉" style="width: 40px; height: 40px; border: none; background: transparent; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface);">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>` : ''}
    <div class="bottom-sheet-content" style="flex: 1; overflow-y: auto; padding: 16px 20px;">${content}</div>
    ${actions.length > 0 ? `<div class="bottom-sheet-actions" style="padding: 16px 20px; border-top: 1px solid var(--md-sys-color-outline-variant); display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
      ${actions.map(a => `<button class="btn ${a.class || 'btn-tonal'}" data-action="${escapeHTML(a.action)}">${escapeHTML(a.label)}</button>`).join('')}
    </div>` : ''}
  `;
  
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  
  // Animate in
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    sheet.style.transform = 'translateY(0)';
  });
  
  const close = () => {
    backdrop.style.opacity = '0';
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => backdrop.remove(), 300);
  };
  
  // Close handlers
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  
  const closeBtn = sheet.querySelector('.bottom-sheet-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  
  // Action buttons
  sheet.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = actions.find(a => a.action === btn.dataset.action);
      if (action?.callback) action.callback();
      if (!action?.keepOpen) close();
    });
  });
  
  // ESC key
  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  
  // Cleanup on close
  const originalClose = close;
  close = () => {
    document.removeEventListener('keydown', escHandler);
    originalClose();
  };
  
  return { close, sheet, backdrop };
}

/* ========== Step Progress Indicator Helper ========== */
export function createStepProgress(steps, currentStep = 0) {
  const container = document.createElement('div');
  container.className = 'step-progress';
  container.setAttribute('role', 'navigation');
  container.setAttribute('aria-label', '步驟進度');
  
  steps.forEach((step, index) => {
    const item = document.createElement('div');
    item.className = 'step-progress-item';
    if (index < currentStep) item.classList.add('completed');
    if (index === currentStep) item.classList.add('active');
    
    item.innerHTML = `
      <div class="step-progress-circle" aria-current="${index === currentStep ? 'step' : 'false'}">
        ${index < currentStep ? '' : (index + 1)}
      </div>
      <span class="step-progress-label">${escapeHTML(step)}</span>
    `;
    
    container.appendChild(item);
  });
  
  return container;
}

export function updateStepProgress(container, currentStep) {
  const items = container.querySelectorAll('.step-progress-item');
  items.forEach((item, index) => {
    item.classList.remove('active', 'completed');
    const circle = item.querySelector('.step-progress-circle');
    if (index < currentStep) {
      item.classList.add('completed');
      circle.textContent = '';
    } else if (index === currentStep) {
      item.classList.add('active');
      circle.textContent = index + 1;
    } else {
      circle.textContent = index + 1;
    }
    circle.setAttribute('aria-current', index === currentStep ? 'step' : 'false');
  });
}