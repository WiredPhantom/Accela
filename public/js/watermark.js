(function () {
  function createWatermarkDataUrl(text, opts = {}) {
    const font = opts.font || '18px Arial';
    const rotate = opts.rotate || -25;
    const color = opts.color || 'rgba(0,0,0,0.12)';
    const gapX = opts.gapX || 180;
    const gapY = opts.gapY || 140;
    const canvas = document.createElement('canvas');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = (gapX + 200) * ratio;
    canvas.height = (gapY + 100) * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.translate(canvas.width / (2 * ratio), canvas.height / (2 * ratio));
    ctx.rotate((Math.PI / 180) * rotate);
    // Draw the text centered-ish
    ctx.fillText(text, -50, 0);
    return canvas.toDataURL('image/png');
  }

  function applyWatermark() {
    const user = window.__ACCELA_USER || {};
    const username = (user.username || 'Guest').toString();
    const email = (user.email || '').toString();
    const now = new Date().toLocaleString();
    const text = `${username} | ${email} | ${now}`;
    // Create a watermark image with slightly larger text for readability
    const dataUrl = createWatermarkDataUrl(text, { font: '20px Arial', rotate: -22, color: 'rgba(0,0,0,0.10)' });
    const overlays = document.querySelectorAll('#watermarkOverlay');
    overlays.forEach(overlay => {
      overlay.style.backgroundImage = `url(${dataUrl})`;
      overlay.style.backgroundSize = '220px 140px';
    });
  }

  // Apply watermark on load and refresh periodically (so screenshots show changing timestamp)
  window.addEventListener('load', applyWatermark);
  // Refresh watermark every 30 seconds (adjust as needed)
  setInterval(applyWatermark, 30 * 1000);
})();
