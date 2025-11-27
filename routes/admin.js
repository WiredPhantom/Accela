module.exports = (User, Flashcard, Note) => {
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

      // Get note chapters for admin
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
        noteTopics 
      });

    } catch (err) {
      console.error("❌ Aggregate error:", err);
      res.render("admin", { 
        chapters: [], 
        topics: [], 
        users: [], 
        noteChapters: [], 
        noteTopics: [] 
      });
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

  // Get all notes
  router.get('/notes', async (req, res) => {
    try {
      const notes = await Note.find().sort({ chapterIndex: 1, topicIndex: 1 });
      res.json(notes);
    } catch (err) {
      console.error("❌ Error fetching notes:", err);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Get single note
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

  // Add new note
  router.post("/add-note", async (req, res) => {
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
      // Handle chapter selection/creation
      if (newChapterName?.trim()) {
        chapterIndex = +newChapterIndex;
        chapterName = newChapterName.trim();
      } else {
        chapterIndex = +chapterIndex;
      }

      // Handle topic selection/creation
      if (newTopicName?.trim()) {
        topicIndex = +newTopicIndex;
        topicName = newTopicName.trim();
      } else {
        topicIndex = +topicIndex;
      }

      if (!chapterName || !topicName || !noteTitle || !htmlContent) {
        throw new Error("Missing required fields");
      }

      // Check if note already exists for this chapter/topic
      const existingNote = await Note.findOne({
        chapterIndex,
        topicIndex
      });

      if (existingNote) {
        throw new Error("A note already exists for this chapter/topic combination");
      }

      const newNote = new Note({
        chapterIndex,
        chapterName,
        topicIndex,
        topicName,
        noteTitle,
        htmlContent,
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true
      });

      await newNote.save();
      res.redirect("/admin");
    } catch (err) {
      console.error("❌ Error adding note:", err.message);
      res.status(500).send("Failed to add note: " + err.message);
    }
  });

  // Edit note
  router.post("/edit-note", async (req, res) => {
    const { noteId, noteTitle, htmlContent, isPremium } = req.body;
    
    try {
      await Note.findByIdAndUpdate(noteId, {
        noteTitle,
        htmlContent,
        isPremium: isPremium === 'on' || isPremium === 'true' || isPremium === true,
        updatedAt: new Date()
      });
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error editing note:", err);
      res.status(500).json({ error: "Failed to edit note" });
    }
  });

  // Delete note
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

  // Toggle note chapter premium
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

  // Toggle note topic premium
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
