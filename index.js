const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const { getAllPlans, getValidityMonths, formatDate, getPlan, planCoversTerm } = require("./config/plans");
const { getAllSubjects, getSubject } = require("./config/subjects");
const {
  generateDeviceFingerprint,
  getClientIP,
  getCookieOptions,
} = require("./utils/device-fingerprint");

const app = express();
const port = process.env.PORT || 3000;

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

// --------- RATE LIMITING ---------
const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
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
async function getUserAccess(username) {
  const empty = { isPremium: false, daysLeft: 0, isAdmin: false, plans: [], user: null };
  if (!username) return empty;
  try {
    const user = await User.findOne({ username });
    if (!user) return empty;

    const isAdmin = user.role === "admin";
    const isPremium = isAdmin || user.hasAnyActivePlan();
    const daysLeft = isAdmin ? Infinity : user.getMaxDaysLeft();
    const plans = user.getActivePlans().map(p => {
      const meta = getPlan(p.planId);
      return {
        planId: p.planId,
        name: meta?.name || p.planId,
        shortName: meta?.shortName || p.planId,
        chapterLabel: meta?.chapterLabel || "",
        expiresAt: p.expiresAt,
      };
    });

    return { isPremium, daysLeft, isAdmin, plans, user };
  } catch (err) {
    console.error("Error checking premium status:", err);
    return empty;
  }
}

// Backward-compat shim — older code paths may still call this name.
async function checkUserPremium(username) {
  const a = await getUserAccess(username);
  return { isPremium: a.isPremium, daysLeft: a.daysLeft, isAdmin: a.isAdmin, plans: a.plans };
}

// Device fingerprint, client-IP, and cookie helpers now live in
// utils/device-fingerprint.js (shared with routes/payment.js so the two
// can never drift apart and lock paying users out of their own account).

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
    
    if (user.role === 'admin') {
      req.user = decoded;
      req.isAuthenticated = true;
      return next();
    }
    
    const deviceFingerprint = generateDeviceFingerprint(req);
    const sessionValidation = user.validateSession(sessionToken, deviceFingerprint);
    
    if (!sessionValidation.valid) {
      req.user = null;
      req.isAuthenticated = false;
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      
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
    
    const user = await User.findOne({ username: decoded.username });
    
    if (!user) {
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      return res.render("accessdenied");
    }
    
    if (user.role === 'admin') {
      req.user = decoded;
      return next();
    }
    
    const sessionValidation = user.validateSession(sessionToken, deviceFingerprint);
    
    if (!sessionValidation.valid) {
      console.log(`🚫 Session invalid for ${user.username}: ${sessionValidation.reason}`);
      
      res.clearCookie("token");
      res.clearCookie("sessionToken");
      
      if (sessionValidation.reason === 'SESSION_EXPIRED') {
        user.clearSession();
        await user.save();
        return res.render("sessionexpired", { 
          message: "Your session has expired after 30 days. Please login again." 
        });
      }
      
      return res.render("accessdenied");
    }
    
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
      message: "Login required to access premium content",
      username: null,
      chapterIndex: null,
    });
  }

  try {
    const user = await User.findOne({ username: req.user.username });

    if (!user) {
      return res.render("premiumrequired", {
        message: "User not found",
        username: null,
        chapterIndex: null,
      });
    }

    if (user.role === "admin" || user.hasAnyActivePlan()) {
      req.hasPremium = true;
      return next();
    }

    req.hasPremium = false;
    res.render("premiumrequired", {
      message: "Upgrade to a plan to access this content",
      username: user.username,
      chapterIndex: null,
    });
  } catch (err) {
    console.error("Premium check error:", err);
    res.render("premiumrequired", {
      message: "Error checking premium status",
      username: null,
      chapterIndex: null,
    });
  }
}

// --------- 6. ADMIN ROUTES ---------
const adminRoutes = require("./routes/admin")(User, Flashcard, Note);
app.use("/admin", checkAuth, checkRole("admin"), adminRoutes);

// --------- 7. MAIN ROUTES ---------

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

app.get("/login", (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.jwtkey);
      if (decoded) return res.redirect("/");
    }
  } catch (err) {}
  res.render("login");
});

