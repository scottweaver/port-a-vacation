# CLAUDE.md — Project Context

This file gives Claude Code persistent context about this project. Read it on every session start.

**Maintenance directive:** Keep this file current as work progresses. When a session applies changes that affect any section below — status checkboxes, applied/deferred work, architecture decisions, conventions, or the "next major step" — update CLAUDE.md in the same session. Don't leave stale "not yet applied" notes after the work is done. Treat this as part of the task, not a follow-up.

---

## What this project is

A real-time, collaborative trip dashboard for the Weaver family's Port Aransas vacation (May 25–29, 2026). Eight people across three families (Weavers, Ramirezes, Titsworths) share a packing checklist with per-family quantities and binary tasks. Built quickly to be genuinely useful for one specific trip, not a generic product.

**Live audience:** Scott (admin), his wife, two kids (Isaac 13, Cordelia 10), plus the Ramirez and Titsworth families. Most users are non-technical relatives who'll use it on phones.

**Trip date:** May 25–29, 2026. The app needs to be deployed and approved-user-ready before then.

---

## Stack & deployment

- **Vite + React 18 + TypeScript** (strict mode, `noUncheckedIndexedAccess`)
- **Tailwind CSS 3** (NOT 4 — the v3 config story is more stable for now)
- **Supabase**: Postgres + Auth (Google OAuth, PKCE flow) + Realtime
- **Vercel** for deployment (target — not yet deployed)
- **GitHub** for source (this repo)

Project owner email is hardcoded as `scott.t.weaver@gmail.com` in two places: the SQL trigger (`handle_new_user`) and `src/lib/supabase.ts` as `OWNER_EMAIL`. Both auto-admin this user. Changing the owner requires updates in both spots.

---

## Architecture decisions worth knowing

### Data model: families + collaborative contributions

We deliberately did NOT do per-user lists. Instead:

- **`families`** (3 rows: Weavers, Ramirezes, Titsworths)
- **`profiles`** belong to one family (nullable until first login picks one)
- **`checklist_items`** are shared across all families; have `tracking_type` of `'quantity'` or `'task'`
- **`contributions`** are per-(item, family). Composite PK `(item_id, family_id)`. Quantity items use `quantity` column; task items use `done` boolean.

**Why:** packing is family-scoped in practice. "Did Scott bring sunscreen" is the wrong question — "did anyone bring enough sunscreen" is right. Each family edits their own row but anyone can edit anyone's (collaborative — Scott's wife can bump the Weaver number on Scott's behalf).

We considered and rejected: target quantities per item (added complexity for little value), per-user contributions (8 columns of mostly-zero), individual checkboxes (loses the "how many" question).

### Auth: Google OAuth + admin-gated approval

Three-stage gate after sign-in:

1. `pending` — user signed in with Google, awaiting Scott's approval
2. `needs-family` — approved but hasn't picked a family yet
3. `approved` — full access

Scott (hardcoded email) is auto-approved + auto-admin + auto-Weaver-family on first sign-in via the DB trigger. Other users go to pending.

We considered and rejected: email approval workflow with Resend + Edge Functions (overkill for 8 known people), hardcoded whitelist (less flexible), no auth at all (anyone with the URL).

### RLS is doing the security work

All four tables have RLS enabled. `is_approved()` and `is_admin()` are stable security-definer helpers used in policies. The user-facing client uses the anon key and cannot escape RLS. The `updated_by = auth.uid()` check on contribution writes prevents spoofing "updated by Scott" from another user's session.

### Static trip data lives in code

Weather forecast, tide chart, drive itinerary, restaurant/activity recommendations, info tiles — all in `src/lib/trip-data.ts`. These are NOT in the database. Rationale: not collaborative, doesn't change frequently, and keeps the app fully functional even if Supabase is down mid-trip.

If a future change wants real-time weather/tides, Open-Meteo (free, no key) and NOAA Port Aransas station are good free sources. Just don't make this a hard dependency.

### Realtime UX

Optimistic updates with rollback on error in `useChecklist.setContribution`. Three realtime channels:
- `profile:{userId}` (filtered to current user) — drives auth stage transitions
- `checklist-and-contributions` (both tables, one channel) — drives the checklist UI
- `admin-pending-profiles` (admin-only) — drives the admin tab

