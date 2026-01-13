/* ========================================
   ACCELA CONTENT PROTECTION SCRIPTS
   File: public/js/protection.js
   ======================================== */

// ========== CONFIGURATION ==========
const protectionConfig = {
  username: 'guest',
  email: '',
  copyright: '© Accela 2025',
  opacity: 0.04,
  showWarnings: true
};

// ========== MAIN INITIALIZATION ==========
function initProtection(username, email, options = {}) {
  protectionConfig.username = username || 'guest';
  protectionConfig.email = email || '';
  
  // Merge custom options
  if (options.copyright) protectionConfig.copyright = options.copyright;
  if (options.opacity) protectionConfig.opacity = options.opacity;
  if (options.showWarnings !== undefined) protectionConfig.showWarnings = options.showWarnings;
  
  // Initialize all protection measures
  generateWatermarks();
  setupAntiTheft();
  addInvisibleWatermark();
  
  console.log('%c🛡️ Content Protection Active', 'color: #4f46e5; font-weight: bold; font-size: 12px;');
}

// ========== WATERMARK GENERATION ==========
function generateWatermarks() {
  const watermarkText = `${protectionConfig.username} • ${protectionConfig.email} • ${protectionConfig.copyright}`;
  
  // Generate pattern watermark
  const pattern = document.getElementById('watermarkPattern');
  if (pattern) {
    pattern.innerHTML = '';
    pattern.style.opacity = protectionConfig.opacity;
    
    // Create grid of watermarks (adjust count based on screen size)
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
    corner.innerHTML = `
      <div class="wm-username">${protectionConfig.username}</div>
      ${protectionConfig.email ? `<div class="wm-email">${protectionConfig.email}</div>` : ''}
      <div class="wm-copyright">${protectionConfig.copyright}</div>
    `;
  }

  // Generate print watermark
  const print = document.getElementById('printWatermark');
  if (print) {
    print.textContent = watermarkText;
  }
}

// ========== ANTI-THEFT MEASURES ==========
function setupAntiTheft() {
  
  // 1. Disable right-click context menu
  document.addEventListener('contextmenu', function(e) {
    // Allow right-click on inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    showProtectionWarning('Right-click is disabled to protect content.');
    return false;
  });

  // 2. Disable keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    const key = e.key.toLowerCase();
    
    // Ctrl+C, Ctrl+V, Ctrl+X (Copy, Paste, Cut)
    if (e.ctrlKey && (key === 'c' || key === 'v' || key === 'x')) {
      // Allow in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      showProtectionWarning('Copy/Paste is disabled to protect content.');
      return false;
    }
    
    // Ctrl+S (Save)
    if (e.ctrlKey && key === 's') {
      e.preventDefault();
      showProtectionWarning('Saving is disabled to protect content.');
      return false;
    }
    
    // Ctrl+A (Select All)
    if (e.ctrlKey && key === 'a') {
      // Allow in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      showProtectionWarning('Select all is disabled to protect content.');
      return false;
    }
    
    // Ctrl+P (Print) - Allow but log it
    if (e.ctrlKey && key === 'p') {
      console.log('Print initiated by:', protectionConfig.username);
      // Don't prevent - watermark will show in print
    }
    
    // Ctrl+Shift+I, F12 (Developer Tools)
    if ((e.ctrlKey && e.shiftKey && key === 'i') || e.key === 'F12') {
      e.preventDefault();
      showProtectionWarning('Developer tools are restricted.');
      return false;
    }
    
    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && key === 'c') {
      e.preventDefault();
      showProtectionWarning('Inspect element is disabled.');
      return false;
    }
    
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && key === 'j') {
      e.preventDefault();
      return false;
    }
    
    // Ctrl+U (View Source)
    if (e.ctrlKey && key === 'u') {
      e.preventDefault();
      showProtectionWarning('View source is disabled.');
      return false;
    }
    
    // PrintScreen key
    if (e.key === 'PrintScreen') {
      showProtectionWarning('Screenshots contain your watermark for accountability.');
    }
  });

  // 3. Disable drag and drop
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      showProtectionWarning('Image dragging is disabled.');
      return false;
    }
    e.preventDefault();
    return false;
  });

  // 4. Detect DevTools opening
  let devToolsOpen = false;
  const threshold = 160;
  
  setInterval(function() {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        console.log('%c⚠️ CONTENT PROTECTED', 'color: #ef4444; font-size: 24px; font-weight: bold;');
        console.log('%cThis content is protected and watermarked.', 'color: #f97316; font-size: 14px;');
        console.log('%cUser: ' + protectionConfig.username, 'color: #f97316; font-size: 14px;');
        console.log('%cEmail: ' + protectionConfig.email, 'color: #f97316; font-size: 14px;');
        console.log('%c⚠️ Any attempt to steal content will be traced back to your account.', 'color: #ef4444; font-size: 12px;');
      }
    } else {
      devToolsOpen = false;
    }
  }, 1000);

  // 5. Disable text selection via JavaScript
  document.addEventListener('selectstart', function(e) {
    // Allow selection in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    return false;
  });

  // 6. Disable copy event
  document.addEventListener('copy', function(e) {
    // Allow in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    showProtectionWarning('Copying is disabled to protect content.');
    return false;
  });

  // 7. Disable cut event
  document.addEventListener('cut', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    e.preventDefault();
    return false;
  });

  // 8. Log visibility changes (potential screenshot)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      console.log('Tab hidden - User:', protectionConfig.username, 'Time:', new Date().toISOString());
    }
  });

  // 9. Disable image context menu and dragging
  document.querySelectorAll('img').forEach(function(img) {
    img.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    img.setAttribute('draggable', 'false');
  });
}

