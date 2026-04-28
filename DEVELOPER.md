# Accela — Developer Guide

A complete walkthrough of the codebase: how the system is architected, what every file does, and how to extend it safely.

---

## 1. High-level architecture

```
┌──────────────┐   HTTPS    ┌────────────────────────────┐
│   Browser    │ ─────────► │  Express server (index.js) │
│   (mobile)   │            │  - EJS views               │
└──────────────┘            │  - JWT cookie auth         │
                            │  - Razorpay integration    │
                            └─────────┬──────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
       ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
       │ MongoDB     │         │ MongoDB     │         │ MongoDB     │
       │ users       │         │ flashcards  │         │ notes       │
       │ (useruri)   │         │(flashcarduri│         │ (noteuri)   │
       └─────────────┘         └─────────────┘         └─────────────┘
```

- **One Express app**, server-rendered with EJS, no SPA framework.
- **Three separate Mongoose connections** (users / flashcards / notes) so each collection can live in its own MongoDB cluster if needed.
- **JWT-based auth** stored in HTTP-only cookies. Every protected route runs `checkAuth` middleware.
- **Razorpay** handles payment collection. We verify the signature server-side before granting plans.

---

## 2. Tech stack

| Layer            | Choice                                    |
|------------------|-------------------------------------------|
| Runtime          | Node.js 20                                |
| Web framework    | Express 5                                 |
| Templating       | EJS                                       |
| Database         | MongoDB (Mongoose ODM)                    |
| Auth             | JWT + bcrypt + HTTP-only cookies          |
| Payments         | Razorpay (Indian payment gateway)         |
| Email            | Gmail SMTP via `nodemailer` (free)        |
| Frontend assets  | Plain CSS + vanilla JS (no build step)    |
| Hosting          | Replit                                    |

No bundler, no transpiler, no React/Vue. Edits go straight to production after a workflow restart.

---

## 3. Directory map

```
.
├── index.js                  ← main server: routes, middleware, auth, content gating
├── package.json
├── replit.md                 ← project memory (architecture, env vars, plans)
├── BUSINESS.md               ← business / investor overview
├── DEVELOPER.md              ← this file
│
├── config/
│   └── plans.js              ← single source of truth for plans, prices, validity
│
├── models/
│   ├── user.js               ← User schema + auth/session/plan/device-lock methods
│   ├── flashcard.js          ← Flashcard schema (chapter, topic, Q/A, isPremium flag)
│   └── note.js               ← Note schema (chapter, topic, HTML body, isPremium flag)
│
├── routes/
│   ├── payment.js            ← Razorpay create-order / verify / list-plans
│   └── admin.js              ← All /admin/* routes (content, users, plans, ledger)
│
├── utils/
│   └── email.js              ← Gmail SMTP wrapper (verification + password reset)
│
├── views/                    ← EJS templates
│   ├── home.ejs              ← landing page (pitch + updates + nav)
│   ├── login.ejs · signup.ejs · changepassword.ejs
│   ├── verifyemail.ejs · forgotpassword.ejs · resetpassword.ejs
│   ├── chapters.ejs · topics.ejs · flashcards.ejs
│   ├── note-chapters.ejs · note-topics.ejs · note-view.ejs
│   ├── upgrade.ejs           ← 4-card plan picker (Razorpay checkout)
│   ├── profile.ejs           ← shows active plans + expiries
│   ├── premiumrequired.ejs   ← chapter-aware upsell page
│   ├── sessionexpired.ejs · accessdenied.ejs · unauthorized.ejs · 404.ejs
│   └── admin.ejs             ← admin panel UI
│
├── public/                   ← static assets served by Express
│   ├── admin.css · login.css · chapters.css · topics.css · flashcards.css
│   ├── clientadmin.js        ← client JS for admin panel (modal helpers, fetch calls)
│   └── login.js
│
└── admin.js                  ← (legacy duplicate of routes/admin.js — see §10)
```

---

## 4. The plan system (the heart of monetisation)

All pricing/access logic flows through three places:

