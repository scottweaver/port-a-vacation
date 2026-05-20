# Port A 2026 — Family Trip Dashboard

Real-time collaborative dashboard for our Port Aransas family trip (May 25–29, 2026). Three families (Weavers, Ramirezes, Titsworths) sign in with Google, see weather/tides/drive info, track shared packing with per-family quantities, claim "I'll bring it" items, chat per-item, and check items off on a separate Pack screen on the day of departure.

For deep architectural context, data model rationale, and the full release history, see **`CLAUDE.md`** — it's the canonical doc for how and why the project is built the way it is.

> **License:** dual-licensed under [AGPL-3.0-or-later](./LICENSE) (free) or a [commercial license](./COMMERCIAL-LICENSE.md) (paid alternative for parties that don't want AGPL obligations). See [`LICENSING.md`](./LICENSING.md) for which one you need.

## Stack

- **Vite + React 18 + TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS 3** (NOT v4 — v3 is more stable for now)
- **Supabase**: Postgres + Auth (Google OAuth + dev email/password) + Realtime
- **Vitest** for unit tests on the pure-logic layer (cache, queue, auth logic, format helpers, link/typing helpers, weather/tide parsers) — 85+ tests, `environment: 'node'` so no DOM dependency
- **Caveat** display font (Google Fonts) for the title; system stack for body
- **Vercel** for deploy, auto on push to `main`

## Quick start (local development)

This is the **recommended path** — don't develop against prod, the family is using it.

### Prerequisites

- Node 20+ and npm
- Docker (for local Supabase)
- Supabase CLI: `brew install supabase/tap/supabase`
- GitHub CLI (for the release flow): `brew install gh`

### Boot the local stack

```bash
npm install
supabase start                       # local Postgres + Auth + Realtime in Docker
supabase db reset --local && ./scripts/seed-local-users.sh   # apply all migrations + reseed test users in one shot
supabase status -o env > .env.development.local   # local URL + anon key for Vite
npm run dev                          # dev server on http://localhost:5173
```

**⚠️ Always chain the seed after a reset.** `supabase db reset --local` wipes `auth.users`, so the four test accounts disappear until the seed script reruns. Forget this and you'll hit "invalid credentials" on every dev login.

**⚠️ Always pass `--local` to `supabase db reset`.** Bare `supabase db reset` would target the prod remote; that's banned for this project.

Open <http://localhost:5173>. The sign-in screen has an amber "Dev sign-in" form (only rendered in dev builds, gated by `import.meta.env.DEV`) with quick-pick buttons for the seeded test users:

- `scott.t.weaver@gmail.com` / `devdev123` — auto-admin, Weavers
- `weaver-2@test.local` / `dev` — Weavers
- `ramirez@test.local` / `dev` — Ramirezes
- `titsworth@test.local` / `dev` — Titsworths

### Day-to-day commands

```bash
npm run dev              # dev server (uses .env.development.local → local Supabase)
npm run build            # prod build (uses .env.local → prod Supabase). Runs write-version.mjs first.
npm run typecheck        # tsc -b --noEmit
npm test                 # vitest run (one-shot)
npm run test:watch       # vitest in watch mode
```

### Two-env-file pattern

- `.env.local` — **prod** Supabase values. Loaded in all modes unless a mode-specific file overrides.
- `.env.development.local` — **local** Supabase values. Overrides `.env.local` in dev mode.

Both are gitignored. `npm run dev` picks up local; `npm run build` produces a prod bundle.

## Forking this project (one-time setup)

If you're using this as a starting template for your own trip, you'll need to do a couple of things in addition to the local-stack steps above.

### Set the owner identity

The frontend reads two env vars (both shown on the Pending / Denied screens so users know who to nudge):

```
VITE_OWNER_EMAIL=you@example.com       # used in the mailto link
VITE_OWNER_NAME=YourFirstName          # used in "X needs to approve you" copy
```

Add them to `.env.local` for local prod-like builds and to your Vercel project env (Production) for the deployed app. If `VITE_OWNER_EMAIL` is omitted the mailto link is suppressed and the screens fall back to generic copy; if `VITE_OWNER_NAME` is omitted the screens derive a name from the email local-part (e.g. `scott.t.weaver@…` → "Scott").

### Change the SQL-trigger owner email

There's still one hardcoded reference that needs editing before you apply migrations: the `handle_new_user` trigger in **`supabase/migrations/0001_init.sql`** (line ~102) auto-admins the email it matches on first Google sign-in. Search-and-replace `scott.t.weaver@gmail.com` with your own email there. *(Planned follow-up: move this into an `app_config` table so it's a one-line SQL UPDATE post-deploy instead of a source edit.)*

