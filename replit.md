# Accela — Flashcard & Notes App

Express + MongoDB + EJS app for BUMS students (Tareekh-e-Tib focus). Uses self-hosted JWT/bcrypt auth, device-fingerprint locking for premium accounts, and Razorpay for payments.

## Stack
- Node.js / Express 5
- MongoDB (Mongoose, three separate connections: users, flashcards, notes)
- EJS views, vanilla JS frontend
- Razorpay (test mode keys configured)

## Pricing / Plans
Multi-plan, additive system. Each plan is valid for **18 months from purchase date** (different students have different exam dates, so per-purchase validity is more flexible than a global exam date). Configurable via `PLAN_VALIDITY_MONTHS` env var.

| Plan ID    | Name              | Price | Coverage              |
|------------|-------------------|-------|-----------------------|
| `complete` | Complete Syllabus | ₹499  | All chapters          |
| `term1`    | 1st Term Syllabus | ₹199  | Chapters 1 – 6        |
| `term2`    | 2nd Term Syllabus | ₹199  | Chapters 7 – 19       |
| `term3`    | 3rd Term Syllabus | ₹199  | Chapter 20 onwards    |

A user may hold multiple plans simultaneously (e.g. term1 + term3). Coverage applies to **both notes and flashcards** for the same chapter range.

Plan definitions live in `config/plans.js`. Per-user plans are stored in `User.plans` (array). Helper methods on the User model: `getActivePlans()`, `canAccessChapter(idx)`, `hasAnyActivePlan()`, `addPlan(...)`.

Backward compatibility: existing users with `subscriptionStatus: "premium"` and a non-expired `subscriptionExpiry` are treated as holding a "complete" plan until that legacy expiry.

## Key Files
- `index.js` — main server, auth middleware, chapter/note routes
- `routes/payment.js` — Razorpay create-order / verify-payment / refresh-token, plan-aware
- `routes/admin.js` + `admin.js` — admin CRUD for chapters, topics, notes, users
- `models/user.js` — user schema + plan/session/device-lock methods
- `models/flashcard.js`, `models/note.js`
- `config/plans.js` — single source of truth for plans + exam date
- `views/upgrade.ejs` — 3-plan picker UI
- `views/profile.ejs` — shows active plans
- `views/premiumrequired.ejs` — chapter-aware upsell

## Environment Variables (`[userenv.shared]` in `.replit`)
- `useruri`, `flashcarduri`, optional `noteuri` — MongoDB URIs
- `jwtkey` — JWT signing secret
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay credentials
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — Gmail SMTP credentials for sending verification / password-reset emails (use a Google App Password, not the account password). Optional `EMAIL_FROM` overrides the From header.
- `EXAM_DATE` — ISO date string (e.g. `2027-04-30`); plans expire at this date. Defaults to today + 12 months if unset.

## Running
`npm start` (the `Start application` workflow runs this).