// ========== LOGIN HANDLER WITH DEVICE LOCK ENFORCEMENT ==========
app.post("/login", rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const deviceFingerprint = generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = getClientIP(req);
    
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
      user.logLoginAttempt(ipAddress, userAgent, false, 'WRONG_PASSWORD');
      await user.save();
      
      return res.status(401).json({ 
        success: false, 
        message: "Wrong username or password" 
      });
    }

    // ========== DEVICE LOCK CHECK (independent of session) ==========
    const loginCheck = user.canLoginFromDevice(deviceFingerprint);
    
    if (!loginCheck.allowed) {
      user.logLoginAttempt(ipAddress, userAgent, false, loginCheck.reason);
      await user.save();
      
      console.log(`🚫 Login blocked for ${username}: ${loginCheck.reason} (${loginCheck.remainingDays} days remaining)`);
      
      return res.status(403).json({ 
        success: false, 
        message: loginCheck.message,
        reason: 'DEVICE_LOCKED',
        expiresAt: loginCheck.expiresAt,
        remainingDays: loginCheck.remainingDays
      });
    }

    // Clear rate limit on successful login
    loginAttempts.delete(ipAddress);

    // ========== CREATE SESSION ==========
    const sessionToken = user.createSession(deviceFingerprint, userAgent, ipAddress);

    // ========== CREATE/REFRESH DEVICE LOCK FOR PREMIUM USERS ==========
    if (user.subscriptionStatus === 'premium' && user.role !== 'admin') {
      if (!user.hasActiveDeviceLock()) {
        user.createDeviceLock(deviceFingerprint);
        console.log(`🔒 New device lock created for ${username} on device ${deviceFingerprint.substring(0, 8)}...`);
      }
    }

    user.logLoginAttempt(ipAddress, userAgent, true);
    await user.save();

    const jwtToken = jwt.sign(
      { 
        username, 
        role: user.role, 
        subscriptionStatus: user.subscriptionStatus 
      },
      process.env.jwtkey,
      { expiresIn: "720h" }
    );

    const cookieOptions = getCookieOptions();

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

// ========== LOGOUT - CLEARS SESSION BUT NOT DEVICE LOCK ==========
app.get("/logout", async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.jwtkey);
      const user = await User.findOne({ username: decoded.username });
      
      if (user) {
        user.clearSession();
        await user.save();
        console.log(`🚪 Session cleared for ${user.username} (device lock preserved)`);
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
  } catch (err) {}
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

    // Check username and email separately so we can give a precise message
    // for username collisions (usernames are public so no privacy leak),
    // but a generic message for email collisions to avoid email enumeration.
    const usernameTaken = await User.findOne({ username }).select('_id').lean();
    if (usernameTaken) {
      return res.status(400).json({
        success: false,
        message: "Username already taken. Please choose another."
      });
    }

    const emailTaken = await User.findOne({ email }).select('_id').lean();
    if (emailTaken) {
      return res.status(400).json({
        success: false,
        message: "Could not create the account with the details you provided. If you already have an account, try logging in or resetting your password."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      userId: `user_${Date.now()}`,
      username,
      email,
      password: hashedPassword,
      role: "user",
      subscriptionStatus: "free",
      emailVerified: false
    });

    const verificationCode = newUser.generateEmailVerificationCode();
    await newUser.save();

    // Try to send the verification email — don't fail signup if it doesn't go through
    try {
      const { sendVerificationEmail } = require("./utils/email");
      const result = await sendVerificationEmail({
        to: email,
        username,
        code: verificationCode,
        validityHours: 24
      });
      if (!result.sent) {
        console.log(`📭 Verification email not sent (${result.reason || 'unknown'}). Code: ${verificationCode} — admin can share via /admin panel.`);
      }
    } catch (e) {
      console.error("Verification email error:", e.message);
    }

    console.log(`📝 New signup: ${username} (${email}) — verification code: ${verificationCode}`);

    res.json({
      success: true,
      message: "Account created. Please verify your email to continue.",
      username: username,
      requiresVerification: true,
      redirect: `/verify-email?username=${encodeURIComponent(username)}`
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed" 
    });
  }
});

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

    const activePlans = user.getActivePlans().map(p => p.planId);
    const allPlans = getAllPlans();

    // If user already has the "complete" plan or all 3 terms, send them home.
    const hasComplete = activePlans.includes("complete");
    const hasAllTerms = ["term1", "term2", "term3"].every(t => activePlans.includes(t));
    if (hasComplete || hasAllTerms) {
      return res.redirect(`/profile`);
    }

    res.render("upgrade", {
      username,
      plans: allPlans,
      activePlans,
      validityMonths: getValidityMonths(),
    });
  } catch (err) {
    console.error("Upgrade page error:", err);
    res.redirect("/");
  }
});

