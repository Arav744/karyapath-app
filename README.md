# कार्यपथ — Karyapath

A workspace + task tracker with a Kanban board, built as a real client/server
application: an Express API backed by a pluggable storage layer (a local
JSON file out of the box, or Supabase/Postgres once you add credentials),
and a plain HTML/CSS/JS client that talks to it over `fetch()`.

## Quick start (runs immediately, no account needed)

```bash
cd server
npm install
npm start
```

Then open **http://localhost:4000** in your browser. The server serves the
client itself, so that's the only URL you need — there's nothing separate
to start for the front end.

The first time it runs, `server/data/db.json` is created automatically with
the starter users, workspaces, and tasks described below. Stop the server
and delete `server/data/db.json` at any time to reset everything back to
that starter state.

## Logging in

| ID | Password | Workspace(s) |
|---|---|---|
| `admin` | `admin` | All three — PSIPL, SEPL, Gaurav (admin can see and manage every top-level workspace) |
| `rajat` | `rajat` | PSIPL |
| `amit` | `amit` | PSIPL |
| `reema` | `reema` | PSIPL |
| `kanu` | `kanu` | SEPL |
| `praveen` | `praveen` | SEPL |
| `sales` | `sales` | SEPL |
| `accounts` | `accounts` | SEPL |
| `gaurav` | `gaurav` | Gaurav |

Any member can also create a **private sub-workspace** nested under a
workspace they belong to (via the avatar menu, top-right → "New private
workspace under..."). A private sub-workspace is visible only to the person
who created it — not other members of the parent workspace, and not even
`admin`.

## What's real and what isn't

- **Real**: login/sessions, workspace access control (membership + private
  sub-workspaces), tasks, drag-and-drop Kanban stage changes, archive/restore,
  all persisted through the API to whichever storage backend is active.
- **WhatsApp poke**: this does *not* send a message through any WhatsApp
  API. Clicking "Poke on WhatsApp" on a task logs the nudge (so the "last
  poked X ago" detail and daily-limit-of-5 are real) and opens a `wa.me`
  link with the message pre-filled, which launches WhatsApp Web or the
  WhatsApp app on the recipient's number — the same thing happens if you
  type a `wa.me` link into a browser yourself. Sending fully automatically
  without that hand-off would require Meta's WhatsApp Business API, which
  needs its own business account and approval process, separate from this
  app entirely.
- **"Main table" / "Dashboard" / "Integrate" / "Automate" tabs** on the
  board view are visual placeholders (intentionally disabled) — only
  "Kanban" is a working view in this build.
- **Due-date alerts**: real, server-side, and persisted. A background
  scheduler (`server/lib/scheduler.js`) checks every active task every 5
  minutes and creates an in-app notification for each assignee at 1 day,
  12h, 6h, 3h, 1h, 30m, and 15m before the due date/time, then once an
  hour after it's overdue, until the task is marked Done. Delivery is
  the in-app bell (top-right, web) — there's no push/email/SMS yet. Each
  threshold fires at most once per task per person even if the server
  restarts; if a task has been overdue for a long time before its first
  check, only the single most recent "still overdue" notification is
  shown rather than flooding the bell with one per missed hour.
- **Due time**: tasks now have an optional due *time* in addition to the
  date — needed because 30-minute/15-minute alert thresholds are
  meaningless against a date alone. A task with no due time is treated
  as due at 23:59 for alert purposes.
- **Mobile app**: a React Native (Expo) scaffold lives in `mobile/` —
  see `mobile/README.md`. It's real, runnable code (verified by parsing
  every file with Expo's actual Babel preset), but it has not been
  executed on a device or simulator, since neither exists in the
  environment this was built in. Treat it as a working starting point,
  not a finished, store-published app.

## Project structure

```
karyapath-app/
  server/
    index.js              Express app: routes, picks storage backend
    lib/
      auth.js              Login/session token handling
      access.js             Workspace visibility rules
      alerts.js             Alert threshold ladder + escalation logic
      scheduler.js           Background job: sweeps tasks every 5 min
      store-local.js       Default storage: a JSON file on disk
      store-supabase.js    Same interface, backed by Supabase/Postgres
      seed-supabase.js      One-time script to populate a Supabase project
    data/
      seed.js               Starter users/workspaces/tasks (single source of truth)
      schema.sql            Postgres schema for Supabase
      db.json               Auto-created local database (gitignore this)
    .env.example            Copy to .env to configure Supabase or the port
    package.json
    test-api.sh             Backend API test suite
    test-alerts.sh          Alert/notification test suite
  client/
    index.html
    app.js                  All UI logic; calls the API via fetch()
    styles.css              Dark theme, monospace font, Kanban board styles
  mobile/                  React Native (Expo) scaffold - see mobile/README.md
```

## Switching to Supabase

The app runs on a local JSON file by default so you can use it right away.
To move to real Postgres via Supabase:

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In your Supabase project: **SQL Editor** → paste the contents of
   `server/data/schema.sql` → Run. This creates all the tables.
3. In **Project Settings → API**, copy:
   - **Project URL**
   - **service_role** secret key (not the `anon` key — the server needs
     to bypass row-level security since this app does its own login
     checks rather than using Supabase Auth)
4. Copy `server/.env.example` to `server/.env` and fill in:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```
5. Load the starter data into your new project (one time only):
   ```bash
   cd server
   node lib/seed-supabase.js
   ```
6. Restart the server (`npm start`). The startup log will say
   `Storage backend: supabase` instead of `local-json` — everything else
   about the app behaves identically.

## Before deploying this anywhere real

A few things were deliberately simplified for a fast-moving demo and
should be hardened first:

- **Passwords are stored and checked as plain text** (see the comment in
  `server/lib/auth.js` and `server/data/schema.sql`). Swap in `bcrypt`
  hashing before this touches real user data.
- **Sessions are an in-memory token map** with no expiry — fine for one
  server process, not for multiple instances or long-term deployments.
- **Row Level Security is off** on the Supabase tables; the server's
  `service_role` key enforces access rules in application code instead
  (`server/lib/access.js`). If you ever let a browser talk to Supabase
  directly (bypassing this server), add RLS policies first.

## Running the test scripts

```bash
# Backend-only API tests (login, access control, tasks, pokes)
cd server && npm start &      # start the server first
bash test-api.sh

# Alert/notification system tests
bash test-alerts.sh

# Full end-to-end test (real client + real server together)
cd ..
node test-e2e.js
```
