module.exports = (User, Flashcard) => {
  const router = require('express').Router();
  const bcrypt = require("bcrypt");

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
      
      const users = await User.find({}, { password: 0 });

      res.render("admin", { chapters, topics, users });

    } catch (err) {
      console.error("❌ Aggregate error:", err);
      res.render("admin", { chapters: [], topics: null, users: []});
    }
  });

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

  // ✅ NEW: Toggle premium status for chapter
  router.post("/toggle-chapter-premium", async (req, res) => {
    const { chapterIndex, isPremium } = req.body;
    try {
      await Flashcard.updateMany(
        { chapterIndex: parseInt(chapterIndex) },
        { $set: { isPremium: isPremium === 'true' } }
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error toggling chapter premium:", err);
      res.status(500).json({ error: "Failed to toggle premium status" });
    }
  });

  // ✅ NEW: Toggle premium status for topic
  router.post("/toggle-topic-premium", async (req, res) => {
    const { chapterIndex, topicIndex, isPremium } = req.body;
    try {
      await Flashcard.updateMany(
        { 
          chapterIndex: parseInt(chapterIndex),
          topicIndex: parseInt(topicIndex)
        },
        { $set: { isPremium: isPremium === 'true' } }
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error toggling topic premium:", err);
      res.status(500).json({ error: "Failed to toggle premium status" });
    }
  });

  // ✅ NEW: Update user subscription
  router.post("/update-subscription", async (req, res) => {
    const { userId, subscriptionStatus, subscriptionExpiry } = req.body;
    try {
      const updateData = { subscriptionStatus };
      
      if (subscriptionExpiry) {
        updateData.subscriptionExpiry = new Date(subscriptionExpiry);
      }
      
      await User.findOneAndUpdate(
        { userId },
        { $set: updateData }
      );
      
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error updating subscription:", err);
      res.status(500).send("Failed to update subscription");
    }
  });

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
        topicIndex = +newTopicIndex;
        topicName = newTopicName.trim();
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName) throw new Error("Missing chapter or topic name");

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
        isPremium: isPremium === 'on' || isPremium === 'true'
      });

      await newFlashcard.save();
      res.redirect("/admin");
    } catch (err) {
      console.error("Error adding flashcard:", err.message);
      res.status(500).send("Failed to add flashcard");
    }
  });

  router.post("/bulk-upload", async (req, res) => {
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
      if (newChapterName?.trim()) {
        chapterIndex = +newChapterIndex;
        chapterName = newChapterName.trim();
      } else {
        chapterIndex = +chapterIndex;
      }

      if (newTopicName?.trim()) {
        topicIndex = +newTopicIndex;
        topicName = newTopicName.trim();
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName) throw new Error("Chapter or topic name missing.");
      if (!jsonData || !jsonData.trim()) throw new Error("JSON data is required.");

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
        isPremium: isPremium === 'on' || isPremium === 'true'
      }));

      await Flashcard.insertMany(flashcards);
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Upload Error:", err.message);
      res.status(400).send("❌ " + err.message);
    }
  });

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
    const { userId, username, password, role, subscriptionStatus } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        userId,
        username,
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
