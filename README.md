# Piano Repertoire — a cozy practice journal

A warm, candlelit little web app for logging your piano practice and keeping
track of your repertoire. No accounts, no servers, no install — everything is
saved right in your browser on this device, and you can export/import a CSV
anytime to back things up or move between computers.

> Pour something warm, sit down, and let's make a little music.

## Getting started

There's nothing to build or install. Just open **`index.html`** in any modern
browser (Chrome, Edge, Firefox, Safari).

- **Easiest:** double-click `index.html`.
- Or right-click it → *Open with* → your browser.

Want it to feel like a real website with a friendly address? Drop the folder
on any static host — **GitHub Pages**, Netlify, or Vercel all work with zero
configuration, since it's just plain HTML/CSS/JS.

## What it does

### Dashboard
A cozy welcome with your stats at a glance — total repertoire, sessions logged,
all-time time at the keys, and your current day-by-day practice streak — plus
your most recent sessions and what's currently on the music stand.

### Practice Log
Log a practice session with **multiple pieces, each with its own details** —
not just notes. For every piece you can record:

- **Minutes** spent
- **Tempo (BPM)** reached — so you can watch a piece speed up over time
- **Practice focus** — Technique, Sight-reading, Memorization, Musicality, or
  Run-through
- **How it went** — a quick 1–5 star rating
- **Notes** for that piece
- **Focus for next time** — and the next time you log that same piece, the app
  gently reminds you what you wanted to work on 🎯

Add a mood, overall session notes, and the date too. Edit or delete any session
later.

### Repertoire
Your personal database of pieces. Track title, composer, opus/catalog number,
key, difficulty, status (Wishlist → Learning → Polishing → Performance Ready →
Maintenance → On Hold), tags, favorites, and free-form notes. Search and filter
instantly. Each piece shows how much time you've poured into it.

> Tip: when logging practice you can type any piece name — if it isn't in your
> repertoire yet, it's added automatically so your library grows as you play.

### Calendar
A month view that glows warmer the more you practiced each day (like a cozy
heatmap). Click any day and its sessions appear in a panel right beside the
calendar (or below it on a narrow screen) — no pop-up to dismiss — where you can
review, edit, or log practice for that date.

### Works on your phone too
The site is fully responsive — open it on a phone (or narrow your browser) and it
switches to a layout tailored for small screens: a thumb-friendly **bottom tab
bar**, full-width cards, a simplified calendar, and dialogs that slide up as
**bottom sheets**. On a desktop it stays the roomy two-column layout. Because
it's a static site, the phone version is delivered automatically by the browser
based on screen size — no separate mobile app or address needed. Add it to your
home screen for an app-like feel.

### Day / night theme
A slider in the header switches between the warm cream "day" palette and a
candlelit "night" palette that's gentler on the eyes for afternoon and evening
practice. Your choice is remembered, and on a first visit the app picks a
sensible default based on the time of day.

