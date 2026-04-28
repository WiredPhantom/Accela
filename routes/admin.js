const { getAllPlans, getPlan, calcPlanExpiry, getValidityMonths } = require("../config/plans");
const { sanitizeNoteHtml } = require("../utils/sanitize");

module.exports = (User, Flashcard, Note) => {
  const router = require('express').Router();
  const bcrypt = require("bcryptjs");
  const multer = require('multer');
  
  const storage = multer.memoryStorage();
  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'jsonFile' && file.mimetype === 'application/json') {
        cb(null, true);
      } else if (file.fieldname === 'htmlFile' && file.mimetype === 'text/html') {
        cb(null, true);
      } else if (file.mimetype === 'text/plain') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Please upload JSON for flashcards or HTML for notes.'));
      }
    }
  });

  function findNextAvailableIndex(existingIndices) {
    if (existingIndices.length === 0) return 1;
    const sorted = [...existingIndices].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) return i + 1;
    }
    return sorted[sorted.length - 1] + 1;
  }

  // ==================== MAIN ADMIN PAGE ====================
  router.get('/', async (req, res) => {
    try {
      const chapters = await Flashcard.aggregate([
        {
          $group: {
            _id: "$chapterIndex",
            chapterName: { $first: "$chapterName" },
            isPremium: { $first: "$isPremium" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const topics = await Flashcard.aggregate([
        {
          $group: {
            _id: {
              chapterIndex: "$chapterIndex",
              topicIndex: "$topicIndex"
            },
            chapterName: { $first: "$chapterName" },
            topicName: { $first: "$topicName" },
            isPremium: { $first: "$isPremium" }
          }
        },
        { $sort: { "_id.chapterIndex": 1, "_id.topicIndex": 1 } }
      ]);
      
      const rawUsers = await User.find({}, { password: 0 });

      // Enrich each user with their active-plans list (uses model methods so legacy users still appear)
      const users = rawUsers.map(u => {
        const obj = u.toObject({ virtuals: false });
        const active = u.getActivePlans();
        obj.activePlans = active.map(p => {
          const def = getPlan(p.planId);
          return {
            planId: p.planId,
            planName: def ? def.name : p.planId,
            shortName: def ? def.shortName : p.planId,
            chapterLabel: def ? def.chapterLabel : "",
            purchasedAt: p.purchasedAt,
            expiresAt: p.expiresAt,
            amount: p.amount || 0,
            legacy: p.legacy || false,
          };
        });
        return obj;
      });

      // Build flat purchase ledger (newest first) and total revenue
      const recentPurchases = [];
      let totalRevenuePaise = 0;
      rawUsers.forEach(u => {
        (u.plans || []).forEach(p => {
          const def = getPlan(p.planId);
          recentPurchases.push({
            username: u.username,
            userId: u.userId,
            planId: p.planId,
            planName: def ? def.name : p.planId,
            amount: p.amount || 0,
            currency: p.currency || "INR",
            purchasedAt: p.purchasedAt,
            expiresAt: p.expiresAt,
            razorpayOrderId: p.razorpayOrderId,
            razorpayPaymentId: p.razorpayPaymentId,
            isAdminGrant: p.razorpayPaymentId && String(p.razorpayPaymentId).startsWith("admin_grant"),
          });
          totalRevenuePaise += p.amount || 0;
        });
      });
      recentPurchases.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

      // Revenue from real (non-admin-grant) purchases only
      const realRevenuePaise = recentPurchases
        .filter(p => !p.isAdminGrant)
        .reduce((s, p) => s + (p.amount || 0), 0);

      const allPlans = getAllPlans();

      // Pending password reset requests (active + not expired)
      const buildResetUrl = (req, token) => {
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.get('host');
        return `${proto}://${host}/reset-password?token=${token}`;
      };
      // Note: we cannot reconstruct the raw token from the hash. The admin
      // panel surfaces the request so admin knows to ASK the user to use the
      // link from their email — or, if email isn't set up, the admin can
      // generate a NEW token and copy the link via "Generate New Link".
      const pendingResets = rawUsers
        .filter(u => u.hasPendingPasswordReset && u.hasPendingPasswordReset())
        .map(u => ({
          userId: u.userId,
          username: u.username,
          email: u.email,
          requestedAt: u.passwordReset.requestedAt,
          expiresAt: u.passwordReset.expiresAt,
          requestIp: u.passwordReset.requestIp || ""
        }))
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

      // Users who signed up but haven't verified their email yet
      const unverifiedUsers = rawUsers
        .filter(u => u.emailVerified === false)
        .map(u => ({
          userId: u.userId,
          username: u.username,
          email: u.email,
          createdAt: u.createdAt || u._id.getTimestamp(),
          codeOnFile: !!(u.emailVerification && u.emailVerification.code),
          code: (u.emailVerification && u.emailVerification.code) || null,
          codeExpiresAt: (u.emailVerification && u.emailVerification.expiresAt) || null,
          attempts: (u.emailVerification && u.emailVerification.attempts) || 0
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const noteChapters = await Note.aggregate([
        {
          $group: {
            _id: "$chapterIndex",
            chapterName: { $first: "$chapterName" },
            isPremium: { $first: "$isPremium" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const noteTopics = await Note.aggregate([
        {
          $group: {
            _id: {
              chapterIndex: "$chapterIndex",
              topicIndex: "$topicIndex"
            },
            chapterName: { $first: "$chapterName" },
            topicName: { $first: "$topicName" },
            isPremium: { $first: "$isPremium" }
          }
        },
        { $sort: { "_id.chapterIndex": 1, "_id.topicIndex": 1 } }
      ]);

      res.render("admin", {
        chapters,
        topics,
        users,
        noteChapters,
        noteTopics,
        allPlans,
        recentPurchases: recentPurchases.slice(0, 25),
        totalRevenue: Math.round(realRevenuePaise / 100),
        totalPurchaseCount: recentPurchases.filter(p => !p.isAdminGrant).length,
        validityMonths: getValidityMonths(),
        pendingResets,
        unverifiedUsers,
      });

    } catch (err) {
      console.error("❌ Aggregate error:", err);
      res.render("admin", {
        chapters: [],
        topics: [],
        users: [],
        noteChapters: [],
        noteTopics: [],
        allPlans: getAllPlans(),
        recentPurchases: [],
        unverifiedUsers: [],
        totalRevenue: 0,
        totalPurchaseCount: 0,
        validityMonths: getValidityMonths(),
        pendingResets: [],
      });
    }
  });

  // ==================== SESSION MANAGEMENT ====================
  
  // Force logout a user (clear their session only, NOT device lock)
  router.post("/force-logout", async (req, res) => {
    const { userId } = req.body;
    
    try {
      const user = await User.findOne({ userId });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: "User not found" 
        });
      }
      
      user.clearSession();
      await user.save();
      
      console.log(`✅ Admin forced logout for user: ${user.username} (device lock preserved)`);
      
      res.json({ 
        success: true, 
        message: `Session cleared for ${user.username} (device lock still active)` 
      });
    } catch (err) {
      console.error("❌ Force logout error:", err);
      res.status(500).json({ 
        success: false, 
        error: "Failed to force logout" 
      });
    }
  });

  // ==================== NEW: CLEAR DEVICE LOCK (Admin only) ====================
  router.post("/clear-device-lock", async (req, res) => {
    const { userId } = req.body;
    
    try {
      const user = await User.findOne({ userId });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: "User not found" 
        });
      }
      
      const hadLock = user.hasActiveDeviceLock();
      const oldFingerprint = user.deviceLock?.deviceFingerprint?.substring(0, 8) || 'none';
      
      user.clearDeviceLock();
      await user.save();
      
      console.log(`🔓 Admin cleared device lock for user: ${user.username} (was locked: ${hadLock}, old device: ${oldFingerprint}...)`);
      
      res.json({ 
        success: true, 
        message: `Device lock cleared for ${user.username}. They can now login from any device.`,
        hadActiveLock: hadLock
      });
    } catch (err) {
      console.error("❌ Clear device lock error:", err);
      res.status(500).json({ 
        success: false, 
        error: "Failed to clear device lock" 
      });
    }
  });

  // ==================== NEW: Clear device lock by username (convenience route) ====================
  router.post("/clear-device-lock/:username", async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: "User not found" 
        });
      }
      
      const hadLock = user.hasActiveDeviceLock();
      
      user.clearDeviceLock();
      await user.save();
      
      console.log(`🔓 Admin cleared device lock for: ${user.username}`);
      
      res.json({ 
        success: true, 
        message: `Device lock cleared for ${user.username}`,
        hadActiveLock: hadLock
      });
    } catch (err) {
      console.error("❌ Clear device lock error:", err);
      res.status(500).json({ 
        success: false, 
        error: "Failed to clear device lock" 
      });
    }
  });

  // Get user session AND device lock info
  router.get("/user-session/:userId", async (req, res) => {
    try {
      const user = await User.findOne({ userId: req.params.userId });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const sessionInfo = user.getSessionInfo();
      
      res.json({
        username: user.username,
        subscriptionStatus: user.subscriptionStatus,
        hasActiveSession: user.hasActiveSession(),
        hasActiveDeviceLock: user.hasActiveDeviceLock(),
        session: sessionInfo.session,
        deviceLock: sessionInfo.deviceLock,
        loginAttempts: user.loginAttempts?.slice(-5) || []
      });
    } catch (err) {
      console.error("❌ Session info error:", err);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });

  // View all active sessions AND device locks
  router.get("/active-sessions", async (req, res) => {
    try {
      const usersWithSessions = await User.find({
        'currentSession.sessionToken': { $exists: true },
        'currentSession.expiresAt': { $gt: new Date() }
      }).select('username userId currentSession deviceLock role subscriptionStatus');
      
      const sessions = usersWithSessions.map(u => ({
        userId: u.userId,
        username: u.username,
        role: u.role,
        subscriptionStatus: u.subscriptionStatus,
        loginTime: u.currentSession.loginTime,
        lastActivity: u.currentSession.lastActivity,
        sessionExpiresAt: u.currentSession.expiresAt,
        ipAddress: u.currentSession.ipAddress,
        hasDeviceLock: u.hasActiveDeviceLock(),
        deviceLockExpiresAt: u.deviceLock?.expiresAt || null
      }));
      
      res.json({ 
        count: sessions.length, 
        sessions 
      });
    } catch (err) {
      console.error("❌ Active sessions error:", err);
      res.status(500).json({ error: "Failed to get active sessions" });
    }
  });

  // ==================== NEW: View all device locks ====================
  router.get("/device-locks", async (req, res) => {
    try {
      const usersWithLocks = await User.find({
        'deviceLock.deviceFingerprint': { $exists: true },
        'deviceLock.expiresAt': { $gt: new Date() }
      }).select('username userId deviceLock subscriptionStatus');
      
      const locks = usersWithLocks.map(u => ({
        userId: u.userId,
        username: u.username,
        subscriptionStatus: u.subscriptionStatus,
        deviceFingerprint: u.deviceLock.deviceFingerprint?.substring(0, 8) + '...',
        lockedAt: u.deviceLock.lockedAt,
        expiresAt: u.deviceLock.expiresAt,
        remainingDays: Math.ceil((u.deviceLock.expiresAt - new Date()) / (1000 * 60 * 60 * 24))
      }));
      
      res.json({ 
        count: locks.length, 
        locks 
      });
    } catch (err) {
      console.error("❌ Device locks error:", err);
      res.status(500).json({ error: "Failed to get device locks" });
    }
  });

  // ==================== DATA RETRIEVAL ROUTES ====================
  
  router.get('/users', async (req, res) => {
    const users = await User.find();
    res.json(users);
  });

  router.get('/flashcards', async (req, res) =>{
    const flashcards = await Flashcard.find();
    res.json(flashcards);
  });

  router.get('/flashcards/:chapterIndex/:topicIndex', async (req, res) => {
    try {
      const { chapterIndex, topicIndex } = req.params;
      const flashcards = await Flashcard.find({
        chapterIndex: parseInt(chapterIndex),
        topicIndex: parseInt(topicIndex)
      }).sort({ flashcardIndex: 1 });
      res.json(flashcards);
    } catch (err) {
      console.error("❌ Error fetching flashcards:", err);
      res.status(500).json({ error: "Failed to fetch flashcards" });
    }
  });

  router.get('/notes', async (req, res) => {
    try {
      const notes = await Note.find().sort({ chapterIndex: 1, topicIndex: 1 });
      res.json(notes);
    } catch (err) {
      console.error("❌ Error fetching notes:", err);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  router.get('/notes/:chapterIndex/:topicIndex', async (req, res) => {
    try {
      const { chapterIndex, topicIndex } = req.params;
      const note = await Note.findOne({
        chapterIndex: parseInt(chapterIndex),
        topicIndex: parseInt(topicIndex)
      });
      res.json(note);
    } catch (err) {
      console.error("❌ Error fetching note:", err);
      res.status(500).json({ error: "Failed to fetch note" });
    }
  });

  // ==================== NOTES MANAGEMENT ====================

  router.post("/add-note", upload.single('htmlFile'), async (req, res) => {
    let {
      chapterIndex,
      chapterName,
      newChapterIndex,
      newChapterName,
      topicIndex,
      topicName,
      newTopicIndex,
      newTopicName,
      noteTitle,
      htmlContent,
      isPremium
    } = req.body;

    try {
      if (req.file) {
        htmlContent = req.file.buffer.toString('utf-8');
        console.log("✅ HTML file uploaded, size:", req.file.size, "bytes");
      }

      if (newChapterName?.trim()) {
        chapterIndex = +newChapterIndex;
        chapterName = newChapterName.trim();
      } else {
        chapterIndex = +chapterIndex;
      }

      if (newTopicName?.trim()) {
        topicName = newTopicName.trim();
        
        if (newTopicIndex && newTopicIndex.trim() !== '') {
          topicIndex = +newTopicIndex;
          
          const existingNote = await Note.findOne({
            chapterIndex,
            topicIndex
          });

          if (existingNote) {
            return res.status(400).send(
              `❌ A note already exists at Chapter ${chapterIndex}, Topic ${topicIndex}.\n\n` +
              `Title: "${existingNote.noteTitle}"\n\n` +
              `Choose a different topic index.`
            );
          }
        } else {
          const existingIndices = await Note.find({ 
            chapterIndex 
          }).distinct('topicIndex');
          
          topicIndex = findNextAvailableIndex(existingIndices);
          console.log(`✅ Auto-assigned note topic index ${topicIndex}`);
        }
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName || !noteTitle || !htmlContent) {
        throw new Error("Missing required fields");
      }

      const existingNote = await Note.findOne({
        chapterIndex,
        topicIndex
      });

      if (existingNote) {
        throw new Error(`A note already exists for Chapter ${chapterIndex}, Topic ${topicIndex}`);
      }

      const newNote = new Note({
        chapterIndex,
        chapterName,
        topicIndex,
        topicName,
        noteTitle,
        htmlContent: sanitizeNoteHtml(htmlContent),
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
      });

      await newNote.save();
      console.log(`✅ Added note to Chapter ${chapterIndex}, Topic ${topicIndex}`);
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error adding note:", err.message);
      res.status(500).send("Failed to add note: " + err.message);
    }
  });

  router.post("/delete-note", async (req, res) => {
    const { noteId } = req.body;
    try {
      await Note.findByIdAndDelete(noteId);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error deleting note:", err);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  router.post("/toggle-note-chapter-premium", async (req, res) => {
    const { chapterIndex, isPremium } = req.body;
    
    try {
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      const result = await Note.updateMany(
        { chapterIndex: parseInt(chapterIndex) },
        { $set: { isPremium: premiumValue, updatedAt: new Date() } }
      );
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
    } catch (err) {
      console.error("❌ Error toggling note chapter premium:", err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  router.post("/toggle-note-topic-premium", async (req, res) => {
    const { chapterIndex, topicIndex, isPremium } = req.body;
    
    try {
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      const result = await Note.updateMany(
        { 
          chapterIndex: parseInt(chapterIndex),
          topicIndex: parseInt(topicIndex)
        },
        { $set: { isPremium: premiumValue, updatedAt: new Date() } }
      );
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
    } catch (err) {
      console.error("❌ Error toggling note topic premium:", err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  // ==================== PREMIUM MANAGEMENT ROUTES (FLASHCARDS) ====================
  
  router.post("/toggle-chapter-premium", async (req, res) => {
    const { chapterIndex, isPremium } = req.body;
    
    try {
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      const result = await Flashcard.updateMany(
        { chapterIndex: parseInt(chapterIndex) },
        { $set: { isPremium: premiumValue } }
      );
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
      
    } catch (err) {
      console.error("❌ ERROR in toggle-chapter-premium:", err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  router.post("/toggle-topic-premium", async (req, res) => {
    const { chapterIndex, topicIndex, isPremium } = req.body;
    
    try {
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      const result = await Flashcard.updateMany(
        { 
          chapterIndex: parseInt(chapterIndex),
          topicIndex: parseInt(topicIndex)
        },
        { $set: { isPremium: premiumValue } }
      );
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
      
    } catch (err) {
      console.error("❌ ERROR in toggle-topic-premium:", err);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  router.post("/update-subscription", async (req, res) => {
    const { userId, subscriptionStatus, subscriptionExpiry } = req.body;
    
    try {
      const updateData = { subscriptionStatus };
      
      if (subscriptionExpiry && subscriptionExpiry.trim()) {
        updateData.subscriptionExpiry = new Date(subscriptionExpiry);
      } else if (subscriptionStatus === 'free') {
        updateData.subscriptionExpiry = null;
      }
      
      // If downgrading to free, also clear the device lock
      if (subscriptionStatus === 'free') {
        const user = await User.findOne({ userId });
        if (user) {
          user.clearDeviceLock();
          user.subscriptionStatus = 'free';
          user.subscriptionExpiry = updateData.subscriptionExpiry;
          await user.save();
          console.log(`✅ Subscription downgraded to free for ${user.username}, device lock cleared`);
          return res.redirect("/admin");
        }
      }
      
      await User.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true }
      );
      
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error updating subscription:", err);
      res.status(500).send("Failed to update subscription: " + err.message);
    }
  });

  // ==================== PLAN MANAGEMENT (NEW MULTI-PLAN SYSTEM) ====================

  // Grant a specific plan to a user (e.g. for cash payments, gifts, comps)
  router.post("/grant-plan", async (req, res) => {
    const { userId, planId, customExpiry, note } = req.body;
    try {
      const plan = getPlan(planId);
      if (!plan) return res.status(400).send("Invalid plan ID: " + planId);

      const user = await User.findOne({ userId });
      if (!user) return res.status(404).send("User not found");

      let expiresAt;
      if (customExpiry && customExpiry.trim()) {
        expiresAt = new Date(customExpiry);
        if (isNaN(expiresAt.getTime())) {
          return res.status(400).send("Invalid expiry date");
        }
      } else {
        expiresAt = calcPlanExpiry(new Date());
      }

      user.addPlan({
        planId,
        expiresAt,
        amount: 0,
        currency: plan.currency,
        razorpayOrderId: "admin_grant",
        razorpayPaymentId: "admin_grant_" + Date.now() + (note ? "_" + note.replace(/\s+/g, "_").slice(0, 20) : ""),
      });

      await user.save();
      console.log(`✅ Admin granted plan "${planId}" to ${user.username} (expires ${expiresAt.toISOString()})`);
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error granting plan:", err);
      res.status(500).send("Failed to grant plan: " + err.message);
    }
  });

  // Download every purchase as CSV (for accounting / records)
  router.get("/export-purchases.csv", async (req, res) => {
    try {
      const allUsers = await User.find({}, { password: 0 });
      const rows = [["purchased_at","expires_at","username","user_id","plan_id","plan_name","amount_inr","currency","is_admin_grant","razorpay_order_id","razorpay_payment_id"]];

      allUsers.forEach(u => {
        (u.plans || []).forEach(p => {
          const def = getPlan(p.planId);
          const isGrant = p.razorpayPaymentId && String(p.razorpayPaymentId).startsWith("admin_grant");
          rows.push([
            p.purchasedAt ? new Date(p.purchasedAt).toISOString() : "",
            p.expiresAt ? new Date(p.expiresAt).toISOString() : "",
            u.username,
            u.userId,
            p.planId,
            def ? def.name : p.planId,
            isGrant ? "0" : String(Math.round((p.amount || 0) / 100)),
            p.currency || "INR",
            isGrant ? "yes" : "no",
            p.razorpayOrderId || "",
            p.razorpayPaymentId || "",
          ]);
        });
      });

      const csv = rows.map(r =>
        r.map(cell => {
          const s = String(cell == null ? "" : cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(",")
      ).join("\r\n");

      const filename = `accela-purchases-${new Date().toISOString().slice(0,10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      console.error("❌ Error exporting purchases:", err);
      res.status(500).send("Failed to export: " + err.message);
    }
  });

  // ==================== PASSWORD RESETS (admin) ====================

  // Generate a fresh reset link for a user. Returns the URL so admin can copy
  // and share it via WhatsApp / call. Use this when email isn't configured or
  // the user didn't receive the original email.
  router.post("/generate-reset-link", async (req, res) => {
    const { userId } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      if (user.role === "admin") {
        return res.status(403).json({ success: false, error: "Admin passwords cannot be reset this way." });
      }

      const ip = req.headers['x-forwarded-for'] || req.ip || 'admin';
      const rawToken = user.generatePasswordResetToken(typeof ip === 'string' ? ip : String(ip));
      await user.save();

      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const resetUrl = `${proto}://${host}/reset-password?token=${rawToken}`;

      console.log(`🔑 Admin generated reset link for ${user.username}`);
      res.json({
        success: true,
        resetUrl,
        username: user.username,
        email: user.email,
        expiresAt: user.passwordReset.expiresAt
      });
    } catch (err) {
      console.error("❌ Error generating reset link:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dismiss a pending reset request (clears the token without resetting password)
  router.post("/dismiss-reset", async (req, res) => {
    const { userId } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      user.clearPasswordResetToken();
      await user.save();
      console.log(`🗑️  Admin dismissed reset request for ${user.username}`);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error dismissing reset:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== EMAIL VERIFICATION (admin override) ====================
  // Manually mark a user's email as verified (e.g. when email isn't reaching them)
  router.post("/verify-email-now", async (req, res) => {
    const { userId } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      user.emailVerified = true;
      user.emailVerification = undefined;
      await user.save();
      console.log(`✅ Admin manually verified email for ${user.username}`);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error verifying email:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate a fresh verification code (and try to email it)
  router.post("/resend-verification-code", async (req, res) => {
    const { userId } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });
      if (user.emailVerified) {
        return res.status(400).json({ success: false, error: "User is already verified." });
      }
      const code = user.generateEmailVerificationCode();
      await user.save();

      try {
        const { sendVerificationEmail } = require("../utils/email");
        await sendVerificationEmail({
          to: user.email,
          username: user.username,
          code,
          validityHours: 24
        });
      } catch (e) {
        console.error("Email send error:", e.message);
      }

      console.log(`📧 Admin re-issued verification code for ${user.username}: ${code}`);
      res.json({ success: true, code, email: user.email });
    } catch (err) {
      console.error("❌ Error resending verification:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Revoke a single plan from a user (or clear legacy premium status)
  router.post("/revoke-plan", async (req, res) => {
    const { userId, planId } = req.body;
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, error: "User not found" });

      user.removePlan(planId);
      await user.save();
      console.log(`✅ Admin revoked plan "${planId}" from ${user.username}`);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error revoking plan:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== CHAPTER MANAGEMENT (FLASHCARDS) ====================

  router.post("/edit-chapter", async (req, res) => {
    const { oldChapterIndex, newChapterName } = req.body;
    try {
      await Flashcard.updateMany(
        { chapterIndex: parseInt(oldChapterIndex) },
        { $set: { chapterName: newChapterName } }
      );
      res.redirect("/admin");
    } catch (err) {
      res.status(500).send("Error updating chapter name");
    }
  });

  router.post("/delete-chapter", async (req, res) => {
    const { chapterIndex } = req.body;
    try {
      await Flashcard.deleteMany({ chapterIndex: parseInt(chapterIndex) });
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error deleting chapter:", err);
      res.status(500).send("Failed to delete chapter");
    }
  });

  // ==================== TOPIC MANAGEMENT (FLASHCARDS) ====================

  router.post("/edit-topic", async (req, res) => {
    const { chapterIndex, topicIndex, newTopicName } = req.body;
    try {
      await Flashcard.updateMany(
        { chapterIndex: parseInt(chapterIndex), topicIndex: parseInt(topicIndex) },
        { $set: { topicName: newTopicName } }
      );
      res.redirect("/admin");
    } catch (err) {
      res.status(500).send("Failed to update topic name");
    }
  });

  router.post("/delete-topic", async (req, res) => {
    const { chapterIndex, topicIndex } = req.body;
    try {
      await Flashcard.deleteMany({
        chapterIndex: parseInt(chapterIndex),
        topicIndex: parseInt(topicIndex),
      });
      res.redirect("/admin");
    } catch (err) {
      res.status(500).send("Failed to delete topic");
    }
  });

  // ==================== FLASHCARD MANAGEMENT ====================

  router.post("/edit-flashcard", async (req, res) => {
    const { flashcardId, question, answer } = req.body;
    try {
      await Flashcard.findByIdAndUpdate(flashcardId, {
        question,
        answer
      });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error editing flashcard:", err);
      res.status(500).json({ error: "Failed to edit flashcard" });
    }
  });

  router.post("/delete-flashcard", async (req, res) => {
    const { flashcardId } = req.body;
    try {
      await Flashcard.findByIdAndDelete(flashcardId);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error deleting flashcard:", err);
      res.status(500).json({ error: "Failed to delete flashcard" });
    }
  });

  router.post("/add-flashcard", async (req, res) => {
    let {
      chapterIndex,
      chapterName,
      newChapterIndex,
      newChapterName,
      topicIndex,
      topicName,
      newTopicIndex,
      newTopicName,
      question,
      answer,
      isPremium
    } = req.body;
    
    try {
      if (newChapterName?.trim()) {
        chapterIndex = +newChapterIndex;
        chapterName = newChapterName.trim();
      } else {
        chapterIndex = +chapterIndex;
      }

      if (newTopicName?.trim()) {
        topicName = newTopicName.trim();
        
        if (newTopicIndex && newTopicIndex.trim() !== '') {
          topicIndex = +newTopicIndex;
          
          const existingTopic = await Flashcard.findOne({ 
            chapterIndex, 
            topicIndex 
          });
          
          if (existingTopic) {
            if (existingTopic.topicName !== topicName) {
              return res.status(400).send(
                `❌ Topic ${topicIndex} already exists in Chapter ${chapterIndex} with name "${existingTopic.topicName}".\n\n` +
                `Choose a different index or use the existing topic name.`
              );
            }
          }
        } else {
          const existingIndices = await Flashcard.find({ 
            chapterIndex 
          }).distinct('topicIndex');
          
          topicIndex = findNextAvailableIndex(existingIndices);
          console.log(`✅ Auto-assigned topic index ${topicIndex} for chapter ${chapterIndex}`);
        }
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName) {
        throw new Error("Missing chapter or topic name");
      }

      const flashcardIndex = await Flashcard.countDocuments({
        chapterIndex,
        topicIndex
      }) + 1;

      const newFlashcard = new Flashcard({
        chapterIndex,
        chapterName,
        topicIndex,
        topicName,
        flashcardIndex,
        question,
        answer,
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
      });

      await newFlashcard.save();
      console.log(`✅ Added flashcard to Chapter ${chapterIndex}, Topic ${topicIndex}`);
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error adding flashcard:", err.message);
      res.status(500).send("Failed to add flashcard: " + err.message);
    }
  });

  router.post("/bulk-upload", upload.single('jsonFile'), async (req, res) => {
    let {
      chapterIndex,
      chapterName,
      newChapterIndex,
      newChapterName,
      topicIndex,
      topicName,
      newTopicIndex,
      newTopicName,
      jsonData,
      isPremium
    } = req.body;
    
    try {
      if (req.file) {
        jsonData = req.file.buffer.toString('utf-8');
        console.log("✅ JSON file uploaded, size:", req.file.size, "bytes");
      }

      if (newChapterName?.trim()) {
        chapterIndex = +newChapterIndex;
        chapterName = newChapterName.trim();
      } else {
        chapterIndex = +chapterIndex;
      }

      if (newTopicName?.trim()) {
        topicName = newTopicName.trim();
        
        if (newTopicIndex && newTopicIndex.trim() !== '') {
          topicIndex = +newTopicIndex;
          
          const existingTopic = await Flashcard.findOne({ 
            chapterIndex, 
            topicIndex 
          });
          
          if (existingTopic && existingTopic.topicName !== topicName) {
            return res.status(400).send(
              `❌ Topic ${topicIndex} already exists with name "${existingTopic.topicName}"`
            );
          }
        } else {
          const existingIndices = await Flashcard.find({ 
            chapterIndex 
          }).distinct('topicIndex');
          
          topicIndex = findNextAvailableIndex(existingIndices);
          console.log(`✅ Auto-assigned topic index ${topicIndex}`);
        }
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName) {
        throw new Error("Chapter or topic name missing.");
      }
      if (!jsonData || !jsonData.trim()) {
        throw new Error("JSON data is required.");
      }

      const flashcardsData = JSON.parse(jsonData);

      if (!Array.isArray(flashcardsData)) {
        throw new Error("JSON must be an array of flashcard objects.");
      }

      const existingCount = await Flashcard.countDocuments({ chapterIndex, topicIndex });

      const flashcards = flashcardsData.map((fc, i) => ({
        chapterIndex,
        chapterName,
        topicIndex,
        topicName,
        flashcardIndex: existingCount + i + 1,
        question: fc.question,
        answer: fc.answer,
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
      }));

      await Flashcard.insertMany(flashcards);
      console.log(`✅ Bulk uploaded ${flashcards.length} flashcards to Topic ${topicIndex}`);
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Upload Error:", err.message);
      res.status(400).send("❌ " + err.message);
    }
  });

  // ==================== USER MANAGEMENT ====================

  router.post("/delete-user", async (req, res) => {
    try {
      await User.deleteOne({ userId: req.body.userId });
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error deleting user:", err);
      res.status(500).send("Failed to delete user");
    }
  });

  router.post("/add-user", async (req, res) => {
    const { userId, username, password, email, role, subscriptionStatus } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        userId,
        username,
        email: email || `${username}@example.com`,
        password: hashedPassword,
        role,
        subscriptionStatus: subscriptionStatus || 'free'
      });

      await newUser.save();
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error adding user:", err);
      res.status(500).send("Failed to add user");
    }
  });

  return router;
};
