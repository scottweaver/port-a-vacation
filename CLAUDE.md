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
- **Supabase**: Postgres + Auth (Google OAuth + dev email/password, PKCE flow) + Realtime
- **Vercel** for deployment, auto-deploys on push to `main`
- **GitHub** for source (this repo). Release tags: `version/1.0` (Pack mode), `version/2.0` (offline tolerance + Online pill).
- **Vitest** for unit tests — pure helpers only (cache, queue, auth logic, format). No React Testing Library.

Project owner email is hardcoded as `scott.t.weaver@gmail.com` in two places: the SQL trigger (`handle_new_user`) and `src/lib/supabase.ts` as `OWNER_EMAIL`. Both auto-admin this user. Changing the owner requires updates in both spots.

---

## Architecture decisions worth knowing

### Data model: families + collaborative contributions

We deliberately did NOT do per-user lists. Instead:

- **`families`** (3 rows: Weavers, Ramirezes, Titsworths)
- **`profiles`** belong to one family (nullable until first login picks one)
- **`checklist_items`** are shared across all families; have `tracking_type` of `'quantity'`, `'task'`, or `'claim'`
- **`contributions`** are per-(item, family). Composite PK `(item_id, family_id)`. Quantity items use `quantity` column; task items use `done` boolean. **Claim items** are single-provider: exactly zero or one contribution row exists per item, with `done = true`. Enforced at the application layer (`useChecklist.claimItem` deletes other contributions then upserts; `unclaimItem` deletes all). RLS already permits the delete; no per-table constraint added because the trip's 8 users make race-window collisions negligible.
- **`packing_status`** (added in migration `0004`) is **family-private** — per-(item, family) with composite PK `(item_id, family_id)`, but RLS scopes both reads AND writes to the user's own family. Other families literally cannot see your packing progress. Absent row = unpacked, present row = packed. Pack is INSERT (via supabase upsert with `ignoreDuplicates: true` so no UPDATE policy needed); unpack is DELETE. Drives the Pack mode UI.

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

**Delete policy on checklist_items** (post-migration `0002`): admins can delete any item including the 74 seeded defaults; non-admin approved users can delete only non-default items they themselves created. The UI mirrors this — `ChecklistRow` shows the X for `(!item.is_default || isAdmin)`. The pattern keeps the seed list curated while letting any family member trim items they added by mistake.

### Static trip data lives in code

Weather forecast, tide chart, drive itinerary, restaurant/activity recommendations, info tiles, booked activities — all in `src/lib/trip-data.ts`. These are NOT in the database. Rationale: not collaborative, doesn't change frequently, and keeps the app fully functional even if Supabase is down mid-trip.

If a future change wants real-time weather/tides, Open-Meteo (free, no key) and NOAA Port Aransas station are good free sources. Just don't make this a hard dependency.

### Collapsible sections

The major sections on the Trip tab (Weather, Tide, Drive, BookedActivity, Checklists, Places, Info) are collapsible. Implemented as `<CollapsibleCard>` (`src/components/CollapsibleCard.tsx`) — a thin wrapper that takes `header` and `children` slots plus a `storageKey` and `userId`. Each card was refactored to pass its title/subtitle as the header and the rest as the body. CountdownCard and ProgressCard are intentionally not collapsible (short headlines, no value in hiding).

State persists in `localStorage` via `useCollapsedState` (`src/lib/useCollapsed.ts`), keyed `port-a:collapsed:<userId>:<sectionKey>`. Per-user-per-device — doesn't sync across devices and doesn't bleed between users on a shared device. Default is expanded.

Anchor scrolling from ProgressCard category tiles preserves the `cat-<key>` id on the section element, so deep-links still work. They scroll to a collapsed section if it's collapsed — auto-expand-on-anchor was considered and deferred.

### Offline tolerance

Tier-2 offline support (in-session): the app keeps working through brief network drops, queues writes to localStorage, and syncs on reconnect. **Not** a PWA — cold-loading the page still needs network for the bundle. Built on three pieces:

