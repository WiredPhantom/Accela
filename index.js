const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// --------- CONSISTENT PRICING (FIX: Use single source of truth) ---------
const PREMIUM_PRICE = parseInt(process.env.PREMIUM_PRICE) || 9900; // ₹99 in paise
const PREMIUM_CURRENCY = process.env.PREMIUM_CURRENCY || "INR";

// --------- VALIDATE ENVIRONMENT VARIABLES ---------
if (!process.env.jwtkey) {
  console.error("❌ FATAL: JWT secret key (jwtkey) is not configured in .env");
  process.exit(1);
}

if (!process.env.useruri || !process.env.flashcarduri) {
  console.error("❌ FATAL: Database URIs not configured");
  process.exit(1);
}

// --------- 1. MIDDLEWARE ---------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");

// --------- RATE LIMITING (Simple in-memory implementation) ---------
const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, []);
  }

  const attempts = loginAttempts.get(ip).filter(time => now - time < windowMs);
  loginAttempts.set(ip, attempts);

  if (attempts.length >= maxAttempts) {
    const oldestAttempt = attempts[0];
    const retryAfter = Math.ceil((oldestAttempt + windowMs - now) / 1000 / 60);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Try again in ${retryAfter} minutes.`
    });
  }

  next();
}

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const [ip, attempts] of loginAttempts.entries()) {
    const validAttempts = attempts.filter(time => now - time < windowMs);
    if (validAttempts.length === 0) {
      loginAttempts.delete(ip);
    } else {
      loginAttempts.set(ip, validAttempts);
    }
  }
}, 60 * 60 * 1000);

// --------- 2. MONGOOSE MULTI-CONNECTION SETUP ---------
const useruri = process.env.useruri;
const flashcarduri = process.env.flashcarduri;
const noteuri = process.env.noteuri || flashcarduri;

const userConnection = mongoose.createConnection(useruri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
const flashcardConnection = mongoose.createConnection(flashcarduri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
const noteConnection = mongoose.createConnection(noteuri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

userConnection.on("connected", () => console.log("✅ User DB connected"));
flashcardConnection.on("connected", () => console.log("✅ Flashcard DB connected"));
noteConnection.on("connected", () => console.log("✅ Note DB connected"));

userConnection.on("error", err => {
  console.error("❌ User DB Error:", err);
  process.exit(1);
});
flashcardConnection.on("error", err => {
  console.error("❌ Flashcard DB Error:", err);
  process.exit(1);
});
noteConnection.on("error", err => {
  console.error("❌ Note DB Error:", err);
  process.exit(1);
});

// --------- 3. LOAD MODELS ---------
const getUserModel = require("./models/user");
const getFlashcardModel = require("./models/flashcard");
const getNoteModel = require("./models/note");

const User = getUserModel(userConnection);
const Flashcard = getFlashcardModel(flashcardConnection);
const Note = getNoteModel(noteConnection);

// --------- 4. HELPER FUNCTIONS ---------
async function checkUserPremium(username) {
  if (!username) return { isPremium: false, daysLeft: 0 };
  try {
    const user = await User.findOne({ username });
    if (!user) return { isPremium: false, daysLeft: 0 };
    
    if (user.role === "admin") {
      return { isPremium: true, daysLeft: Infinity, isAdmin: true };
    }
    
    if (user.subscriptionStatus === "premium") {
      if (!user.subscriptionExpiry) {
        return { isPremium: true, daysLeft: Infinity };
      }
      
      const now = new Date();
      if (user.subscriptionExpiry > now) {
        const daysLeft = Math.ceil((user.subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
        return { isPremium: true, daysLeft };
      }
    }
    
    return { isPremium: false, daysLeft: 0 };
  } catch (err) {
    console.error("Error checking premium status:", err);
    return { isPremium: false, daysLeft: 0 };
  }
}

// --------- DEVICE FINGERPRINT HELPER (FIX: Removed IP address) ---------
function generateDeviceFingerprint(req) {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'] || 'unknown';
  const acceptEncoding = req.headers['accept-encoding'] || 'unknown';
  
  // FIX: Don't use IP - it changes too frequently!
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

// --------- COOKIE OPTIONS HELPER ---------
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

// --------- 5. AUTH MIDDLEWARE WITH SESSION VALIDATION ---------

async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    const sessionToken = req.cookies.sessionToken;
    
    if (!token) {
      req.user = null;
      req.isAuthenticated = false;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.jwtkey);
    const user = await User.findOne({ username: decoded.username });
    
    if (!user) {
      req.user = null;
      req.isAuthenticated = false;
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      return next();
    }
    
    // Admin bypass - no session validation needed
    if (user.role === 'admin') {
      req.user = decoded;
      req.isAuthenticated = true;
      return next();
    }
    
    // Validate session for regular users
    const deviceFingerprint = generateDeviceFingerprint(req);
    const sessionValidation = user.validateSession(sessionToken, deviceFingerprint);
    
    if (!sessionValidation.valid) {
      req.user = null;
      req.isAuthenticated = false;
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      
      // Auto-clear expired sessions
      if (sessionValidation.reason === 'SESSION_EXPIRED') {
        user.clearSession();
        await user.save();
      }
      return next();
    }
    
    req.user = decoded;
    req.isAuthenticated = true;
  } catch (err) {
    req.user = null;
    req.isAuthenticated = false;
  }
  next();
}

async function checkAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    const sessionToken = req.cookies.sessionToken;
    
    if (!token) {
      return res.render("accessdenied");
    }
    
    const decoded = jwt.verify(token, process.env.jwtkey);
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Find user and validate session
    const user = await User.findOne({ username: decoded.username });
    
    if (!user) {
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      return res.render("accessdenied");
    }
    
    // Admin bypass - no session validation needed
    if (user.role === 'admin') {
      req.user = decoded;
      return next();
    }
    
    // Validate session for regular users
    const sessionValidation = user.validateSession(sessionToken, deviceFingerprint);
    
    if (!sessionValidation.valid) {
      console.log(`❌ Session invalid for ${user.username}: ${sessionValidation.reason}`);
      
      // Clear cookies if session is invalid
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      
      if (sessionValidation.reason === 'SESSION_EXPIRED') {
        // Clear the expired session from DB
        user.clearSession();
        await user.save();
        return res.render("sessionexpired", { 
          message: "Your session has expired after 30 days. Please login again." 
        });
      }
      
      return res.render("accessdenied");
    }
    
    // Update last activity
    user.updateActivity();
    await user.save();
    
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.clearCookie("token");
    res.clearCookie("sessionToken");
    res.render("accessdenied");
  }
}

function checkRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.render("unauthorized");
    }
    next();
  };
}

async function checkPremiumAccess(req, res, next) {
  if (!req.isAuthenticated) {
    return res.render("premiumrequired", { 
      message: "Login required to access premium content" 
    });
  }

  try {
    const user = await User.findOne({ username: req.user.username });
    
    if (!user) {
      return res.render("premiumrequired", { 
        message: "User not found" 
      });
    }

    if (user.role === "admin") {
      req.hasPremium = true;
      return next();
    }

    if (user.subscriptionStatus === "premium") {
      if (user.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
        req.hasPremium = true;
        return next();
      } else if (!user.subscriptionExpiry) {
        req.hasPremium = true;
        return next();
      }
    }

    req.hasPremium = false;
    res.render("premiumrequired", { 
      message: "Upgrade to premium to access this content" 
    });
  } catch (err) {
    console.error("Premium check error:", err);
    res.render("premiumrequired", { 
      message: "Error checking premium status" 
    });
  }
}

// --------- 6. ADMIN ROUTES ---------
const adminRoutes = require("./routes/admin")(User, Flashcard, Note);
app.use("/admin", checkAuth, checkRole("admin"), adminRoutes);

// --------- 7. MAIN ROUTES ---------

// HOME PAGE
app.get("/", optionalAuth, async (req, res) => {
  try {
    const premiumStatus = await checkUserPremium(req.user?.username);

    res.render("home", { 
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      daysLeft: premiumStatus.daysLeft,
      isAdmin: premiumStatus.isAdmin || false,
      user: req.user 
    });
  } catch (err) {
    console.error("❌ Home page error:", err);
    res.render("home", { 
      isAuthenticated: false, 
      hasPremium: false,
      daysLeft: 0,
      isAdmin: false,
      user: null 
    });
  }
});

// Login page
app.get("/login", (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.jwtkey);
      if (decoded) return res.redirect("/");
    }
  } catch (err) {
    // Invalid token, continue to login page
  }
  res.render("login");
});

// ========== LOGIN HANDLER WITH SINGLE DEVICE ENFORCEMENT ==========
app.post("/login", rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const deviceFingerprint = generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = getClientIP(req);
    
    // Track this attempt for rate limiting
    if (!loginAttempts.has(ipAddress)) {
      loginAttempts.set(ipAddress, []);
    }
    loginAttempts.get(ipAddress).push(Date.now());
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Username and password required" 
      });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Wrong username or password" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Log failed attempt
      user.logLoginAttempt(ipAddress, userAgent, false, 'WRONG_PASSWORD');
      await user.save();
      
      return res.status(401).json({ 
        success: false, 
        message: "Wrong username or password" 
      });
    }

    // ========== SINGLE DEVICE CHECK (SKIP FOR ADMIN) ==========
    const loginCheck = user.canLoginFromDevice(deviceFingerprint);
    
    if (!loginCheck.allowed) {
      // Log blocked attempt
      user.logLoginAttempt(ipAddress, userAgent, false, loginCheck.reason);
      await user.save();
      
      console.log(`🚫 Login blocked for ${username}: ${loginCheck.reason}`);
      
      return res.status(403).json({ 
        success: false, 
        message: loginCheck.message,
        reason: 'DEVICE_LOCKED',
        expiresAt: loginCheck.expiresAt
      });
    }

    // Clear rate limit on successful login
    loginAttempts.delete(ipAddress);

    // ========== CREATE NEW SESSION ==========
    const sessionToken = user.createSession(deviceFingerprint, userAgent, ipAddress);
    user.logLoginAttempt(ipAddress, userAgent, true);
    await user.save();

    // Create JWT token
    const jwtToken = jwt.sign(
      { 
        username, 
        role: user.role, 
        subscriptionStatus: user.subscriptionStatus 
      },
      process.env.jwtkey,
      { expiresIn: "720h" } // 30 days
    );

    const cookieOptions = getCookieOptions();

    // Set both JWT and session token cookies
    res.cookie("token", jwtToken, cookieOptions);
    res.cookie("sessionToken", sessionToken, cookieOptions);
    
    console.log(`✅ Login successful for ${username} from device ${deviceFingerprint.substring(0, 8)}...`);
    
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "An error occurred during login" 
    });
  }
});

// ========== LOGOUT - CLEARS SESSION FROM DB ==========
app.get("/logout", async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.jwtkey);
      const user = await User.findOne({ username: decoded.username });
      
      if (user) {
        user.clearSession();
        await user.save();
        console.log(`✅ Session cleared for ${user.username}`);
      }
    }
  } catch (err) {
    console.error("Logout error:", err.message);
  }
  
  res.clearCookie("token");
  res.clearCookie("sessionToken");
  res.redirect("/");
});

// --------- SIGNUP ROUTES ---------

app.get("/signup", (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.jwtkey);
      if (decoded) return res.redirect("/");
    }
  } catch (err) {
    // Invalid token, continue to signup page
  }
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields required" 
      });
    }

    // Basic validation
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ 
        success: false, 
        message: "Username must be 3-30 characters" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters" 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email format" 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "Username or email already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      userId: `user_${Date.now()}`,
      username,
      email,
      password: hashedPassword,
      role: "user",
      subscriptionStatus: "free"
    });

    await newUser.save();

    res.json({ 
      success: true, 
      message: "Account created successfully",
      username: username
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed" 
    });
  }
});

// ========== FIX: Set cookies server-side! ==========
app.post("/create-free-session", async (req, res) => {
  try {
    const { username } = req.body;
    const deviceFingerprint = generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = getClientIP(req);

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

    // Create session in database
    const sessionToken = user.createSession(deviceFingerprint, userAgent, ipAddress);
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

    // FIX: Set cookies server-side instead of returning them!
    res.cookie("token", token, cookieOptions);
    res.cookie("sessionToken", sessionToken, cookieOptions);

    res.json({ success: true });

  } catch (err) {
    console.error("Free session error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create session" 
    });
  }
});

app.get("/upgrade", optionalAuth, async (req, res) => {
  const username = req.query.username || req.user?.username;
  
  if (!username) {
    return res.redirect("/login");
  }

  try {
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.redirect("/signup");
    }

    if (user.subscriptionStatus === "premium" && 
        user.subscriptionExpiry && 
        user.subscriptionExpiry > new Date()) {
      return res.redirect("/");
    }

    res.render("upgrade", { username });
  } catch (err) {
    console.error("Upgrade page error:", err);
    res.redirect("/");
  }
});

app.get("/profile", checkAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username })
      .select('-password');

    if (!user) {
      return res.redirect("/login");
    }

    const premiumStatus = await checkUserPremium(user.username);

    res.render("profile", { 
      user,
      hasPremium: premiumStatus.isPremium,
      daysLeft: premiumStatus.daysLeft,
      isAuthenticated: true 
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.redirect("/");
  }
});

// Payment routes - Pass PREMIUM_PRICE for consistency
const paymentRoutes = require("./routes/payment")(User, PREMIUM_PRICE, PREMIUM_CURRENCY);
app.use("/payment", paymentRoutes);

// --------- 8. FLASHCARD ROUTES ---------

app.get("/chapters", optionalAuth, async (req, res) => {
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

    const premiumStatus = await checkUserPremium(req.user?.username);

    res.render("chapters", { 
      chapters, 
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user 
    });
  } catch (err) {
    console.error("❌ Aggregate error:", err);
    res.render("chapters", { 
      chapters: [], 
      isAuthenticated: false, 
      hasPremium: false,
      user: null 
    });
  }
});

app.get("/chapter/:id", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  
  if (isNaN(chapterId) || chapterId < 0) {
    return res.status(400).render("404");
  }
  
  try {
    const premiumStatus = await checkUserPremium(req.user?.username);
    
    const chapterCheck = await Flashcard.findOne({ chapterIndex: chapterId });
    
    if (!chapterCheck) {
      return res.status(404).render("404");
    }
    
    if (chapterCheck.isPremium && !premiumStatus.isPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this chapter" 
      });
    }

    const topics = await Flashcard.aggregate([
      { $match: { chapterIndex: chapterId } },
      {
        $group: {
          _id: "$topicIndex",
          topicName: { $first: "$topicName" },
          isPremium: { $first: "$isPremium" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render("topics", { 
      chapterId, 
      topics,
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user
    });
  } catch (err) {
    console.error("❌ Topic fetch error:", err);
    res.render("topics", { 
      chapterId, 
      topics: [],
      isAuthenticated: false,
      hasPremium: false,
      user: null
    });
  }
});

app.get("/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  if (isNaN(chapterId) || isNaN(topicId) || chapterId < 0 || topicId < 0) {
    return res.status(400).render("404");
  }

  try {
    const premiumStatus = await checkUserPremium(req.user?.username);
    
    const topicCheck = await Flashcard.findOne({ 
      chapterIndex: chapterId, 
      topicIndex: topicId 
    });
    
    if (!topicCheck) {
      return res.status(404).render("404");
    }
    
    if (topicCheck.isPremium && !premiumStatus.isPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this topic" 
      });
    }

    const flashcards = await Flashcard.find({
      chapterIndex: chapterId,
      topicIndex: topicId
    }).sort({ flashcardIndex: 1 });

    // ========== NEW: Fetch full user with email for watermark ==========
    let fullUser = null;
    if (req.user?.username) {
      fullUser = await User.findOne({ username: req.user.username }).select('username email');
    }

    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards,
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user,
      fullUser: fullUser  // <-- ADDED THIS
    });
  } catch (err) {
    console.error("âŒ Flashcard fetch error:", err);
    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards: [],
      isAuthenticated: false,
      hasPremium: false,
      user: null,
      fullUser: null  // <-- ADDED THIS
    });
  }
});

// --------- 9. NOTES ROUTES ---------

app.get("/notes", optionalAuth, async (req, res) => {
  try {
    const chapters = await Note.aggregate([
      {
        $group: {
          _id: "$chapterIndex",
          chapterName: { $first: "$chapterName" },
          isPremium: { $first: "$isPremium" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const premiumStatus = await checkUserPremium(req.user?.username);

    res.render("note-chapters", { 
      chapters, 
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user 
    });
  } catch (err) {
    console.error("❌ Note chapters error:", err);
    res.render("note-chapters", { 
      chapters: [], 
      isAuthenticated: false, 
      hasPremium: false,
      user: null 
    });
  }
});

app.get("/notes/chapter/:id", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  
  if (isNaN(chapterId) || chapterId < 0) {
    return res.status(400).render("404");
  }
  
  try {
    const premiumStatus = await checkUserPremium(req.user?.username);
    
    const chapterCheck = await Note.findOne({ chapterIndex: chapterId });
    
    if (!chapterCheck) {
      return res.status(404).render("404");
    }
    
    if (chapterCheck.isPremium && !premiumStatus.isPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this chapter" 
      });
    }

    const topics = await Note.aggregate([
      { $match: { chapterIndex: chapterId } },
      {
        $group: {
          _id: "$topicIndex",
          topicName: { $first: "$topicName" },
          isPremium: { $first: "$isPremium" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render("note-topics", { 
      chapterId, 
      topics,
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user
    });
  } catch (err) {
    console.error("❌ Note topics error:", err);
    res.render("note-topics", { 
      chapterId, 
      topics: [],
      isAuthenticated: false,
      hasPremium: false,
      user: null
    });
  }
});

app.get("/notes/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  if (isNaN(chapterId) || isNaN(topicId) || chapterId < 0 || topicId < 0) {
    return res.status(400).render("404");
  }

  try {
    const premiumStatus = await checkUserPremium(req.user?.username);
    
    const note = await Note.findOne({ 
      chapterIndex: chapterId, 
      topicIndex: topicId 
    });
    
    if (!note) {
      return res.status(404).render("404");
    }
    
    if (note.isPremium && !premiumStatus.isPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this note" 
      });
    }

    // ========== NEW: Fetch full user with email for watermark ==========
    let fullUser = null;
    if (req.user?.username) {
      fullUser = await User.findOne({ username: req.user.username }).select('username email');
    }

    res.render("note-view", { 
      note,
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user,
      fullUser: fullUser  // <-- ADDED THIS
    });
  } catch (err) {
    console.error("âŒ Note view error:", err);
    res.status(404).render("404");
  }
});

// --------- 10. ERROR HANDLING ---------
app.use((req, res) => {
  res.status(404).render("404");
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);
  res.status(500).render("404");
});

// --------- 11. GRACEFUL SHUTDOWN ---------
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await userConnection.close();
  await flashcardConnection.close();
  await noteConnection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing connections...');
  await userConnection.close();
  await flashcardConnection.close();
  await noteConnection.close();
  process.exit(0);
});

// --------- 12. START SERVER ---------
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Server accessible at http://0.0.0.0:${port}`);
});