### `config/plans.js` — definitions
```js
PLANS = {
  complete: { id, name, shortName, price: 49900, currency: 'INR',
              coverage: { type: 'all' }, ... },
  term1:    { ..., coverage: { type: 'range', min: 1,  max: 6 } },
  term2:    { ..., coverage: { type: 'range', min: 7,  max: 19 } },
  term3:    { ..., coverage: { type: 'range', min: 20, max: Infinity } },
}
```
Exported helpers:
- `getPlan(id)` → plan object or undefined
- `getAllPlans()` → array sorted in display order
- `planCoversChapter(planId, chapterIndex)` → boolean
- `calcPlanExpiry(purchaseDate)` → Date 18 months later
- `getValidityMonths()` → 18 (or whatever `PLAN_VALIDITY_MONTHS` env var says)

**To add a new plan, edit only this file** plus the `PLAN_ORDER` array.

### `models/user.js` — per-user state
```js
plans: [{
  planId,         // 'complete' | 'term1' | 'term2' | 'term3'
  purchasedAt,
  expiresAt,
  amount,         // paise (49900 = ₹499)
  currency,
  razorpayOrderId,
  razorpayPaymentId
}]
```

Methods on `User`:
- `getActivePlans()` — filters by `expiresAt > now`. Falls back to legacy `subscriptionStatus: 'premium'` (treats it as a Complete plan).
- `canAccessChapter(idx)` — true if any active plan covers `idx`. Admins always true.
- `hasAnyActivePlan()` — boolean.
- `addPlan({...})` — appends or extends an existing plan; mirrors latest expiry to legacy `subscriptionExpiry` for old admin views.
- `removePlan(planId)` — removes from array. Special token `'__legacy__'` clears the old `subscriptionStatus` field.

### `index.js` — content gating
```js
function checkPremiumAccess(user, chapterIndex) {
  return user.role === 'admin' || user.canAccessChapter(chapterIndex);
}
```
Every chapter / topic / note route calls this with the chapter being requested. If false, the user is redirected to `/upgrade?username=…` with the chapter pre-highlighted.

---

## 5. Auth & session flow

1. **Signup** (`POST /signup`) — bcrypt-hash the password, generate a unique `userId`, save the user.
2. **Login** (`POST /login`):
   - Verify password.
   - Capture device fingerprint (UA + IP hash).
   - If user has *no active device lock*, set one (30-day lifetime).
   - If user has an *existing* device lock and the fingerprint doesn't match → block login.
   - Generate JWT (`token` cookie) and a session token (`sessionToken` cookie).
3. **Every request** runs `checkAuth` middleware:
   - Decodes JWT → loads user from DB.
   - Validates `sessionToken` matches `user.currentSession.token` (so admin force-logout works).
   - Validates device fingerprint still matches `user.deviceLock.deviceFingerprint`.
4. **`checkRole('admin')`** middleware on `/admin/*` blocks non-admin users.

Device lock fields on the User schema:
```js
deviceLock: { deviceFingerprint, lockedAt, expiresAt }
currentSession: { token, expiresAt, deviceFingerprint, ipAddress }
```

---

## 6. Payment flow

```
Browser (upgrade.ejs)              Server (routes/payment.js)         Razorpay
─────────────────────              ──────────────────────────         ────────
 click "Buy Term 1"  ───►  POST /payment/create-order  ───►  orders.create({amount: 19900})
                                                       ◄───  { orderId }
                          ◄───  { orderId, key, amount, plan }
 Razorpay checkout opens
 user pays
                          Razorpay returns { order_id, payment_id, signature }
 POST /payment/verify-payment  ───►  HMAC-SHA256(order_id|payment_id, secret) === signature?
                                     If yes: user.addPlan({...}); user.save()
                                     refresh JWT with new plan info
                          ◄───  { success: true, token }
```

Key detail: **the price comes from the server** (`getPlan(planId).price`), never from the client. The client only sends a `planId`. This prevents the user from tampering with the amount.

---

## 7. Admin panel

Mounted at `/admin` (auth + admin role required).

### Content management
- **Flashcards**: chapters (auto-derived from card data), topics, individual cards. Add / edit / delete each.
- **Notes**: chapter + topic + topic-title + HTML body. Same CRUD.
- **Bulk upload**: JSON for flashcards, HTML for notes (`multer` memory storage, 5 MB cap).
- **Premium toggles**: mark any chapter/topic/note as paid content (sets `isPremium: true` in MongoDB).

