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
- **`hidden_items`** (added in migration `0005`) is **family-private** — same shape and family-scoped RLS as `packing_status`. Absent row = visible for this family; present row = hidden. Drives the per-category "Hidden items" subsection in `ChecklistSection` (default collapsed, shown only when N > 0). PackView also filters hidden items so hide-everywhere is the consistent UX.
- **`messages`** and **`thread_reads`** (added in migration `0006`) drive per-item conversation threads. `messages(id, item_id, author_id, content, created_at, edited_at)` is global-read (anyone approved can see any thread), but authors can only edit/delete their own. `thread_reads(item_id, user_id, last_read_at)` is self-only RLS — it's how each user tracks where they left off so unread badges work. Absent thread_reads row = "never read" = all messages count as unread.

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

### Conversations (per-item chat)

Every checklist item is its own conversation thread. Reached via a chat-bubble icon on each `ChecklistRow`. Modal is full-screen on mobile, centered card on desktop (`max-w-md`), with a faded palm-sunset background (`public/beach-bg.webp`, ~218KB WebP from Unsplash) under a 75% white overlay so bubbles stay legible.

**Schema:**
- `messages(id, item_id, author_id, content, created_at, edited_at)` — hard delete (no tombstones), edit content via UPDATE which triggers a `touch_message_edited_at` BEFORE UPDATE trigger to set `edited_at = now()`. Anyone approved reads any thread; authors can only edit/delete their own rows.
- `thread_reads(item_id, user_id, last_read_at)` — self-only RLS. Absent row = "never read." Updated on modal open via `markRead`.

**Hook (`useConversations`):**
- Eagerly loads **metadata only** for every message at page load — `id, item_id, author_id, created_at, edited_at`. Content stays server-side. Sufficient to compute per-item unread counts and message counts without N×content bandwidth.
- Lazily fetches **full content** for an item the first time its modal opens (`loadThread(itemId)`). Cached in a `Map<itemId, Message[]>` in state.
- Realtime channel listens to all `messages` (every change updates the metadata store + any loaded thread) and to `thread_reads` filtered to the current user.
- Writes (post / edit / delete / markRead) go through the offline `writeQueue` like every other mutation. Posts mint client-side UUIDs so optimistic IDs match server.
- **Conservative-win tradeoff:** posting in a thread you've never opened adds to metadata but NOT to the threads map; the message shows up if/when you open the thread. Fine at trip scale.

