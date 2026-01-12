const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// FIX: Accept PREMIUM_PRICE and PREMIUM_CURRENCY as parameters for consistency
module.exports = (User, PREMIUM_PRICE, PREMIUM_CURRENCY) => {
  const router = express.Router();

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  // Helper function for device fingerprint (same as in index.js)
  function generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const acceptLanguage = req.headers['accept-language'] || 'unknown';
    const acceptEncoding = req.headers['accept-encoding'] || 'unknown';
    
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 32);
  }

  function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.ip || 
           req.connection?.remoteAddress || 
           'unknown';
  }

  function getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };
  }

  // Create Razorpay order
  router.post("/create-order", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: "Username required" 
        });
      }

      // Check if user exists
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if already premium
      if (user.subscriptionStatus === "premium" && 
          user.subscriptionExpiry && 
          user.subscriptionExpiry > new Date()) {
        return res.status(400).json({ 
          success: false, 
          message: "Already a premium member" 
        });
      }

      // FIX: Use consistent PREMIUM_PRICE passed from index.js
      const options = {
        amount: PREMIUM_PRICE, // amount in smallest currency unit (paise)
        currency: PREMIUM_CURRENCY,
        receipt: `receipt_${username}_${Date.now()}`,
        notes: {
          username: username,
          userId: user.userId,
          email: user.email
        }
      };

      const order = await razorpay.orders.create(options);

      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      });

    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create order" 
      });
    }
  });

  // Verify payment and upgrade user
  router.post("/verify-payment", async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        username
      } = req.body;

      // Verify signature
      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

      if (razorpay_signature !== expectedSign) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid payment signature" 
        });
      }

      // Payment is valid, upgrade user
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Set premium for 1 month
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      user.subscriptionStatus = "premium";
      user.subscriptionExpiry = expiryDate;
      user.lastPaymentDate = new Date();
      
      // FIX: Use consistent PREMIUM_PRICE
      user.totalPaid += PREMIUM_PRICE;
      
      user.paymentHistory.push({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY,
        status: "success",
        createdAt: new Date()
      });

      await user.save();

      res.json({
        success: true,
        message: "Premium activated successfully!",
        expiryDate: expiryDate,
        needsTokenRefresh: true // Signal to refresh token
      });

    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }
  });

  // Check payment status
  router.get("/check-premium/:username", async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username });
      
      if (!user) {
        return res.json({ isPremium: false, daysLeft: 0 });
      }

      const isPremium = user.role === "admin" || 
        (user.subscriptionStatus === "premium" && 
         (!user.subscriptionExpiry || user.subscriptionExpiry > new Date()));

      let daysLeft = 0;
      if (isPremium && user.subscriptionExpiry) {
        daysLeft = Math.ceil((user.subscriptionExpiry - new Date()) / (1000 * 60 * 60 * 24));
      } else if (isPremium) {
        daysLeft = Infinity; // Lifetime or admin
      }

      res.json({ 
        isPremium,
        daysLeft,
        expiryDate: user.subscriptionExpiry,
        role: user.role
      });

    } catch (error) {
      console.error("Premium check error:", error);
      res.status(500).json({ isPremium: false, daysLeft: 0 });
    }
  });

  // FIX: Refresh token after payment - now also sets sessionToken!
  router.post("/refresh-token", async (req, res) => {
    try {
      const { username } = req.body;
      const deviceFingerprint = generateDeviceFingerprint(req);
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress = getClientIP(req);
      
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // FIX: Create new session token too!
      const sessionToken = user.createSession(deviceFingerprint, userAgent, ipAddress);
      await user.save();

      const token = jwt.sign(
        { 
          username: user.username, 
          role: user.role, 
          subscriptionStatus: user.subscriptionStatus 
        },
        process.env.jwtkey,
        { expiresIn: "720h" } // 30 days
      );

      const cookieOptions = getCookieOptions();

      // FIX: Set both cookies server-side!
      res.cookie("token", token, cookieOptions);
      res.cookie("sessionToken", sessionToken, cookieOptions);

      res.json({ success: true });

    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ success: false });
    }
  });

  return router;
};