### User & plan management (new multi-plan UI)
- **User Plans table**: shows each user's `activePlans` as chips with their own expiry dates.
- **✏️ Manage modal** (`public/clientadmin.js → openSubscriptionModal`):
  - Lists active plans with 🗑️ Revoke buttons (calls `POST /admin/revoke-plan`).
  - Grant form: choose plan + optional custom expiry → `POST /admin/grant-plan`.
  - Granted plans are tagged `admin_grant_<timestamp>` in the `razorpayPaymentId` field so they're filtered out of revenue.
- **Revenue panel**: total revenue, paid-purchase count, latest 25 purchases, **CSV download** (`GET /admin/export-purchases.csv`).

### Preserved features (do not break these)
- 🚪 **Force Logout** (`POST /admin/force-logout`) — clears `currentSession`, leaves device lock.
- 🔓 **Clear Device Lock** (`POST /admin/clear-device-lock`) — resets `deviceLock`.
- 🗑️ **Delete User** — full record deletion.
- ➕ **Add User** — create user manually.

---

## 8. File-by-file deep dive

### `index.js` (main server)
- **Lines 1–60** — middleware setup (express.json, cookieParser, EJS engine, static files).
- **Mongoose connections** — three separate `mongoose.createConnection()` calls; each one gets its own model factory.
- **`checkAuth`** — reads JWT cookie, validates session token + device fingerprint, attaches `req.user`.
- **`checkRole`** — role-based gate.
- **`checkPremiumAccess`** — wraps `user.canAccessChapter(idx)` with admin override.
- **Public routes**: `/`, `/login`, `/signup`, `/logout`.
- **Content routes**: `/chapter/:idx`, `/topic/:c/:t`, `/notes/:c`, `/note/:c/:t` — all gated by `checkPremiumAccess`.
- **`/upgrade`**, **`/profile`** — render the plan picker / profile pages.
- **Mounts** `/payment` (`routes/payment.js`) and `/admin` (`routes/admin.js`).

### `config/plans.js`
- `PLANS` object + `PLAN_ORDER` array.
- All helpers documented in §4.
- **Validity is computed per-purchase**: `purchaseDate + PLAN_VALIDITY_MONTHS months`. This file is the *only* place that knows about prices, durations, or chapter ranges.

### `models/user.js`
- Schema fields: `userId`, `username`, `email`, `password` (bcrypt hash), `role`, `plans[]`, legacy `subscriptionStatus`/`subscriptionExpiry`, `deviceLock`, `currentSession`, `createdAt`, `lastPaymentDate`.
- Pre-save hook: bcrypt-hash the password if modified.
- **Methods**: see §4 — covers active-plan logic, chapter access, plan add/remove, device lock, session helpers, days-until-expiry.

### `models/flashcard.js` / `models/note.js`
- Same shape: `chapterIndex`, `chapterName`, `topicIndex`, `topicName`, content (Q/A or HTML), `isPremium` flag, timestamps.
- `isPremium` is a *content* flag (does this card require any plan to view?). The *user's* access is checked separately via the plan system.
- Setting `isPremium: false` on a chapter/topic/note makes it **free for everyone**, including logged-out visitors. This is the mechanism for offering free sample chapters without changing `config/plans.js`.

