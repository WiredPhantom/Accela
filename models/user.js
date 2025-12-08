const mongoose = require("mongoose");

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
    
    // Session Management - SINGLE DEVICE ONLY
    currentSession: {
      sessionToken: String,
      deviceInfo: String,
      ipAddress: String,
      loginTime: Date,
      lastActivity: Date,
      expiresAt: Date
    },
    
    // Payment tracking
    paymentHistory: [{
      razorpayOrderId: String,
      razorpayPaymentId: String,
      amount: Number,
      currency: String,
      status: String,
      createdAt: { type: Date, default: Date.now }
    }],
    
    lastPaymentDate: { type: Date },
    totalPaid: { type: Number, default: 0 }
  }, { 
    collection: "practicecollection",
    timestamps: true 
  });

  // Set/Update current session (replaces any existing session)
  userSchema.methods.setSession = function(sessionToken, deviceInfo, ipAddress) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 22); // 22 days
    
    this.currentSession = {
      sessionToken,
      deviceInfo,
      ipAddress,
      loginTime: new Date(),
      lastActivity: new Date(),
      expiresAt
    };
  };

  // Clear current session
  userSchema.methods.clearSession = function() {
    this.currentSession = undefined;
  };

  // Check if session is valid
  userSchema.methods.isSessionValid = function(sessionToken) {
    if (!this.currentSession) return false;
    if (this.currentSession.sessionToken !== sessionToken) return false;
    if (this.currentSession.expiresAt < new Date()) return false;
    return true;
  };

  // Update session activity
  userSchema.methods.updateSessionActivity = function() {
    if (this.currentSession) {
      this.currentSession.lastActivity = new Date();
    }
  };

  return connection.model("User", userSchema);
};