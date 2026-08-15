// Material 3 Basic Dialog - Strict Spec Implementation
// https://m3.material.io/components/dialogs/specs

let dialogContainer = null;
let dialogQueue = [];
let isDialogShowing = false;

// Initialize dialog container
export function initM3Dialog() {
  if (dialogContainer) return;
  
  dialogContainer = document.createElement('div');
  dialogContainer.id = 'm3-dialog-container';
  dialogContainer.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10000;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  `;
  document.body.appendChild(dialogContainer);
}

// Show Material 3 Alert Dialog (Basic Dialog)
export function showM3Alert(message, title, options = {}) {
  return new Promise((resolve) => {
    const config = {
      title: title || '',
      message: message || '',
      confirmText: options.confirmText || '確定',
      confirmColor: options.confirmColor || 'primary',
      icon: options.icon || null,
      iconColor: options.iconColor || 'primary',
      onConfirm: options.onConfirm || (() => {}),
      destructive: options.destructive || false,
      ...options
    };
    queueDialog('alert', config, resolve);
  });
}

// Show Material 3 Confirm Dialog (Basic Dialog)
export function showM3Confirm(message, title, options = {}) {
  return new Promise((resolve) => {
    const config = {
      title: title || '',
      message: message || '',
      confirmText: options.confirmText || '確定',
      cancelText: options.cancelText || '取消',
      confirmColor: options.confirmColor || 'primary',
      icon: options.icon || null,
      iconColor: options.iconColor || 'primary',
      destructive: options.destructive || false,
      onConfirm: options.onConfirm || (() => {}),
      onCancel: options.onCancel || (() => {}),
      ...options
    };
    queueDialog('confirm', config, resolve);
  });
}

function queueDialog(type, config, resolve) {
  dialogQueue.push({ type, config, resolve });
  processDialogQueue();
}

function processDialogQueue() {
  if (isDialogShowing || dialogQueue.length === 0) return;
  
  const { type, config, resolve } = dialogQueue.shift();
  isDialogShowing = true;
  
  const dialog = createDialogElement(type, config, resolve);
  
  requestAnimationFrame(() => {
    dialog.show();
  });
}

function createDialogElement(type, config, resolve) {
  // Scrim backdrop - full viewport, 32% opacity
  const scrim = document.createElement('div');
  scrim.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.32);
    opacity: 0;
    transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
    pointer-events: auto;
  `;
  
  // Dialog container - 28dp corner radius, Surface Container High
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    z-index: 10001;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    background: var(--md-sys-color-surface-container-high, #2c2c2c);
    border-radius: 28px;
    box-shadow: 
      0 6px 10px rgba(0,0,0,0.15),
      0 2px 5px rgba(0,0,0,0.1);
    opacity: 0;
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s;
    pointer-events: auto;
    padding: 16px;
  `;
  
  const dialog = {
    show: () => {
      scrim.style.opacity = '1';
      container.style.transform = 'translate(-50%, -50%) scale(1)';
      container.style.opacity = '1';
    },
    hide: () => {
      scrim.style.opacity = '0';
      container.style.transform = 'translate(-50%, -50%) scale(0.9)';
      container.style.opacity = '0';
      setTimeout(() => {
        scrim.remove();
        container.remove();
        isDialogShowing = false;
        processDialogQueue();
      }, 200);
    },
    _scrim: scrim,
    _container: container
  };
  
  document.body.appendChild(scrim);
  document.body.appendChild(container);
  
  // Icon (optional) - 24dp, centered, NO container background
  let iconHtml = '';
  if (config.icon) {
    const iconColor = config.destructive ? 'error' : config.iconColor;
    iconHtml = `
      <div style="
        display: flex;
        justify-content: center;
        margin: 16px 0 8px;
        color: var(--md-sys-color-${iconColor}, ${config.destructive ? '#f2b8b5' : '#bcb5f0'});
      ">
        <span class="material-symbols-outlined" style="font-size: 24px;">${config.icon}</span>
      </div>
    `;
  }
  
  // Title - Headline Small (20sp/1.25rem), Medium (500), left-aligned
  const titleHtml = config.title ? `
    <h3 style="
      margin: 0 0 8px;
      font-size: 1.25rem;
      font-weight: 500;
      line-height: 1.5;
      color: var(--md-sys-color-on-surface, #fff);
      text-align: left;
    ">${escapeHTML(config.title)}</h3>
  ` : '';
  
  // Message - Body Large (14sp/0.875rem), Regular (400), On Surface Variant, left-aligned
  const messageHtml = config.message ? `
    <p style="
      margin: 0;
      font-size: 0.875rem;
      font-weight: 400;
      line-height: 1.5;
      color: var(--md-sys-color-on-surface-variant, #b0b0b0);
      text-align: left;
    ">${escapeHTML(config.message)}</p>
  ` : '';
  
  // Buttons - Text Button style (no background, no border)
  // Label Large (14sp/0.875rem), Medium (500), uppercase, Primary color
  let actionsHtml = '';
  
  const colorMap = {
    primary: 'primary',
    secondary: 'secondary',
    tertiary: 'tertiary',
    error: 'error'
  };
  const confirmColor = config.destructive ? 'error' : (colorMap[config.confirmColor] || 'primary');
  const confirmTextColor = config.destructive ? 'error' : confirmColor;
  
  if (type === 'alert') {
    actionsHtml = createButton(config.confirmText, confirmTextColor, true);
  } else {
    // Cancel button - Text Button, Primary color
    const cancelHtml = createButton(config.cancelText, 'primary', false);
    // Confirm button - Text Button, Primary/Error color
    const confirmHtml = createButton(config.confirmText, confirmTextColor, true);
    
    // M3: dismissive action first, confirming action last (right-aligned)
    actionsHtml = `<div style="display: flex; gap: 8px; justify-content: flex-end;">${cancelHtml}${confirmHtml}</div>`;
  }
  
  container.innerHTML = `
    <div style="padding: 24px 24px 8px;">
      ${iconHtml}
      ${titleHtml}
      ${messageHtml}
    </div>
    <div style="
      display: flex;
      gap: 8px;
      padding: 8px 24px 24px;
      justify-content: flex-end;
    ">
      ${actionsHtml}
    </div>
  `;
  
  // Bind events
  const confirmBtn = container.querySelector('[data-role="confirm"]');
  const cancelBtn = container.querySelector('[data-role="cancel"]');
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      config.onConfirm();
      resolve(type === 'confirm' ? true : undefined);
      dialog.hide();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      config.onCancel();
      resolve(false);
      dialog.hide();
    });
  }
  
  // Close on scrim click (for both alert and confirm)
  scrim.addEventListener('click', () => {
    if (type === 'confirm') {
      config.onCancel();
      resolve(false);
    } else {
      config.onConfirm();
      resolve();
    }
    dialog.hide();
  });
  
  // ESC key
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (type === 'confirm') {
        config.onCancel();
        resolve(false);
      } else {
        config.onConfirm();
        resolve();
      }
      dialog.hide();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  dialog._cleanup = () => document.removeEventListener('keydown', handleEsc);
  const origHide = dialog.hide;
  dialog.hide = () => { origHide(); dialog._cleanup(); };
  
  return dialog;
}

// Text Button: no background, no border, Primary color, 36dp height, 64dp min-width
function createButton(text, colorKey, isConfirm) {
  const role = isConfirm ? 'confirm' : 'cancel';
  const colorVar = colorKey === 'error' ? 'error' : colorKey;
  
  // Pre-compute colors for inline event handlers
  const hoverBg = colorKey === 'error' ? '#4d1919' : '#3a354d';
  const colorValue = colorKey === 'error' ? '#f2b8b5' : '#bcb5f0';
  const colorVarContainer = `${colorVar}-container`;
  
  return `
    <button 
      data-role="${role}"
      style="
        height: 36px;
        min-width: 64px;
        padding: 0 12px;
        border-radius: 18px;
        font-size: 0.875rem;
        font-weight: 500;
        letter-spacing: 0.0178571429em;
        text-transform: uppercase;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: transparent;
        border: none;
        color: var(--md-sys-color-${colorVar}, ${colorValue});
        transition: background-color 0.15s cubic-bezier(0.2, 0, 0, 1);
      "
      onmouseover="this.style.backgroundColor='var(--md-sys-color-${colorVarContainer}, ${hoverBg})'"
      onmouseout="this.style.backgroundColor='transparent'"
      onmousedown="this.style.backgroundColor='var(--md-sys-color-${colorVarContainer}, ${hoverBg})'"
      onmouseup="this.style.backgroundColor='transparent'"
    >
      ${escapeHTML(text)}
    </button>
  `;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// Convenience functions
export function m3Alert(message, title, options) {
  return showM3Alert(message, title, options);
}

export function m3Confirm(message, title, options) {
  return showM3Confirm(message, title, options);
}

export function m3Error(message, title) {
  return showM3Alert(message, title || '錯誤', { 
    icon: 'error', 
    iconColor: 'error',
    confirmColor: 'error',
    destructive: true
  });
}

export function m3Success(message, title) {
  return showM3Alert(message, title || '成功', { 
    icon: 'check_circle', 
    iconColor: 'primary',
    confirmColor: 'primary'
  });
}

export function m3Warning(message, title) {
  return showM3Alert(message, title || '警告', { 
    icon: 'warning', 
    iconColor: 'tertiary',
    confirmColor: 'tertiary'
  });
}

export function m3Info(message, title) {
  return showM3Alert(message, title || '提示', { 
    icon: 'info', 
    iconColor: 'primary',
    confirmColor: 'primary'
  });
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initM3Dialog);
} else {
  initM3Dialog();
}

// Export for global access
window.m3Alert = m3Alert;
window.m3Confirm = m3Confirm;
window.m3Error = m3Error;
window.m3Success = m3Success;
window.m3Warning = m3Warning;
window.m3Info = m3Info;