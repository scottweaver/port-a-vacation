# Port A 2026 — Family Trip Dashboard

Real-time collaborative dashboard for our Port Aransas family trip (May 25–29, 2026). Three families (Weavers, Ramirezes, Titsworths) sign in with Google, see weather/tides/drive info, and track shared packing with per-family quantities.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Realtime)
- Vercel for deploy

## One-time setup (~20–30 min)

### 1. Supabase project (2 min)

1. <https://supabase.com> → New Project. Name: `port-a-2026`. Pick `us-east-1`. Save the DB password.
2. After provisioning, go to **Project Settings → API**. Copy:
   - **Project URL**
   - **anon / public key**

### 2. Run the SQL (1 min)

1. Supabase → **SQL Editor → New query**
2. Paste contents of `supabase/migrations/0001_init.sql`
3. Run. Verify: `select count(*) from public.families;` → 3, `select count(*) from public.checklist_items;` → ~75

### 3. Google OAuth (~10 min)

#### Create Google Cloud project
1. <https://console.cloud.google.com> → top-bar project dropdown → **New Project** named `port-a-2026`.
2. Confirm it's selected.

#### Consent screen
1. **APIs & Services → OAuth consent screen**
2. **External** → Create.
3. App name: `Port A 2026`, your Gmail in support + dev contact fields.
4. Skip scopes. On Test users step, **add the Gmail of each family member** (including yours). Without this, only you can sign in while in testing mode.

#### Credentials
1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Type: **Web application**. Name: `Port A 2026 — Supabase`.
3. **Authorized redirect URI** (replace `xxxxx` with your Supabase project ref):
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
4. Create. Copy **Client ID** and **Client Secret**.

#### Wire Google → Supabase
1. Supabase → **Authentication → Providers → Google** → enable, paste Client ID + Secret.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: add `http://localhost:5173/**`

### 4. Run locally (3 min)

```bash
cp .env.example .env.local
# Edit .env.local: paste your Supabase URL + anon key
npm install
npm run dev
```

Open <http://localhost:5173>. Sign in with `scott.t.weaver@gmail.com` — you're auto-approved as admin.

### 5. Deploy to Vercel (5 min)

1. Push this repo to GitHub.
2. <https://vercel.com> → Add New → Project → import repo.
3. Framework: Vite (auto-detected).
4. Environment Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

### 6. Update Supabase + Google for prod URL (2 min)

In **Supabase → Authentication → URL Configuration**:
- Site URL → your Vercel URL (e.g. `https://port-a-2026.vercel.app`)
- Add `https://port-a-2026.vercel.app/**` to Redirect URLs

Google OAuth callback URL doesn't change.

### 7. Share with family

Send the Vercel URL. Each person: Sign in with Google → "Waiting for approval" → you approve in Admin tab → they pick their family → done.

## Local development

```bash
supabase start                       # local Postgres + Auth + Realtime in Docker
supabase db reset --local            # apply migrations 0001-0006, seed defaults
./scripts/seed-local-users.sh        # create 4 test users with fixed UUIDs + avatars
npm run dev                          # dev server on http://localhost:5173
```

`.env.development.local` (gitignored) points the dev build at local Supabase; `.env.local` is prod. `npm run dev` uses the dev env, `npm run build` uses prod. Sign-in screen shows quick-pick buttons for the seeded test users when running in dev.

## Release notes

Each shipped version has release notes at `public/release-notes/<X.Y>.md`. The same file feeds two surfaces:

- The in-app "What's new" modal (opened from the update banner).
- The GitHub release body — pass `--notes-file public/release-notes/<X.Y>.md` when running `gh release create`.

Write release notes targeting users (what changed for them), not engineers. Under-the-hood notes are welcome as a separate section if useful.

## Testing the version-update banner

The red "A new version is available" banner has two clickable buttons: the main text reloads the app; a "What's new" button on the right opens the release-notes modal. Manual test recipe in dev:

```bash
# Baseline: write the real SHA, then refresh the tab so the mount captures
# it. Header should show "v<tag> (<sha>)" matching git HEAD; no banner.
node scripts/write-version.mjs

# Trigger banner. Default: app_version=3.1, build_id=fake-<timestamp>.
./scripts/trigger-update-banner.sh
# (or specify your own: ./scripts/trigger-update-banner.sh 3.1 abc1234567)

# Within ~4s the banner appears. Header still shows the baseline version.
# Click the banner. Page reloads. The new mount fetches the fake version.json
# → header now shows v3.1 (abc1234), no banner.

# Cleanup:
node scripts/write-version.mjs
```

`./scripts/simulate-update.sh` writes a fake then auto-restores after 15s — useful for verifying the **auto-clear** path (banner appears and disappears on its own, no click needed) and the **realtime cascade** (open two tabs; the first to poll broadcasts on a Supabase channel so the second sees the banner within ~100ms instead of waiting up to 4s for its own poll).

Polling: 4s in dev, 3 min in prod. Broadcast is the fast path either way.

## Troubleshooting

- **"Invalid Refresh Token"**: clear cookies for the site, try again.
- **Approved user still on "Waiting"**: check **Database → Replication** has `profiles` enabled. Re-run migration if not.
- **Stale quantities**: refresh once; if persistent, check browser console for WebSocket errors.
- **Wipe & restart**: re-run `0001_init.sql` (drops + recreates everything).

## Project structure

```
port-a-2026/
├── public/
├── src/
│   ├── components/        # All React components
│   ├── hooks/             # useAuth, useChecklist, etc.
│   ├── lib/               # Supabase client, trip data, helpers
│   ├── types/             # DB types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/migrations/0001_init.sql
├── package.json
├── tsconfig*.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
└── index.html
```

## Cost

Zero at our scale. Supabase free tier: 500MB DB, 200 concurrent realtime connections. Vercel free tier: 100GB bandwidth/mo. Google OAuth: free.