### `utils/email.js`
- Thin wrapper around `nodemailer` configured for Gmail SMTP.
- Reads `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google App Password — *not* the regular account password).
- Exports `sendVerificationEmail(...)` (6-digit signup code, valid 24h) and `sendPasswordResetEmail(...)` (magic link, valid 60min).
- If credentials are missing, send becomes a no-op returning `{ sent: false, reason: 'NO_PROVIDER' }` — the app keeps running so the admin can manually relay codes.
- Templates are inline HTML strings (matching the dark Accela visual style); change them in this single file.

### `routes/payment.js`
- Exports a factory: `module.exports = (User) => router`.
- **`GET /payment/plans`** — returns all 4 plans + `validityMonths` for the upgrade page.
- **`POST /payment/create-order`** — body: `{ username, planId }`. Looks up the plan, creates a Razorpay order at the correct price, returns Razorpay public key + order ID for the checkout widget.
- **`POST /payment/verify-payment`** — body: Razorpay's response + `username` + `planId`. Verifies HMAC, then `user.addPlan(...)` and `user.save()`. Returns a refreshed JWT with the new plan info embedded.
- **`POST /payment/refresh-token`** — re-issues a JWT after plan changes (so the in-memory token reflects fresh access).
- **`GET /payment/check-premium/:username`** — returns active plans (used by some client polling).

### `routes/admin.js`
Big file. Sections inside:
1. **`GET /`** — fetches chapters/topics/users + builds enriched `users` array (with `activePlans`) + `recentPurchases` + revenue totals → renders `admin.ejs`.
2. **Session management** — force-logout, clear-device-lock.
3. **Notes CRUD** — `/add-note`, `/edit-note`, `/delete-note`, `/toggle-note-chapter-premium`, `/toggle-note-topic-premium`.
4. **Flashcards CRUD** — `/edit-chapter`, `/delete-chapter`, `/edit-topic`, `/delete-topic`, `/edit-flashcard`, `/delete-flashcard`, `/add-flashcard`, `/bulk-upload`, `/toggle-chapter-premium`, `/toggle-topic-premium`.
5. **User management** — `/delete-user`, `/add-user`.
6. **Subscription (legacy)** — `/update-subscription` (kept for backward compat, not used by new UI).
7. **Plan management (new)** — `/grant-plan`, `/revoke-plan`, `/export-purchases.csv`.

### `views/admin.ejs`
- Sidebar layout with sections: Dashboard, Flashcards (chapters/topics/all/add/bulk), Notes, Premium Management, Users, Device Locks.
- Modals: edit/delete chapter/topic/flashcard/note/user + the plan-management modal (`#subscription-modal`).
- Server-injected globals at the bottom: `window.chapters`, `window.topics`, `window.noteChapters`, `window.noteTopics` so `clientadmin.js` can reference them without re-fetching.

### `public/clientadmin.js`
All admin-side JS. Notable functions:
- `openSubscriptionModal({ userId, username, activePlans })` — fills the modal, renders revoke buttons.
- `revokePlan(planId, planLabel)` — confirms + `fetch('/admin/revoke-plan')` + reloads.
- `forceLogout`, `clearDeviceLock`, `openDeleteUserModal` — preserved as-is.
- `showToast`, `openModal`, `closeModal` — generic UI helpers.

### `views/upgrade.ejs`
- Renders 4 plan cards with real prices from server.
- Each card's button calls `buyPlan(planId)` which:
  1. POSTs to `/payment/create-order` with `{ username, planId }`.
  2. Opens Razorpay checkout with the returned order ID.
  3. On success, POSTs to `/payment/verify-payment`.
  4. Redirects to `/profile`.
- Plans the user already owns show as "✓ Already Active" (disabled).

### `views/profile.ejs`
- Lists every active plan with its individual expiry date.
- Shows total `daysLeft` (max across all plans).
- "Add Another Plan" button → `/upgrade?username=...`.

---

## 9. Environment variables

Stored in `.replit` under `[userenv.shared]` (managed via the secrets panel — never committed).

| Variable               | Purpose                                                |
|------------------------|--------------------------------------------------------|
| `useruri`              | MongoDB URI for the users database                     |
| `flashcarduri`         | MongoDB URI for the flashcards database                |
| `noteuri`              | MongoDB URI for the notes database (optional, can reuse another) |
| `jwtkey`               | HMAC secret for signing JWTs (32+ chars random)        |
| `RAZORPAY_KEY_ID`      | Razorpay public key                                    |
| `RAZORPAY_KEY_SECRET`  | Razorpay secret key (used for signature verification)  |
| `GMAIL_USER`           | Gmail address used to send verification + reset emails |
| `GMAIL_APP_PASSWORD`   | 16-char Google App Password (NOT the account password) |
| `EMAIL_FROM`           | (Optional) Override the From header. Defaults to `Accela <GMAIL_USER>` |
| `PLAN_VALIDITY_MONTHS` | (Optional) Override default plan validity. Default: 18 |
| `PORT`                 | (Optional) Server port. Default: 3000, Replit uses 5000 |

---

## 10. Known quirks & gotchas

