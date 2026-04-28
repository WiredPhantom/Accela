// ============================================
// SHARED DEVICE FINGERPRINT + REQUEST HELPERS
//
// Single source of truth used by both index.js and routes/payment.js.
// If this logic ever changes, both call sites stay in sync — preventing
// the "paying user gets locked out right after purchase" bug.
//
// Fingerprint uses ONLY stable components (device model, OS family,
// browser family, platform, language base) so it survives:
//   - Chrome/browser version updates
//   - WiFi vs mobile data switches
//   - Desktop-mode toggle
//   - Minor OS updates
// ============================================

const crypto = require('crypto');

function generateDeviceFingerprint(req) {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'] || 'unknown';

  const components = extractStableComponents(userAgent, acceptLanguage);

  const fingerprintData = [
    components.deviceModel,
    components.osFamily,
    components.browserFamily,
    components.platform,
    components.languageBase,
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 32);
}

function extractStableComponents(userAgent, acceptLanguage) {
  const ua = userAgent.toLowerCase();

  // 1. DEVICE MODEL (most stable - physical hardware identifier)
  let deviceModel = 'unknown';
  const androidModelMatch = userAgent.match(/Android[^;]*;\s*([^)]+?)\s*(?:Build|\))/i);
  if (androidModelMatch) {
    deviceModel = androidModelMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
  } else if (ua.includes('iphone')) deviceModel = 'iphone';
  else if (ua.includes('ipad')) deviceModel = 'ipad';
  else if (ua.includes('mobile')) deviceModel = 'mobile_generic';
  else if (ua.includes('windows')) deviceModel = 'windows_pc';
  else if (ua.includes('macintosh') || ua.includes('mac os')) deviceModel = 'mac';
  else if (ua.includes('linux') && !ua.includes('android')) deviceModel = 'linux_pc';

  // 2. OS FAMILY (ignore version numbers completely)
  let osFamily = 'unknown';
  if (ua.includes('android')) osFamily = 'android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) osFamily = 'ios';
  else if (ua.includes('windows')) osFamily = 'windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) osFamily = 'macos';
  else if (ua.includes('linux')) osFamily = 'linux';
  else if (ua.includes('cros')) osFamily = 'chromeos';

  // 3. BROWSER FAMILY (NO version numbers - just the browser name)
  let browserFamily = 'unknown';
  if (ua.includes('edg/') || ua.includes('edge/')) browserFamily = 'edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browserFamily = 'opera';
  else if (ua.includes('firefox') || ua.includes('fxios')) browserFamily = 'firefox';
  else if (ua.includes('samsungbrowser')) browserFamily = 'samsung';
  else if (ua.includes('ucbrowser')) browserFamily = 'ucbrowser';
  else if (ua.includes('chrome') || ua.includes('crios')) browserFamily = 'chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browserFamily = 'safari';

  // 4. PLATFORM TYPE (mobile vs desktop vs tablet)
  let platform = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    platform = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    platform = 'tablet';
  }

  // 5. LANGUAGE (just the base language code, e.g., "en" from "en-US,en;q=0.9")
  let languageBase = 'unknown';
  if (acceptLanguage) {
    const langMatch = acceptLanguage.match(/^([a-z]{2})/i);
    if (langMatch) languageBase = langMatch[1].toLowerCase();
  }

  return { deviceModel, osFamily, browserFamily, platform, languageBase };
}

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

module.exports = {
  generateDeviceFingerprint,
  extractStableComponents,
  getClientIP,
  getCookieOptions,
};