// ========== EMAIL VERIFICATION ==========
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? local[0] + '*' : local.slice(0, 2) + '*'.repeat(Math.max(1, local.length - 3)) + local.slice(-1);
  return `${maskedLocal}@${domain}`;
}

app.get("/verify-email", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.redirect("/login");
  try {
    const user = await User.findOne({ username });
    if (!user) return res.redirect("/login");
    if (user.emailVerified) return res.redirect("/login");
    res.render("verifyemail", {
      username: user.username,
      maskedEmail: maskEmail(user.email)
    });
  } catch (err) {
    console.error("Verify-email page error:", err);
    res.redirect("/login");
  }
});

app.post("/verify-email", async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) {
      return res.status(400).json({ success: false, message: "Username and code are required." });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: "Email already verified.", redirect: "/login" });
    }
    const result = user.verifyEmailCode(code);
    await user.save();
    if (result.ok) {
      console.log(`✅ Email verified for: ${user.username}`);
      return res.json({ success: true, message: "Email verified.", redirect: "/login" });
    }
    let message = "Verification failed.";
    if (result.reason === "WRONG_CODE") {
      message = `Wrong code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`;
    } else if (result.reason === "EXPIRED") {
      message = "This code has expired. Please request a new one.";
    } else if (result.reason === "TOO_MANY_ATTEMPTS") {
      message = "Too many wrong attempts. Please request a new code.";
    } else if (result.reason === "NO_CODE") {
      message = "No verification code on file. Please request a new one.";
    }
    res.status(400).json({ success: false, message });
  } catch (err) {
    console.error("Verify-email error:", err);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

app.post("/resend-verification", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: "Username required." });

    const user = await User.findOne({ username });
    if (!user) {
      // Generic response — don't reveal account existence
      return res.json({ success: true, message: "If the account exists and is unverified, a new code has been sent." });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: "Email is already verified. You can log in." });
    }

    // Throttle: don't allow resend more than once per 60 seconds
    if (user.emailVerification && user.emailVerification.sentAt) {
      const sinceMs = Date.now() - new Date(user.emailVerification.sentAt).getTime();
      if (sinceMs < 60 * 1000) {
        return res.status(429).json({ success: false, message: `Please wait ${Math.ceil((60000 - sinceMs)/1000)}s before requesting another code.` });
      }
    }

    const code = user.generateEmailVerificationCode();
    await user.save();

    try {
      const { sendVerificationEmail } = require("./utils/email");
      const result = await sendVerificationEmail({
        to: user.email,
        username: user.username,
        code,
        validityHours: 24
      });
      if (!result.sent) {
        console.log(`📭 Resend email not sent (${result.reason}). Code for ${user.username}: ${code}`);
      }
    } catch (e) {
      console.error("Resend email error:", e.message);
    }

    console.log(`📧 Verification code re-issued for ${user.username}: ${code}`);
    res.json({ success: true, message: "A new code has been sent to your email." });
  } catch (err) {
    console.error("Resend-verification error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ========== FORGOT / RESET PASSWORD ==========
const { sendPasswordResetEmail } = require("./utils/email");

function buildResetUrl(req, token) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/reset-password?token=${token}`;
}

app.get("/forgot-password", (req, res) => {
  res.render("forgotpassword");
});

// Throttle password-reset requests so no one can spam Gmail or flood the DB
// with reset tokens. Sliding window: max 5 requests per IP per 15 minutes.
const forgotPasswordAttempts = new Map();
function rateLimitForgotPassword(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const attempts = (forgotPasswordAttempts.get(ip) || []).filter(t => now - t < windowMs);

  if (attempts.length >= maxAttempts) {
    const retryAfterMin = Math.ceil((attempts[0] + windowMs - now) / 1000 / 60);
    return res.status(429).json({
      success: false,
      message: `Too many password reset requests. Please try again in ${retryAfterMin} minute${retryAfterMin === 1 ? '' : 's'}.`
    });
  }

  attempts.push(now);
  forgotPasswordAttempts.set(ip, attempts);
  next();
}

// Periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const [ip, attempts] of forgotPasswordAttempts.entries()) {
    const valid = attempts.filter(t => now - t < windowMs);
    if (valid.length === 0) forgotPasswordAttempts.delete(ip);
    else forgotPasswordAttempts.set(ip, valid);
  }
}, 60 * 60 * 1000);

app.post("/forgot-password", rateLimitForgotPassword, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== "string" || identifier.length > 200) {
      return res.status(400).json({ success: false, message: "Please enter a valid email or username." });
    }

    // Generic success message — never reveal whether the account exists
    const genericSuccess = {
      success: true,
      message:
        "If an account matches that email or username, a reset link has been generated. " +
        "Check your inbox in a minute. If you don't receive an email, contact your admin — " +
        "they can share the reset link with you directly."
    };

    const trimmed = identifier.trim();
    const user = await User.findOne({
      $or: [{ email: trimmed.toLowerCase() }, { email: trimmed }, { username: trimmed }]
    });

    if (!user) {
      // Still respond success after a small delay (prevents email enumeration)
      await new Promise(r => setTimeout(r, 250));
      return res.json(genericSuccess);
    }

    // Admin accounts cannot reset via this self-serve flow (extra protection)
    if (user.role === "admin") {
      console.log(`⚠️  Password reset attempted for admin: ${user.username}. Ignored.`);
      return res.json(genericSuccess);
    }

    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const rawToken = user.generatePasswordResetToken(typeof ip === 'string' ? ip : String(ip));
    await user.save();

    const resetUrl = buildResetUrl(req, rawToken);
    console.log(`🔑 Password reset requested for: ${user.username} → ${resetUrl}`);

    // Try to send email (no-op if Gmail SMTP credentials are not configured)
    const result = await sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetUrl,
      validityMinutes: 60
    });

    if (!result.sent) {
      console.log(`📭 Email not sent (${result.reason || 'unknown'}). Admin can share link from /admin panel.`);
    }

    res.json(genericSuccess);
  } catch (err) {
    console.error("Forgot-password error:", err);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
});

app.get("/reset-password", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string" || token.length < 32) {
    return res.render("resetpassword", { token: "", invalidToken: true });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      "passwordReset.tokenHash": tokenHash,
      "passwordReset.expiresAt": { $gt: new Date() }
    });

    if (!user) {
      return res.render("resetpassword", { token: "", invalidToken: true });
    }

    res.render("resetpassword", { token, invalidToken: false });
  } catch (err) {
    console.error("Reset-password page error:", err);
    res.render("resetpassword", { token: "", invalidToken: true });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing token or password." });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      "passwordReset.tokenHash": tokenHash,
      "passwordReset.expiresAt": { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Please request a new one."
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.clearPasswordResetToken();
    // Force logout from any active session for safety
    user.clearSession();
    await user.save();

    console.log(`✅ Password reset completed for: ${user.username}`);
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset-password error:", err);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

app.get("/change-password", checkAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username }).select('-password');
    if (!user) return res.redirect("/login");
    res.render("changepassword", { user, isAuthenticated: true });
  } catch (err) {
    console.error("Change-password page error:", err);
    res.redirect("/profile");
  }
});

app.post("/change-password", checkAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords are required." });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current one." });
    }

    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log(`🔐 Password changed for user: ${user.username}`);
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Change-password error:", err);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
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
      activePlans: premiumStatus.plans || [],
      validityMonths: getValidityMonths(),
      isAuthenticated: true
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.redirect("/");
  }
});

const paymentRoutes = require("./routes/payment")(User);
app.use("/payment", paymentRoutes);

// --------- 8. FLASHCARD ROUTES (Subject-based) ---------

app.get("/chapters", optionalAuth, async (req, res) => {
  const premiumStatus = await checkUserPremium(req.user?.username);
  res.render("subjects", {
    type: "flashcards",
    subjects: getAllSubjects(),
    isAuthenticated: req.isAuthenticated,
    hasPremium: premiumStatus.isPremium,
    user: req.user
  });
});

app.get("/chapters/:subjectSlug", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const subject = getSubject(subjectSlug);
  if (!subject) return res.status(404).render("404");

  try {
    const chapters = await Flashcard.aggregate([
      { $match: { subjectSlug } },
      {
        $group: {
          _id: "$chapterIndex",
          chapterName: { $first: "$chapterName" },
          isPremium: { $first: "$isPremium" },
          termNumber: { $first: "$termNumber" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const premiumStatus = await checkUserPremium(req.user?.username);

    res.render("chapters", {
      chapters,
      subjectSlug,
      subjectName: subject.name,
      isAuthenticated: req.isAuthenticated,
      hasPremium: premiumStatus.isPremium,
      user: req.user
    });
  } catch (err) {
    console.error("❌ Chapters error:", err);
    res.render("chapters", {
      chapters: [], subjectSlug, subjectName: subject.name,
      isAuthenticated: false, hasPremium: false, user: null
    });
  }
});

app.get("/chapters/:subjectSlug/chapter/:chapterId", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const chapterId = parseInt(req.params.chapterId);
  const subject = getSubject(subjectSlug);

  if (!subject || isNaN(chapterId) || chapterId < 0) {
    return res.status(404).render("404");
  }

  try {
    const access = await getUserAccess(req.user?.username);
    const chapterCheck = await Flashcard.findOne({ subjectSlug, chapterIndex: chapterId });

    if (!chapterCheck) return res.status(404).render("404");

    const termNumber = chapterCheck.termNumber || 1;
    const allowed =
      !chapterCheck.isPremium ||
      access.isAdmin ||
      (access.user && access.user.canAccessTerm(termNumber));

    if (!allowed) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { message: "Login required to access this chapter", username: null });
      }
      return res.render("premiumrequired", {
        message: `Your current plan doesn't cover Term ${termNumber}. Pick a plan that includes it.`,
        username: req.user.username,
      });
    }

    const topics = await Flashcard.aggregate([
      { $match: { subjectSlug, chapterIndex: chapterId } },
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
      chapterId, topics, subjectSlug, subjectName: subject.name,
      isAuthenticated: req.isAuthenticated, hasPremium: access.isPremium, user: req.user
    });
  } catch (err) {
    console.error("❌ Topic fetch error:", err);
    res.render("topics", {
      chapterId, topics: [], subjectSlug, subjectName: subject.name,
      isAuthenticated: false, hasPremium: false, user: null
    });
  }
});

