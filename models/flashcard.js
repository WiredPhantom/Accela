const mongoose = require("mongoose");

module.exports = (connection) => {
  const flashcardSchema = new mongoose.Schema({
    subject: { type: String, default: 'kulliyat-advia' },
    subjectSlug: { type: String, default: 'kulliyat-advia' },
    termNumber: { type: Number, default: 1 },
    chapterIndex: Number,
    chapterName: String,
    topicIndex: Number,
    topicName: String,
    flashcardIndex: Number,
    question: String,
    answer: String,
    isPremium: { type: Boolean, default: false }
  }, { collection: "flashcard" });

  return connection.model("Flashcard", flashcardSchema);
};