- **`src/lib/cache.ts`** — versioned (`port-a:cache:v1:<name>`) localStorage cache. Class with injectable storage so tests don't need jsdom. Defensive on every boundary: corrupted JSON is cleared on read; quota errors and unserializable values are dropped silently. Hooks hydrate from cache on first render, then refresh from the server. Persist on every state change. Bump `CACHE_VERSION` on schema changes — no migration path; the cache regenerates from the server.
- **`src/lib/queue.ts`** — `WriteQueue` persists ops to the cache so a tab close mid-flush doesn't lose work. FIFO with `enqueue` / `flush` / `subscribe`. Decoupled from Supabase via a `Sender` callback (production wiring in `queueSender.ts`, tests pass a fake). `classifyError` maps Postgres 23xxx (constraint) and 42xxx (permission) plus PostgREST RLS codes to `drop`; anything else retries up to `maxAttempts` (default 5).
- **`src/lib/online.ts`** — installed once from `main.tsx`. Listens to `window` online/offline events plus `visibilitychange→visible` as a backstop. On reconnect: notify subscribers and flush the write queue. Hooks subscribe via `subscribeReconnect` to refetch state that realtime may have dropped events for during the offline window.

Hook integration:
- **`useChecklist` / `usePacking`** hydrate from cache, persist on change, route all writes through `writeQueue.enqueue(...)` followed by an immediate `writeQueue.flush()` (which is a no-op offline). Old refetch-on-error logic is gone; the queue handles retry. The 250ms debounce per `(item, family)` key still coalesces rapid presses *before* enqueue.
- **`useFamilies` / `useProfiles`** hydrate from cache, persist on change. Read-only — no queue involvement.
- **`useChecklist.addCustomItem`** mints UUIDs client-side (`crypto.randomUUID()`) so the optimistic row matches the eventual server row even if queued offline. Schema accepts client-provided ids.

UI surface:
- **`TopBar`** always shows a connection pill: emerald **Online** (Wifi icon) when `navigator.onLine === true`, grey **Offline** (WifiOff icon) when not. Plus an amber **N** pending-writes badge whenever the queue is non-empty (with a spinner when online and currently flushing). All driven by `useOnline()` / `useQueueSize()` in `src/hooks/useOnline.ts`. Persistent connection feedback is intentional — Scott specifically asked for the green "Online" state rather than the absence of an indicator.

Auth resilience:
- **Expired-session-on-reload (Option B):** `useAuth` checks `session.expires_at` on initial getSession. If the cached session is expired AND we're offline, it skips straight to `signed-out` rather than rendering the dashboard with a token that would 401 every write.
- **Tab-focus-while-offline:** when Supabase's auto-refresh fails (no network), it emits a null session. We ignore null auth events while offline so the user stays where they were. Their cached profile carries the UI.
- **Token refresh for same user:** when Supabase emits a new session object for the user we already have, we preserve the current stage (no spinner flash) and just update the session reference.
- **Cached profile:** `useAuth` caches the user's own profile keyed `profile:<userId>`. Hydration on session-effect means the first paint shows the real user state, not a spinner. Cleared on `signOut`.
- The three offline-sensitive decisions live as pure helpers in `src/lib/authLogic.ts` with regression tests in `authLogic.test.ts`.

Conflict policy: last-write-wins for quantity items. With one person per family managing edits in practice, this is acceptable. If contention becomes real, the upgrade path is a server-side `adjust_quantity(item_id, family_id, delta)` RPC and sending deltas instead of absolutes.

Test coverage: 49 unit tests across `cache.test.ts` (9), `queue.test.ts` (18), `authLogic.test.ts` (13), `format.test.ts` (7), classifyError (2). Run with `npm test` (one-shot) or `npm run test:watch`. Vitest uses `environment: 'node'` (no DOM). Full hook tests would need RTL+jsdom — deliberately skipped; the offline-sensitive logic is extracted into pure helpers (see `authLogic.ts`) and tested there instead.

### Realtime UX

Optimistic updates with per-key debounced writes in `useChecklist` and `usePacking`. Quantity/task presses update local state via functional `setState` (so rapid clicks compound correctly), then a 250ms debounce per `(item, family)` key coalesces a burst into a single op. Same pattern in `usePacking` for pack/unpack toggles, 200ms debounce. After debounce, the op goes through the write queue (see Offline tolerance) — online: flushes immediately; offline: waits for reconnect. Pending debounce timers flush on `visibilitychange === 'hidden'` and on hook unmount so a tab close mid-debounce doesn't drop data.