app.get("/chapters/:subjectSlug/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);
  const subject = getSubject(subjectSlug);

  if (!subject || isNaN(chapterId) || isNaN(topicId)) {
    return res.status(404).render("404");
  }

  try {
    const access = await getUserAccess(req.user?.username);
    const topicCheck = await Flashcard.findOne({ subjectSlug, chapterIndex: chapterId, topicIndex: topicId });

    if (!topicCheck) return res.status(404).render("404");

    const termNumber = topicCheck.termNumber || 1;
    const allowed =
      !topicCheck.isPremium ||
      access.isAdmin ||
      (access.user && access.user.canAccessTerm(termNumber));

    if (!allowed) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { message: "Login required to access this topic", username: null });
      }
      return res.render("premiumrequired", {
        message: `Your current plan doesn't cover Term ${termNumber}. Pick a plan that includes it.`,
        username: req.user.username,
      });
    }

    const flashcards = await Flashcard.find({
      subjectSlug, chapterIndex: chapterId, topicIndex: topicId
    }).sort({ flashcardIndex: 1 });

    let fullUser = null;
    if (req.user?.username) {
      fullUser = await User.findOne({ username: req.user.username }).select('username email');
    }

    res.render("flashcards", {
      chapterId, topicId, subjectSlug, flashcards,
      isAuthenticated: req.isAuthenticated, hasPremium: access.isPremium,
      user: req.user, fullUser
    });
  } catch (err) {
    console.error("❌ Flashcard fetch error:", err);
    res.render("flashcards", {
      chapterId, topicId, subjectSlug: subjectSlug || '', flashcards: [],
      isAuthenticated: false, hasPremium: false, user: null, fullUser: null
    });
  }
});

