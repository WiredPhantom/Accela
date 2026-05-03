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
  // ── Batch 1 (previously seeded) ──────────────────────────────────────────
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

  // ── Batch 2 — Ch12 عہد مغلیہ ─────────────────────────────────────────────
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   1,
    topicName:    "حکیم علی گیلانی",
    noteTitle:    "حکیم علی گیلانی - عہدِ اکبری کے مشہور طبیب",
    file:         "aligilani_1777799985967.html",
    isPremium:    false,
  },
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   2,
    topicName:    "حکیم صدرا",
    noteTitle:    "حکیم صدرا - مسیح الزماں",
    file:         "sidra_1777799985593.html",
    isPremium:    false,
  },
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   3,
    topicName:    "حکیم امان اللہ خان",
    noteTitle:    "حکیم امان اللہ خان - مغل دور کے نامور طبیب",
    file:         "Amanullah_1777799985877.html",
    isPremium:    false,
  },
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   4,
    topicName:    "حکیم اکبر ارزانی",
    noteTitle:    "حکیم اکبر ارزانی - سوانح حیات",
    file:         "arjani_1777799985792.html",
    isPremium:    false,
  },
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   6,
    topicName:    "حکیم یوسفی",
    noteTitle:    "حکیم یوسفی - مغل دور کے مشہور طبیب",
    file:         "Yusufi_1777799985518.html",
    isPremium:    false,
  },
  {
    chapterIndex: 12,
    chapterName:  "عہد مغلیہ",
    topicIndex:   7,
    topicName:    "حکیم شریف خان",
    noteTitle:    "حکیم شریف خان - اشرف الحکماء",
    file:         "shareef_1777799985684.html",
    isPremium:    false,
  },

  // ── Batch 2 — Ch18 برطانوی عہد ───────────────────────────────────────────
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   1,
    topicName:    "حکیم اجمل خان",
    noteTitle:    "حکیم اجمل خاں - مسیح الملک",
    file:         "azmalkhan_1777799986207.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   2,
    topicName:    "حکیم عبدالعزیز لکھنوی",
    noteTitle:    "حکیم عبدالعزیز - خاندان عزیزی کے بانی",
    file:         "aziz_1777799986287.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   3,
    topicName:    "حکیم اعظم خان",
    noteTitle:    "حکیم اعظم خاں - تعارف",
    file:         "azamkhan_1777799986512.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   4,
    topicName:    "حکیم عبدالحمید",
    noteTitle:    "حکیم عبد الحمید لکھنوی - سوانح حیات",
    file:         "Abdul_Hameed_1777799986587.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   5,
    topicName:    "حکیم عبداللطیف فلسفی",
    noteTitle:    "حکیم عبد اللطیف فلسفی",
    file:         "lateeffalsafi_1777799986048.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   6,
    topicName:    "حکیم عبدالحلیم لکھنوی",
    noteTitle:    "حکیم عبدالحلیم لکھنوی - تعارف",
    file:         "abdulhaleem_(1)_1777799986443.html",
    isPremium:    false,
  },
  {
    chapterIndex: 18,
    chapterName:  "برطانوی عہد",
    topicIndex:   7,
    topicName:    "حکیم احمد حسین عثمانی",
    noteTitle:    "حکیم احمد حسین عثمانی - سوانح حیات",
    file:         "husain_usmani_1777799986129.html",
    isPremium:    false,
  },

  // ── Batch 2 — Ch19 چند دیگر مشہور اطباء ─────────────────────────────────
  {
    chapterIndex: 19,
    chapterName:  "چند دیگر مشہور اطباء",
    topicIndex:   1,
    topicName:    "حکیم محمد کبیر الدین",
    noteTitle:    "محمد کبیر الدین - مجاہد طب",
    file:         "kabirrudiin_1777799986665.html",
    isPremium:    false,
  },
  {
    chapterIndex: 19,
    chapterName:  "چند دیگر مشہور اطباء",
    topicIndex:   2,
    topicName:    "حکیم غلام حسنین کنتوری",
    noteTitle:    "حکیم غلام حسنین کنتوری - عظیم طبیب و مترجم",
    file:         "kisoori-1_1777799986367.html",
    isPremium:    false,
  },
  {
    chapterIndex: 19,
    chapterName:  "چند دیگر مشہور اطباء",
    topicIndex:   3,
    topicName:    "حکیم محمد الیاس خان",
    noteTitle:    "حکیم محمد الیاس خان - سوانح حیات",
    file:         "ilyas_khan_1777799986906.html",
    isPremium:    false,
  },
  {
    chapterIndex: 19,
    chapterName:  "چند دیگر مشہور اطباء",
    topicIndex:   4,
    topicName:    "حکیم عبدالحمید دہلوی",
    noteTitle:    "حکیم عبدالحمید دہلوی - سوانح حیات",
    file:         "hameed_dahlawi_1777799986744.html",
    isPremium:    false,
  },
  {
    chapterIndex: 19,
    chapterName:  "چند دیگر مشہور اطباء",
    topicIndex:   5,
    topicName:    "حکیم عبدالرزاق",
    noteTitle:    "حکیم محمد عبد الرزاق - سوانح حیات",
    file:         "Abdul_razzaq_1777799986824.html",
    isPremium:    false,
  },

  // ── Batch 3 — Ch20 ہندوستان کے مشہور طبی خانوادے ───────────────────────
  {
    chapterIndex: 20,
    chapterName:  "ہندوستان کے مشہور طبی خانوادے",
    topicIndex:   1,
    topicName:    "خاندان شریفی",
    noteTitle:    "خاندان شریفی - طب یونانی کے محافظ",
    file:         "shareefi_khandan_1777800883217.html",
    isPremium:    false,
  },
  {
    chapterIndex: 20,
    chapterName:  "ہندوستان کے مشہور طبی خانوادے",
    topicIndex:   2,
    topicName:    "خاندان عزیزی",
    noteTitle:    "خاندان عزیزی - مشہور اطباء",
    file:         "azizi_khandan_1777800883250.html",
    isPremium:    false,
  },
  {
    chapterIndex: 20,
    chapterName:  "ہندوستان کے مشہور طبی خانوادے",
    topicIndex:   3,
    topicName:    "خاندان عثمانی",
    noteTitle:    "خاندان عثمانی - طب یونانی کے عظیم خادم",
    file:         "usmani_khandan_1777800883175.html",
    isPremium:    false,
  },

  // ── Batch 3 — Ch21 درس گاہوں کا کردار ──────────────────────────────────
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   1,
    topicName:    "اے اینڈیو طبیہ کالج، قرول باغ",
    noteTitle:    "آیورویدک اینڈ یونانی طبیہ کالج، دہلی",
    file:         "ayurvedic_and_unani_clg-2_(1)_1777800883809.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   2,
    topicName:    "اجمل خان طبیہ کالج ،علی گڑھ",
    noteTitle:    "اجمل خان طبیہ کالج، علی گڑھ",
    file:         "ajmal_clg_1777800883885.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   3,
    topicName:    "تکمیل الطب کالج، لکھنو",
    noteTitle:    "تکمیل الطب کالج، لکھنؤ",
    file:         "takmeel_tib_clg_1777800883495.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   4,
    topicName:    "اسٹیت یونانی میڈیکل کالج، پریاگران",
    noteTitle:    "یونانی میڈیکل کالج، الہ آباد",
    file:         "unani_medical_clg_1777800883420.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   5,
    topicName:    "گورنمنٹ یونانی میڈیکل کالج، پٹنہ",
    noteTitle:    "گورنمنٹ طبیہ کالج پٹنہ - تاریخ",
    file:         "government_clg_1777800883733.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   6,
    topicName:    "جامعہ طبیہ /ا سکول آف یونانی میڈیکل ایجو کیشن اینڈ ریسریچ، جامعہ  ہمدرد، نئی دہلی",
    noteTitle:    "جامعہ طبیہ دہلی - تاریخ",
    file:         "jamia_tibbia_1777800883653.html",
    isPremium:    false,
  },
  {
    chapterIndex: 21,
    chapterName:  "ہندوستان میں طب یونانی کے فروغ میں درس گاہوں کا کردار ",
    topicIndex:   7,
    topicName:    "نظامیہ طبیہ کالج ، حیدرآباد",
    noteTitle:    "نظامیہ طبیہ کالج حیدرآباد - تاریخ",
    file:         "nizamia_tibbia_1777800883573.html",
    isPremium:    false,
  },

  // ── Batch 3 — Ch22 انتظامی و تحقیقی شعبہ جات ───────────────────────────
  {
    chapterIndex: 22,
    chapterName:  "ہندوستان میں طب یونانی کے انتظامی و تحقیقی شعبہ جات اور ان کی اہم کار گزاریاں",
    topicIndex:   1,
    topicName:    "CCRUM",
    noteTitle:    "مرکزی کونسل برائے تحقیق طب یونانی - CCRUM",
    file:         "ccrum_1777800883341.html",
    isPremium:    false,
  },
  {
    chapterIndex: 22,
    chapterName:  "ہندوستان میں طب یونانی کے انتظامی و تحقیقی شعبہ جات اور ان کی اہم کار گزاریاں",
    topicIndex:   2,
    topicName:    "NIUM",
    noteTitle:    "نیشنل انسٹی ٹیوٹ آف یونانی میڈیسن - NIUM",
    file:         "nium_1777800883283.html",
    isPremium:    false,
  },

  // ── Batch 3 — Ch23 طبی اخلاقیات ─────────────────────────────────────────
  {
    chapterIndex: 23,
    chapterName:  "طبی اخلاقیات",
    topicIndex:   1,
    topicName:    "فن طب کی عظمت و شرافت",
    noteTitle:    "فن طب کی عظمت و شرافت",
    file:         "funny_tip_ki_ajmat_aur_shrafat_1777800884170.html",
    isPremium:    false,
  },
  {
    chapterIndex: 23,
    chapterName:  "طبی اخلاقیات",
    topicIndex:   2,
    topicName:    "معاہدہ بقراطیہ اور اس کا پس منظر",
    noteTitle:    "معاہدہ بقراطیہ - Hippocratic Oath",
    file:         "Oath_1777800884044.html",
    isPremium:    false,
  },
  {
    chapterIndex: 23,
    chapterName:  "طبی اخلاقیات",
    topicIndex:   3,
    topicName:    "معاہدہ بقراطیہ کے متن کا اردو ترجمہ",
    noteTitle:    "معاہدہ بقراط - طبی عہد نامہ",
    file:         "oath_urdu_1777800884105.html",
    isPremium:    false,
  },
  {
    chapterIndex: 23,
    chapterName:  "طبی اخلاقیات",
    topicIndex:   4,
    topicName:    "متعلمین طب کے اوصاف",
    noteTitle:    "متعلمین طب کے اوصاف اور اطباء کے فرائض",
    file:         "متعلمین_طب_etc__1777800883965.html",
    isPremium:    false,
  },
  {
    chapterIndex: 23,
    chapterName:  "طبی اخلاقیات",
    topicIndex:   5,
    topicName:    "CCIM کہ مرتب کردہ ضابطہ اخلاق برائے طبیب",
    noteTitle:    "ضابطہ اخلاق برائے طبیب - CCIM",
    file:         "ccim_(1)_1777800884231.html",
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
