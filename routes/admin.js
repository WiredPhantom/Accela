module.exports = (User, Flashcard) => {
  const router = require('express').Router();
  const bcrypt = require("bcrypt");

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
      
      const users = await User.find({}, { password: 0 });

      res.render("admin", { chapters, topics, users });

    } catch (err) {
      console.error("âŒ Aggregate error:", err);
      res.render("admin", { chapters: [], topics: [], users: []});
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
      console.error("âŒ Error fetching flashcards:", err);
      res.status(500).json({ error: "Failed to fetch flashcards" });
    }
  });

  // ==================== PREMIUM MANAGEMENT ROUTES ====================
  
  // Toggle premium status for chapter (WITH DEBUG LOGS)
  router.post("/toggle-chapter-premium", async (req, res) => {
    console.log("=".repeat(50));
    console.log("ðŸ“¥ TOGGLE CHAPTER PREMIUM REQUEST");
    console.log("=".repeat(50));
    console.log("Request body:", req.body);
    
    const { chapterIndex, isPremium } = req.body;
    
    console.log("Chapter Index:", chapterIndex, "| Type:", typeof chapterIndex);
    console.log("isPremium value:", isPremium, "| Type:", typeof isPremium);
    
    try {
      // Convert to boolean properly - handles both string and boolean
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      console.log("âœ… Converted premium value:", premiumValue, "| Type:", typeof premiumValue);
      
      // Find how many flashcards will be affected
      const count = await Flashcard.countDocuments({ 
        chapterIndex: parseInt(chapterIndex) 
      });
      console.log(`ðŸ“Š Found ${count} flashcards in chapter ${chapterIndex}`);
      
      if (count === 0) {
        console.log("âš ï¸ WARNING: No flashcards found for this chapter!");
        return res.json({ 
          success: false, 
          error: "No flashcards found for this chapter",
          modifiedCount: 0 
        });
      }
      
      // Perform the update
      const result = await Flashcard.updateMany(
        { chapterIndex: parseInt(chapterIndex) },
        { $set: { isPremium: premiumValue } }
      );
      
      console.log("âœ… MongoDB Update Result:");
      console.log("   - Acknowledged:", result.acknowledged);
      console.log("   - Matched Count:", result.matchedCount);
      console.log("   - Modified Count:", result.modifiedCount);
      console.log("=".repeat(50));
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
      
    } catch (err) {
      console.error("âŒ ERROR in toggle-chapter-premium:");
      console.error(err);
      console.log("=".repeat(50));
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  // Toggle premium status for topic (WITH DEBUG LOGS)
  router.post("/toggle-topic-premium", async (req, res) => {
    console.log("=".repeat(50));
    console.log("ðŸ“¥ TOGGLE TOPIC PREMIUM REQUEST");
    console.log("=".repeat(50));
    console.log("Request body:", req.body);
    
    const { chapterIndex, topicIndex, isPremium } = req.body;
    
    console.log("Chapter Index:", chapterIndex, "| Type:", typeof chapterIndex);
    console.log("Topic Index:", topicIndex, "| Type:", typeof topicIndex);
    console.log("isPremium value:", isPremium, "| Type:", typeof isPremium);
    
    try {
      // Convert to boolean properly
      let premiumValue;
      if (typeof isPremium === 'boolean') {
        premiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        premiumValue = isPremium === 'true';
      } else {
        premiumValue = Boolean(isPremium);
      }
      
      console.log("âœ… Converted premium value:", premiumValue, "| Type:", typeof premiumValue);
      
      // Find how many flashcards will be affected
      const count = await Flashcard.countDocuments({ 
        chapterIndex: parseInt(chapterIndex),
        topicIndex: parseInt(topicIndex)
      });
      console.log(`ðŸ“Š Found ${count} flashcards in chapter ${chapterIndex}, topic ${topicIndex}`);
      
      if (count === 0) {
        console.log("âš ï¸ WARNING: No flashcards found for this topic!");
        return res.json({ 
          success: false, 
          error: "No flashcards found for this topic",
          modifiedCount: 0 
        });
      }
      
      // Perform the update
      const result = await Flashcard.updateMany(
        { 
          chapterIndex: parseInt(chapterIndex),
          topicIndex: parseInt(topicIndex)
        },
        { $set: { isPremium: premiumValue } }
      );
      
      console.log("âœ… MongoDB Update Result:");
      console.log("   - Acknowledged:", result.acknowledged);
      console.log("   - Matched Count:", result.matchedCount);
      console.log("   - Modified Count:", result.modifiedCount);
      console.log("=".repeat(50));
      
      res.json({ 
        success: true, 
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
      
    } catch (err) {
      console.error("âŒ ERROR in toggle-topic-premium:");
      console.error(err);
      console.log("=".repeat(50));
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  // Update user subscription
  router.post("/update-subscription", async (req, res) => {
    console.log("ðŸ“¥ Update subscription request received");
    console.log("Body:", req.body);
    
    const { userId, subscriptionStatus, subscriptionExpiry } = req.body;
    
    try {
      const updateData = { subscriptionStatus };
      
      if (subscriptionExpiry && subscriptionExpiry.trim()) {
        updateData.subscriptionExpiry = new Date(subscriptionExpiry);
        console.log("Setting expiry:", updateData.subscriptionExpiry);
      } else if (subscriptionStatus === 'free') {
        // Clear expiry if downgrading to free
        updateData.subscriptionExpiry = null;
        console.log("Clearing expiry (free user)");
      }
      // If premium with no expiry, don't set expiry (lifetime)
      
      console.log("Update data:", updateData);
      
      const result = await User.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true }
      );
      
      console.log("âœ… Update result:", result);
      
      res.redirect("/admin");
    } catch (err) {
      console.error("âŒ Error updating subscription:", err);
      res.status(500).send("Failed to update subscription: " + err.message);
    }
  });

  // ==================== CHAPTER MANAGEMENT ====================

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
      console.error("âŒ Error deleting chapter:", err);
      res.status(500).send("Failed to delete chapter");
    }
  });

  // ==================== TOPIC MANAGEMENT ====================

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
      console.error("âŒ Error editing flashcard:", err);
      res.status(500).json({ error: "Failed to edit flashcard" });
    }
  });

  router.post("/delete-flashcard", async (req, res) => {
    const { flashcardId } = req.body;
    try {
      await Flashcard.findByIdAndDelete(flashcardId);
      res.json({ success: true });
    } catch (err) {
      console.error("âŒ Error deleting flashcard:", err);
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
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
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
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
      }));

      await Flashcard.insertMany(flashcards);
      res.redirect("/admin");
    } catch (err) {
      console.error("âŒ Upload Error:", err.message);
      res.status(400).send("âŒ " + err.message);
    }
  });

  // ==================== USER MANAGEMENT ====================

  router.post("/delete-user", async (req, res) => {
    try {
      await User.deleteOne({ userId: req.body.userId });
      res.redirect("/admin");
    } catch (err) {
      console.error("âŒ Error deleting user:", err);
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
      console.error("âŒ Error adding user:", err);
      res.status(500).send("Failed to add user");
    }
  });

  return router;
};