// --------- 9. NOTES ROUTES (Subject-based) ---------

app.get("/notes", optionalAuth, async (req, res) => {
  const premiumStatus = await checkUserPremium(req.user?.username);
  res.render("subjects", {
    type: "notes",
    subjects: getAllSubjects(),
    isAuthenticated: req.isAuthenticated,
    hasPremium: premiumStatus.isPremium,
    user: req.user
  });
});

app.get("/notes/:subjectSlug", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const subject = getSubject(subjectSlug);
  if (!subject) return res.status(404).render("404");

  try {
    const chapters = await Note.aggregate([
      { $match: { subjectSlug } },
      {
        $group: {
          _id: "$chapterIndex",
          chapterName: { $first: "$chapterName" },
          isPremium: { $first: "$isPremium" },
          termNumber: { $first: "$termNumber" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const premiumStatus = await checkUserPremium(req.user?.username);

    res.render("note-chapters", {
      chapters, subjectSlug, subjectName: subject.name,
      isAuthenticated: req.isAuthenticated, hasPremium: premiumStatus.isPremium, user: req.user
    });
  } catch (err) {
    console.error("❌ Note chapters error:", err);
    res.render("note-chapters", {
      chapters: [], subjectSlug, subjectName: subject.name,
      isAuthenticated: false, hasPremium: false, user: null
    });
  }
});

app.get("/notes/:subjectSlug/chapter/:chapterId", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const chapterId = parseInt(req.params.chapterId);
  const subject = getSubject(subjectSlug);

  if (!subject || isNaN(chapterId) || chapterId < 0) {
    return res.status(404).render("404");
  }

  try {
    const access = await getUserAccess(req.user?.username);
    const chapterCheck = await Note.findOne({ subjectSlug, chapterIndex: chapterId });

    if (!chapterCheck) return res.status(404).render("404");

    const termNumber = chapterCheck.termNumber || 1;
    const allowed =
      !chapterCheck.isPremium ||
      access.isAdmin ||
      (access.user && access.user.canAccessTerm(termNumber));

    if (!allowed) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { message: "Login required to access this chapter", username: null });
      }
      return res.render("premiumrequired", {
        message: `Your current plan doesn't cover Term ${termNumber}. Pick a plan that includes it.`,
        username: req.user.username,
      });
    }

    const topics = await Note.aggregate([
      { $match: { subjectSlug, chapterIndex: chapterId } },
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
      chapterId, topics, subjectSlug, subjectName: subject.name,
      isAuthenticated: req.isAuthenticated, hasPremium: access.isPremium, user: req.user
    });
  } catch (err) {
    console.error("❌ Note topics error:", err);
    res.render("note-topics", {
      chapterId, topics: [], subjectSlug, subjectName: subject.name,
      isAuthenticated: false, hasPremium: false, user: null
    });
  }
});