The dev tooling also references this email in a few places (`scripts/seed-local-users.sh`, `src/components/SignInScreen.tsx` `DEV_USERS` array). These are dev-only (gated by `import.meta.env.DEV`) and never ship to prod, but you'll want to update them so your local test users can pick "admin" via the quick-pick form.

### Set up your own Supabase project (~5 min)

1. <https://supabase.com> → New Project. Save the DB password.
2. **Project Settings → API** — copy the **Project URL** and **anon / public key** into `.env.local`.
3. Link the CLI and push migrations:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push      # applies all migrations (0001–0010 as of v3.12.1) to the linked remote
   ```
   Verify in SQL Editor: `select count(*) from public.families;` → 3, `select count(*) from public.checklist_items;` → 74.

### Google OAuth (~10 min, optional but needed for prod)

#### Create a Google Cloud project

1. <https://console.cloud.google.com> → top-bar project dropdown → **New Project**.
2. Confirm it's selected.

#### Consent screen

1. **APIs & Services → OAuth consent screen** → **External** → Create.
2. App name, your Gmail in support + dev contact fields.
3. On Test users step, **add the Gmail of each family member**. Without this, only you can sign in while the consent screen is in testing mode (which is fine — no need to verify under 100 known users).

#### Credentials

1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Type: **Web application**. Authorized redirect URI:
   ```
   https://<your-supabase-ref>.supabase.co/auth/v1/callback
   ```
3. Copy **Client ID** and **Client Secret**.

#### Wire Google → Supabase

1. Supabase → **Authentication → Providers → Google** → enable, paste Client ID + Secret.
2. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL once deployed (e.g. `https://your-project.vercel.app`)
   - Redirect URLs: `https://your-project.vercel.app/**`

### Deploy to Vercel (~5 min)

