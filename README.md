# UniNest

**Chat together. Keep what matters.**

A minimal, mobile-friendly group chat for college students. Sign in, talk in real
time, share files, and save anything important into a personal **Nest Egg** organised
by folder.

Built with React + Vite + Tailwind CSS and Supabase (Auth, Database, Realtime,
Storage).

---

## Features

- **Login page** — email + password sign-in via Supabase Auth, limited to
  **`@jecrcu.edu.in`** college addresses. The form validates the domain, and a
  `auth.users` trigger rejects any other sign-up server-side. Your display name lives
  in your profile and is what your groups see. Without Supabase keys the same page
  offers a local demo sign-in (name + email, stored in the browser) using the same
  domain check.
- **Groups** — create one with a name and optional college; every group gets a short
  invite code (e.g. `K7PM2Q`). Join a classmate's group by entering that code.
- **Real-time chat** — text plus file uploads (PDF, images, `.doc`/`.docx`, `.txt`,
  slides, spreadsheets) up to 10 MB, stored in Supabase Storage.
- **Save to Nest Egg** — every message and file has a *Save to Nest Egg* action.
  Pick a category (Notes, Assignments, Activity, Notices, Other) and optionally add a
  short title.
- **Nest Egg page** — category chips plus sections for every category, search, the
  group and date each item came from, and open / download / remove actions.
- **Participants** — tap the group name in a chat to see who is in the group, who
  created it, and the invite code (WhatsApp-style group info). The invite code is
  shown **only** there — not in the group list or the chat header.
- **Group admins** — whoever creates a group is its admin. From the group info sheet
  admins can rename the group, change its college, remove members, generate a new
  invite code (which invalidates the old one), and lock the chat so only admins can
  post. The creator cannot be removed.
- **Clean responsive design** — warm cream background, sage green accent, rounded
  bubbles, Inter font. On mobile the group list is a full-screen view; on desktop it
  sits in a left sidebar.

> **Prototype for college groups.**

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run dev
```

Open the printed URL (default [http://localhost:3000](http://localhost:3000)).

**No keys yet?** The app still runs in a local demo mode: the login page creates a
local account stored in `localStorage`, with groups, messages and saved items kept in
the browser. The footer shows a "Demo mode" badge. Add the Supabase env vars and
restart to switch to real accounts and the shared backend.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql)
   and run it. This creates profiles, groups, memberships, messages and Nest Egg
   items, all the row-level-security policies, the private `chat-files` bucket and
   the realtime publication.

   > The script starts by dropping any tables from the earlier no-auth prototype.
   > If you already ran that version, you will lose its prototype data. For an
   > existing account-based database, run
   > [`supabase/migrations.sql`](supabase/migrations.sql) instead — it applies the
   > folder and email-domain changes without touching your data.

3. Copy **Project URL** and the **anon public** key from **Project Settings → API**
   into `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

4. Check **Authentication → Providers → Email** is enabled. Supabase requires email
   confirmation by default; either leave it on and confirm the link after sign-up,
   or turn **Confirm email** off for local testing. If you keep it on, also add your
   dev URL under **Authentication → URL Configuration → Redirect URLs**.
5. Account emails are restricted to `@jecrcu.edu.in`: the login form checks the domain
   and the `handle_new_user` trigger aborts any other sign-up. To change the domain,
   edit [`src/lib/college.js`](src/lib/college.js) and the trigger in
   [`supabase/schema.sql`](supabase/schema.sql) to match.

Only the anon (public) key belongs in the frontend. Never put a service-role key in
`VITE_*` variables.

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Supabase anon/public key |

Copy [`.env.example`](.env.example) to `.env`. `.env` is git-ignored.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built frontend locally |

---

## Accounts, access and security

There is no client-side access control: every rule is enforced by Postgres RLS, so a
student cannot read another group's chat even if they edit the request.

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | your own row | insert/update your own row |
| `groups` | members of the group | create only via `create_group()` |
| `group_members` | your own rows, plus members of your groups | join only via `join_group()`; rename your own row; removal only via `remove_group_member()` (admins) |
| `messages` | members of that group | members, with `sender_id = auth.uid()` |
| `nest_egg_items` | **only the student who saved it** | own rows only |
| `storage.objects` (`chat-files`) | members of the group in the first path segment | members of that group |

- Joining is only possible with the invite code, handled by the `join_group(code)`
  security-definer function; groups are not enumerable.
- `chat-files` is **private**. The app requests one-hour signed URLs for the files it
  renders, so links are not permanently public.
- Nest Egg rows carry `user_id default auth.uid()`; every query is additionally
  scoped by RLS to the signed-in student, which is what makes "my saved items" work
  across devices.
- Uploaded files live under `<group_id>/…`; the storage policies check membership of
  that group for read, upload and delete.

To verify the isolation yourself: create two accounts, join the same group with the
invite code, and confirm each account only sees its own Nest Egg items while both see
the shared chat. Signed-out requests to the REST API with the anon key should return
no rows.

Accounts must use an `@jecrcu.edu.in` address. This is enforced twice: the login form
rejects other domains, and the `handle_new_user` trigger on `auth.users` raises an
exception, so a sign-up that bypasses the UI still fails. Existing accounts created
before this restriction are not removed.

---

## Deploying

`npm run build` produces two things:

- `dist/` — the static Vite frontend
- `dist-worker/index.js` — `worker/index.js` bundled as an ES module

### Freebuff Sites / Cloudflare Workers

[`deploy.json`](deploy.json) describes the deployment: the Worker serves the uploaded
assets and falls back to `env.ASSETS.fetch(request)` for the SPA. Point the Sites
deployer at that manifest.

Because `VITE_SUPABASE_*` values are **baked in at build time**, a deployment built
without them runs in demo mode for every visitor. Provide them in the build environment
before deploying to make accounts and the shared backend live.

### Vercel

Import the repo, add the two `VITE_SUPABASE_*` variables and deploy as a static site.

### Other hosts

Upload `dist/` to any static host, and add your deployed URL to Supabase
**Authentication → URL Configuration**.

> `npm run build:web` and `npm run build:worker` build each half separately.

---

## How it works

```
src/
  App.jsx                  session bootstrap, profile, groups, responsive shell
  components/
    AuthGate.jsx           login (Supabase email/password, or local demo sign-in)
    GroupInfo.jsx          participants sheet, invite code, creator
    Sidebar.jsx            groups, create/join dialogs, rename, sign out
    SaveToNestEggModal.jsx folder + title picker
    Footer.jsx             prototype disclaimer
  pages/
    HomePage.jsx           desktop empty state
    ChatPage.jsx           realtime chat, uploads, save-to-egg
    NestEggPage.jsx        saved items by folder, search, open/download/remove
  lib/
    supabase.js            client from env vars
    store.js               auth, data access, signed URLs (Supabase or demo)
    useFileUrls.js         resolves storage paths to signed URLs
    format.js              date / size / initials helpers
worker/index.js            Worker: static assets (Sites/Cloudflare)
deploy.json                Sites deployment manifest
supabase/schema.sql        tables, RPCs, policies, private bucket, realtime
```

`src/lib/store.js` exposes one API (`createGroup`, `joinGroup`, `listMessages`,
`sendMessage`, `subscribeMessages`, `saveToNestEgg`, `listNestEgg`, …) with a
Supabase implementation and a local demo one, so the UI is identical either way.

---

## Limitations

- Email + password only — no password reset screen, no magic links, no avatars.
- Group membership has no leave/remove flow, and messages are not paginated beyond
  the latest 300 per group.
- Attendance/college verification is not checked; anyone with a code can join.

---
