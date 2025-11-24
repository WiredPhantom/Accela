const mongoose = require("mongoose");

module.exports = (connection) => {
  const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    subscriptionStatus: { type: String, enum: ["free", "premium"], default: "free" }, // ✅ NEW
    subscriptionExpiry: { type: Date } // ✅ NEW: For tracking premium expiry
  }, { collection: "practicecollection" });

  return connection.model("User", userSchema);
};