**UI:**
- `ConversationModal` renders standard messaging-app layout: avatar+bubble flex-row-reverse on own messages (right-aligned), flex-row on others (left). Per-user bubble color via FNV-1a + Murmur3 `fmix32` finalizer over user_id (`src/lib/messageColor.ts`) — the trivial djb2-style rolling hash collapsed adjacent UUIDs to identical hues; FNV alone wasn't enough either, the avalanche step was load-bearing.
- Avatar logic: render `profile.avatar_url` if present (Google OAuth photo or Dicebear in dev), fall back to a colored first-letter circle.
- `EmojiPicker` is an inline ~70-emoji curated grid (no external dep) opened from a Smile button next to Send. Inserts at the textarea cursor.
- **Cascading unread indicators:** three nested badges all clickable, all coral.
  - Top-bar pill (total across everything).
  - Per-category badge in each section header (counts items in that category).
  - Per-item badge on the chat-bubble icon.
  Clicking any of them calls `jumpToNextUnread(scope)` in `Dashboard` — finds the next unread item in display order (or the first if the cursor's gone stale), dispatches a `window.dispatchEvent(new CustomEvent('collapsible:expand', { detail: { storageKey } }))` to expand its category if collapsed, then `scrollIntoView({ behavior: 'smooth', block: 'center' })`. `CollapsibleCard` listens for that event to enable the expansion. Cursor is per-scope and ref-based so cycling doesn't trigger re-renders.

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
- **`version/2.1`** (launched 2026-05-17) — family-private hide list. Migration `0005` adds `hidden_items`. New per-category "Hidden items" subsection in `ChecklistSection`. `useHiddenItems` mirrors the `usePacking` pattern (family-scoped Set, cache hydration, queue-routed writes, realtime channel filtered to own family). Pack screen also filters hidden items.
- **`version/3.0`** (launched 2026-05-17) — per-item conversation threads. Migration `0006` adds `messages` + `thread_reads`. New `useConversations` hook splits eager metadata (every message minus content) from lazy thread content (loaded on modal open) so page-load payload stays small. ConversationModal renders chat with avatars + per-user-color bubbles + emoji picker + edit/delete on own messages + a faded palm-sunset background. Cascading unread indicators: top-bar pill (total) + per-category badge + per-item badge — all clickable to jump-to-next-unread, expanding collapsed sections on the way. Dev tooling: stable-UUID multi-user seeding, quick-pick buttons in the dev sign-in form, retry cap on `useAuth` profile lookups so a stale local JWT can't loop.
- **`version/3.1`** (launched 2026-05-17) — chat polish + self-announcing updates. Typing indicators (Supabase Realtime broadcast, ephemeral, no DB writes). Browser notifications for incoming messages when the tab is backgrounded. Version-update banner: red bar under the TopBar appears when `public/version.json` differs from the bundle's mounted version; clicking reloads; an "What's new" button opens an in-app `ReleaseNotesModal` that renders the bundled `public/release-notes/<X.Y>.md` via a tiny custom markdown component. Header subtitle shows `v<X.Y> (<short-sha>)`. URL linkification in chat messages. No schema changes. Fixed up in `2a6dec7` where Vercel's shallow clone stripped tags and produced `app_version=dev`; build script now tries `git describe` → `git fetch --tags && describe` → `package.json` `version` field in order.
- **`version/3.2`** (launched 2026-05-17) — live filter. Sticky search input under the TopBar on the trip tab (case-insensitive substring match against item labels). When non-empty: hides Countdown/Progress/Weather/Tide/Drive/Booked/Places/Info, drops categories with zero matches, force-opens matching collapsed sections via a new `forceOpen` prop on `CollapsibleCard`, hides the add-item form + hidden subsection inside matching sections, and skips hidden items entirely (hidden stays hidden under filter). Clear via X button or Esc. Empty state with one-click clear when no matches. Also fixed the version chip in the header subtitle being `hidden sm:block` — now visible on mobile too. No schema changes.
- **`version/3.6`** (launched 2026-05-18) — countdown confetti. When the trip-start countdown ticks past 0:0:0:0 (Mon May 25 08:00 CDT), `CountdownCard` fires a Gulf-palette `canvas-confetti` burst (three quick staggered shots, ~½ second total, colors: rose / coral / gold / pink / ocean). Added `canvas-confetti` + `@types/canvas-confetti` to dependencies (~10KB gzipped, no React deps). The celebration is gated by a single `useEffect([start.isPast])` plus a localStorage flag (`port-a:trip-start-celebrated`) — same path handles both "watching at the moment" (effect fires on the transition false→true) and "loading after the fact" (effect fires on initial mount with isPast=true). Flag is per-device, not synced — each browser/phone gets its own one-time burst. localStorage failure (private mode, quota) silently degrades to "confetti on every reload." No prod migration, no schema changes.
- **`version/3.5.3`** (launched 2026-05-18) — patch fix for toolbar layout shift. The right-side pill cluster in TopBar is right-anchored via the parent's `justify-between`, so any width change ripples through every sibling. The pending-writes badge (`{pendingWrites > 0 && ...}`) was inserted into that flex flow, so it pushed the Online pill (and Pack button, profile avatar, etc.) sideways every time a write was queued — which happens for ~½ second on every +/- press on a quantity item due to the 250ms debounce + Supabase round-trip. Moved the badge to absolute positioning (`right-full top-1/2 -translate-y-1/2 mr-1.5`) inside a new `<div className="relative">` wrapper around the connectivity pill. Badge now floats to the LEFT of Online without participating in flex layout — it appears and disappears with zero ripple effect.
- **`version/3.5.2`** (launched 2026-05-18) — patch fix for profile dropdown z-stacking. The title-row container in TopBar was at `z-30` (bumped from `z-20` in this patch); the previous `z-20` tied with the search-input container's `z-20` (set in v3.3.1 so the cream input box punches through the palm image at `z-10`), and DOM order put the dropdown below. The Change-family / Sign-out menu's lower portion (the part that overhangs into the filter bar area) got covered by the search input. Title row now sits above both palm (z-10) and search input (z-20) at z-30; everything else unchanged. Layering documented as: z-10 palm = atmospheric backdrop, z-20 search input = punches through palm, z-30 title row + dropdown = above everything.
- **`version/3.5.1`** (launched 2026-05-18) — re-ship of v3.5 (same feature content). v3.5 tag was created but the deploy errored on Vercel because `src/components/Dashboard.tsx` was missing from the `git add` command at commit time — local typecheck had the working-directory file and passed, but the commit had the stale Dashboard that didn't know about `ingredients` / `onAddIngredient` / `onDeleteIngredient` props on MealsCard, so Vercel hit TS2739. The prod migration (0008) had already applied successfully and v3.4 stayed live on prod. v3.5.1 includes the Dashboard wiring; functionally identical to what v3.5 was supposed to ship.
- **`version/3.5`** (launched 2026-05-18) — Phase 2 of cook-at-the-condo: per-meal ingredients + per-meal collapse. Migration `0008_meal_ingredients.sql` adds `meal_ingredients(id, meal_id, name, quantity TEXT, notes, sort_order, created_by)`. New `can_edit_meal_ingredients(target_meal_id)` security-definer SQL helper resolves to head_chef OR sous_chef OR admin; all write policies route through it so the write rules stay aligned with the meal's chef roster as it changes. `useMeals` extended with `ingredients: Map<meal_id, MealIngredient[]>`, `addIngredient`, `deleteIngredient`; realtime channel covers all three meal-domain tables in one subscription. New queue ops `meal_ingredients/insert` and `meal_ingredients/delete`. UI: each `MealRow` now has its own per-user `useCollapsedState(`meal:${id}`)` defaulting to collapsed; one-line summary shows meal-type label + title + head chef name, chevron toggles. Expanded reveals notes, sous-chef row, edit pencil, and an Ingredients sub-section (default expanded if any exist; collapsible separately). `AddIngredientForm` scripts Enter-key flow: Enter in quantity advances to name; Enter in name submits and returns focus to quantity for rapid list entry. Phase 3 (shopping list — generated from ingredients OR manually added) deferred.
- **`version/3.4`** (launched 2026-05-18) — Phase 1 of cook-at-the-condo support: meal plan with head chef + sous chef opt-ins. Migration `0007_meals.sql` adds `meals(id, meal_date, meal_type CHECK in (breakfast/lunch/dinner/other), title, notes, head_chef_id, created_by)` and `meal_sous_chefs(meal_id, user_id, joined_at)` with composite PK. **Trip-level**, NOT family-private like packing/hidden — all approved users read all meals; head chef + admin write the meal row; self-INSERT/DELETE on sous chef opt-ins (+ head chef/admin can remove anyone). New `useMeals` hook follows the cache+realtime+queue pattern (sort by date then meal_type). New `MealsCard` (CollapsibleCard between BookedActivityCard map and CATEGORIES map) groups meals by day with meal-type emojis (🥞/🌮/🍝/🍿). New `MealFormModal` for create/edit with day picker (5 trip dates), meal-type buttons, title, notes, head-chef select; two-tap delete confirm. Queue ops + queueSender extended with `meals` (insert/update/delete) and `meal_sous_chefs` (insert/delete). Phase 2 (per-meal ingredients) and Phase 3 (shopping list) deferred for follow-up releases.
- **`version/3.3.4`** (launched 2026-05-17) — last item from the original Gulf-vibes list (#5 — decorative accent). Three small seagull silhouettes added as a stroked SVG (`fill="none" stroke="currentColor"`) in the upper-left of the gradient bar, sized w-20 sm:w-24 at 40% opacity in `text-dusk-900`. Hand-drawn pelican silhouette was tried first and looked nothing like a bird at small render sizes — pivoted to the universal "shallow-M-with-rounded-arcs" seagull silhouette which reads as bird-in-flight at any size. Three gulls at varied sizes/y-positions for depth. z-10 so they sit behind the title text (z-20) if there's any overlap.
- **`version/3.3.3`** (launched 2026-05-17) — patch fix for palm-image anchoring. The img was a direct child of `<header>` with `bottom-0`, which means its bottom anchor was the header's bottom — so when the update banner appeared, the header grew and the image was pulled down over the "What's new" button on the banner's right side. Wrapped the gradient bar + filter bar in a new `<div className="relative">` (the sky+ocean container) and moved the img inside it. Image now anchors to the wrapper's bottom (= filter bar bottom, or gradient bar bottom when no filter is showing), never extending into the update banner. The update banner remains a sibling of the wrapper and renders cleanly below it.
- **`version/3.3.2`** (launched 2026-05-17) — patch fix for the chat-modal background. The faded palm-sunset photo (`public/beach-bg.webp`) was set on the same element that handles message scrolling with `background-attachment: local`, which causes the background to scroll WITH the content — users saw the visible portion drift from palm tree to sailboats as they scrolled. Restructured the chat body into three stacked absolute layers (background image, white 75% overlay, scroll area) inside a `flex-1 relative overflow-hidden` container, so the background is anchored to the container and the scrolling happens on a transparent layer on top. Also changed `background-position` from `center` to `left center` so the palm tree is the visible focal point regardless of modal aspect ratio. `scrollRef` moved inline to the new innermost scrolling element; auto-scroll-to-bottom behavior unchanged.
- **`version/3.3.1`** (launched 2026-05-17) — patch fix for the v3.3 palm-sunset header. Mobile users saw the palm-tree silhouette overlapping the search input area (the image extends from the gradient bar down into the filter bar, and on narrow viewports its right portion sat on top of the input). Fix: `relative z-20` on the inner search-input container (the existing `<div className="relative">` that holds the input + icons), not on the filter bar wrapper. This keeps the dusk→ocean gradient at z-auto so the palm-sunset image still renders on top of it (preserving the "island in the ocean" effect), but the cream search box punches through at z-20 wherever it overlaps the palm. First patch-level release for the project; `write-version.mjs` already strips only a trailing `.0` from `package.json` version, so `"3.3.1"` stays `"3.3.1"` and the in-app modal correctly fetches `/release-notes/3.3.1.md`.
- **`version/3.3`** (launched 2026-05-17) — Gulf-coast visual pass. No behavior or schema changes. **Header**: sunset gradient (dusk-800 → sunset-500 → sunset-300, diagonal), title in Caveat 700 (loaded via Google Fonts), `theme-color` meta swapped to dusk-800, version chip now visible on mobile (was `hidden sm:block`). Hand-coded palm SVG was iterated then replaced with a real vector asset (`public/palm-sunset.svg`) anchored to the bottom of the whole sticky header so the island silhouette rests against the bottom edge of the filter bar; z-10 on the image and z-20 on the title content div so palm sits behind text but above gradient bg. **Filter bar**: bg swapped from white to `bg-gradient-to-b from-dusk-600 to-ocean-700` (the "ocean" the palm-island sits in); search input retinted to `bg-sand-100` with `border-sand-200` for warm-coordinated focus surface. White wave divider that originally separated gradient bar from white filter bar was removed (now reads as a thick white band against the ocean). **Cards**: all dashboard card backgrounds swapped from `bg-white` to `bg-sand-50` (CollapsibleCard DEFAULT_CLASSNAME, ProgressCard, AdminPanel sections, Dashboard filter empty state). Modal-style surfaces (ConversationModal, auth-flow screens) deliberately kept white. **Per-category color wash on ChecklistSections**: each category card gets a thin colored top stripe (gradient from full color on left to 40% on right) + a faint diagonal `bg-gradient-to-br` corner wash on the body at `/25` opacity + a colored `shadow-md` glow cast downward from the stripe. tintFade element transitions opacity 100%↔50% smoothly when card is expanded/collapsed. New CategoryMeta fields: `tint` / `tintFade` / `tintShadow`. New Tailwind tokens: `dusk-{600..900}`, `sunset-{300..600}`, `sage-400` (`#9caf88` — kitchen), `lavender-400` (`#c0a8d8` — games); the muted sage/lavender replaced stock emerald-500/violet-500 which were too saturated against the other categories.

### Release checklist

Steps to ship a release (e.g., `version/3.2`). Each manual step matters — skipping the package.json bump or the release-notes file will break either the header display, the GitHub release, or both.

1. **Write release notes** at `public/release-notes/<X.Y>.md`. Target users in a `## What's new` section. Engineering notes can go in `## Under the hood`. Same content powers the in-app modal AND the GitHub release body.
2. **Bump `package.json` `version`** to match (e.g., `"3.1.0"`). Required failsafe: Vercel's shallow clone may not surface git tags, so `scripts/write-version.mjs` falls back to package.json. Without the bump, the deployed `app_version` ends up `"dev"`, the header reads `v dev (<sha>)`, and the "What's new" button hides itself.
3. **Commit** (notes file + package.json bump in one commit is fine).
4. **Tag**:
   ```bash
   git tag -a version/<X.Y> -m "v<X.Y>: <one-line summary>" HEAD
   ```
5. **Push** main and the tag:
   ```bash
   git push origin main
   git push origin version/<X.Y>
   ```
6. **Create the GitHub release** from the same notes file:
   ```bash
   gh release create version/<X.Y> --title "v<X.Y> — <title>" --notes-file public/release-notes/<X.Y>.md
   ```
7. **Vercel auto-deploys** on the push to main. Watch the build log via `mcp__plugin_vercel_vercel__get_deployment_build_logs` (or the dashboard) and confirm: `wrote version.json build_id=<sha> app_version=<X.Y>`. If `app_version=dev` slips through, the package.json bump was missed — fix and push again.
8. **Add the entry** to "Release history" above in this file, including a one-paragraph what-changed summary.

The Vercel + write-version chain works like this:
- `vercel build` runs `npm run build` → `node scripts/write-version.mjs && tsc -b && vite build`.
- `write-version.mjs` writes `public/version.json` with `{build_id, app_version, built_at}` BEFORE `vite build` so the file is bundled into `dist/` and served at `/version.json` on the deployed site.
- `build_id` comes from `VERCEL_GIT_COMMIT_SHA` (the env var Vercel exposes) — always present, never the failure mode.
- `app_version` tries three sources: (a) `git describe --tags --abbrev=0` (works locally where tags exist; fails on Vercel due to shallow clone), (b) `git fetch --tags origin --depth=1` then describe (sometimes works on Vercel; depends on auth/network), (c) `package.json` `version` field (always works as long as someone remembered to bump it).
- The package.json path normalizes `"3.1.0"` → `"3.1"` (only strips a trailing `.0` patch component) so it matches the tag style. Without this, the in-app release-notes modal would fetch `/release-notes/3.1.0.md` and miss the actual file at `/release-notes/3.1.md`.

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
- `supabase db reset --local` applies all migrations (0001–0006) to local and seeds 3 families + 74 items. **Always `--local`** — bare `supabase db reset` would target the prod remote; banned for this project.
- `supabase status -o env` prints the local URL + anon JWT in env-var format.
- `.env.development.local` (gitignored) holds the local values; Vite loads it in dev mode and it overrides `.env.local`. So `npm run dev` hits local, `npm run build` still hits prod via `.env.local`.
- Migrations should be written, applied locally (`supabase db reset --local`), tested, then `supabase db push` to prod (forward-only).
- **Dev sign-in:** SignInScreen renders a small amber "Dev sign-in" form below the Google button, gated by `import.meta.env.DEV` so it never appears in prod builds. Quick-pick buttons sign in as any of the seeded test users in one click; manual form is still there too.
- **Version banner test cycle:** the update-available banner (red bar under the TopBar) has two clickable buttons: the main "tap to update" area reloads the app, and a "What's new" button on the right opens an in-app modal with release notes (fetched from `public/release-notes/<app_version>.md`). Both buttons are visible on mobile. "What's new" is suppressed when `app_version === 'dev'`. The modal falls back to a "View on GitHub" link if the version's markdown file isn't bundled.

  **Release-notes single source of truth:** when shipping a new release, write `public/release-notes/<X.Y>.md`, then use that same file for the GitHub release body:
  ```bash
  gh release create version/3.1 --title "v3.1 — …" --notes-file public/release-notes/3.1.md
  ```
  The in-app modal and the GitHub release stay in sync.

  The dev test cycle:

  ```bash
  # Establish baseline: write public/version.json with the current git SHA so
  # mounted-version matches and no banner shows.
  node scripts/write-version.mjs

  # Refresh your browser. Header shows "v<tag> (<sha>)" matching version.json.
  # No banner.

  # Trigger the banner (defaults to app_version=3.1, build_id=fake-<timestamp>):
  ./scripts/trigger-update-banner.sh
  # Override either: ./scripts/trigger-update-banner.sh 3.1 abc1234567

  # Within ~4s (POLL_INTERVAL_MS in dev), the red banner appears in your tab.
  # Click the banner. window.location.reload() fires. The new mount fetches
  # the fake public/version.json → header now shows v3.1 (abc1234) → no
  # banner (mount == current).

  # Cleanup:
  node scripts/write-version.mjs   # back to current git SHA
  ```

  Alternative `./scripts/simulate-update.sh` — writes a fake, sleeps 15s, restores. Useful for verifying the **auto-clear** path (banner appears, then disappears 15s later because the poll finds the restored version matches mount). Doesn't show a header change because mount-time and post-restore values are the same.

  Two-tab cascade test: trigger the banner with the manual recipe; open a second tab (regular + incognito). Both should show the banner — the first tab's poll detects, broadcasts on `app-version` Supabase channel, second tab lights up within ~100ms without waiting for its own poll.

  `__BUILD_ID__` and `__APP_VERSION__` are NOT baked into the bundle — they're fetched at runtime from `/version.json` so the header reflects what the server is currently serving (which lets the click→reload→new-mount path actually change the displayed version in dev). In prod that "what the server is serving" matches the new bundle, same effect for free.

- **Multi-user seeding:** `./scripts/seed-local-users.sh` creates four test users with stable UUIDs (so browser sessions survive resets) and Dicebear avatars (so the avatar code path renders something in dev):
  - `scott.t.weaver@gmail.com` / `devdev123` — admin, Weavers (auto-admin via `handle_new_user` trigger matching this email)
  - `weaver-2@test.local` / `dev` — Weavers
  - `ramirez@test.local` / `dev` — Ramirezes
  - `titsworth@test.local` / `dev` — Titsworths

  The `DEV_USERS` array in `SignInScreen.tsx` mirrors this list — keep them in sync when adding test users. Override via `EMAIL=… PASSWORD=… ./scripts/seed-local-users.sh`.

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