const PLANS = {
  complete: {
    id: "complete",
    name: "Complete Syllabus",
    shortName: "Complete",
    description: "Tamam 4 subjects ke tamam 3 terms — poora syllabus",
    price: 99900,
    currency: "INR",
    coverage: { type: "all" },
    chapterLabel: "All terms — all 4 subjects",
    badge: "Best Value",
    accent: "#ffd700",
  },
  term1: {
    id: "term1",
    name: "1st Term Syllabus",
    shortName: "Term 1",
    description: "Tamam 4 subjects ka 1st Term (notes + flashcards)",
    price: 49900,
    currency: "INR",
    coverage: { type: "term", termNumber: 1 },
    chapterLabel: "Term 1 — all 4 subjects",
    accent: "#00ffcc",
  },
  term2: {
    id: "term2",
    name: "2nd Term Syllabus",
    shortName: "Term 2",
    description: "Tamam 4 subjects ka 2nd Term (notes + flashcards)",
    price: 49900,
    currency: "INR",
    coverage: { type: "term", termNumber: 2 },
    chapterLabel: "Term 2 — all 4 subjects",
    accent: "#7c5cff",
  },
  term3: {
    id: "term3",
    name: "3rd Term Syllabus",
    shortName: "Term 3",
    description: "Tamam 4 subjects ka 3rd Term (notes + flashcards)",
    price: 49900,
    currency: "INR",
    coverage: { type: "term", termNumber: 3 },
    chapterLabel: "Term 3 — all 4 subjects",
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

function planCoversTerm(planId, termNumber) {
  const plan = getPlan(planId);
  if (!plan) return false;
  const c = plan.coverage;
  if (c.type === "all") return true;
  if (c.type === "term") return c.termNumber === termNumber;
  return false;
}

// Backward compat alias (legacy code may call this)
function planCoversChapter(planId, chapterIndex) {
  return planCoversTerm(planId, chapterIndex);
}

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
  planCoversTerm,
  planCoversChapter,
  getValidityMonths,
  calcPlanExpiry,
  formatDate,
  rupees,
};
