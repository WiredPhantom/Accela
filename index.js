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

// --------- 5. ADMIN ROUTES ---------
const adminRoutes = require("./routes/admin")(User, Flashcard);
app.use("/admin", checkAuth, checkRole("admin"), adminRoutes);

// --------- 6. MAIN ROUTES ---------

// ✅ Updated: prevent logged-in users from seeing login page again
app.get("/login", (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.jwtkey);
    if (decoded) return res.redirect("/chapters");
  } catch {}
  res.render("login");
});

// Root: redirect based on login status
app.get("/", (req, res) => {
  const token = req.cookies.token;
  try {
    const decoded = jwt.verify(token, process.env.jwtkey);
    req.user = decoded;
    res.redirect("/chapters");
  } catch (err) {
    res.redirect("/login");
  }
});

// ✅ Updated: switch from res.json to res.redirect/render
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.render("accessdenied");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.render("accessdenied");   
const token = jwt.sign(
  { username, role: user.role },
  process.env.jwtkey,
  { expiresIn: "528h" } // JWT valid for 22 days
);

res.cookie("token", token, {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: false,
  maxAge: 22 * 24 * 60 * 60 * 1000 // Cookie valid for 22 days
});
    res.redirect("/chapters");
  } catch (err) {
    console.error("Login error:", err);
    res.render("accessdenied");
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// --------- 7. FLASHCARD ROUTES ---------
app.get("/chapters", checkAuth, async (req, res) => {
  try {
    const chapters = await Flashcard.aggregate([
      {
        $group: {
          _id: "$chapterIndex",
          chapterName: { $first: "$chapterName" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render("chapters", { chapters });
  } catch (err) {
    console.error("❌ Aggregate error:", err);
    res.render("chapters", { chapters: [] });
  }
});

app.get("/chapter/:id", checkAuth, async (req, res) => {
  const chapterId = parseInt(req.params.id);
  try {
    const topics = await Flashcard.aggregate([
      { $match: { chapterIndex: chapterId } },
      {
        $group: {
          _id: "$topicIndex",
          topicName: { $first: "$topicName" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render("topics", { chapterId, topics });
  } catch (err) {
    console.error("❌ Topic fetch error:", err);
    res.render("topics", { chapterId, topics: [] });
  }
});

app.get("/chapter/:chapterId/topic/:topicId", checkAuth, async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const topicId = parseInt(req.params.topicId);

  try {
    const flashcards = await Flashcard.find({
      chapterIndex: chapterId,
      topicIndex: topicId
    }).sort({ flashcardIndex: 1 });

    res.render("flashcards", { chapterId, topicId, flashcards });
  } catch (err) {
    console.error("❌ Flashcard fetch error:", err);
    res.render("flashcards", { chapterId, topicId, flashcards: [] });
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
