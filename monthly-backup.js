require("dotenv").config();
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const DB_URI         = process.env.noteuri || process.env.flashcarduri;
const GITHUB_REPO    = "https://github.com/WiredPhantom/Accela";
const RECIPIENT      = "accela.official@gmail.com";

if (!GMAIL_USER || !GMAIL_PASSWORD) {
  console.error("❌ GMAIL_USER or GMAIL_APP_PASSWORD not set in environment.");
  process.exit(1);
}

if (!DB_URI) {
  console.error("❌ No DB URI found. Set flashcarduri or noteuri in environment.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASSWORD,
  },
});

async function runBackup() {
  const now   = new Date();
  const label = now.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  console.log(`\n📦 Starting monthly backup — ${label}`);

  let conn;
  try {
    conn = await mongoose.createConnection(DB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    }).asPromise();

    const db = conn.db;

    // ── Export all three collections ─────────────────────────────────────
    const [notes, flashcards, chapters] = await Promise.all([
      db.collection("notes").find({}).toArray(),
      db.collection("flashcard").find({}).toArray(),
      db.collection("chapters").find({}).toArray(),
    ]);

    // ── Build stats summary ──────────────────────────────────────────────
    const notesByChapter = {};
    for (const n of notes) {
      const key = `Ch${n.chapterIndex}: ${n.chapterName}`;
      notesByChapter[key] = (notesByChapter[key] || 0) + 1;
    }

    const flashcardsByChapter = {};
    for (const f of flashcards) {
      const key = `Ch${f.chapterIndex}: ${f.chapterName}`;
      flashcardsByChapter[key] = (flashcardsByChapter[key] || 0) + 1;
    }

    const allChapterKeys = Array.from(
      new Set([...Object.keys(notesByChapter), ...Object.keys(flashcardsByChapter)])
    ).sort((a, b) => {
      const ai = parseInt(a.match(/\d+/)?.[0] || "0");
      const bi = parseInt(b.match(/\d+/)?.[0] || "0");
      return ai - bi;
    });

    let statsTable = "";
    let notesTotal = 0;
    let flashcardsTotal = 0;
    for (const key of allChapterKeys) {
      const n = notesByChapter[key]      || 0;
      const f = flashcardsByChapter[key] || 0;
      notesTotal      += n;
      flashcardsTotal += f;
      statsTable += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${key}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${n}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${f}</td>
        </tr>`;
    }

    // ── Write temp JSON files ────────────────────────────────────────────
    const tmpDir = path.join(__dirname, "tmp_backup");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const notesPath      = path.join(tmpDir, "notes.json");
    const flashcardsPath = path.join(tmpDir, "flashcards.json");
    const chaptersPath   = path.join(tmpDir, "chapters.json");

    fs.writeFileSync(notesPath,      JSON.stringify(notes,      null, 2), "utf-8");
    fs.writeFileSync(flashcardsPath, JSON.stringify(flashcards, null, 2), "utf-8");
    fs.writeFileSync(chaptersPath,   JSON.stringify(chapters,   null, 2), "utf-8");

    // ── Email HTML body ──────────────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html dir="ltr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e7e34,#28a745);padding:30px;text-align:center;color:white;">
      <h1 style="margin:0;font-size:24px;">🌿 ACCELA Monthly Backup</h1>
      <p style="margin:8px 0 0;opacity:0.9;">${label}</p>
    </div>

    <div style="padding:30px;">

      <!-- Summary Boxes -->
      <div style="display:flex;gap:15px;margin-bottom:30px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:#e8f5e9;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:bold;color:#1e7e34;">${notesTotal}</div>
          <div style="color:#555;margin-top:5px;">Total Notes</div>
        </div>
        <div style="flex:1;min-width:140px;background:#e3f2fd;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:bold;color:#1565c0;">${flashcardsTotal}</div>
          <div style="color:#555;margin-top:5px;">Total Flashcards</div>
        </div>
        <div style="flex:1;min-width:140px;background:#fff3e0;border-radius:10px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:bold;color:#e65100;">${allChapterKeys.length}</div>
          <div style="color:#555;margin-top:5px;">Chapters with Data</div>
        </div>
      </div>

      <!-- Stats Table -->
      <h2 style="color:#1e7e34;border-bottom:2px solid #e8f5e9;padding-bottom:8px;">📊 Chapter-wise Breakdown</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:10px 12px;text-align:left;color:#333;">Chapter</th>
            <th style="padding:10px 12px;text-align:center;color:#333;">Notes</th>
            <th style="padding:10px 12px;text-align:center;color:#333;">Flashcards</th>
          </tr>
        </thead>
        <tbody>${statsTable}</tbody>
      </table>

      <!-- GitHub Link -->
      <h2 style="color:#1e7e34;border-bottom:2px solid #e8f5e9;padding-bottom:8px;">💻 GitHub Repository</h2>
      <div style="background:#f8f9fa;border-radius:10px;padding:20px;margin-bottom:30px;">
        <p style="margin:0 0 10px;color:#555;">Latest source code is available at:</p>
        <a href="${GITHUB_REPO}" style="color:#1565c0;font-weight:bold;font-size:16px;">${GITHUB_REPO}</a>
        <p style="margin:10px 0 0;color:#888;font-size:13px;">Click the link to view or download the latest code from GitHub.</p>
      </div>

      <!-- Attachments Note -->
      <h2 style="color:#1e7e34;border-bottom:2px solid #e8f5e9;padding-bottom:8px;">📎 Attached Files</h2>
      <ul style="color:#555;line-height:2;">
        <li><strong>notes.json</strong> — All ${notesTotal} notes from the database</li>
        <li><strong>flashcards.json</strong> — All ${flashcardsTotal} flashcards from the database</li>
        <li><strong>chapters.json</strong> — All chapter/topic structure data</li>
      </ul>

      <!-- Footer -->
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#aaa;font-size:12px;">
        This is an automated monthly backup generated on ${label}.<br>
        ACCELA Flashcard App — Auto Backup System
      </div>
    </div>
  </div>
</body>
</html>`;

    // ── Send email ───────────────────────────────────────────────────────
    const info = await transporter.sendMail({
      from:    `"ACCELA Backup" <${GMAIL_USER}>`,
      to:      RECIPIENT,
      subject: `📦 ACCELA Monthly Backup — ${label}`,
      html,
      attachments: [
        { filename: "notes.json",      path: notesPath },
        { filename: "flashcards.json", path: flashcardsPath },
        { filename: "chapters.json",   path: chaptersPath },
      ],
    });

    console.log(`✅ Backup email sent! Message ID: ${info.messageId}`);
    console.log(`   Notes: ${notesTotal} | Flashcards: ${flashcardsTotal}`);

    // ── Cleanup temp files ───────────────────────────────────────────────
    fs.unlinkSync(notesPath);
    fs.unlinkSync(flashcardsPath);
    fs.unlinkSync(chaptersPath);
    fs.rmdirSync(tmpDir);

  } catch (err) {
    console.error("❌ Backup failed:", err.message);
  } finally {
    if (conn) await conn.close();
  }
}

// ── Schedule: 1st of every month at 08:00 AM ────────────────────────────────
// Cron format: second(opt) minute hour day month weekday
// "0 8 1 * *" = at 08:00 on the 1st day of every month
cron.schedule("0 8 1 * *", () => {
  console.log("⏰ Monthly cron triggered — running backup...");
  runBackup();
}, {
  timezone: "Asia/Kolkata",
});

console.log("✅ Monthly backup scheduler started.");
console.log("   Will run at 08:00 AM IST on the 1st of every month.");
console.log("   To test immediately, run:  node monthly-backup.js --now");

// ── Manual trigger: node monthly-backup.js --now ─────────────────────────────
if (process.argv.includes("--now")) {
  console.log("🔧 Manual trigger detected — running backup now...");
  runBackup();
}
