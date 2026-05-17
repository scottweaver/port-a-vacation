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
- ✅ Supabase project created (ref: `swqeikhtqwpiykovszjp`, region us-east-1)
- ✅ Migration applied via `supabase db push` (CLI). Verified: 3 families, 74 checklist items
- ✅ Google OAuth configured (Cloud Console client + Supabase provider wired); family test users added in Google Cloud Console "Audience" tab
- ✅ Local end-to-end working: Scott signs in with Google → DB trigger auto-approves + auto-admin + auto-Weaver-family → dashboard renders with Trip + Admin tabs, countdown, weather/tide tiles, 0/74 checklist
- ✅ Pushed to GitHub: https://github.com/scottweaver/port-a-vacation (public repo, `main` branch)
- ✅ Deployed to Vercel; Supabase Site URL + Redirect URLs updated to prod; Google Cloud OAuth Authorized JavaScript origin updated to prod
- ✅ **LIVE — family members are actively using the app and adding checklist contributions** (launched 2026-05-16, T-9 days from trip)

`.env.local` holds real Supabase values (gitignored). Production env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` live in Vercel project settings.

### Post-launch operating notes

The app is live and in use — future work in this repo is shipping changes to a running system that the family depends on.

- Vercel production URL is the canonical app URL (see Vercel dashboard → Domains tab for current value).
- Any change to the production URL (custom domain, project rename) requires updating **three** places: Supabase Site URL, Supabase Redirect URLs, Google Cloud OAuth Authorized JavaScript origins.
- Google OAuth consent screen is still in **Testing** status — only emails on the test-users list can sign in. Add more there as needed; no redeploy required. We don't need to verify the app (under 100 known users).
- If a table doesn't push realtime updates, check Supabase → Database → Replication: `checklist_items`, `contributions`, `profiles` must be in the `supabase_realtime` publication.
- Google avatar images need `referrerPolicy="no-referrer"` to load (already set in code).
- Deployment auto-runs on push to `main` via Vercel's GitHub integration. Mind the family is using it — prefer PRs or local verification before pushing changes that touch UI or data flow.

### Things deliberately deferred / nice-to-haves

- Real weather data via Open-Meteo
- Real NOAA tide data for Port Aransas station
- Push notifications when someone updates the checklist
- Custom domain on Vercel
- A "trip is now active" mode that swaps countdown for "X hours left"
- Reconsider-denied-users UI (`reconsider` action exists in `useAdmin` but no button)
- **Make the "add custom item" form more discoverable.** The feature is already built (per-category inline form at the bottom of each `ChecklistSection`, with Count/Task toggle and delete affordance on user-added rows). Scott didn't notice it on the first prod look — it blends in below the item list. Lightest fix: add a top divider + small "Add a new item" label above the form. Stronger fix (more friction): collapse behind a "+ Add an item" button.

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