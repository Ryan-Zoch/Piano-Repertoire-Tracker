# 🎹 Piano Repertoire — a cozy practice journal

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

### 📊 Dashboard
A cozy welcome with your stats at a glance — total repertoire, sessions logged,
all-time time at the keys, and your current day-by-day practice streak — plus
your most recent sessions and what's currently on the music stand.

### 📖 Practice Log
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

### 🎼 Repertoire
Your personal database of pieces. Track title, composer, opus/catalog number,
key, difficulty, status (Wishlist → Learning → Polishing → Performance Ready →
Maintenance → On Hold), tags, favorites, and free-form notes. Search and filter
instantly. Each piece shows how much time you've poured into it.

> Tip: when logging practice you can type any piece name — if it isn't in your
> repertoire yet, it's added automatically so your library grows as you play.

### 📅 Calendar
A month view that glows warmer the more you practiced each day (like a cozy
heatmap). Click any day and its sessions appear in a panel right beside the
calendar (or below it on a narrow screen) — no pop-up to dismiss — where you can
review, edit, or log practice for that date.

### ☀️🌙 Day / night theme
A slider in the header switches between the warm cream "day" palette and a
candlelit "night" palette that's gentler on the eyes for afternoon and evening
practice. Your choice is remembered, and on a first visit the app picks a
sensible default based on the time of day.

### 💾 Import / Export (the **Data ▾** menu)
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

It lives in your browser's `localStorage` under the key
`piano-repertoire-tracker/v1`. That means:

- It stays private on your device — nothing is uploaded anywhere.
- It persists between visits in the **same browser**.
- Clearing your browser's site data will erase it — so export a backup now and
  then. ☕

## Project layout

```
index.html      — page shell, header, nav, modal & toast scaffolding
css/styles.css  — the warm, cozy theme
js/app.js       — all the logic (state, views, calendar, CSV/JSON, persistence)
```

Made for quiet evenings at the piano. Enjoy. 🕯️
