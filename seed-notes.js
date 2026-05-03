require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const uri = process.env.noteuri || process.env.flashcarduri;

if (!uri) {
  console.error("❌ No DB URI found. Set flashcarduri or noteuri in environment.");
  process.exit(1);
}

const conn = mongoose.createConnection(uri, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
});

const noteSchema = new mongoose.Schema({
  chapterIndex: { type: Number, required: true },
  chapterName:  { type: String, required: true },
  topicIndex:   { type: Number, required: true },
  topicName:    { type: String, required: true },
  noteTitle:    { type: String, required: true },
  htmlContent:  { type: String, required: true },
  isPremium:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
}, { collection: "notes" });

const A = "attached_assets";

const notes = [
  {
    chapterIndex: 10,
    chapterName:  "عہد تغلق",
    topicIndex:   1,
    topicName:    "ضیاء محمد مسعود رشید زنگی",
    noteTitle:    "ضیاء محمد مسعود رشید زنگی",
    file:         "Zia_Mohammed_1777798364645.html",
    isPremium:    false,
  },
  {
    chapterIndex: 11,
    chapterName:  "عہد لودھی",
    topicIndex:   1,
    topicName:    "بہوہ بن خواص خان",
    noteTitle:    "بہوہ بن خواص خان",
    file:         "behwa_bin_kHawas_1777798364827.html",
    isPremium:    false,
  },
  {
    chapterIndex: 13,
    chapterName:  "قطب شاہی دور",
    topicIndex:   1,
    topicName:    "حکیم میر مومن",
    noteTitle:    "حکیم میر مومن",
    file:         "mir_momin_1777798364795.html",
    isPremium:    false,
  },
  {
    chapterIndex: 13,
    chapterName:  "قطب شاہی دور",
    topicIndex:   2,
    topicName:    "حکیم الملک نظام الدین گیلانی",
    noteTitle:    "حکیم نظام الدین احمد گیلانی",
    file:         "Ahmed_Gilani_1777798364860.html",
    isPremium:    false,
  },
  {
    chapterIndex: 14,
    chapterName:  "نظام شاہی دور",
    topicIndex:   1,
    topicName:    "رستم جرجانی",
    noteTitle:    "رستم جرجانی",
    file:         "Rustum_jurjane_1777798364779.html",
    isPremium:    false,
  },
  {
    chapterIndex: 14,
    chapterName:  "نظام شاہی دور",
    topicIndex:   2,
    topicName:    "حکیم ولی گیلانی",
    noteTitle:    "حکیم ولی گیلانی",
    file:         "wali_Gilani_1777798364715.html",
    isPremium:    false,
  },
  {
    chapterIndex: 15,
    chapterName:  "عادل شاہی دور",
    topicIndex:   1,
    topicName:    "ابو القاسم فرشتہ",
    noteTitle:    "ابوالقاسم فرشتہ",
    file:         "Abul_Qasim_farishta_1777797603367.html",
    isPremium:    false,
  },
  {
    chapterIndex: 16,
    chapterName:  "آصف جاہی دور",
    topicIndex:   1,
    topicName:    "حکیم رضا علی خان",
    noteTitle:    "حکیم رضا علی خاں",
    file:         "Raza_Ali_Khan_1777798364809.html",
    isPremium:    false,
  },
  {
    chapterIndex: 16,
    chapterName:  "آصف جاہی دور",
    topicIndex:   2,
    topicName:    "حکیم شفائی خان",
    noteTitle:    "حکیم شفائی خاں",
    file:         "Shifai_Khan_1777798364739.html",
    isPremium:    false,
  },
  {
    chapterIndex: 17,
    chapterName:  "گجرات کا مشہور طبیب",
    topicIndex:   1,
    topicName:    "شہاب عبدالکریم ناگوری",
    noteTitle:    "شہاب عبدالکریم ناگوری",
    file:         "Shahab_Abdul_Karim_Nagori_1777798364760.html",
    isPremium:    false,
  },
];

conn.on("connected", async () => {
  console.log("✅ Connected to Notes DB");
  const Note = conn.model("Note", noteSchema);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const n of notes) {
    const filePath = path.join(A, n.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      failed++;
      continue;
    }

    const htmlContent = fs.readFileSync(filePath, "utf-8");

    const existing = await Note.findOne({
      chapterIndex: n.chapterIndex,
      topicIndex:   n.topicIndex,
    });

    if (existing) {
      console.log(`⚠️  Skipped (already exists): Ch${n.chapterIndex}/T${n.topicIndex} — ${n.noteTitle}`);
      skipped++;
      continue;
    }

    try {
      await Note.create({
        chapterIndex: n.chapterIndex,
        chapterName:  n.chapterName,
        topicIndex:   n.topicIndex,
        topicName:    n.topicName,
        noteTitle:    n.noteTitle,
        htmlContent,
        isPremium:    n.isPremium,
      });
      console.log(`✅ Inserted: Ch${n.chapterIndex}/T${n.topicIndex} — ${n.noteTitle}`);
      inserted++;
    } catch (err) {
      console.error(`❌ Failed to insert Ch${n.chapterIndex}/T${n.topicIndex}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Done: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
  await conn.close();
  process.exit(0);
});

conn.on("error", (err) => {
  console.error("❌ DB connection error:", err.message);
  process.exit(1);
});
