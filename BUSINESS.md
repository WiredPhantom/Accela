# Accela — Business Overview

## What is Accela?

**Accela is a focused study companion for BUMS (Bachelor of Unani Medicine and Surgery) students** preparing for the *Tareekh-e-Tib* (History of Medicine) paper. It combines two proven study tools — **flashcards** and **structured notes** — into one paid web app, organised exactly the way the syllabus is taught: by chapter and topic.

In short: **a paid, exam-aligned study app that replaces messy PDFs and scattered handwritten notes with one clean, mobile-friendly platform.**

---

## The problem we're solving

BUMS students preparing for *Tareekh-e-Tib* face three real pain points:

1. **Scattered material.** Notes circulate as photocopies, PDFs and WhatsApp forwards. Quality and accuracy vary.
2. **No active recall tool.** Reading notes is passive. Flashcards force active recall — proven to be 2–3× more effective for memorisation — but no one has built them for this niche.
3. **No structure aligned to the actual exam.** Existing material rarely matches the syllabus chapter-by-chapter, so students waste time figuring out *what* to study.

Accela solves all three with a single product, structured chapter-by-chapter, with both flashcards and notes for every topic.

---

## Who it's for

- **Primary**: BUMS undergraduate students (1st–5th year) preparing for university exams in Tareekh-e-Tib
- **Secondary**: Coaching institutes that want to recommend a single, reliable revision tool to their students
- **Future**: Other Unani / AYUSH subjects, expanding chapter-by-chapter

The market is niche but **highly underserved** — there is essentially no digital-first product in this space.

---

## Pricing model

We use a **flexible, multi-plan structure** that respects students' budgets and the way the syllabus is divided into terms.

| Plan                   | Price | Covers                  | Validity                |
|------------------------|------:|-------------------------|-------------------------|
| **Complete Syllabus**  | ₹499  | All chapters            | 18 months from purchase |
| **1st Term Syllabus**  | ₹199  | Chapters 1 – 6          | 18 months from purchase |
| **2nd Term Syllabus**  | ₹199  | Chapters 7 – 19         | 18 months from purchase |
| **3rd Term Syllabus**  | ₹199  | Chapter 20 onwards      | 18 months from purchase |

### Why this works
- **Low entry price (₹199)** removes the buying friction. A student can try it for one term first.
- **Bundle discount (₹499 vs ₹597 for all 3 terms)** rewards high-intent buyers — strong upsell.
- **Plans are additive.** A student who started with Term 1 can later add Term 2, Term 3, or upgrade to Complete.
- **18-month validity** comfortably covers any student's prep window regardless of when their actual exam falls.
- **Single one-time payment per plan** — no recurring billing complexity, no subscription cancellation friction.

### Unit economics (illustrative)
- Cost to serve one user: pennies (cloud hosting + database storage are minimal at our scale)
- Razorpay payment fees: ~2% per transaction
- Effective gross margin: **~95%+**
- Average revenue per paying user (estimated): **₹250–₹400** (mix of single-term and complete buyers)

---

## Product highlights

### For students
- **Sign up free**, browse the chapter list, see exactly what's locked
- **Free sample chapters** — admin can mark any chapter "free" so visitors can try before they buy, no code changes required
- **Buy only the syllabus you need** — no waste
- **Notes + flashcards** in one place, organised by chapter and topic
- **Device-locked accounts** prevent password sharing (account stays tied to the first device used)
- **Self-serve email verification + password reset** — no admin involvement needed for routine account recovery
- **Profile page** shows every plan owned with its individual expiry date

### For the operator (admin panel)
- Full CRUD on chapters, topics, flashcards and notes — content can be edited anytime
- Per-user plan management — grant, revoke, or extend any plan with one click
- **Revenue dashboard** with total income, paid-purchase count, and a live ledger of every sale (with Razorpay payment IDs)
- **CSV export** of every purchase for accounting / accountant
- Manual plan grants (for cash payments, gifts, refunds) tagged separately so they don't inflate revenue numbers
- Force-logout and device-lock controls for fraud prevention

---

## Defensibility

1. **Content moat.** The flashcards and notes themselves are the product. Building this corpus chapter-by-chapter takes domain expertise (knowing the BUMS syllabus, having reliable Unani medical history sources). A generic competitor cannot enter overnight.
2. **First mover in a tiny niche.** Most edtech players ignore BUMS because it's small. We *own* this audience.
3. **Direct distribution.** Word-of-mouth in BUMS colleges spreads fast — a satisfied student tells their entire batch.
4. **Sticky.** Once a student buys for one term and finds it useful, the path of least resistance is to buy the next term from the same product, not search for alternatives.

---

## Growth path

**Phase 1 (now)** — Tareekh-e-Tib for BUMS, prove the model.

**Phase 2 (next 6–12 months)** — Add the next high-value BUMS subject (e.g. *Kulliyat-e-Tib*, *Ilmul Advia*) using the same chapter/topic/plan structure. Same pricing model, same code, same audience.

**Phase 3** — Expand to BAMS (Ayurveda) and BHMS (Homeopathy) — same AYUSH ecosystem, similar exam patterns.

**Phase 4** — White-label the platform to coaching centres (B2B SaaS) so they can sell their own branded flashcards/notes to their students using our infrastructure.

---

## Tech & operating costs (today)

- **Stack**: Node.js + MongoDB + Razorpay — all standard, all cheap to scale
- **Hosting**: ~$10/month (Replit deployment) handles thousands of users
- **Payment processing**: Razorpay (instant settlement to Indian bank account)
- **Transactional email**: Gmail SMTP — **₹0/month** (no Resend / SendGrid / Mailgun bill)
- **No third-party recurring costs** beyond hosting and Razorpay fees

A small operator can run this profitably from day one.

---

## In one line

> **Accela turns a fragmented, photocopied syllabus into a polished, paid, mobile study app — for an audience nobody else is serving.**
