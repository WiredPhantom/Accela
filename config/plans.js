const PLANS = {
  complete: {
    id: "complete",
    name: "Complete Syllabus",
    shortName: "Complete",
    description: "All chapters (notes + flashcards) till exam",
    price: 49900,
    currency: "INR",
    coverage: { type: "all" },
    chapterLabel: "All chapters",
    badge: "Best Value",
    accent: "#ffd700",
  },
  term1: {
    id: "term1",
    name: "1st Term Syllabus",
    shortName: "Term 1",
    description: "Chapters 1 to 6 (notes + flashcards) till exam",
    price: 19900,
    currency: "INR",
    coverage: { type: "range", min: 1, max: 6 },
    chapterLabel: "Chapters 1 – 6",
    accent: "#00ffcc",
  },
  term2: {
    id: "term2",
    name: "2nd Term Syllabus",
    shortName: "Term 2",
    description: "Chapters 7 to 19 (notes + flashcards) till exam",
    price: 19900,
    currency: "INR",
    coverage: { type: "range", min: 7, max: 19 },
    chapterLabel: "Chapters 7 – 19",
    accent: "#7c5cff",
  },
  term3: {
    id: "term3",
    name: "3rd Term Syllabus",
    shortName: "Term 3",
    description: "Chapters 20 onwards (notes + flashcards) till exam",
    price: 19900,
    currency: "INR",
    coverage: { type: "range", min: 20, max: Infinity },
    chapterLabel: "Chapter 20 onwards",
    accent: "#ff7ab6",
  },
};

const PLAN_ORDER = ["complete", "term1", "term2", "term3"];

function getPlan(planId) {
  return PLANS[planId] || null;
}

function getAllPlans() {
  return PLAN_ORDER.map((id) => PLANS[id]);
}

function planCoversChapter(planId, chapterIndex) {
  const plan = getPlan(planId);
  if (!plan) return false;
  const c = plan.coverage;
  if (c.type === "all") return true;
  if (c.type === "range") {
    return chapterIndex >= c.min && chapterIndex <= c.max;
  }
  return false;
}

// All plans are valid for a fixed number of months from the date of purchase.
// Configurable via PLAN_VALIDITY_MONTHS env var (default 18).
const VALIDITY_MONTHS = parseInt(process.env.PLAN_VALIDITY_MONTHS, 10) || 18;

function getValidityMonths() {
  return VALIDITY_MONTHS;
}

function calcPlanExpiry(purchaseDate) {
  const start = purchaseDate ? new Date(purchaseDate) : new Date();
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + VALIDITY_MONTHS);
  return expiry;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function rupees(paise) {
  return Math.round(paise / 100);
}

module.exports = {
  PLANS,
  PLAN_ORDER,
  getPlan,
  getAllPlans,
  planCoversChapter,
  getValidityMonths,
  calcPlanExpiry,
  formatDate,
  rupees,
};
