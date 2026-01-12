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
    
    // ========== SINGLE DEVICE SESSION (30 DAYS) ==========
    currentSession: {
      sessionToken: { type: String, index: true },
      deviceFingerprint: String,
      userAgent: String,
      ipAddress: String,
      loginTime: Date,
      lastActivity: Date,
      expiresAt: { type: Date, index: true }
    },
    
    // Track login attempts for security (FIX: Added default empty array)
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
    
    // Payment tracking (FIX: Added default empty array)
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

  // ========== CREATE NEW SESSION (30 DAYS) ==========
  userSchema.methods.createSession = function(deviceFingerprint, userAgent, ipAddress) {
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days = 1 month
    
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

  // ========== CHECK IF USER HAS ACTIVE SESSION ==========
  userSchema.methods.hasActiveSession = function() {
    if (!this.currentSession || !this.currentSession.sessionToken) {
      return false;
    }
    
    // Check if session has expired
    if (this.currentSession.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  };

  // ========== VALIDATE SESSION TOKEN ==========
  userSchema.methods.validateSession = function(sessionToken, deviceFingerprint) {
    // No session exists
    if (!this.currentSession || !this.currentSession.sessionToken) {
      return { valid: false, reason: 'NO_SESSION' };
    }
    
    // Token doesn't match
    if (this.currentSession.sessionToken !== sessionToken) {
      return { valid: false, reason: 'TOKEN_MISMATCH' };
    }
    
    // Session expired
    if (this.currentSession.expiresAt < new Date()) {
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }
    
    // Device fingerprint mismatch (different device)
    // FIX: More lenient check - only fail if both exist and don't match
    if (deviceFingerprint && 
        this.currentSession.deviceFingerprint && 
        this.currentSession.deviceFingerprint !== deviceFingerprint) {
      return { valid: false, reason: 'DEVICE_MISMATCH' };
    }
    
    return { valid: true };
  };

  // ========== CHECK IF LOGIN ALLOWED ==========
  userSchema.methods.canLoginFromDevice = function(deviceFingerprint) {
    // Admin can login from anywhere
    if (this.role === 'admin') {
      return { allowed: true, reason: 'ADMIN_EXEMPT' };
    }
    
    // No active session - allow login
    if (!this.hasActiveSession()) {
      return { allowed: true, reason: 'NO_ACTIVE_SESSION' };
    }
    
    // Same device - allow (re-login)
    if (this.currentSession.deviceFingerprint === deviceFingerprint) {
      return { allowed: true, reason: 'SAME_DEVICE' };
    }
    
    // Different device with active session - BLOCK
    const remainingTime = this.currentSession.expiresAt - new Date();
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    
    return { 
      allowed: false, 
      reason: 'DEVICE_LOCKED',
      message: `Already logged in on another device. Session expires in ${remainingDays} days. Logout from other device first.`,
      expiresAt: this.currentSession.expiresAt
    };
  };

  // ========== UPDATE SESSION ACTIVITY ==========
  userSchema.methods.updateActivity = function() {
    if (this.currentSession) {
      this.currentSession.lastActivity = new Date();
    }
  };

  // ========== CLEAR SESSION (LOGOUT) ==========
  userSchema.methods.clearSession = function() {
    this.currentSession = undefined;
  };

  // ========== LOG LOGIN ATTEMPT ==========
  userSchema.methods.logLoginAttempt = function(ipAddress, userAgent, success, blockedReason = null) {
    // loginAttempts now has default [], so no need to initialize
    
    // Keep only last 20 attempts
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
    if (!this.currentSession) {
      return null;
    }
    
    return {
      isActive: this.hasActiveSession(),
      loginTime: this.currentSession.loginTime,
      lastActivity: this.currentSession.lastActivity,
      expiresAt: this.currentSession.expiresAt,
      ipAddress: this.currentSession.ipAddress,
      userAgent: this.currentSession.userAgent
    };
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
      return Infinity; // Lifetime premium
    }
    
    const now = new Date();
    if (this.subscriptionExpiry <= now) {
      return 0;
    }
    
    return Math.ceil((this.subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
  };

  return connection.model("User", userSchema);
};
