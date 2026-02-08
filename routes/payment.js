const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

module.exports = (User, PREMIUM_PRICE, PREMIUM_CURRENCY) => {
  const router = express.Router();

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

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
      maxAge: 30 * 24 * 60 * 60 * 1000
    };
  }

  router.post("/create-order", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: "Username required" 
        });
      }

      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      if (user.subscriptionStatus === "premium" && 
          user.subscriptionExpiry && 
          user.subscriptionExpiry > new Date()) {
        return res.status(400).json({ 
          success: false, 
          message: "Already a premium member" 
        });
      }

      const options = {
        amount: PREMIUM_PRICE,
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

  router.post("/verify-payment", async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        username
      } = req.body;

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

      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      user.subscriptionStatus = "premium";
      user.subscriptionExpiry = expiryDate;
      user.lastPaymentDate = new Date();
      
      user.totalPaid += PREMIUM_PRICE;
      
      user.paymentHistory.push({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY,
        status: "success",
        createdAt: new Date()
      });

      // ========== CREATE DEVICE LOCK ON PAYMENT ==========
      // Lock the device that made the payment
      const deviceFingerprint = generateDeviceFingerprint(req);
      user.createDeviceLock(deviceFingerprint);
      console.log(`🔒 Device lock created for ${username} after payment on device ${deviceFingerprint.substring(0, 8)}...`);

      await user.save();

      res.json({
        success: true,
        message: "Premium activated successfully!",
        expiryDate: expiryDate,
        needsTokenRefresh: true
      });

    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }
  });

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
        daysLeft = Infinity;
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

      const sessionToken = user.createSession(deviceFingerprint, userAgent, ipAddress);
      
      // Device lock should already exist from verify-payment
      // But if not, create it now for premium users
      if (user.subscriptionStatus === 'premium' && !user.hasActiveDeviceLock()) {
        user.createDeviceLock(deviceFingerprint);
      }
      
      await user.save();

      const token = jwt.sign(
        { 
          username: user.username, 
          role: user.role, 
          subscriptionStatus: user.subscriptionStatus 
        },
        process.env.jwtkey,
        { expiresIn: "720h" }
      );

      const cookieOptions = getCookieOptions();

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
