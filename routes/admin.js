module.exports = (User, Flashcard) => {
  const router = require('express').Router();


  router.get('/', async (req, res) => {
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

      const topics = await Flashcard.aggregate([
        {
          $group: {
            _id: {
              chapterIndex: "$chapterIndex",
              topicIndex: "$topicIndex"
            },
            chapterName: { $first: "$chapterName" },
            topicName: { $first: "$topicName" }
          }
        },
        { $sort: { "_id.chapterIndex": 1, "_id.topicIndex": 1 } }
      ]);
      const users = await User.find({}, { password: 0 }); // don't expose password

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

  
  router.post("/edit-chapter", async (req, res) => {
    const { oldChapterIndex, newChapterName } = req.body;
      console.log(req.body)
    try {
      const result = await Flashcard.updateMany(
        { chapterIndex: oldChapterIndex },
        { $set: { chapterName: newChapterName } }
      );
console.log(result)
      res.redirect("/admin"); // or res.send("success") if using AJAX

    } catch (err) {
      res.status(500).send("Error updating chapter name");
    }
  });


  router.post("/delete-chapter", async (req, res) => {
    const { chapterIndex } = req.body;

    try {
      await Flashcard.deleteMany({ chapterIndex: parseInt(chapterIndex) });
      res.redirect("/admin"); // or JSON if using AJAX
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
    answer
  } = req.body;
console.log(req.body)
  try {
    // Use new chapter if given
    if (newChapterName?.trim()) {
      chapterIndex = +newChapterIndex;
      chapterName = newChapterName.trim();
    } else {
      chapterIndex = +chapterIndex;
    }

    // Use new topic if given
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
      answer
    });

    await newFlashcard.save();
    res.redirect("/admin");
  } catch (err) {
    console.error("Error adding flashcard:", err.message);
    res.status(500).send("Failed to add flashcard");
  }
});

    





  
      


  
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  let {
    chapterIndex,
    chapterName,
    newChapterIndex,
    newChapterName,
    topicIndex,
    topicName,
    newTopicIndex,
    newTopicName
  } = req.body;
console.log(req.body)
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

    const raw = fs.readFileSync(req.file.path);
    const flashcardsData = JSON.parse(raw);

    const existingCount = await Flashcard.countDocuments({ chapterIndex, topicIndex });

    const flashcards = flashcardsData.map((fc, i) => ({
      chapterIndex,
      chapterName,
      topicIndex,
      topicName,
      flashcardIndex: existingCount + i + 1,
      question: fc.question,
      answer: fc.answer
    }));

    await Flashcard.insertMany(flashcards);
    fs.unlinkSync(req.file.path);
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




  const bcrypt = require("bcrypt");

  router.post("/add-user", async (req, res) => {
    const { userId, username, password, role } = req.body;
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        userId,
        username,
        password: hashedPassword,
        role
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
