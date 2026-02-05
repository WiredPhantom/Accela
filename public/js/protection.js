/* ========================================
   ACCELA CONTENT PROTECTION SCRIPTS
   File: src/utils/protection.js
   ======================================== */

// Global config
const protectionConfig = {
  username: 'guest',
  email: 'guestmail',
  copyright: '© Accela 2026',
  opacity: 1, // Let CSS handle opacity
  showWarnings: true
};

// Main Initialization
export function initProtection(username, email, options) {
  options = options || {};
  protectionConfig.username = username || 'guest';
  protectionConfig.email = email || '';
  
  // Merge custom options
  if (options.copyright) protectionConfig.copyright = options.copyright;
  if (options.opacity) protectionConfig.opacity = options.opacity;
  if (typeof options.showWarnings !== 'undefined') protectionConfig.showWarnings = options.showWarnings;
  
  // Initialize all protection measures
  generateWatermarks();
  setupAntiTheft();
  addInvisibleWatermark();
  
  // Enhanced screenshot protection
  setupFocusBlur();
  setupVisibilityDetection();
  setupEnhancedKeyDetection();
  setupMobileScreenshotDetection();
  
  // NO DYNAMIC WATERMARK SETUP - Removed as requested
  
  console.log('%c🛡️ Content Protection Active', 'color: #4f46e5; font-weight: bold; font-size: 12px;');
}

// Watermark Generation
function generateWatermarks() {
  const watermarkText = `${protectionConfig.username} • ${protectionConfig.email} • ${protectionConfig.copyright}`;
  
  // Generate pattern watermark
  const pattern = document.getElementById('watermarkPattern');
  if (pattern) {
    pattern.innerHTML = '';
    
    // Create grid of watermarks
    const count = window.innerWidth > 768 ? 150 : 80;
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'watermark-item';
      item.textContent = watermarkText;
      pattern.appendChild(item);
    }
  }

  // Generate floating watermark
  const floating = document.getElementById('floatingWatermark');
  if (floating) {
    floating.textContent = `${protectionConfig.username} • ${protectionConfig.copyright}`;
  }

  // Generate corner watermark
  const corner = document.getElementById('cornerWatermark');
  if (corner) {
    const emailHtml = protectionConfig.email ? `<div class="wm-email">${escapeHtml(protectionConfig.email)}</div>` : '';
    corner.innerHTML = `
      <div class="wm-username">${escapeHtml(protectionConfig.username)}</div>
      ${emailHtml}
      <div class="wm-copyright">${escapeHtml(protectionConfig.copyright)}</div>
    `;
  }

  // Generate print watermark
  const printWm = document.getElementById('printWatermark');
  if (printWm) {
    printWm.textContent = watermarkText;
  }
}

// HTML Escape Helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Mobile Screenshot Detection
function setupMobileScreenshotDetection() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (!isMobile) return; 
  
  let lastVisibility = document.visibilityState;
  
  // Check periodically
  setInterval(() => {
    const currentVisibility = document.visibilityState;
    if (lastVisibility === 'visible' && currentVisibility === 'hidden') {
      triggerProtection();
    }
    lastVisibility = currentVisibility;
  }, 200);
}

function triggerProtection() {
  document.body.style.opacity = '0';
  document.body.style.filter = 'blur(30px)';
  
  setTimeout(() => {
    document.body.style.opacity = '1';
    document.body.style.filter = 'none';
  }, 1000);
}

// Blur on Window Focus Loss
function setupFocusBlur() {
  window.addEventListener('blur', () => {
    document.body.style.filter = 'blur(30px)';
    document.body.style.opacity = '0.1';
  });
  
  window.addEventListener('focus', () => {
    setTimeout(() => {
      document.body.style.filter = 'none';
      document.body.style.opacity = '1';
    }, 200);
  });
}

// Visibility Change Detection
function setupVisibilityDetection() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.style.filter = 'blur(50px)';
      document.body.style.opacity = '0';
    } else {
      setTimeout(() => {
        document.body.style.filter = 'none';
        document.body.style.opacity = '1';
      }, 300);
    }
  });
}

// Enhanced Key Detection
function setupEnhancedKeyDetection() {
  document.addEventListener('keydown', (e) => {
    const key = e.key ? e.key.toLowerCase() : '';
    const isScreenshot = (
      e.key === 'PrintScreen' ||
      (e.metaKey && e.shiftKey && ['3','4','5'].includes(key)) ||
      (e.ctrlKey && e.shiftKey && key === 's') ||
      (e.metaKey && e.shiftKey && key === '4')
    );
    
    if (isScreenshot) {
      e.preventDefault();
      triggerProtection();
      showProtectionWarning('Screenshots are restricted.');
      return false;
    }
  });
}

// Anti-Theft Measures
function setupAntiTheft() {
  // Disable right-click
  document.addEventListener('contextmenu', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return true;
    e.preventDefault();
    return false;
  });

  // Disable keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const key = e.key ? e.key.toLowerCase() : '';
    
    if (e.ctrlKey && ['c', 'v', 'x', 'a', 's', 'u'].includes(key)) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) && ['c','v','x','a'].includes(key)) return true;
      e.preventDefault();
      if (protectionConfig.showWarnings) showProtectionWarning('Protected Content');
      return false;
    }
    
    if ((e.ctrlKey && e.shiftKey && ['i', 'c', 'j'].includes(key)) || e.key === 'F12') {
      e.preventDefault();
      return false;
    }
  });

  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
  });
}

// Warning Toast
function showProtectionWarning(message) {
  if (!protectionConfig.showWarnings) return;
  
  const existing = document.getElementById('protection-warning');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'protection-warning';
  // Updated style: Dark theme compatible
  toast.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(10, 9, 45, 0.95); color: #fff; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-family: Inter, sans-serif; z-index: 100001; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); pointer-events: none;';
  
  toast.textContent = message;
  
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 2000);
}

// Invisible Watermark
function addInvisibleWatermark() {
  const uniqueId = btoa(`${protectionConfig.username}-${Date.now()}`).substring(0, 16);
  const invisible = document.createElement('div');
  invisible.style.cssText = 'position: absolute; opacity: 0; pointer-events: none;';
  invisible.textContent = uniqueId;
  document.body.appendChild(invisible);
}
