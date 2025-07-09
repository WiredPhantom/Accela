const mongoose = require("mongoose"); // still needed for Schema

module.exports = (connection) => {
  const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" }
  }, { collection: "practicecollection" });

  return connection.model("User", userSchema);
};