1. Push the repo to GitHub.
2. <https://vercel.com> → Add New → Project → import repo. Framework: Vite (auto-detected).
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OWNER_EMAIL`, `VITE_OWNER_NAME`.
4. Deploy. Vercel auto-deploys on every push to `main` from then on.

If you change the deployed URL later (custom domain, project rename), update **three** places: Supabase Site URL, Supabase Redirect URLs, Google Cloud OAuth Authorized JavaScript origins.

### Share with family

Send the Vercel URL. Each person: Sign in with Google → "Waiting for approval" → you approve in the Admin tab → they pick their family → done.

## Architecture overview

Just enough to navigate the code; full rationale in `CLAUDE.md`.

### Data model

- **`families`** — 3 rows (Weavers, Ramirezes, Titsworths)
- **`profiles`** — one per signed-in user, belongs to one family
- **`checklist_items`** — shared across all families, 74 seed items + user-added ones. `tracking_type` is `'quantity'`, `'task'`, or `'claim'`
- **`contributions`** — per-(item, family). Quantity items use `quantity`; task and claim items use `done`. Composite PK
- **`packing_status`** (migration 0004) — **family-private** per-(item, family). Drives the Pack screen. RLS scopes both reads + writes to the user's own family
- **`hidden_items`** (migration 0005) — family-private hide list, same pattern
- **`messages` + `thread_reads`** (migration 0006) — per-item chat threads. `messages` are global-read but author-only-write; `thread_reads` is self-only RLS so unread counts work per-user

### Security

All tables have RLS enabled. `is_approved()` and `is_admin()` are stable security-definer helpers used in policies. The user-facing client uses the anon key and cannot escape RLS. The `updated_by = auth.uid()` check on contribution writes prevents spoofing "updated by someone else" from another user's session.

### Auth gate

Three stages after Google sign-in:

1. `pending` — awaiting admin approval
2. `needs-family` — approved but hasn't picked a family yet
3. `approved` — full access

The owner (email hardcoded in the `handle_new_user` SQL trigger, see "Forking" above) is auto-approved + auto-admin + auto-assigned to the first-seeded family on first sign-in.

### Offline tolerance

In-session offline support (not a PWA — cold loads still need the bundle). Three pieces:

- `src/lib/cache.ts` — versioned localStorage cache. Hooks hydrate from cache on first render, persist on every state change.
- `src/lib/queue.ts` — `WriteQueue` persists ops to cache so a tab close mid-flush doesn't lose work. Auto-retries with exponential backoff; permission/constraint errors drop.
- `src/lib/online.ts` — listens to `online`/`offline` events + `visibilitychange→visible`. Flushes the queue on reconnect; refetches data realtime may have dropped events for during the offline window.

UI: persistent `Online`/`Offline` pill in the TopBar + amber pending-writes badge when the queue is non-empty.

### Hooks own subscription lifecycle

`useEffect` with `let cancelled = false` and `supabase.removeChannel(channel)` in cleanup. Always.

### Static trip data is in code, not the DB

`src/lib/trip-data.ts` holds the weather forecast, tide chart, drive itinerary, restaurant/activity recommendations, booked activities, info tiles. Not collaborative, doesn't change often, keeps the app functional even if Supabase is unreachable.

## Release process

Each shipped version has release notes at `public/release-notes/<X.Y>.md` (or `<X.Y.Z>.md` for patch releases). The same file feeds two surfaces:

- The in-app "What's new" modal (opened from the red update banner).
- The GitHub release body — pass `--notes-file public/release-notes/<X.Y>.md` to `gh release create`.

Write release notes targeting users, not engineers. Under-the-hood notes are fine as a separate section.

### Minimum-ceremony release flow

```bash
# 1. Write public/release-notes/<X.Y>.md (or <X.Y.Z>.md for patches)
# 2. Bump package.json "version" to match (REQUIRED — see "Versioning gotcha" below)
# 3. Update CLAUDE.md "Release history" with a one-paragraph summary
# 4. Commit + tag + push + release in one chain:
git add CLAUDE.md package.json public/release-notes/X.Y.md src/
git commit -m "vX.Y: <one-line summary>"
git tag -a version/X.Y -m "vX.Y: ..." HEAD
git push origin main
git push origin version/X.Y
gh release create version/X.Y --title "vX.Y — ..." --notes-file public/release-notes/X.Y.md
```

Vercel auto-deploys on the push to `main`. Verify the build log shows `wrote version.json … app_version=X.Y` (use the Vercel MCP or the dashboard). If `app_version=dev` slips through, the package.json bump was missed.

### Versioning gotcha

Vercel's shallow clone often doesn't surface git tags, so `scripts/write-version.mjs` tries three paths in order:

1. `git describe --tags --abbrev=0` — works locally where tags exist
2. `git fetch --tags origin --depth=1` then describe — usually works on Vercel
3. `package.json` `version` field — failsafe; **always works as long as you bumped it**

The package.json path normalizes a trailing `.0` away (so `"3.1.0"` → `"3.1"` to match the tag style `version/3.1`), but `"3.1.1"` stays `"3.1.1"`. If you forget to bump and `git describe` doesn't find a tag, `app_version` falls through to `"dev"` and the in-app "What's new" button is suppressed.

## Testing the version-update banner

The red "A new version is available" banner has two clickable buttons: the main text reloads the app; a "What's new" button on the right opens the release-notes modal. Manual test recipe in dev:

```bash
# Baseline: write the real SHA, then refresh the tab so the mount captures
# it. Header shows "v<tag> (<sha>)" matching git HEAD; no banner.
node scripts/write-version.mjs

# Trigger banner. Default: app_version=3.1, build_id=fake-<timestamp>.
./scripts/trigger-update-banner.sh
# (or specify: ./scripts/trigger-update-banner.sh 3.1 abc1234567)

# Within ~4s the banner appears. Click it. Page reloads → new mount fetches
# the fake version.json → header now shows v3.1 (abc1234), no banner.

