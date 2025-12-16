const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

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
  if (!username) return false;
  try {
    const user = await User.findOne({ username });
    if (!user) return false;
    
    return user.role === "admin" || 
      (user.subscriptionStatus === "premium" && 
       (!user.subscriptionExpiry || user.subscriptionExpiry > new Date()));
  } catch (err) {
    console.error("Error checking premium status:", err);
    return false;
  }
}

// --------- 5. AUTH MIDDLEWARE ---------
function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      req.user = null;
      req.isAuthenticated = false;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.jwtkey);
    req.user = decoded;
    req.isAuthenticated = true;
  } catch (err) {
    req.user = null;
    req.isAuthenticated = false;
  }
  next();
}

function checkAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.render("accessdenied");
    }
    
    const decoded = jwt.verify(token, process.env.jwtkey);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
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

// ✅ HOME PAGE
app.get("/", optionalAuth, async (req, res) => {
  try {
    const hasPremium = await checkUserPremium(req.user?.username);

    res.render("home", { 
      isAuthenticated: req.isAuthenticated,
      hasPremium,
      user: req.user 
    });
  } catch (err) {
    console.error("❌ Home page error:", err);
    res.render("home", { 
      isAuthenticated: false, 
      hasPremium: false,
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

// Login handler
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
      return res.status(401).json({ 
        success: false, 
        message: "Wrong username or password" 
      });
    }

    const token = jwt.sign(
      { username, role: user.role, subscriptionStatus: user.subscriptionStatus },
      process.env.jwtkey,
      { expiresIn: "528h" }
    );

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie("token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      maxAge: 22 * 24 * 60 * 60 * 1000
    });
    
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "An error occurred during login" 
    });
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
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

app.post("/create-free-session", async (req, res) => {
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

    const token = jwt.sign(
      { 
        username: user.username, 
        role: user.role, 
        subscriptionStatus: user.subscriptionStatus 
      },
      process.env.jwtkey,
      { expiresIn: "720h" }
    );

    const isProduction = process.env.NODE_ENV === 'production';

    res.json({
      success: true,
      token: token,
      cookieOptions: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000
      }
    });

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

    const hasPremium = await checkUserPremium(user.username);

    res.render("profile", { 
      user,
      hasPremium,
      isAuthenticated: true 
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.redirect("/");
  }
});

// Payment routes
const paymentRoutes = require("./routes/payment")(User);
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

    const hasPremium = await checkUserPremium(req.user?.username);

    res.render("chapters", { 
      chapters, 
      isAuthenticated: req.isAuthenticated,
      hasPremium,
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

// ✅ FIXED: Topics route with proper premium handling
app.get("/chapter/:id", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  
  if (isNaN(chapterId) || chapterId < 0) {
    return res.status(400).render("404");
  }
  
  try {
    // Check if user has premium access FIRST
    const hasPremium = await checkUserPremium(req.user?.username);
    
    // Check chapter premium status
    const chapterCheck = await Flashcard.findOne({ chapterIndex: chapterId });
    
    if (!chapterCheck) {
      return res.status(404).render("404");
    }
    
    // If chapter is premium and user doesn't have premium, block access
    if (chapterCheck.isPremium && !hasPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this chapter" 
      });
    }

    // Fetch all topics for this chapter (with premium status)
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

    // Pass ALL required data to template
    res.render("topics", { 
      chapterId, 
      topics,
      isAuthenticated: req.isAuthenticated,
      hasPremium,
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

// ✅ FIXED: Flashcards route with proper premium handling
app.get("/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  if (isNaN(chapterId) || isNaN(topicId) || chapterId < 0 || topicId < 0) {
    return res.status(400).render("404");
  }

  try {
    // Check if user has premium access
    const hasPremium = await checkUserPremium(req.user?.username);
    
    // Check topic premium status
    const topicCheck = await Flashcard.findOne({ 
      chapterIndex: chapterId, 
      topicIndex: topicId 
    });
    
    if (!topicCheck) {
      return res.status(404).render("404");
    }
    
    // If topic is premium and user doesn't have premium
    if (topicCheck.isPremium && !hasPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this topic" 
      });
    }

    // Fetch flashcards for this topic
    const flashcards = await Flashcard.find({
      chapterIndex: chapterId,
      topicIndex: topicId
    }).sort({ flashcardIndex: 1 });

    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards,
      isAuthenticated: req.isAuthenticated,
      hasPremium,
      user: req.user
    });
  } catch (err) {
    console.error("❌ Flashcard fetch error:", err);
    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards: [],
      isAuthenticated: false,
      hasPremium: false,
      user: null
    });
  }
});

// --------- 9. NOTES ROUTES ---------

// Notes chapters list
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

    const hasPremium = await checkUserPremium(req.user?.username);

    res.render("note-chapters", { 
      chapters, 
      isAuthenticated: req.isAuthenticated,
      hasPremium,
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

// Topics in a note chapter
app.get("/notes/chapter/:id", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  
  if (isNaN(chapterId) || chapterId < 0) {
    return res.status(400).render("404");
  }
  
  try {
    // Check premium status FIRST
    const hasPremium = await checkUserPremium(req.user?.username);
    
    const chapterCheck = await Note.findOne({ chapterIndex: chapterId });
    
    if (!chapterCheck) {
      return res.status(404).render("404");
    }
    
    // Block premium chapters for non-premium users
    if (chapterCheck.isPremium && !hasPremium) {
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

    // Pass ALL required data
    res.render("note-topics", { 
      chapterId, 
      topics,
      isAuthenticated: req.isAuthenticated,
      hasPremium,
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

// Display the actual note
app.get("/notes/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  if (isNaN(chapterId) || isNaN(topicId) || chapterId < 0 || topicId < 0) {
    return res.status(400).render("404");
  }

  try {
    const hasPremium = await checkUserPremium(req.user?.username);
    
    const note = await Note.findOne({ 
      chapterIndex: chapterId, 
      topicIndex: topicId 
    });
    
    if (!note) {
      return res.status(404).render("404");
    }
    
    if (note.isPremium && !hasPremium) {
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }
      return res.render("premiumrequired", { 
        message: "Upgrade to premium to access this note" 
      });
    }

    res.render("note-view", { 
      note,
      isAuthenticated: req.isAuthenticated,
      hasPremium,
      user: req.user
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