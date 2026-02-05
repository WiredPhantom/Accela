/* ========================================
   ACCELA CONTENT PROTECTION SCRIPTS
   STATIC WATERMARK - NO MOVEMENT
   ======================================== */

(function() {
  'use strict';

  var protectionConfig = {
    username: 'guest',
    email: '',
    copyright: '© Accela 2026',
    showWarnings: true
  };

  window.initProtection = function(username, email, options) {
    options = options || {};
    protectionConfig.username = username || 'guest';
    protectionConfig.email = email || '';
    
    if (options.copyright) protectionConfig.copyright = options.copyright;
    if (typeof options.showWarnings !== 'undefined') protectionConfig.showWarnings = options.showWarnings;
    
    generateWatermarks();
    setupAntiTheft();
    addInvisibleWatermark();
    setupFocusBlur();
    setupVisibilityDetection();
    setupEnhancedKeyDetection();
    setupMobileScreenshotDetection();
    
    console.log('%c🛡️ Content Protection Active', 'color: #4f46e5; font-weight: bold;');
  };

  function generateWatermarks() {
    var watermarkText = protectionConfig.username + ' • ' + protectionConfig.email + ' • ' + protectionConfig.copyright;
    
    var pattern = document.getElementById('watermarkPattern');
    if (pattern) {
      pattern.innerHTML = '';
      var count = window.innerWidth > 768 ? 200 : 100;
      for (var i = 0; i < count; i++) {
        var item = document.createElement('div');
        item.className = 'watermark-item';
        item.textContent = watermarkText;
        pattern.appendChild(item);
      }
    }

    var floating = document.getElementById('floatingWatermark');
    if (floating) {
      floating.textContent = protectionConfig.username + ' • ' + protectionConfig.copyright;
    }

    var corner = document.getElementById('cornerWatermark');
    if (corner) {
      var emailHtml = protectionConfig.email ? '<div class="wm-email">' + escapeHtml(protectionConfig.email) + '</div>' : '';
      corner.innerHTML = '<div class="wm-username">' + escapeHtml(protectionConfig.username) + '</div>' + emailHtml + '<div class="wm-copyright">' + escapeHtml(protectionConfig.copyright) + '</div>';
    }

    var printWm = document.getElementById('printWatermark');
    if (printWm) {
      printWm.textContent = watermarkText;
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setupMobileScreenshotDetection() {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    
    var lastVisibility = document.visibilityState;
    setInterval(function() {
      var currentVisibility = document.visibilityState;
      if (lastVisibility === 'visible' && currentVisibility === 'hidden') {
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(30px)';
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
        }, 1000);
      }
      lastVisibility = currentVisibility;
    }, 150);
  }

  function setupFocusBlur() {
    window.addEventListener('blur', function() {
      document.body.style.filter = 'blur(30px)';
      document.body.style.opacity = '0';
    });
    
    window.addEventListener('focus', function() {
      setTimeout(function() {
        document.body.style.filter = 'none';
        document.body.style.opacity = '1';
      }, 200);
    });
  }

  function setupVisibilityDetection() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        document.body.style.filter = 'blur(50px)';
        document.body.style.opacity = '0';
      } else {
        setTimeout(function() {
          document.body.style.filter = 'none';
          document.body.style.opacity = '1';
        }, 300);
      }
    });
  }

  function setupEnhancedKeyDetection() {
    document.addEventListener('keydown', function(e) {
      var key = e.key ? e.key.toLowerCase() : '';
      var isScreenshot = (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3','4','5'].indexOf(key) !== -1) ||
        (e.ctrlKey && e.shiftKey && key === 's') ||
        (e.metaKey && e.shiftKey && key === '4')
      );
      
      if (isScreenshot) {
        e.preventDefault();
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(50px)';
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
        }, 1000);
        showProtectionWarning('Screenshots are watermarked.');
        return false;
      }
    });
  }

  function setupAntiTheft() {
    document.addEventListener('contextmenu', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
      e.preventDefault();
      showProtectionWarning('Right-click is disabled.');
      return false;
    });

    document.addEventListener('keydown', function(e) {
      var key = e.key ? e.key.toLowerCase() : '';
      
      if (e.ctrlKey && (key === 'c' || key === 'v' || key === 'x')) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
        e.preventDefault();
        showProtectionWarning('Copy/Paste is disabled.');
        return false;
      }
      
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        showProtectionWarning('Saving is disabled.');
        return false;
      }
      
      if (e.ctrlKey && key === 'a') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
        e.preventDefault();
        showProtectionWarning('Select all is disabled.');
        return false;
      }
      
      if ((e.ctrlKey && e.shiftKey && key === 'i') || e.key === 'F12') {
        e.preventDefault();
        showProtectionWarning('Developer tools are restricted.');
        return false;
      }
      
      if (e.ctrlKey && e.shiftKey && (key === 'c' || key === 'j')) {
        e.preventDefault();
        return false;
      }
      
      if (e.ctrlKey && key === 'u') {
        e.preventDefault();
        showProtectionWarning('View source is disabled.');
        return false;
      }
    });

    document.addEventListener('dragstart', function(e) {
      e.preventDefault();
      return false;
    });

    document.addEventListener('selectstart', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
      e.preventDefault();
      return false;
    });

    document.addEventListener('copy', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
      e.preventDefault();
      showProtectionWarning('Copying is disabled.');
      return false;
    });

    document.addEventListener('cut', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
      e.preventDefault();
      return false;
    });
  }

  function showProtectionWarning(message) {
    if (!protectionConfig.showWarnings) return;
    
    var existing = document.getElementById('protection-warning');
    if (existing) existing.parentNode.removeChild(existing);

    var toast = document.createElement('div');
    toast.id = 'protection-warning';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(15,14,50,0.95);color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;font-family:Inter,sans-serif;font-weight:500;z-index:100001;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;border:1px solid rgba(79,70,229,0.3);display:flex;align-items:center;gap:10px;';
    toast.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>' + message + '</span>';
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.animation = 'slideUp 0.3s ease';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  function addInvisibleWatermark() {
    var data = protectionConfig.username + '-' + protectionConfig.email + '-' + Date.now();
    var uniqueId = btoa(data).substring(0, 24);
    
    var invisible = document.createElement('div');
    invisible.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0.01;color:transparent;font-size:1px;pointer-events:none;top:0;left:0;';
    invisible.textContent = uniqueId;
    invisible.setAttribute('data-uid', uniqueId);
    invisible.setAttribute('data-user', protectionConfig.username);
    document.body.appendChild(invisible);
  }

  window.updateProtectionWatermarks = function(username, email) {
    if (username) protectionConfig.username = username;
    if (email) protectionConfig.email = email;
    generateWatermarks();
  };

  window.toggleWatermarks = function(show) {
    var display = show ? 'block' : 'none';
    var overlay = document.getElementById('watermarkOverlay');
    var floating = document.getElementById('floatingWatermark');
    var corner = document.getElementById('cornerWatermark');
    if (overlay) overlay.style.display = display;
    if (floating) floating.style.display = display;
    if (corner) corner.style.display = display;
  };

})();
