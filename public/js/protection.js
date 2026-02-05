/* ========================================
   ACCELA CONTENT PROTECTION SCRIPTS
   File: public/js/protection.js
   ======================================== */

(function() {
  'use strict';

  // ========== CONFIGURATION ==========
  var protectionConfig = {
    username: 'guest',
    email: '',
    copyright: '© Accela 2026',
    opacity: 0.03,
    showWarnings: true
  };

  // ========== MAIN INITIALIZATION ==========
  window.initProtection = function(username, email, options) {
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
    
    console.log('%c🛡️ Content Protection Active', 'color: #4f46e5; font-weight: bold; font-size: 12px;');
  };

  // ========== WATERMARK GENERATION ==========
  function generateWatermarks() {
    var watermarkText = protectionConfig.username + ' • ' + protectionConfig.email + ' • ' + protectionConfig.copyright;
    
    // Generate pattern watermark
    var pattern = document.getElementById('watermarkPattern');
    if (pattern) {
      pattern.innerHTML = '';
      pattern.style.opacity = protectionConfig.opacity;
      
      // Create grid of watermarks
      var count = window.innerWidth > 768 ? 150 : 80;
      for (var i = 0; i < count; i++) {
        var item = document.createElement('div');
        item.className = 'watermark-item';
        item.textContent = watermarkText;
        pattern.appendChild(item);
      }
    }

    // Generate floating watermark
    var floating = document.getElementById('floatingWatermark');
    if (floating) {
      floating.textContent = protectionConfig.username + ' • ' + protectionConfig.copyright;
    }

    // Generate corner watermark - STATIC, no dynamic positioning
    var corner = document.getElementById('cornerWatermark');
    if (corner) {
      var emailHtml = protectionConfig.email ? '<div class="wm-email">' + escapeHtml(protectionConfig.email) + '</div>' : '';
      corner.innerHTML = '<div class="wm-username">' + escapeHtml(protectionConfig.username) + '</div>' +
        emailHtml +
        '<div class="wm-copyright">' + escapeHtml(protectionConfig.copyright) + '</div>';
    }

    // Generate print watermark
    var printWm = document.getElementById('printWatermark');
    if (printWm) {
      printWm.textContent = watermarkText;
    }
  }

  // ========== HTML ESCAPE HELPER ==========
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== IMPROVED MOBILE SCREENSHOT DETECTION ==========
  function setupMobileScreenshotDetection() {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) return;
    
    // Method 1: Visibility change detection (works on most devices)
    var lastVisibility = document.visibilityState;
    var visibilityCheckInterval = setInterval(function() {
      var currentVisibility = document.visibilityState;
      
      if (lastVisibility === 'visible' && currentVisibility === 'hidden') {
        // Page became hidden - possible screenshot
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(30px)';
        document.body.style.transition = 'none';
        
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
          document.body.style.transition = '';
        }, 800);
        
        console.log('📸 Possible screenshot - User:', protectionConfig.username);
      }
      
      lastVisibility = currentVisibility;
    }, 100);
    
    // Method 2: Page freeze detection (iOS screenshots freeze briefly)
    var lastTime = Date.now();
    var freezeCheckInterval = setInterval(function() {
      var currentTime = Date.now();
      var timeDiff = currentTime - lastTime;
      
      // If there's a gap bigger than 250ms, possible screenshot
      if (timeDiff > 250) {
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(30px)';
        document.body.style.transition = 'none';
        
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
          document.body.style.transition = '';
        }, 600);
        
        console.log('📸 Screenshot freeze detected');
      }
      
      lastTime = currentTime;
    }, 50);
    
    // Method 3: Enhanced visibility monitoring
    var blurActive = false;
    var visibilityMonitor = setInterval(function() {
      if (document.hidden && !blurActive) {
        blurActive = true;
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(40px)';
        document.body.style.transition = 'none';
      } else if (!document.hidden && blurActive) {
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
          document.body.style.transition = '';
          blurActive = false;
        }, 300);
      }
    }, 50);
  }

  // ========== BLUR ON WINDOW FOCUS LOSS ==========
  function setupFocusBlur() {
    window.addEventListener('blur', function() {
      document.body.style.filter = 'blur(30px)';
      document.body.style.transition = 'none';
      document.body.style.opacity = '0';
    });
    
    window.addEventListener('focus', function() {
      setTimeout(function() {
        document.body.style.filter = 'none';
        document.body.style.opacity = '1';
        document.body.style.transition = '';
      }, 200);
    });
  }

  // ========== VISIBILITY CHANGE DETECTION ==========
  function setupVisibilityDetection() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        document.body.style.filter = 'blur(40px)';
        document.body.style.opacity = '0';
        document.body.style.transition = 'none';
        console.log('⚠️ Screenshot attempt detected - User:', protectionConfig.username);
      } else {
        setTimeout(function() {
          document.body.style.filter = 'none';
          document.body.style.opacity = '1';
          document.body.style.transition = '';
        }, 300);
      }
    });
  }

  // ========== ENHANCED SCREENSHOT KEY DETECTION ==========
  function setupEnhancedKeyDetection() {
    document.addEventListener('keydown', function(e) {
      var key = e.key ? e.key.toLowerCase() : '';
      
      // Screenshot shortcuts
      var isScreenshot = (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3','4','5'].includes(key)) ||
        (e.ctrlKey && e.shiftKey && key === 's') ||
        (e.metaKey && e.shiftKey && key === '4')
      );
      
      if (isScreenshot) {
        e.preventDefault();
        
        // Hide content immediately
        document.body.style.opacity = '0';
        document.body.style.filter = 'blur(50px)';
        document.body.style.transition = 'none';
        
        setTimeout(function() {
          document.body.style.opacity = '1';
          document.body.style.filter = 'none';
          document.body.style.transition = '';
        }, 1000);
        
        showProtectionWarning('🚨 Screenshot detected! All screenshots are watermarked.');
        
        console.log('%c🚨 SCREENSHOT ATTEMPT', 'color: red; font-size: 16px; font-weight: bold;');
        console.log('User:', protectionConfig.username);
        console.log('Email:', protectionConfig.email);
        console.log('Time:', new Date().toISOString());
        
        return false;
      }
    });
  }

  // ========== ANTI-THEFT MEASURES ==========
  function setupAntiTheft() {
    
    // 1. Disable right-click context menu
    document.addEventListener('contextmenu', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      showProtectionWarning('Right-click is disabled to protect content.');
      return false;
    });

    // 2. Disable keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      var key = e.key ? e.key.toLowerCase() : '';
      
      if (e.ctrlKey && (key === 'c' || key === 'v' || key === 'x')) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return true;
        }
        e.preventDefault();
        showProtectionWarning('Copy/Paste is disabled to protect content.');
        return false;
      }
      
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        showProtectionWarning('Saving is disabled to protect content.');
        return false;
      }
      
      if (e.ctrlKey && key === 'a') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return true;
        }
        e.preventDefault();
        showProtectionWarning('Select all is disabled to protect content.');
        return false;
      }
      
      if (e.ctrlKey && key === 'p') {
        console.log('Print initiated by:', protectionConfig.username);
      }
      
      if ((e.ctrlKey && e.shiftKey && key === 'i') || e.key === 'F12') {
        e.preventDefault();
        showProtectionWarning('Developer tools are restricted.');
        return false;
      }
      
      if (e.ctrlKey && e.shiftKey && key === 'c') {
        e.preventDefault();
        showProtectionWarning('Inspect element is disabled.');
        return false;
      }
      
      if (e.ctrlKey && e.shiftKey && key === 'j') {
        e.preventDefault();
        return false;
      }
      
      if (e.ctrlKey && key === 'u') {
        e.preventDefault();
        showProtectionWarning('View source is disabled.');
        return false;
      }
    });

    // 3. Disable drag and drop
    document.addEventListener('dragstart', function(e) {
      e.preventDefault();
      return false;
    });

    // 4. Detect DevTools opening
    var devToolsOpen = false;
    var threshold = 160;
    
    setInterval(function() {
      var widthThreshold = window.outerWidth - window.innerWidth > threshold;
      var heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
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

    // 5. Disable text selection
    document.addEventListener('selectstart', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    });

    // 6. Disable copy event
    document.addEventListener('copy', function(e) {
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

    // 8. Log visibility changes
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        console.log('Tab hidden - User:', protectionConfig.username, 'Time:', new Date().toISOString());
      }
    });

    // 9. Disable image context menu and dragging
    var images = document.querySelectorAll('img');
    for (var i = 0; i < images.length; i++) {
      images[i].addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      });
      images[i].setAttribute('draggable', 'false');
    }
  }

  // ========== WARNING TOAST ==========
  function showProtectionWarning(message) {
    if (!protectionConfig.showWarnings) return;
    
    var existing = document.getElementById('protection-warning');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    var toast = document.createElement('div');
    toast.id = 'protection-warning';
    toast.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 500; z-index: 100001; box-shadow: 0 6px 24px rgba(79, 70, 229, 0.35); animation: slideDown 0.3s ease; border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; gap: 8px; max-width: 90vw; text-align: center;';
    
    toast.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>' + message + '</span>';
    
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.animation = 'slideUp 0.3s ease';
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2500);
  }

  // ========== INVISIBLE WATERMARK ==========
  function addInvisibleWatermark() {
    var timestamp = Date.now();
    var data = protectionConfig.username + '-' + protectionConfig.email + '-' + timestamp;
    var uniqueId = btoa(data).substring(0, 24);
    
    var invisible = document.createElement('div');
    invisible.style.cssText = 'position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0.01; color: transparent; font-size: 1px; pointer-events: none; top: 0; left: 0;';
    invisible.textContent = uniqueId;
    invisible.setAttribute('data-uid', uniqueId);
    invisible.setAttribute('data-user', protectionConfig.username);
    document.body.appendChild(invisible);
    
    var comment = document.createComment(' Protected Content - UID: ' + uniqueId + ' - User: ' + protectionConfig.username + ' ');
    document.body.insertBefore(comment, document.body.firstChild);
    
    return uniqueId;
  }

  // ========== UTILITY FUNCTIONS ==========
  window.updateProtectionWatermarks = function(username, email) {
    if (username) protectionConfig.username = username;
    if (email) protectionConfig.email = email;
    generateWatermarks();
  };

  window.toggleWatermarks = function(show) {
    var overlay = document.getElementById('watermarkOverlay');
    var floating = document.getElementById('floatingWatermark');
    var corner = document.getElementById('cornerWatermark');
    
    var display = show ? 'block' : 'none';
    
    if (overlay) overlay.style.display = display;
    if (floating) floating.style.display = display;
    if (corner) corner.style.display = display;
  };

  window.setWatermarkOpacity = function(opacity) {
    protectionConfig.opacity = opacity;
    var pattern = document.getElementById('watermarkPattern');
    if (pattern) {
      pattern.style.opacity = opacity;
    }
  };

})();
