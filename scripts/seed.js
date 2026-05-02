/**
 * Seed script: clears old dummy data and inserts real sample entries
 * for the 4 new pharmacy subjects.
 *
 * Run: node scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const FLASHCARD_URI = process.env.flashcarduri;
if (!FLASHCARD_URI) {
  console.error('❌ flashcarduri not set in .env');
  process.exit(1);
}

const flashcardConn = mongoose.createConnection(FLASHCARD_URI);
const noteConn = mongoose.createConnection(FLASHCARD_URI);

const flashcardSchema = new mongoose.Schema({
  subject: String,
  subjectSlug: String,
  termNumber: Number,
  chapterIndex: Number,
  chapterName: String,
  topicIndex: Number,
  topicName: String,
  flashcardIndex: Number,
  question: String,
  answer: String,
  isPremium: { type: Boolean, default: false }
}, { collection: 'flashcard' });

const noteSchema = new mongoose.Schema({
  subject: String,
  subjectSlug: String,
  termNumber: Number,
  chapterIndex: Number,
  chapterName: String,
  topicIndex: Number,
  topicName: String,
  noteTitle: String,
  htmlContent: String,
  isPremium: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'notes' });

const Flashcard = flashcardConn.model('Flashcard', flashcardSchema);
const Note = noteConn.model('Note', noteSchema);

const SAMPLE_FLASHCARDS = [
  // ===== Kulliyate Advia wa Advia Jadeeda =====
  {
    subject: 'kulliyat-advia', subjectSlug: 'kulliyat-advia', termNumber: 1,
    chapterIndex: 1, chapterName: 'Dawa ki Tarif aur Iqsam',
    topicIndex: 1, topicName: 'Dawa ki Bunyadi Tarif', flashcardIndex: 1,
    question: 'Dawa (Dawaa) ki bunyadi Unani tarif kya hai?',
    answer: 'Dawa woh mufrad ya murakkab madda hai jo jism mein daakhil ho kar isko nafa ya nuqsaan pahunchaye. Unani tib mein dawaa ko Mufrad aur Murakkab mein taqseem kiya gaya hai.',
    isPremium: false
  },
  {
    subject: 'kulliyat-advia', subjectSlug: 'kulliyat-advia', termNumber: 1,
    chapterIndex: 1, chapterName: 'Dawa ki Tarif aur Iqsam',
    topicIndex: 1, topicName: 'Dawa ki Bunyadi Tarif', flashcardIndex: 2,
    question: 'Advia Mufrada aur Advia Murakkaba mein farq kya hai?',
    answer: 'Advia Mufrada woh dawaaen hain jo ek hi nau (species) se haasil hoti hain, jaise Zanjabeel (adrak). Advia Murakkaba do ya ziyada mufradat ko mila kar banaayi jaati hain, jaise Tiryaq.',
    isPremium: false
  },
  {
    subject: 'kulliyat-advia', subjectSlug: 'kulliyat-advia', termNumber: 1,
    chapterIndex: 1, chapterName: 'Dawa ki Tarif aur Iqsam',
    topicIndex: 2, topicName: 'Advia Jadeeda — Pehchaan', flashcardIndex: 1,
    question: 'Advia Jadeeda (modern drugs) se kya muraad hai?',
    answer: 'Advia Jadeeda woh dawaaen hain jo modern chemistry ke zariye tayyaar ki jaati hain, jaise synthetic antibiotics, analgesics, aur hormonal drugs. Inhen allopathic medicine mein ziyada istemal kiya jaata hai.',
    isPremium: true
  },

  // ===== Advia Mufradat =====
  {
    subject: 'advia-mufradat', subjectSlug: 'advia-mufradat', termNumber: 1,
    chapterIndex: 1, chapterName: 'Nabati Advia — Bunyadi Usool',
    topicIndex: 1, topicName: 'Nabati Dawaaon ki Pehchaan', flashcardIndex: 1,
    question: 'Nabati Advia Mufradat mein Zanjabeel (Ginger) ka Mizaj kya hai?',
    answer: 'Zanjabeel ka Mizaj Haar (garm) aur Yaabis (khuushk) darje awwal wa doem hai. Ye Baalgham kush, Haazimdaar, aur Muqawwi Maida hai.',
    isPremium: false
  },
  {
    subject: 'advia-mufradat', subjectSlug: 'advia-mufradat', termNumber: 1,
    chapterIndex: 1, chapterName: 'Nabati Advia — Bunyadi Usool',
    topicIndex: 1, topicName: 'Nabati Dawaaon ki Pehchaan', flashcardIndex: 2,
    question: 'Haldi (Kurkum) ke Unani khawaas kya hain?',
    answer: 'Haldi ka mizaj Haar Yaabis hai. Iske khawaas: Mufattit Riyaah, Mukhrij Balgham, Zakhm bandh karne wali (Qabiz), jild ke amraaz mein mufiid. Khariji istemal mein dard kush aur sozish dafa karta hai.',
    isPremium: false
  },
  {
    subject: 'advia-mufradat', subjectSlug: 'advia-mufradat', termNumber: 1,
    chapterIndex: 2, chapterName: 'Haiwani wa Maadani Advia',
    topicIndex: 1, topicName: 'Haiwani Advia ki Amali Pehchaan', flashcardIndex: 1,
    question: 'Shahad (Asal) ke Unani tibbi khawaas bayan karein.',
    answer: 'Shahad ka mizaj Haar Yaabis hai darje awwal. Khawaas: Munaffis Balgham, Mulayyin Tabiat, Haazimdaar, zakhm saaf karne wali (Jali), Muqawwi Jigar. Amraaz Sader mein khaaskar mufiid.',
    isPremium: false
  },

  // ===== Ilmul Saidla =====
  {
    subject: 'ilmul-saidla', subjectSlug: 'ilmul-saidla', termNumber: 1,
    chapterIndex: 1, chapterName: 'Ilmul Saidla ka Taaruf',
    topicIndex: 1, topicName: 'Saidla ki Tarif aur Tareekh', flashcardIndex: 1,
    question: 'Ilmul Saidla (Unani Pharmacy) ki bunyadi tarif kya hai?',
    answer: 'Ilmul Saidla woh ilm hai jis mein adwiyah ki pehchaan, jaanch, hifazat, tayyaari, aur taqseem ka tafseeli mutaalia kiya jaata hai. Woh shakhsh jo is kaam ko anjaam de, use "Saidal" ya Pharmacist kehte hain.',
    isPremium: false
  },
  {
    subject: 'ilmul-saidla', subjectSlug: 'ilmul-saidla', termNumber: 1,
    chapterIndex: 1, chapterName: 'Ilmul Saidla ka Taaruf',
    topicIndex: 1, topicName: 'Saidla ki Tarif aur Tareekh', flashcardIndex: 2,
    question: 'Wazarat e Sehat ki Sarkari Pharmacopoeia se kya muraad hai?',
    answer: 'Pharmacopoeia ek sarkari kitaab hai jis mein dawaaon ke معیار (standards), khaasiyaat, jaanch ke tareeqe aur tayyaari ke usool darj hote hain. Hind mein Ayurvedic Pharmacopoeia of India (API) naafiiz hai.',
    isPremium: false
  },

  // ===== Advia Murakkabat =====
  {
    subject: 'advia-murakkabat', subjectSlug: 'advia-murakkabat', termNumber: 1,
    chapterIndex: 1, chapterName: 'Murakkab Dawaaon ke Usool',
    topicIndex: 1, topicName: 'Tiryaq aur Jawarish', flashcardIndex: 1,
    question: 'Jawarish kya hoti hai aur iska mukhya faida kya hai?',
    answer: 'Jawarish ek semisolid (nim-jamd) murakkab dawaa hai jo adrak, maida, ya kisi aur qawaam se banaai jaati hai. Woh Maida, Jigar aur Aanta ko taqwiyat deti hai. Mashhoor: Jawarish Jalinus, Jawarish Amla.',
    isPremium: false
  },
  {
    subject: 'advia-murakkabat', subjectSlug: 'advia-murakkabat', termNumber: 1,
    chapterIndex: 1, chapterName: 'Murakkab Dawaaon ke Usool',
    topicIndex: 1, topicName: 'Tiryaq aur Jawarish', flashcardIndex: 2,
    question: 'Tiryaq Arbaah ki tarkib mein kya shamil hota hai aur yeh kis kaam aata hai?',
    answer: 'Tiryaq Arbaah mein 4 bunyadi mufradat hain: Mur (myrrh), Hindh Berry, Zafran, aur Anisoon. Yeh Muqawwi Qalb, Daf\'e Sumoom (antidote), aur Mushil Baalgham hai. Qadeem zamaane se mustaghal hai.',
    isPremium: false
  },
];

const SAMPLE_NOTES = [
  {
    subject: 'kulliyat-advia', subjectSlug: 'kulliyat-advia', termNumber: 1,
    chapterIndex: 1, chapterName: 'Dawa ki Tarif aur Iqsam',
    topicIndex: 1, topicName: 'Dawa ki Bunyadi Tarif',
    noteTitle: 'Dawa ki Tarif aur Iqsam — Mukhtasar Note',
    isPremium: false,
    htmlContent: `<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:'Noto Nastaliq Urdu',serif;background:#1a3a2e;color:#e8f5e8;padding:40px 20px;max-width:800px;margin:0 auto;line-height:2.2;font-size:18px}
  h1{color:#00ffaa;font-size:26px;border-bottom:2px solid #00ffaa;padding-bottom:12px;margin-bottom:24px}
  h2{color:#4ade80;font-size:21px;margin-top:28px;margin-bottom:12px}
  .key-point{background:rgba(0,255,170,0.08);border-right:4px solid #00ffaa;border-radius:8px;padding:16px 20px;margin:16px 0}
  .term{color:#ffd700;font-weight:bold}
  p{margin-bottom:14px}
</style>
</head>
<body>
<h1>📗 دواء کی تعریف اور اقسام</h1>
<h2>تعریف</h2>
<p>دواء وہ مفرد یا مرکب مادہ ہے جو جسم میں داخل ہو کر اس کو نفع یا نقصان پہنچائے۔</p>
<div class="key-point">
  <p><span class="term">یاد رکھیں:</span> دواء لازمی طور پر مفید نہیں ہوتی — زہر بھی دواء کی تعریف میں آتا ہے!</p>
</div>
<h2>اقسام</h2>
<p><span class="term">۱۔ ادویہ مفردہ:</span> وہ ادویہ جو ایک ہی نوع سے حاصل ہوں — جیسے زنجبیل (ادرک)، ہلدی۔</p>
<p><span class="term">۲۔ ادویہ مرکبہ:</span> دو یا زیادہ مفردات کو ملا کر بنائی گئی — جیسے جوارش، تریاق۔</p>
<h2>مآخذ (Sources)</h2>
<p>ادویہ کے تین بنیادی مآخذ ہیں:</p>
<p>• <span class="term">نباتی</span> — پودوں سے (مثلاً زنجبیل، انیسون)</p>
<p>• <span class="term">حیوانی</span> — جانوروں سے (مثلاً شہد، مشک)</p>
<p>• <span class="term">معدنی</span> — پتھر/دھاتوں سے (مثلاً گندھک، مردار سنگ)</p>
</body>
</html>`
  },
  {
    subject: 'advia-mufradat', subjectSlug: 'advia-mufradat', termNumber: 1,
    chapterIndex: 1, chapterName: 'Nabati Advia — Bunyadi Usool',
    topicIndex: 1, topicName: 'Nabati Dawaaon ki Pehchaan',
    noteTitle: 'Nabati Advia Mufradat — Mukhtasar Note',
    isPremium: false,
    htmlContent: `<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:'Noto Nastaliq Urdu',serif;background:#1a3a2e;color:#e8f5e8;padding:40px 20px;max-width:800px;margin:0 auto;line-height:2.2;font-size:18px}
  h1{color:#00ffaa;font-size:26px;border-bottom:2px solid #00ffaa;padding-bottom:12px;margin-bottom:24px}
  h2{color:#4ade80;font-size:21px;margin-top:28px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:rgba(0,255,170,0.15);color:#00ffaa;padding:12px;border:1px solid rgba(0,255,170,0.2)}
  td{padding:10px 12px;border:1px solid rgba(255,255,255,0.1)}
  tr:nth-child(even){background:rgba(255,255,255,0.03)}
</style>
</head>
<body>
<h1>🌿 نباتی ادویہ مفردہ — پہچان</h1>
<h2>اہم نباتی ادویہ اور ان کا مزاج</h2>
<table>
<tr><th>دواء</th><th>مزاج</th><th>اہم خاصیت</th></tr>
<tr><td>زنجبیل (ادرک)</td><td>گرم خشک درجہ ۲</td><td>ہاضم، مقوی معدہ، بلغم کش</td></tr>
<tr><td>ہلدی (کرکم)</td><td>گرم خشک</td><td>مفتت ریاح، زخم بند کرے، جلد امراض</td></tr>
<tr><td>شہد (عسل)</td><td>گرم خشک درجہ ۱</td><td>منفث بلغم، ملین، مقوی جگر</td></tr>
<tr><td>انیسون</td><td>گرم خشک درجہ ۲</td><td>مدر بول، نفاخ دور کرے، مقوی معدہ</td></tr>
</table>
</body>
</html>`
  },
];

async function run() {
  try {
    await Promise.all([
      new Promise((res, rej) => flashcardConn.once('open', res).once('error', rej)),
      new Promise((res, rej) => noteConn.once('open', res).once('error', rej)),
    ]);
    console.log('✅ Connected to MongoDB');

    const fc = await Flashcard.deleteMany({});
    console.log(`🗑️  Cleared ${fc.deletedCount} old flashcards`);

    const nt = await Note.deleteMany({});
    console.log(`🗑️  Cleared ${nt.deletedCount} old notes`);

    await Flashcard.insertMany(SAMPLE_FLASHCARDS);
    console.log(`✅ Inserted ${SAMPLE_FLASHCARDS.length} sample flashcards`);

    await Note.insertMany(SAMPLE_NOTES);
    console.log(`✅ Inserted ${SAMPLE_NOTES.length} sample notes`);

    console.log('\n🎉 Seed complete!');
    console.log('Subjects seeded:');
    console.log('  - Kulliyate Advia wa Advia Jadeeda: 3 flashcards, 1 note');
    console.log('  - Advia Mufradat: 3 flashcards, 1 note');
    console.log('  - Ilmul Saidla: 2 flashcards');
    console.log('  - Advia Murakkabat: 2 flashcards');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await flashcardConn.close();
    await noteConn.close();
    process.exit(0);
  }
}

run();