Realtime channels:
- `profile:{userId}` (filtered to current user) — drives auth stage transitions
- `checklist-and-contributions` (both tables, one channel) — drives the checklist UI
- `packing-{familyId}` (filtered to own family via realtime `filter: 'family_id=eq.<uuid>'`) — drives the Pack screen
- `admin-pending-profiles` (admin-only) — drives the admin tab

When admin approves someone, the approved user's app re-routes from "pending" to "approved" within ~100ms via realtime, no refresh needed. Same with family changes.

### Pack mode

Day-of-departure view that's deliberately **separate from the dashboard**. Reached via the amber **Pack** button in `TopBar` (always visible for users with a family). Toggles `mode: 'dashboard' | 'pack'` state in `Dashboard.tsx`; when `'pack'`, `Dashboard` renders `<PackView>` instead of the normal `<TopBar>`+main layout. PackView has its own compact header with a back button.

Two panels, mobile-first `max-w-lg`:
- **Unpacked** (top, fixed/not-collapsible) — items the family has *committed to bring* on the dashboard that aren't yet packed, plus all per-family tasks that aren't yet done.
- **Packed** (bottom, collapsible, **default collapsed**) — same row component, with a check icon and line-through. Tap to unpack (puts the row back in the top panel).

What appears on the Pack screen:
- Quantity items — only if my family's `contribution.quantity > 0`
- Claim items — only if my family is the claimant (`contribution.done === true`)
- Task items — only if my family has **ticked** the task on the planning dashboard (`contribution.done === true`). Not auto-included.

"Packed" state lives uniformly in `packing_status` for all three types. The Trip-tab task tick is the **commit** step (= "we're doing this task"); the Pack-screen tick is the **execution** step (= "we actually did it / packed it"). They are independent: ticking a task on Trip makes it appear on Pack as *Unpacked* (not auto-checked); the user then has to tap it on Pack to move it to the Packed panel. Un-ticking on Trip removes it from Pack entirely; un-packing on Pack only moves it back to the Unpacked panel there.

The semantic shift to watch: for task items, `contributions.done` on Trip was originally read as "we did this." With Pack mode added, it's better read as "we've committed to do this." Same column, fuller meaning. Quantity/claim semantics on `contributions` are unchanged.

---

## Code conventions

- **`@/` path alias** for `src/` (configured in both `tsconfig.app.json` and `vite.config.ts`)
- **Discriminated unions for state**, e.g. `AuthStage` — switch on `.kind`, TypeScript narrows. Used in `useAuth`.
- **Hand-written DB types in `src/types/db.ts`** — NOT generated via `supabase gen types`. The schema is small and stable; hand-written is more readable.
- **Hooks own their own subscription lifecycle.** `useEffect` with `let cancelled = false` and `supabase.removeChannel(channel)` in cleanup. Always.
- **`cx()` for class names** (in `src/lib/format.ts`) — tiny clsx replacement, no external dep
- **No external state management** (Redux/Zustand/etc.). Hooks + lifted state has been sufficient.
- **No routing library.** `Dashboard.tsx` uses a `useState<Tab>('trip' | 'admin')` and a separate `useState<Mode>('dashboard' | 'pack')`. Pack mode swaps the whole post-TopBar render rather than showing as a tab. If deep links are ever needed, swap to react-router.

---

## Status & open work

### Release history

- **`version/1.0`** (launched 2026-05-16, commit `8757eea`) — initial release. Pack mode added on the same tag. Family members began using the app actively.
- **`version/2.0`** (launched 2026-05-17, commit `e628181`) — offline tolerance + Online/Offline pill + local-Supabase dev environment + Vitest. Schema unchanged since v1.0; entirely client-side work.

### Project state (current)

