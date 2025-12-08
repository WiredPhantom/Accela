const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");

module.exports = (User) => {
  const router = express.Router();

  // Initialize Razorpay
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

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

      const amount = parseInt(process.env.PREMIUM_PRICE) || 4900; // ₹49
      const currency = process.env.PREMIUM_CURRENCY || "INR";

      const options = {
        amount: amount, // amount in smallest currency unit (paise)
        currency: currency,
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
      user.totalPaid += parseInt(process.env.PREMIUM_PRICE) || 5000;
      
      user.paymentHistory.push({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: parseInt(process.env.PREMIUM_PRICE) || 5000,
        currency: process.env.PREMIUM_CURRENCY || "INR",
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
        return res.json({ isPremium: false });
      }

      const isPremium = user.role === "admin" || 
        (user.subscriptionStatus === "premium" && 
         (!user.subscriptionExpiry || user.subscriptionExpiry > new Date()));

      res.json({ 
        isPremium,
        expiryDate: user.subscriptionExpiry,
        role: user.role
      });

    } catch (error) {
      console.error("Premium check error:", error);
      res.status(500).json({ isPremium: false });
    }
  });

  // Refresh token after payment (to update premium status in JWT)
  router.post("/refresh-token", async (req, res) => {
    try {
      const { username } = req.body;
      
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const jwt = require("jsonwebtoken");
      const token = jwt.sign(
        { 
          username: user.username, 
          role: user.role, 
          subscriptionStatus: user.subscriptionStatus 
        },
        process.env.jwtkey,
        { expiresIn: "720h" } // 30 days
      );

      res.json({ 
        success: true, 
        token: token 
      });

    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ success: false });
    }
  });

  return router;
};