const mongoose = require("mongoose");

module.exports = (connection) => {
  const noteSchema = new mongoose.Schema({
    subject: { type: String, default: 'kulliyat-advia' },
    subjectSlug: { type: String, default: 'kulliyat-advia' },
    termNumber: { type: Number, default: 1 },
    chapterIndex: { type: Number, required: true },
    chapterName: { type: String, required: true },
    topicIndex: { type: Number, required: true },
    topicName: { type: String, required: true },
    noteTitle: { type: String, required: true },
    htmlContent: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { collection: "notes" });

  return connection.model("Note", noteSchema);
};