- ✅ Supabase project (ref: `swqeikhtqwpiykovszjp`, region us-east-1) with migrations 0001–0004 applied.
- ✅ Google OAuth wired (Cloud Console + Supabase). Test users added in Cloud Console "Audience" tab; consent screen still in **Testing** mode (we're under 100 known users, no need to verify).
- ✅ Vercel auto-deploys on push to `main`. Production URL is the canonical app URL (see Vercel dashboard → Domains).
- ✅ Local Supabase via the CLI for development (see "Local development" below).
- ✅ Vitest with 49 passing unit tests on the pure-logic layer (cache, queue, auth logic, format helpers).
- ✅ `npm run typecheck` clean, `npm test` clean.

`.env.local` holds prod Supabase values (gitignored). Production env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` live in Vercel project settings.

### Local development

Local Supabase runs via the CLI in Docker (added 2026-05-17). Don't develop against prod — the family is using it.

- `supabase start` boots local Postgres + Auth + Realtime + Studio. Studio at http://127.0.0.1:54323, API at http://127.0.0.1:54321, mailpit at http://127.0.0.1:54324.
- `supabase db reset` applies all migrations (0001–0004) to local and seeds 3 families + 74 items.
- `supabase status -o env` prints the local URL + anon JWT in env-var format.
- `.env.development.local` (gitignored) holds the local values; Vite loads it in dev mode and it overrides `.env.local`. So `npm run dev` hits local, `npm run build` still hits prod via `.env.local`.
- Migrations should be written, applied locally (`supabase db reset`), tested, then `supabase db push` to prod.
- **Dev sign-in:** SignInScreen renders a small amber "Dev sign-in" form below the Google button, gated by `import.meta.env.DEV` so it never appears in prod builds. Uses `supabase.auth.signInWithPassword`. After `supabase db reset` (or first `supabase start`), recreate the user:
  ```
  ./scripts/seed-local-user.sh
  ```
  Defaults: `scott.t.weaver@gmail.com` / `devdev123`. The `handle_new_user` trigger auto-admins this email, so on insert the user lands as approved + admin + Weavers without further setup. Override via env: `EMAIL=other@example.com PASSWORD=hunter2 ./scripts/seed-local-user.sh`.

### Post-launch operating notes

The app is live and in use — future work in this repo is shipping changes to a running system that the family depends on.

- Vercel production URL is the canonical app URL (see Vercel dashboard → Domains tab for current value).
- Any change to the production URL (custom domain, project rename) requires updating **three** places: Supabase Site URL, Supabase Redirect URLs, Google Cloud OAuth Authorized JavaScript origins.
- Google OAuth consent screen is still in **Testing** status — only emails on the test-users list can sign in. Add more there as needed; no redeploy required. We don't need to verify the app (under 100 known users).
- If a table doesn't push realtime updates, check Supabase → Database → Replication: `checklist_items`, `contributions`, `profiles` must be in the `supabase_realtime` publication.
- Google avatar images need `referrerPolicy="no-referrer"` to load (already set in code).
- Deployment auto-runs on push to `main` via Vercel's GitHub integration. Mind the family is using it — prefer PRs or local verification before pushing changes that touch UI or data flow.
- **For risky work, branch off main and don't push until tested.** v2.0 was developed on an `offline-mode` branch precisely to avoid shipping half-tested offline behavior to active users. Hotfixes off a tagged release: `git checkout -b hotfix-X version/2.0`.

### Things deliberately deferred / nice-to-haves

- Real weather data via Open-Meteo
- Real NOAA tide data for Port Aransas station
- Push notifications when someone updates the checklist
- Custom domain on Vercel
- A "trip is now active" mode that swaps countdown for "X hours left"
- Reconsider-denied-users UI (`reconsider` action exists in `useAdmin` but no button)
- **Make the "add custom item" form more discoverable.** The feature is already built (per-category inline form at the bottom of each `ChecklistSection`, with Count/Task toggle and delete affordance on user-added rows). Scott didn't notice it on the first prod look — it blends in below the item list. Lightest fix: add a top divider + small "Add a new item" label above the form. Stronger fix (more friction): collapse behind a "+ Add an item" button.
- **Auto-expand collapsed sections when scrolled-to via anchor.** Clicking a category tile in `ProgressCard` jumps to its `ChecklistSection` via `#cat-<key>`. If that section is collapsed, you land on a closed card. A small effect listening for hashchange that flips the collapsed state for the targeted key would fix this.
- **Theme the chevron color per card** in `CollapsibleCard`. Currently hardcoded to `text-slate-400`, which looks slightly off against the amber InfoPanel background. Add an optional `chevronClassName` prop or derive from a theme variant.

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