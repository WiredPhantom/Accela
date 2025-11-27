const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// --------- 1. MIDDLEWARE ---------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");

// --------- 2. MONGOOSE MULTI-CONNECTION SETUP ---------
const useruri = process.env.useruri;
const flashcarduri = process.env.flashcarduri;

const userConnection = mongoose.createConnection(useruri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
const flashcardConnection = mongoose.createConnection(flashcarduri, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

userConnection.on("connected", () => console.log("✅ User DB connected"));
flashcardConnection.on("connected", () => console.log("✅ Flashcard DB connected"));
userConnection.on("error", err => console.error("❌ User DB Error:", err));
flashcardConnection.on("error", err => console.error("❌ Flashcard DB Error:", err));

// --------- 3. LOAD MODELS ---------
const getUserModel = require("./models/user");
const getFlashcardModel = require("./models/flashcard");

const User = getUserModel(userConnection);
const Flashcard = getFlashcardModel(flashcardConnection);

// --------- 4. AUTH MIDDLEWARE ---------
// ✅ Optional auth - doesn't block if not logged in
function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.jwtkey);
    req.user = decoded;
    req.isAuthenticated = true;
  } catch (err) {
    req.user = null;
    req.isAuthenticated = false;
  }
  next();
}

// ✅ Required auth for admin/logged-in routes
function checkAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.jwtkey);
    req.user = decoded;
    next();
  } catch (err) {
    res.render("accessdenied");
  }
}

function checkRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.render("unauthorized");
    }
    next();
  };
}

// ✅ Check if user has premium access
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

    // Check if user is admin (admins have full access)
    if (user.role === "admin") {
      req.hasPremium = true;
      return next();
    }

    // Check premium status
    if (user.subscriptionStatus === "premium") {
      // Check if subscription is still valid
      if (user.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
        req.hasPremium = true;
        return next();
      } else if (!user.subscriptionExpiry) {
        // Lifetime premium (no expiry set)
        req.hasPremium = true;
        return next();
      }
    }

    // No premium access
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

// --------- 5. ADMIN ROUTES ---------
const adminRoutes = require("./routes/admin")(User, Flashcard);
app.use("/admin", checkAuth, checkRole("admin"), adminRoutes);

// --------- 6. MAIN ROUTES ---------

// ✅ NEW HOME PAGE (Root)
app.get("/", optionalAuth, async (req, res) => {
  try {
    // Get user's premium status if logged in
    let hasPremium = false;
    if (req.isAuthenticated) {
      const user = await User.findOne({ username: req.user.username });
      if (user && (user.role === "admin" || 
          (user.subscriptionStatus === "premium" && 
           (!user.subscriptionExpiry || user.subscriptionExpiry > new Date())))) {
        hasPremium = true;
      }
    }

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
    const decoded = jwt.verify(token, process.env.jwtkey);
    if (decoded) return res.redirect("/");
  } catch {}
  res.render("login");
});

// Login handler
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.render("accessdenied");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.render("accessdenied");

    const token = jwt.sign(
      { username, role: user.role, subscriptionStatus: user.subscriptionStatus },
      process.env.jwtkey,
      { expiresIn: "528h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 22 * 24 * 60 * 60 * 1000
    });
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.render("accessdenied");
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// --------- 7. FLASHCARD ROUTES (PUBLIC + PREMIUM) ---------

// ✅ Chapters list - PUBLIC (shows all chapters with lock icons on premium ones)
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

    // Get user's premium status
    let hasPremium = false;
    if (req.isAuthenticated) {
      const user = await User.findOne({ username: req.user.username });
      if (user && (user.role === "admin" || 
          (user.subscriptionStatus === "premium" && 
           (!user.subscriptionExpiry || user.subscriptionExpiry > new Date())))) {
        hasPremium = true;
      }
    }

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

// ✅ Topics in a chapter - Check if chapter is premium
app.get("/chapter/:id", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  
  try {
    // Check if chapter is premium
    const chapterCheck = await Flashcard.findOne({ chapterIndex: chapterId });
    
    if (chapterCheck && chapterCheck.isPremium) {
      // Premium chapter - check access
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }

      const user = await User.findOne({ username: req.user.username });
      const hasPremium = user && (user.role === "admin" || 
        (user.subscriptionStatus === "premium" && 
         (!user.subscriptionExpiry || user.subscriptionExpiry > new Date())));

      if (!hasPremium) {
        return res.render("premiumrequired", { 
          message: "Upgrade to premium to access this chapter" 
        });
      }
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
      isAuthenticated: req.isAuthenticated 
    });
  } catch (err) {
    console.error("❌ Topic fetch error:", err);
    res.render("topics", { 
      chapterId, 
      topics: [],
      isAuthenticated: false 
    });
  }
});

// ✅ Flashcards in a topic - Check if topic is premium
app.get("/chapter/:chapterId/topic/:topicId", optionalAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  try {
    // Check if topic is premium
    const topicCheck = await Flashcard.findOne({ 
      chapterIndex: chapterId, 
      topicIndex: topicId 
    });
    
    if (topicCheck && topicCheck.isPremium) {
      // Premium topic - check access
      if (!req.isAuthenticated) {
        return res.render("premiumrequired", { 
          message: "Login required to access premium content" 
        });
      }

      const user = await User.findOne({ username: req.user.username });
      const hasPremium = user && (user.role === "admin" || 
        (user.subscriptionStatus === "premium" && 
         (!user.subscriptionExpiry || user.subscriptionExpiry > new Date())));

      if (!hasPremium) {
        return res.render("premiumrequired", { 
          message: "Upgrade to premium to access this topic" 
        });
      }
    }

    const flashcards = await Flashcard.find({
      chapterIndex: chapterId,
      topicIndex: topicId
    }).sort({ flashcardIndex: 1 });

    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards,
      isAuthenticated: req.isAuthenticated 
    });
  } catch (err) {
    console.error("❌ Flashcard fetch error:", err);
    res.render("flashcards", { 
      chapterId, 
      topicId, 
      flashcards: [],
      isAuthenticated: false 
    });
  }
});

// --------- 8. ERROR HANDLING ---------
app.use((req, res) => {
  res.status(404).render("404");
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);
  res.render("404");
});

// --------- 9. START SERVER ---------
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Server accessible at http://0.0.0.0:${port}`);
});