- **`admin.js` (root) vs `routes/admin.js`** — there's a duplicate file at the project root. The *active* one mounted by `index.js` is `routes/admin.js`. The root file appears to be a legacy copy. Don't edit both; only `routes/admin.js` matters.
- **Backward-compat layer for legacy users** — pre-multi-plan users have `subscriptionStatus: 'premium'` and an empty `plans[]`. `getActivePlans()` synthesises a virtual "complete" plan for them so they keep working. When admin revokes their access, pass `planId: '__legacy__'` to `removePlan()` to clear the old fields.
- **Admin grants are tagged in `razorpayPaymentId`** with the prefix `admin_grant_<timestamp>`. The CSV export and revenue dashboard filter on this prefix. Don't change the prefix without updating both consumers.
- **No `noteuri` env var?** — The code falls back to the flashcard DB if `noteuri` isn't set. Check `index.js` near the Mongoose connection setup.
- **Workflow restart required** after editing server files (`index.js`, anything in `routes/`, `models/`, `config/`). EJS view + public asset edits don't need a restart, just a browser refresh.

---

## 11. How to extend safely

### Add a new plan (e.g. "Term 4")
1. Edit `config/plans.js`:
   ```js
   PLANS.term4 = {
     id: 'term4', name: '4th Term Syllabus', shortName: 'Term 4',
     description: 'Chapters 30 onwards (notes + flashcards) till exam',
     price: 19900, currency: 'INR',
     coverage: { type: 'range', min: 30, max: Infinity },
     chapterLabel: 'Chapter 30 onwards',
   };
   PLAN_ORDER.push('term4');
   ```
2. Adjust other plans' `coverage.max` if they overlap.
3. No other code changes needed. The upgrade page, payment routes, admin grant dropdown, and access checks all read from `config/plans.js`.

### Make selected chapters free (sample / trial)
The `isPremium` flag on each Flashcard / Note record is **independent** of the plan system. To open a chapter to everyone (including logged-out visitors):

1. Open `/admin` → flip the chapter's premium toggle off (or call `POST /admin/toggle-chapter-premium` with `isPremium: false`).
2. The gate `!chapter.isPremium || isAdmin || user.canAccessChapter(idx)` now lets anyone through.
3. **Do not edit `config/plans.js`** for this — it only describes paid plan coverage. Free-chapter logic is a separate, independent layer.

### Add a new content collection (e.g. "Past Papers")
1. Create `models/pastpaper.js` mirroring `note.js`.
2. In `index.js`, create a new Mongoose connection (or reuse one) and a new model factory.
3. Add routes for listing / viewing, gated by `checkPremiumAccess`.
4. Add admin CRUD in `routes/admin.js`.
5. Add a sidebar nav item in `views/admin.ejs`.

### Add a new admin permission
- All admin routes are mounted with `checkAuth, checkRole('admin')`. To add a finer-grained role (e.g. "editor"), introduce a new role string and update `checkRole` to accept an array.

---

## 12. Running locally on Replit

```bash
npm install
npm start                       # workflow "Start application" runs this
```

Server listens on port 5000. Replit proxies it to a public `*.replit.app` URL.

To test payments end-to-end, use Razorpay's test cards (`4111 1111 1111 1111`, any future expiry, any CVV).

---

## 13. Database access for debugging

Each Mongoose connection points to a separate MongoDB Atlas cluster. The collections we care about:

- `useruri` → `practicecollection` (users)
- `flashcarduri` → `flashcards` (or whatever the model defaults to)
- `noteuri` → `notes`

A common debugging pattern:
```js
const mongoose = require('mongoose');
require('dotenv').config();
const conn = mongoose.createConnection(process.env.useruri);
conn.once('open', async () => {
  const u = await conn.db.collection('practicecollection').findOne({ username: 'someone' });
  console.log(JSON.stringify(u, null, 2));
  await conn.close(); process.exit(0);
});
```

---

## 14. Where to start if you're new

1. Read `config/plans.js` (5 minutes) — understand the plan model.
2. Read `models/user.js` plan-related methods (10 minutes) — understand per-user state.
3. Trace one chapter request: `GET /chapter/3` in `index.js` → `user.canAccessChapter(3)` → render or redirect.
4. Trace one purchase: `POST /payment/create-order` → Razorpay → `POST /payment/verify-payment` → `user.addPlan(...)`.
5. Open `/admin` as an admin user, click around. Then read `routes/admin.js` and `public/clientadmin.js`.

You'll have the whole system in your head in under an hour.