# Cleanup:
node scripts/write-version.mjs
```

`./scripts/simulate-update.sh` writes a fake then auto-restores after 15s — useful for verifying the **auto-clear** path (banner appears and disappears on its own) and the **realtime cascade** (open two tabs; the first to poll broadcasts on a Supabase channel so the second sees the banner within ~100ms instead of waiting up to 4s for its own poll).

Polling: 4s in dev, 3 min in prod. Broadcast is the fast path either way.

## Troubleshooting

- **Tailwind classes not showing up after a `tailwind.config.js` edit** — the dev server caches the JIT scan. Restart with `pkill -f vite && npm run dev`.
- **"Invalid Refresh Token"** — clear cookies for the site and sign in again.
- **Approved user still on "Waiting"** — check **Database → Replication** has `profiles` enabled. The realtime stage transition relies on it.
- **Stale quantities** — refresh once; if persistent, check the browser console for WebSocket errors (Supabase realtime channel disconnect).
- **`app_version=dev` in prod** — package.json wasn't bumped before the release commit. Bump it and push again.
- **Wipe and restart local** — `supabase db reset --local` re-runs all migrations and seeds. **Never drop the `--local`** — bare reset targets prod.

## Project structure

```
port-a-2026/
├── public/
│   ├── beach-bg.webp         # Faded palm-sunset background for chat modal
│   ├── palm-sunset.svg       # Vector art for the header decoration
│   └── release-notes/        # Per-version markdown notes (X.Y.md)
├── scripts/
│   ├── write-version.mjs     # Writes public/version.json at build time
│   ├── seed-local-users.sh   # Creates 4 dev users with stable UUIDs
│   ├── trigger-update-banner.sh  # Manual banner test
│   └── simulate-update.sh    # Auto-clear / cascade banner test
├── src/
│   ├── components/           # React components
│   ├── hooks/                # useAuth, useChecklist, useConversations, …
│   ├── lib/                  # supabase client, trip-data, cache, queue, …
│   │   └── *.test.ts         # Vitest unit tests (co-located)
│   ├── types/db.ts           # Hand-written DB types (not generated)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql                       # families, profiles, checklist_items, contributions, RLS
│       ├── 0002_admin_can_delete_defaults.sql
│       ├── 0003_add_claim_tracking_type.sql
│       ├── 0004_packing_status.sql             # family-private pack tracking
│       ├── 0005_hidden_items.sql               # family-private hide list
│       ├── 0006_messages.sql                   # per-item chat + thread_reads
│       ├── 0007_meals.sql                      # meals + sous chefs
│       ├── 0008_meal_ingredients.sql           # per-meal ingredient list
│       ├── 0009_condo_info.sql                 # single-row condo info (admin-editable)
│       └── 0010_shopping_list.sql              # family-private shopping list
├── CLAUDE.md                 # Canonical project context + release history
├── LICENSE                   # AGPL-3.0 — pure canonical FSF text (so GitHub auto-detects)
├── NOTICE                    # Copyright header + dual-license note
├── LICENSING.md              # Which license you need + dual-license rationale
├── COMMERCIAL-LICENSE.md     # Plain-English commercial option summary
├── COMMERCIAL-TERMS.md       # Substantive commercial terms (placeholder; lawyer review pending)
├── CLA.md                    # Individual Contributor License Agreement
├── CLA-CORPORATE.md          # Corporate Contributor License Agreement
├── .env.example
├── package.json
├── tsconfig*.json
├── vite.config.ts
├── tailwind.config.js
└── index.html
```

## Licensing & contributing

Port A 2026 is **dual-licensed**. Pick the one that fits your use:

- **[AGPL-3.0-or-later](./LICENSE)** (free) — personal forks, hobby use, internal company tools that comply with AGPL's source-release obligations.
- **[Commercial license](./COMMERCIAL-LICENSE.md)** (paid, annual) — proprietary products / SaaS deployments that don't want to release modifications under AGPL. Contact <scott.t.weaver@gmail.com>.

Full guide in [`LICENSING.md`](./LICENSING.md).

### Contributing

All contributions to this repo are made under a Contributor License Agreement so the dual-licensing model can work:

- Individuals (personal time, own copyright): [`CLA.md`](./CLA.md)
- Employees on company time: [`CLA-CORPORATE.md`](./CLA-CORPORATE.md)

By opening a PR you confirm you've read the relevant CLA and agree to its terms. CLA-bot integration (cla-assistant.io) is a planned follow-up.

> **Legal review.** The AGPL-3.0 text is the canonical FSF original. The commercial and CLA documents are modeled on widely-used dual-licensing patterns (Apache, Plausible, Cal.com) but have not been reviewed by counsel — they're a reasonable starting point, not legal advice. For binding commercial agreements or contributor disputes, get a lawyer.

## Cost

Zero at our scale. Supabase free tier: 500MB DB, 200 concurrent realtime connections. Vercel free tier: 100GB bandwidth/mo. Google OAuth: free.