When admin approves someone, the approved user's app re-routes from "pending" to "approved" within ~100ms via realtime, no refresh needed. Same with family changes.

---

## Code conventions

- **`@/` path alias** for `src/` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- **Discriminated unions for state**, e.g. `AuthStage` — switch on `.kind`, TypeScript narrows. Used in `useAuth`.
- **Hand-written DB types in `src/types/db.ts`** — NOT generated via `supabase gen types`. The schema is small and stable; hand-written is more readable.
- **Hooks own their own subscription lifecycle.** `useEffect` with `let cancelled = false` and `supabase.removeChannel(channel)` in cleanup. Always.
- **`cx()` for class names** (in `src/lib/format.ts`) — tiny clsx replacement, no external dep
- **No external state management** (Redux/Zustand/etc.). Hooks + lifted state has been sufficient.
- **No routing library.** `Dashboard.tsx` uses a `useState<Tab>('trip' | 'admin')`. If deep links are ever needed, swap to react-router.

---

## Status & open work

### Setup status as of last session

- ✅ Project structure created on disk under `~/projects/port-a-2026/`
- ✅ `npm install` succeeded
- ✅ `npm run typecheck` passes clean
- ✅ Dev server runs at `http://localhost:5173`
- ✅ Sign-in screen renders correctly with countdown ticking
- ✅ Tailwind compiles, Google G logo renders, beach gradient visible
- ✅ SignInScreen visual tweaks applied (tighter title/card gap, more countdown breathing room, deeper background gradient — see commit history for specifics)
- ⛔ Supabase project NOT yet created
- ⛔ SQL migration NOT yet run
- ⛔ Google OAuth NOT yet configured
- ⛔ NOT yet deployed to Vercel

The placeholder `.env.local` (with `https://placeholder.supabase.co`) is what's loaded — Google sign-in won't work yet, but the rest of the app renders.

### Next major step: Supabase + OAuth + Vercel deployment

Follow `README.md` from "One-time setup" section. The big steps in order:

1. Create Supabase project at supabase.com (~2 min). Save project URL + anon key.
2. Run `supabase/migrations/0001_init.sql` in Supabase SQL Editor (~1 min). Verify with `select count(*) from public.families;` → 3 and `select count(*) from public.checklist_items;` → ~75.
3. Set up Google OAuth — this is the longest step (~10 min). Google Cloud Console → OAuth consent screen (External, add family Gmail addresses as test users), then Credentials → OAuth client ID for Web application with the Supabase callback URL `https://xxxxx.supabase.co/auth/v1/callback`.
4. Wire Google → Supabase: paste Client ID + Secret in Supabase Auth Providers, set Site URL to localhost initially.
5. Update `.env.local` with real Supabase values.
6. Test locally: sign in with `scott.t.weaver@gmail.com` — should auto-approve as admin.
7. Push to GitHub, deploy to Vercel, set the two env vars in Vercel dashboard.
8. Update Supabase Site URL and Redirect URLs to the Vercel production URL.

Common gotchas: OAuth consent screen "Test users" list — without adding family emails, only Scott can sign in. Realtime replication occasionally needs a re-run of the migration to actually enable. Google avatar images need `referrerPolicy="no-referrer"` to load (already set).

### Things deliberately deferred / nice-to-haves

- Real weather data via Open-Meteo
- Real NOAA tide data for Port Aransas station
- Push notifications when someone updates the checklist
- Custom domain on Vercel
- A "trip is now active" mode that swaps countdown for "X hours left"
- Reconsider-denied-users UI (`reconsider` action exists in `useAdmin` but no button)

---

## Working with Scott

Scott is technically sophisticated — strong TypeScript, daily Linux/CLI, comfortable with infra. He'll catch errors and push back on fabrication. Prefer:

- Direct technical explanations over hand-holding
- Honest tradeoff discussion ("X is simpler but loses Y") over single-option recommendations
- Acknowledging when something failed and fixing it, rather than glossing over
- Functional-leaning TypeScript patterns where they fit (discriminated unions, etc.)

Avoid:

- Marketing-style enthusiasm about features
- Unrequested abstractions or premature generalization
- Long preambles before doing the work