### Cloud sync across devices (optional)
Sign in with just your email (a passwordless **magic link**) and your repertoire
and practice log sync automatically across your phone and computer. It's
**off by default** — until you set it up, everything stays local on the device.
Sync merges intelligently per-record, so editing on two devices never clobbers
your data, and deletions propagate too. See **Cloud sync setup** below to enable
it. (If you don't set it up, the app works exactly as before.)

### Import / Export (the **Data ▾** menu)
- **Export Repertoire (CSV)** — one row per piece.
- **Export Practice Log (CSV)** — one row per piece you practiced, grouped by
  session (so multi-piece sessions stay intact on re-import).
- **Import CSV** — auto-detects whether the file is repertoire or a practice
  log by its column headers. Re-importing repertoire updates matching titles
  instead of duplicating them.
- **Full Backup (JSON)** / **Restore Backup** — a complete snapshot of
  everything, perfect for moving devices.

## CSV formats

**Repertoire**

```
Title, Composer, Catalog, Status, Difficulty, Key, Tags, Favorite, TotalMinutes, Notes, DateAdded
```

**Practice log** (one row per piece practiced)

```
SessionId, Date, Mood, Piece, Composer, Minutes, Tempo, Focus, Rating, PieceNotes, NextFocus, SessionNotes
```

Both are standard, spreadsheet-friendly CSVs — commas, quotes, and line breaks
inside notes are handled correctly, so you can open and edit them in Excel,
Numbers, or Google Sheets.

## Where is my data?

By default it lives only in your browser's `localStorage` under the key
`piano-repertoire-tracker/v1`. That means:

- It stays private on your device — nothing is uploaded anywhere.
- It persists between visits in the **same browser**.
- Clearing your browser's site data will erase it — so export a backup now and
  then.

If you enable **Cloud sync**, a copy is also stored in Supabase so it can follow you across devices.

<!-- ## Cloud sync setup

Cloud sync is optional and uses **[Supabase](https://supabase.com)** (free tier
is plenty) for passwordless email sign-in and storage. The whole thing takes
about 5 minutes and needs no server of your own. Magic links require the site to
be served over HTTPS — which **GitHub Pages already is**, so you're set.

### 1. Create a Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a new project
   (any name; remember the database password — you won't need it here, but
   Supabase does).
2. Wait for it to finish provisioning (~1 minute).

### 2. Create the data table
In the Supabase dashboard, open **SQL Editor → New query**, paste this, and run:

```sql
-- One row per user, holding their whole tracker document as JSON
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock it down so each person can only ever touch their own row
alter table public.user_data enable row level security;

create policy "own row - read"   on public.user_data
  for select using (auth.uid() = user_id);
create policy "own row - insert" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "own row - update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3. Point auth at your GitHub Pages URL
Go to **Authentication → URL Configuration** and set:
- **Site URL:** your published URL, e.g. `https://YOURNAME.github.io/Piano-Repertoire-Tracker/`
- **Redirect URLs:** add the same URL with a wildcard so the magic link can
  return to the page: `https://YOURNAME.github.io/Piano-Repertoire-Tracker/**`

(Email sign-in is enabled by default under **Authentication → Providers →
Email** — no need to change it.)

### 4. Add your keys to the app
Open **Project Settings → API** and copy the **Project URL** and the **anon
public** key. Paste them into [`js/config.js`](js/config.js):

```js
window.PRT_CONFIG = {
  supabaseUrl: "https://YOURPROJECT.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...your-anon-key...",
};
```

The anon key is **safe to commit** — it's meant for browsers, and Row Level
Security (step 2) is what actually protects your data. Commit and push so
GitHub Pages picks it up.

### 5. Sign in
Reload the site, click **☁ Sync** in the header, enter your email, and tap the
magic link in your inbox **on the device you want to sign in**. Repeat on your
phone with the same email and your data appears on both. Sync runs automatically
after every change and whenever you return to the app.

### Notes & tips
- **Click the link on the device you're signing in.** If you request it on your
  laptop but open the email on your phone, you'll be signed in on the phone.
- **Optional 6-digit codes:** to sign in by typing a code instead of clicking
  the link, edit **Authentication → Email Templates → Magic Link** and include
  `{{ .Token }}` in the email body. The code box in the Sync dialog will then
  work.
- **Email limits:** Supabase's built-in email is rate-limited and meant for
  light use. For heavier use, add your own SMTP under **Authentication → SMTP
  Settings**.
- **Erasing data while signed in** removes it from every signed-in device (it's
  a real, syncing delete) — export a backup first if unsure. -->

## Project layout

```
index.html      — page shell, header, nav, modal & toast scaffolding
css/styles.css  — the warm, cozy theme
js/app.js       — all the logic (state, views, calendar, CSV/JSON, sync, persistence)
js/config.js    — your Supabase keys for optional cloud sync (blank by default)
```

Made for quiet evenings at the piano. Enjoy.

## AI Use Disclosure

This website, in it's entirety, was vibe coded with Claude Opus 4.8 in Claude Code. The reason I chose to develop this website this way is because I wanted to get it working quickly in order to start keeping track of my different piano pieces.

Also, if you notice any issues with the site, feel free to open a new issue on the github website. 
Thank you for your understanding!