const mongoose = require("mongoose");

module.exports = (connection) => {
  const flashcardSchema = new mongoose.Schema({
    chapterIndex: Number,
    chapterName: String,
    topicIndex: Number,
    topicName: String,
    flashcardIndex: Number,
    question: String,
    answer: String,
    isPremium: { type: Boolean, default: false } // ✅ NEW: Premium flag
  }, { collection: "flashcard" });

  return connection.model("Flashcard", flashcardSchema);
};
