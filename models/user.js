const mongoose = require("mongoose");
const crypto = require("crypto");

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
    totalPaid: { type: Number, default: 0 }
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