app.get("/notes/:subjectSlug/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const subjectSlug = req.params.subjectSlug;
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);
  const subject = getSubject(subjectSlug);

  if (!subject || isNaN(chapterId) || isNaN(topicId)) {
    return res.status(404).render("404");
  }

  try {
    const access = await getUserAccess(req.user?.username);
    const note = await Note.findOne({ subjectSlug, chapterIndex: chapterId, topicIndex: topicId });

    if (!note) return res.status(404).render("404");

    const termNumber = note.termNumber || 1;
    const allowed =
      !note.isPremium ||
      access.isAdmin ||
      (access.user && access.user.canAccessTerm(termNumber));

    if (!allowed) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { message: "Login required to access this note", username: null });
      }
      return res.render("premiumrequired", {
        message: `Your current plan doesn't cover Term ${termNumber}. Pick a plan that includes it.`,
        username: req.user.username,
      });
    }

    let fullUser = null;
    if (req.user?.username) {
      fullUser = await User.findOne({ username: req.user.username }).select('username email');
    }

    res.render("note-view", {
      note, isAuthenticated: req.isAuthenticated, hasPremium: access.isPremium,
      user: req.user, fullUser
    });
  } catch (err) {
    console.error("❌ Note view error:", err);
    res.status(404).render("404");
  }
});

// --------- 10. ERROR HANDLING ---------
app.use((req, res) => {
  res.status(404).render("404");
});

app.use((err, req, res, next) => {
  console.error("⚠️ Unhandled error:", err);
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
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${port}`);
});
