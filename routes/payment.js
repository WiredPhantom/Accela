const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getPlan, getAllPlans, calcPlanExpiry, getValidityMonths } = require("../config/plans");
const {
  generateDeviceFingerprint,
  getClientIP,
  getCookieOptions,
} = require("../utils/device-fingerprint");

module.exports = (User) => {
  const router = express.Router();

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  // Device fingerprint / client-IP / cookie helpers are imported from
  // utils/device-fingerprint.js (shared with index.js so paying users
  // are never locked out by a fingerprint mismatch right after purchase).

  // ============================================
  // PUBLIC: list all available plans
  // ============================================
  router.get("/plans", (req, res) => {
    res.json({
      success: true,
      validityMonths: getValidityMonths(),
      plans: getAllPlans().map(p => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description,
        price: p.price,
        priceRupees: Math.round(p.price / 100),
        currency: p.currency,
        chapterLabel: p.chapterLabel,
      })),
    });
  });

  // ============================================
  // CREATE ORDER FOR A SPECIFIC PLAN
  // ============================================
  router.post("/create-order", async (req, res) => {
    try {
      const { username, planId } = req.body;

      if (!username) {
        return res.status(400).json({ success: false, message: "Username required" });
      }

      const plan = getPlan(planId);
      if (!plan) {
        return res.status(400).json({ success: false, message: "Invalid plan selected" });
      }

      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Block purchase if email isn't verified — prevents typo'd email accounts
      if (user.emailVerified === false) {
        return res.status(403).json({
          success: false,
          message: "Please verify your email before purchasing a plan.",
          requiresVerification: true,
          redirect: `/verify-email?username=${encodeURIComponent(user.username)}`
        });
      }

      // Block if user already has this exact plan active.
      const alreadyActive = (user.plans || []).some(
        p => p.planId === planId && p.expiresAt && p.expiresAt > new Date()
      );
      if (alreadyActive) {
        return res.status(400).json({
          success: false,
          message: `You already have the ${plan.shortName} plan active.`
        });
      }

      const options = {
        amount: plan.price,
        currency: plan.currency,
        receipt: `rcpt_${planId}_${Date.now()}`.slice(0, 40),
        notes: {
          username: username,
          userId: user.userId,
          email: user.email,
          planId: plan.id,
          planName: plan.name,
        }
      };

      const order = await razorpay.orders.create(options);

      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        plan: {
          id: plan.id,
          name: plan.name,
          shortName: plan.shortName,
          description: plan.description,
        },
      });

    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ success: false, message: "Failed to create order" });
    }
  });

  // ============================================
  // VERIFY PAYMENT & ACTIVATE PLAN
  // ============================================
  router.post("/verify-payment", async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        username,
        planId,
      } = req.body;

      const plan = getPlan(planId);
      if (!plan) {
        return res.status(400).json({ success: false, message: "Invalid plan" });
      }

      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

      if (razorpay_signature !== expectedSign) {
        return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }

      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const purchaseDate = new Date();
      const expiryDate = calcPlanExpiry(purchaseDate);

      user.addPlan({
        planId: plan.id,
        expiresAt: expiryDate,
        amount: plan.price,
        currency: plan.currency,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });

      user.lastPaymentDate = new Date();
      user.totalPaid = (user.totalPaid || 0) + plan.price;

      user.paymentHistory.push({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: plan.price,
        currency: plan.currency,
        status: "success",
        createdAt: new Date(),
      });

      // ========== CREATE DEVICE LOCK ON FIRST PAID PLAN ==========
      const deviceFingerprint = generateDeviceFingerprint(req);
      if (!user.hasActiveDeviceLock()) {
        user.createDeviceLock(deviceFingerprint);
        console.log(`🔒 Device lock created for ${username} after ${plan.shortName} purchase`);
      }

      await user.save();

      res.json({
        success: true,
        message: `${plan.name} activated successfully!`,
        planId: plan.id,
        expiryDate,
        needsTokenRefresh: true,
      });

    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ success: false, message: "Payment verification failed" });
    }
  });

  // ============================================
  // CHECK PREMIUM / PLANS FOR A USER
  // ============================================
  router.get("/check-premium/:username", async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username });

      if (!user) {
        return res.json({ isPremium: false, daysLeft: 0, plans: [] });
      }

      const isAdmin = user.role === "admin";
      const isPremium = isAdmin || user.hasAnyActivePlan();
      const daysLeft = isAdmin ? Infinity : user.getMaxDaysLeft();

      const activePlans = user.getActivePlans().map(p => {
        const meta = getPlan(p.planId);
        return {
          planId: p.planId,
          name: meta?.name || p.planId,
          shortName: meta?.shortName || p.planId,
          chapterLabel: meta?.chapterLabel || "",
          expiresAt: p.expiresAt,
        };
      });

      res.json({
        isPremium,
        daysLeft,
        role: user.role,
        plans: activePlans,
      });
    } catch (error) {
      console.error("Premium check error:", error);
      res.status(500).json({ isPremium: false, daysLeft: 0, plans: [] });
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

      if (user.hasAnyActivePlan() && !user.hasActiveDeviceLock() && user.role !== 'admin') {
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