// ========== WARNING TOAST ==========
function showProtectionWarning(message) {
  if (!protectionConfig.showWarnings) return;
  
  // Remove existing warning
  const existing = document.getElementById('protection-warning');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'protection-warning';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    padding: 14px 28px;
    border-radius: 12px;
    font-size: 14px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
    z-index: 100001;
    box-shadow: 0 8px 32px rgba(79, 70, 229, 0.4);
    animation: slideDown 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 90vw;
    text-align: center;
  `;
  
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ========== INVISIBLE WATERMARK (for tracking) ==========
function addInvisibleWatermark() {
  // Generate unique content identifier
  const timestamp = Date.now();
  const data = `${protectionConfig.username}-${protectionConfig.email}-${timestamp}`;
  const uniqueId = btoa(data).substring(0, 24);
  
  // Create invisible tracking element
  const invisible = document.createElement('div');
  invisible.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0.01;
    color: transparent;
    font-size: 1px;
    pointer-events: none;
    top: 0;
    left: 0;
  `;
  invisible.textContent = uniqueId;
  invisible.setAttribute('data-uid', uniqueId);
  invisible.setAttribute('data-user', protectionConfig.username);
  document.body.appendChild(invisible);
  
  // Also add as HTML comment (harder to remove)
  const comment = document.createComment(` Protected Content - UID: ${uniqueId} - User: ${protectionConfig.username} `);
  document.body.insertBefore(comment, document.body.firstChild);
  
  return uniqueId;
}

// ========== UTILITY FUNCTIONS ==========

// Update watermarks dynamically
function updateProtectionWatermarks(username, email) {
  if (username) protectionConfig.username = username;
  if (email) protectionConfig.email = email;
  generateWatermarks();
}

// Toggle watermark visibility
function toggleWatermarks(show) {
  const overlay = document.getElementById('watermarkOverlay');
  const floating = document.getElementById('floatingWatermark');
  const corner = document.getElementById('cornerWatermark');
  
  const display = show ? 'block' : 'none';
  
  if (overlay) overlay.style.display = display;
  if (floating) floating.style.display = display;
  if (corner) corner.style.display = display;
}

// Set watermark opacity
function setWatermarkOpacity(opacity) {
  protectionConfig.opacity = opacity;
  const pattern = document.getElementById('watermarkPattern');
  if (pattern) {
    pattern.style.opacity = opacity;
  }
}

// ========== AUTO-INITIALIZE ON DOM READY ==========
document.addEventListener('DOMContentLoaded', function() {
  // Check if protection elements exist
  const hasWatermarkElements = document.getElementById('watermarkPattern') || 
                                document.getElementById('cornerWatermark');
  
  if (hasWatermarkElements && !window._protectionInitialized) {
    // Check if user info was embedded in data attributes
    const cornerWatermark = document.getElementById('cornerWatermark');
    if (cornerWatermark) {
      const username = cornerWatermark.getAttribute('data-username');
      const email = cornerWatermark.getAttribute('data-email');
      if (username) {
        initProtection(username, email);
        window._protectionInitialized = true;
      }
    }
  }
});
