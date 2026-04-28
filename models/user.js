const mongoose = require("mongoose");
const crypto = require("crypto");
const { planCoversChapter, getPlan } = require("../config/plans");

module.exports = (connection) => {
  const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    subscriptionStatus: { 
      type: String, 
      enum: ["free", "premium"], 
      default: "free" 
    },
    subscriptionExpiry: { type: Date },

    // ========== ACTIVE PLANS (multi-plan support) ==========
    // Each plan has its own validity (typically until exam date).
    // A user can hold multiple plans simultaneously (e.g. term1 + term2).
    plans: {
      type: [{
        planId: { type: String, required: true },     // 'complete' | 'term1' | 'term2' | 'term3'
        purchasedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        amount: Number,
        currency: String,
        razorpayOrderId: String,
        razorpayPaymentId: String,
      }],
      default: []
    },

    // ========== SESSION (for auth/cookie validation) ==========
    currentSession: {
      sessionToken: { type: String, index: true },
      deviceFingerprint: String,
      userAgent: String,
      ipAddress: String,
      loginTime: Date,
      lastActivity: Date,
      expiresAt: { type: Date, index: true }
    },

    // ========== DEVICE LOCK (INDEPENDENT of session, persists after logout) ==========
    deviceLock: {
      deviceFingerprint: String,
      lockedAt: Date,
      expiresAt: { type: Date, index: true },
      reason: { type: String, default: 'premium_subscription' }
    },
    
    // Track login attempts for security
    loginAttempts: {
      type: [{
        timestamp: Date,
        ipAddress: String,
        userAgent: String,
        success: Boolean,
        blockedReason: String
      }],
      default: []
    },
    
    // Payment tracking
    paymentHistory: {
      type: [{
        razorpayOrderId: String,
        razorpayPaymentId: String,
        amount: Number,
        currency: String,
        status: String,
        createdAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    
    lastPaymentDate: { type: Date },
    totalPaid: { type: Number, default: 0 },

    // ========== PASSWORD RESET ==========
    // Stores SHA-256 hash of the reset token (never the raw token)
    passwordReset: {
      tokenHash: { type: String, index: true },
      expiresAt: { type: Date, index: true },
      requestedAt: { type: Date },
      requestIp: { type: String }
    },

    // ========== EMAIL VERIFICATION ==========
    // Default `true` so existing users (created before this feature) keep working.
    // The /signup route explicitly sets this to `false` for new accounts.
    emailVerified: { type: Boolean, default: true },
    emailVerification: {
      code: { type: String },
      expiresAt: { type: Date },
      sentAt: { type: Date },
      attempts: { type: Number, default: 0 }
    }
  }, { 
    collection: "practicecollection",
    timestamps: true 
  });

  // ========== GENERATE UNIQUE SESSION TOKEN ==========
  userSchema.methods.generateSessionToken = function() {
    return crypto.randomBytes(32).toString('hex');
  };

  // ========== CREATE NEW SESSION (for auth) ==========
  userSchema.methods.createSession = function(deviceFingerprint, userAgent, ipAddress) {
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    this.currentSession = {
      sessionToken,
      deviceFingerprint,
      userAgent,
      ipAddress,
      loginTime: new Date(),
      lastActivity: new Date(),
      expiresAt
    };
    
    return sessionToken;
  };

  // ========== CREATE/UPDATE DEVICE LOCK (only for premium users) ==========
  userSchema.methods.createDeviceLock = function(deviceFingerprint) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Lock for 30 days
    
    this.deviceLock = {
      deviceFingerprint,
      lockedAt: new Date(),
      expiresAt,
      reason: 'premium_subscription'
    };
  };

  // ========== CHECK IF DEVICE LOCK IS ACTIVE ==========
  userSchema.methods.hasActiveDeviceLock = function() {
    if (!this.deviceLock || !this.deviceLock.deviceFingerprint) {
      return false;
    }
    
    // Check if lock has expired
    if (this.deviceLock.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  };

  // ========== CLEAR DEVICE LOCK (admin only) ==========
  userSchema.methods.clearDeviceLock = function() {
    this.deviceLock = undefined;
  };

  // ========== CHECK IF USER HAS ACTIVE SESSION ==========
  userSchema.methods.hasActiveSession = function() {
    if (!this.currentSession || !this.currentSession.sessionToken) {
      return false;
    }
    
    if (this.currentSession.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  };

  // ========== VALIDATE SESSION TOKEN ==========
  userSchema.methods.validateSession = function(sessionToken, deviceFingerprint) {
    if (!this.currentSession || !this.currentSession.sessionToken) {
      return { valid: false, reason: 'NO_SESSION' };
    }
    
    if (this.currentSession.sessionToken !== sessionToken) {
      return { valid: false, reason: 'TOKEN_MISMATCH' };
    }
    
    if (this.currentSession.expiresAt < new Date()) {
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }
    
    if (deviceFingerprint && 
        this.currentSession.deviceFingerprint && 
        this.currentSession.deviceFingerprint !== deviceFingerprint) {
      return { valid: false, reason: 'DEVICE_MISMATCH' };
    }
    
    return { valid: true };
  };

  // ========== CHECK IF LOGIN ALLOWED (DEVICE LOCK LOGIC) ==========
  userSchema.methods.canLoginFromDevice = function(deviceFingerprint) {
    // Admin can login from anywhere - no restrictions
    if (this.role === 'admin') {
      return { allowed: true, reason: 'ADMIN_EXEMPT' };
    }
    
    // Free users have NO device lock restrictions
    if (this.subscriptionStatus !== 'premium') {
      return { allowed: true, reason: 'FREE_USER_NO_LOCK' };
    }

    // --- Premium user logic below ---

    // Check if there's an active device lock
    if (this.hasActiveDeviceLock()) {
      // Same device as locked device - ALLOW (even after logout)
      if (this.deviceLock.deviceFingerprint === deviceFingerprint) {
        return { allowed: true, reason: 'SAME_LOCKED_DEVICE' };
      }
      
      // Different device with active lock - BLOCK
      const remainingTime = this.deviceLock.expiresAt - new Date();
      const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
      
      return { 
        allowed: false, 
        reason: 'DEVICE_LOCKED',
        message: `This account is locked to another device for ${remainingDays} more days. Contact admin if you need to change devices.`,
        expiresAt: this.deviceLock.expiresAt,
        remainingDays
      };
    }
    
    // No active device lock (expired or never set) - allow and create new lock
    return { allowed: true, reason: 'NO_ACTIVE_LOCK' };
  };

  // ========== UPDATE SESSION ACTIVITY ==========
  userSchema.methods.updateActivity = function() {
    if (this.currentSession) {
      this.currentSession.lastActivity = new Date();
    }
  };

  // ========== CLEAR SESSION (LOGOUT) - does NOT clear device lock ==========
  userSchema.methods.clearSession = function() {
    this.currentSession = undefined;
    // NOTE: deviceLock is NOT cleared here! It persists after logout.
  };

  // ========== LOG LOGIN ATTEMPT ==========
  userSchema.methods.logLoginAttempt = function(ipAddress, userAgent, success, blockedReason = null) {
    if (this.loginAttempts.length >= 20) {
      this.loginAttempts.shift();
    }
    
    this.loginAttempts.push({
      timestamp: new Date(),
      ipAddress,
      userAgent,
      success,
      blockedReason
    });
  };

  // ========== GET SESSION INFO (FOR ADMIN) ==========
  userSchema.methods.getSessionInfo = function() {
    const info = {
      session: null,
      deviceLock: null
    };

    if (this.currentSession) {
      info.session = {
        isActive: this.hasActiveSession(),
        loginTime: this.currentSession.loginTime,
        lastActivity: this.currentSession.lastActivity,
        expiresAt: this.currentSession.expiresAt,
        ipAddress: this.currentSession.ipAddress,
        userAgent: this.currentSession.userAgent
      };
    }

    if (this.deviceLock) {
      info.deviceLock = {
        isActive: this.hasActiveDeviceLock(),
        deviceFingerprint: this.deviceLock.deviceFingerprint,
        lockedAt: this.deviceLock.lockedAt,
        expiresAt: this.deviceLock.expiresAt,
        reason: this.deviceLock.reason
      };
    }
    
    return info;
  };

  // ========== ACTIVE PLANS HELPERS ==========
  userSchema.methods.getActivePlans = function() {
    const now = new Date();
    const list = (this.plans || []).filter(p => p.expiresAt && p.expiresAt > now);

    // Backward compatibility: legacy "premium" status without explicit plans
    // is treated as a "complete" plan valid until subscriptionExpiry.
    if (list.length === 0 &&
        this.subscriptionStatus === "premium" &&
        this.subscriptionExpiry &&
        this.subscriptionExpiry > now) {
      list.push({
        planId: "complete",
        purchasedAt: this.lastPaymentDate || this.createdAt || now,
        expiresAt: this.subscriptionExpiry,
        legacy: true,
      });
    }
    return list;
  };

  userSchema.methods.canAccessChapter = function(chapterIndex) {
    if (this.role === "admin") return true;
    const active = this.getActivePlans();
    return active.some(p => planCoversChapter(p.planId, chapterIndex));
  };

  userSchema.methods.hasAnyActivePlan = function() {
    if (this.role === "admin") return true;
    return this.getActivePlans().length > 0;
  };

  userSchema.methods.getMaxDaysLeft = function() {
    if (this.role === "admin") return Infinity;
    const active = this.getActivePlans();
    if (active.length === 0) return 0;
    const now = new Date();
    let maxMs = 0;
    for (const p of active) {
      const ms = p.expiresAt - now;
      if (ms > maxMs) maxMs = ms;
    }
    return Math.ceil(maxMs / (1000 * 60 * 60 * 24));
  };

  userSchema.methods.addPlan = function({ planId, expiresAt, amount, currency, razorpayOrderId, razorpayPaymentId }) {
    if (!getPlan(planId)) {
      throw new Error(`Unknown plan: ${planId}`);
    }
    // If user already has this plan active, extend its expiry to the later date.
    const existing = (this.plans || []).find(p => p.planId === planId && p.expiresAt > new Date());
    if (existing) {
      if (expiresAt > existing.expiresAt) existing.expiresAt = expiresAt;
      existing.razorpayOrderId = razorpayOrderId || existing.razorpayOrderId;
      existing.razorpayPaymentId = razorpayPaymentId || existing.razorpayPaymentId;
    } else {
      this.plans.push({
        planId,
        purchasedAt: new Date(),
        expiresAt,
        amount,
        currency,
        razorpayOrderId,
        razorpayPaymentId,
      });
    }
    // Keep legacy fields in sync so older admin views still show "Premium".
    this.subscriptionStatus = "premium";
    const latest = this.getActivePlans()
      .reduce((max, p) => (!max || p.expiresAt > max ? p.expiresAt : max), null);
    if (latest) this.subscriptionExpiry = latest;
  };

  userSchema.methods.removePlan = function(planId) {
    // Special token used by admin to clear legacy "premium" status without a plan entry
    if (planId === "__legacy__") {
      this.subscriptionStatus = "free";
      this.subscriptionExpiry = null;
      return true;
    }
    const before = (this.plans || []).length;
    this.plans = (this.plans || []).filter(p => p.planId !== planId);
    // Recompute legacy mirror fields
    const remaining = this.getActivePlans().filter(p => !p.legacy);
    if (remaining.length === 0) {
      this.subscriptionStatus = "free";
      this.subscriptionExpiry = null;
    } else {
      const latest = remaining.reduce(
        (max, p) => (!max || p.expiresAt > max ? p.expiresAt : max),
        null
      );
      this.subscriptionExpiry = latest;
    }
    return before !== this.plans.length;
  };

  // ========== PASSWORD RESET TOKEN HELPERS ==========
  // Generates a fresh reset token. Returns the RAW token (used in URL).
  // The DB stores only the SHA-256 hash so a DB leak can't hijack resets.
  userSchema.methods.generatePasswordResetToken = function(requestIp) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    this.passwordReset = {
      tokenHash,
      expiresAt,
      requestedAt: new Date(),
      requestIp: requestIp || null
    };

    return rawToken;
  };

  // Returns true if rawToken matches and is not expired
  userSchema.methods.isPasswordResetTokenValid = function(rawToken) {
    if (!this.passwordReset || !this.passwordReset.tokenHash) return false;
    if (!this.passwordReset.expiresAt || this.passwordReset.expiresAt < new Date()) return false;
    const hash = crypto.createHash('sha256').update(rawToken || '').digest('hex');
    return hash === this.passwordReset.tokenHash;
  };

  userSchema.methods.clearPasswordResetToken = function() {
    this.passwordReset = undefined;
  };

  userSchema.methods.hasPendingPasswordReset = function() {
    return !!(this.passwordReset && this.passwordReset.tokenHash &&
              this.passwordReset.expiresAt && this.passwordReset.expiresAt > new Date());
  };

  // ========== EMAIL VERIFICATION HELPERS ==========
  userSchema.methods.generateEmailVerificationCode = function() {
    // 6-digit zero-padded random code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.emailVerification = {
      code,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      sentAt: new Date(),
      attempts: 0
    };
    return code;
  };

  userSchema.methods.verifyEmailCode = function(submittedCode) {
    if (this.emailVerified) return { ok: true, alreadyVerified: true };
    if (!this.emailVerification || !this.emailVerification.code) {
      return { ok: false, reason: "NO_CODE" };
    }
    if (this.emailVerification.expiresAt < new Date()) {
      return { ok: false, reason: "EXPIRED" };
    }
    if ((this.emailVerification.attempts || 0) >= 5) {
      return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
    }
    this.emailVerification.attempts = (this.emailVerification.attempts || 0) + 1;
    if (String(submittedCode).trim() !== String(this.emailVerification.code)) {
      return { ok: false, reason: "WRONG_CODE", attemptsLeft: 5 - this.emailVerification.attempts };
    }
    this.emailVerified = true;
    this.emailVerification = undefined;
    return { ok: true };
  };

  // ========== GET DAYS UNTIL PREMIUM EXPIRY ==========
  userSchema.methods.getDaysUntilExpiry = function() {
    if (this.role === 'admin') {
      return Infinity;
    }
    
    if (this.subscriptionStatus !== 'premium') {
      return 0;
    }
    
    if (!this.subscriptionExpiry) {
      return Infinity;
    }
    
    const now = new Date();
    if (this.subscriptionExpiry <= now) {
      return 0;
    }
    
    return Math.ceil((this.subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
  };

  return connection.model("User", userSchema);
};
