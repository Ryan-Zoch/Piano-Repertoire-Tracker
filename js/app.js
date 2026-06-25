/* =========================================================
   Piano Repertoire — app.js
   Zero-dependency single-file logic.
   Data lives in localStorage; CSV/JSON for import & export.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Constants ---------- */
  const STORAGE_KEY = "piano-repertoire-tracker/v1";
  const THEME_KEY = "piano-repertoire-tracker/theme";
  const STATUSES = ["Wishlist", "Learning", "Polishing", "Performance Ready", "Maintenance", "On Hold"];
  const DIFFICULTIES = ["Beginner", "Early Intermediate", "Intermediate", "Late Intermediate", "Advanced", "Virtuoso"];
  const MOODS = [
    { v: "", label: "— mood —" },
    { v: "🌟", label: "🌟 In the zone" },
    { v: "🙂", label: "🙂 Good" },
    { v: "😌", label: "😌 Calm" },
    { v: "😐", label: "😐 So-so" },
    { v: "😤", label: "😤 Frustrated" },
    { v: "🥱", label: "🥱 Tired" },
  ];
  const FOCUS_TYPES = ["Technique", "Sight-reading", "Memorization", "Musicality", "Run-through"];

  /* ---------- State ---------- */
  let db = { pieces: [], sessions: [] };
  let currentView = "dashboard";
  let calCursor = startOfMonth(new Date()); // which month the calendar shows
  let calSelected = todayISO();             // which day's detail panel is shown

  /* ---------- Small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function todayISO() { return toISO(new Date()); }
  function toISO(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function startOfMonth(d) { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), 1); }

  function prettyDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" });
  }

  function fmtMinutes(mins) {
    mins = Math.round(Number(mins) || 0);
    if (mins <= 0) return "0 min";
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m} min`;
  }

  function statusClass(status) {
    return "pill--" + String(status || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  }

  /* ---------- Persistence ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        db.pieces = Array.isArray(parsed.pieces) ? parsed.pieces : [];
        db.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      }
    } catch (e) {
      console.warn("Could not load saved data:", e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      toast("Couldn't save — storage may be full or blocked.", "bad");
      console.error(e);
    }
  }

  /* ---------- Theme (day / night) ---------- */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "night" ? "night" : "day";
  }
  function applyTheme(theme) {
    const night = theme === "night";
    document.documentElement.setAttribute("data-theme", night ? "night" : "day");
    const toggle = $("#theme-toggle");
    const thumb = $("#theme-thumb");
    if (toggle) toggle.setAttribute("aria-checked", String(night));
    if (thumb) thumb.textContent = night ? "🌙" : "☀️";
  }
  function loadTheme() {
    let theme = null;
    try { theme = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (theme !== "night" && theme !== "day") {
      const h = new Date().getHours();
      theme = (h >= 18 || h < 6) ? "night" : "day"; // a cozy default by time of day
    }
    applyTheme(theme);
  }
  function toggleTheme() {
    const next = currentTheme() === "night" ? "day" : "night";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    toast(next === "night" ? "Night theme — easy on the eyes 🌙" : "Day theme ☀️");
  }

  /* ---------- Derived data ---------- */
  function pieceById(id) { return db.pieces.find((p) => p.id === id) || null; }

  function findPieceByTitle(title) {
    const t = String(title || "").trim().toLowerCase();
    if (!t) return null;
    return db.pieces.find((p) => p.title.trim().toLowerCase() === t) || null;
  }

  // Ensure a piece exists for a typed title; create a stub if needed. Returns the piece.
  function ensurePiece(title, composer) {
    title = String(title || "").trim();
    if (!title) return null;
    let p = findPieceByTitle(title);
    if (!p) {
      p = newPiece({ title, composer: (composer || "").trim() });
      db.pieces.push(p);
    } else if (composer && !p.composer) {
      p.composer = composer.trim();
    }
    return p;
  }

  function newPiece(over = {}) {
    return Object.assign(
      { id: uid(), title: "", composer: "", difficulty: "", status: "Learning",
        musicalKey: "", catalog: "", tags: [], favorite: false, notes: "", dateAdded: todayISO() },
      over
    );
  }

  function sessionsForPiece(pieceId) {
    const out = [];
    db.sessions.forEach((s) => s.entries.forEach((e) => { if (e.pieceId === pieceId) out.push({ session: s, entry: e }); }));
    return out;
  }

  function pieceMinutes(pieceId) {
    return sessionsForPiece(pieceId).reduce((sum, x) => sum + (Number(x.entry.minutes) || 0), 0);
  }

  // Most recent "focus for next time" left for a piece, so we can surface it when it's played again.
  function lastNextFocusForPiece(pieceId, exceptSessionId) {
    if (!pieceId) return "";
    let best = null;
    db.sessions.forEach((s) => {
      if (s.id === exceptSessionId) return;
      s.entries.forEach((e) => {
        if (e.pieceId === pieceId && e.nextFocus && e.nextFocus.trim()) {
          if (!best || s.date > best.date || (s.date === best.date && (s.createdAt || 0) > best.createdAt)) {
            best = { date: s.date, createdAt: s.createdAt || 0, text: e.nextFocus.trim() };
          }
        }
      });
    });
    return best ? best.text : "";
  }

  function sessionMinutes(s) {
    return s.entries.reduce((sum, e) => sum + (Number(e.minutes) || 0), 0);
  }

  function sortedSessions() {
    return db.sessions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  }

  function totalMinutes() { return db.sessions.reduce((s, x) => s + sessionMinutes(x), 0); }

  // Consecutive-day streak counting back from today (or yesterday if today not logged yet).
  function practiceStreak() {
    const days = new Set(db.sessions.map((s) => s.date));
    if (!days.size) return 0;
    let streak = 0;
    let cursor = new Date();
    if (!days.has(toISO(cursor))) cursor.setDate(cursor.getDate() - 1); // allow "haven't practiced yet today"
    while (days.has(toISO(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  /* =========================================================
     Rendering — router
     ========================================================= */
  function render() {
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === currentView));
    const view = $("#view");
    if (currentView === "dashboard") view.innerHTML = renderDashboard();
    else if (currentView === "log") view.innerHTML = renderLog();
    else if (currentView === "pieces") view.innerHTML = renderPieces();
    else if (currentView === "calendar") view.innerHTML = renderCalendar();
    wireView();
    view.focus({ preventScroll: true });
  }

  function setView(v) { currentView = v; render(); }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    const total = totalMinutes();
    const streak = practiceStreak();
    const learning = db.pieces.filter((p) => p.status === "Learning" || p.status === "Polishing");
    const recent = sortedSessions().slice(0, 4);

    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 5) return "Burning the midnight oil";
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      if (h < 21) return "Good evening";
      return "A peaceful night";
    })();

    return `
      <div class="view-head">
        <div>
          <h2>${greeting} 🍵</h2>
          <p>Pour something warm, sit down, and let's make a little music.</p>
        </div>
        <button class="btn" data-action="new-session">＋ Log a practice</button>
      </div>

      <div class="grid stats">
        ${stat("Repertoire", db.pieces.length, db.pieces.length === 1 ? "piece" : "pieces")}
        ${stat("Practice sessions", db.sessions.length, "logged")}
        ${stat("Time at the keys", fmtMinutes(total), "all-time")}
        ${stat("Current streak", streak, streak === 1 ? "day in a row" : "days in a row")}
      </div>

      <div class="grid dash-cols" style="margin-top:16px">
        <div class="card">
          <h3 class="section-title">Recent practice</h3>
          ${recent.length ? recent.map(sessionMiniHTML).join("") :
            `<p class="muted">No sessions yet. Your first one is the coziest — <a href="#" data-action="new-session">log a practice</a>.</p>`}
        </div>
        <div class="card">
          <h3 class="section-title">On the music stand</h3>
          ${learning.length ? learning.slice(0, 8).map((p) => `
            <div class="mini-piece">
              <div>
                <div class="mini-piece__title">${escapeHtml(p.title)}</div>
                <div class="mini-piece__meta">${escapeHtml(p.composer || "—")} · <span class="pill ${statusClass(p.status)}">${escapeHtml(p.status)}</span></div>
              </div>
              <div class="mini-piece__minutes">${fmtMinutes(pieceMinutes(p.id))}</div>
            </div>`).join("") :
            `<p class="muted">Nothing in progress. Add a piece in <a href="#" data-action="goto-pieces">your repertoire</a> to start learning.</p>`}
        </div>
      </div>
    `;
  }

  function stat(label, value, sub) {
    return `<div class="stat">
      <div class="stat__label">${escapeHtml(label)}</div>
      <div class="stat__value">${escapeHtml(value)}</div>
      <div class="stat__sub">${escapeHtml(sub || "")}</div>
    </div>`;
  }

  function sessionMiniHTML(s) {
    const titles = s.entries.map((e) => e.title).filter(Boolean);
    const label = titles.length ? titles.join(", ") : "Practice";
    return `<div class="mini-piece">
      <div>
        <div class="mini-piece__title">${escapeHtml(label)} ${s.mood ? `<span>${s.mood}</span>` : ""}</div>
        <div class="mini-piece__meta">${escapeHtml(prettyDate(s.date))}</div>
      </div>
      <div class="mini-piece__minutes">${fmtMinutes(sessionMinutes(s))}</div>
    </div>`;
  }

  /* ---------- Practice Log ---------- */
  function renderLog() {
    const sessions = sortedSessions();
    return `
      <div class="view-head">
        <div>
          <h2>Practice Log</h2>
          <p>Every session, with separate notes for each piece you touched.</p>
        </div>
        <button class="btn" data-action="new-session">＋ Log a practice</button>
      </div>
      ${sessions.length ? sessions.map(sessionCardHTML).join("") : emptyState(
        "📖", "Your journal is waiting",
        "Log your first practice session — add as many pieces as you like, each with its own notes.",
        "new-session", "Log a practice")}
    `;
  }

  // Read-only rating: filled gold stars + faint remainder
  function starsRead(n) {
    n = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    if (!n) return "";
    return `<span class="stars-read" title="${n} of 5 this session">${"★".repeat(n)}<span class="stars-read__off">${"★".repeat(5 - n)}</span></span>`;
  }

  // Shared renderer for one practiced piece, used by the log cards and the calendar day modal
  function entryLineHTML(e) {
    const chips = [];
    if (e.focus) chips.push(`<span class="chip">${escapeHtml(e.focus)}</span>`);
    if (e.tempo) chips.push(`<span class="chip chip--tempo">♩ = ${escapeHtml(e.tempo)}</span>`);
    const stars = starsRead(e.rating);
    if (stars) chips.push(stars);
    return `<div class="entry-line">
      <div class="entry-line__title">${escapeHtml(e.title || "Untitled")}</div>
      <div class="entry-line__min">${e.minutes ? fmtMinutes(e.minutes) : ""}</div>
      ${chips.length ? `<div class="entry-line__meta">${chips.join(" ")}</div>` : ""}
      ${e.notes ? `<div class="entry-line__notes">${escapeHtml(e.notes)}</div>` : ""}
      ${e.nextFocus ? `<div class="entry-line__next">🎯 Next time: ${escapeHtml(e.nextFocus)}</div>` : ""}
    </div>`;
  }

  function sessionCardHTML(s) {
    const entries = s.entries.map(entryLineHTML).join("");

    return `<article class="session" data-id="${s.id}">
      <div class="session__head">
        <span class="session__date">${escapeHtml(prettyDate(s.date))}</span>
        ${s.mood ? `<span class="session__mood" title="mood">${s.mood}</span>` : ""}
        <span class="session__total">${fmtMinutes(sessionMinutes(s))}</span>
      </div>
      ${s.notes ? `<p class="session__notes">${escapeHtml(s.notes)}</p>` : ""}
      <div class="session__entries">${entries || `<span class="muted">No pieces recorded.</span>`}</div>
      <div class="session__actions">
        <button class="btn btn--ghost btn--sm" data-action="edit-session" data-id="${s.id}">Edit</button>
        <button class="btn btn--ghost btn--sm" data-action="delete-session" data-id="${s.id}">Delete</button>
      </div>
    </article>`;
  }

  /* ---------- Repertoire ---------- */
  function renderPieces() {
    const q = (renderPieces._q || "").toLowerCase();
    const statusFilter = renderPieces._status || "";
    let pieces = db.pieces.slice();

    if (q) pieces = pieces.filter((p) =>
      (p.title + " " + p.composer + " " + (p.tags || []).join(" ") + " " + p.notes).toLowerCase().includes(q));
    if (statusFilter) pieces = pieces.filter((p) => p.status === statusFilter);

    pieces.sort((a, b) => (b.favorite - a.favorite) || a.title.localeCompare(b.title));

    const statusOptions = ['<option value="">All statuses</option>']
      .concat(STATUSES.map((s) => `<option value="${s}" ${s === statusFilter ? "selected" : ""}>${s}</option>`)).join("");

    return `
      <div class="view-head">
        <div>
          <h2>Repertoire</h2>
          <p>Your personal library of pieces — ${db.pieces.length} and growing.</p>
        </div>
        <button class="btn" data-action="new-piece">＋ Add a piece</button>
      </div>

      <div class="toolbar">
        <input type="search" class="grow" id="piece-search" placeholder="Search title, composer, tag, note…" value="${escapeHtml(renderPieces._q || "")}" />
        <select class="select" id="piece-status-filter" style="max-width:200px">${statusOptions}</select>
      </div>

      ${pieces.length ? `<div class="pieces-grid">${pieces.map(pieceCardHTML).join("")}</div>` :
        (db.pieces.length ? `<p class="muted">No pieces match your search.</p>` : emptyState(
          "🎼", "Build your library",
          "Add the pieces you're learning, polishing, or dreaming about. They'll be ready to pick from when you log practice.",
          "new-piece", "Add your first piece"))}
    `;
  }
  renderPieces._q = "";
  renderPieces._status = "";

  function pieceCardHTML(p) {
    const mins = pieceMinutes(p.id);
    const sessions = sessionsForPiece(p.id).length;
    const meta = [];
    if (p.difficulty) meta.push(`<span class="pill">${escapeHtml(p.difficulty)}</span>`);
    if (p.musicalKey) meta.push(`<span class="pill">${escapeHtml(p.musicalKey)}</span>`);
    if (p.catalog) meta.push(`<span class="pill">${escapeHtml(p.catalog)}</span>`);
    const tags = (p.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");

    return `<div class="piece-card" data-id="${p.id}">
      <div class="piece-card__top">
        <div style="flex:1">
          <h3 class="piece-card__title">${escapeHtml(p.title)}</h3>
          <div class="piece-card__composer">${escapeHtml(p.composer || "Unknown composer")}</div>
        </div>
        <button class="star ${p.favorite ? "is-on" : ""}" data-action="toggle-fav" data-id="${p.id}" title="Favorite">★</button>
      </div>
      <div class="piece-card__meta">
        <span class="pill ${statusClass(p.status)}">${escapeHtml(p.status)}</span>
        ${meta.join(" ")}
      </div>
      ${tags ? `<div class="piece-card__meta">${tags}</div>` : ""}
      ${p.notes ? `<div class="piece-card__notes">${escapeHtml(p.notes)}</div>` : ""}
      <div class="piece-card__foot">
        <span class="piece-card__stat">${fmtMinutes(mins)} · ${sessions} session${sessions === 1 ? "" : "s"}</span>
        <button class="iconbtn" data-action="edit-piece" data-id="${p.id}" title="Edit">✎</button>
        <button class="iconbtn iconbtn--danger" data-action="delete-piece" data-id="${p.id}" title="Delete">🗑</button>
      </div>
    </div>`;
  }

  /* ---------- Calendar ---------- */
  function renderCalendar() {
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const monthName = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    // Map ISO date -> {minutes, count}
    const byDay = {};
    db.sessions.forEach((s) => {
      if (!byDay[s.date]) byDay[s.date] = { minutes: 0, count: 0 };
      byDay[s.date].minutes += sessionMinutes(s);
      byDay[s.date].count += 1;
    });

    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let cells = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
      const info = byDay[iso];
      const isToday = iso === todayISO();
      const heat = info ? heatLevel(info.minutes) : 0;
      const dots = info ? Array.from({ length: Math.min(info.count, 4) }, () => `<span class="cal-dot"></span>`).join("") : "";
      const isSelected = iso === calSelected;
      cells += `<button class="cal-cell ${heat ? "heat-" + heat : ""} ${isToday ? "cal-cell--today" : ""} ${isSelected ? "cal-cell--selected" : ""}" data-action="cal-day" data-date="${iso}">
        <span class="cal-cell__num">${day}</span>
        <span class="cal-cell__dots">${dots}</span>
        ${info ? `<span class="cal-cell__min">${fmtMinutes(info.minutes)}</span>` : ""}
      </button>`;
    }

    return `
      <div class="view-head">
        <div>
          <h2>Calendar</h2>
          <p>A warm glow on every day you sat down to play.</p>
        </div>
        <button class="btn" data-action="new-session">＋ Log a practice</button>
      </div>

      <div class="cal-layout">
        <div class="card">
          <div class="cal-head">
            <button class="iconbtn" data-action="cal-prev" title="Previous month">‹</button>
            <h3>${monthName}</h3>
            <button class="iconbtn" data-action="cal-next" title="Next month">›</button>
            <button class="btn btn--ghost btn--sm" data-action="cal-today">Today</button>
          </div>
          <div class="cal-grid">${cells}</div>
          <div class="cal-legend">
            Less <span class="heat-1"></span><span class="heat-2"></span><span class="heat-3"></span><span class="heat-4"></span> More
          </div>
        </div>
        ${dayDetailHTML(calSelected)}
      </div>
    `;
  }

  // Inline detail panel beside the calendar, showing one day's sessions
  function dayDetailHTML(iso) {
    if (!iso) {
      return `<aside class="card day-panel">
        <div class="day-panel__placeholder">
          <div class="day-panel__mark">🗓️</div>
          <p>Pick a day on the calendar to see what you played.</p>
        </div>
      </aside>`;
    }
    const sessions = db.sessions.filter((s) => s.date === iso).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const total = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
    const body = sessions.length
      ? sessions.map((s) => `
          <div class="day-session">
            <div class="session__head">
              ${s.mood ? `<span class="session__mood">${s.mood}</span>` : ""}
              <span class="session__total">${fmtMinutes(sessionMinutes(s))}</span>
            </div>
            ${s.notes ? `<p class="session__notes">${escapeHtml(s.notes)}</p>` : ""}
            <div class="session__entries">${s.entries.map(entryLineHTML).join("")}</div>
            <div class="session__actions">
              <button class="btn btn--ghost btn--sm" data-action="edit-session" data-id="${s.id}">Edit</button>
              <button class="btn btn--ghost btn--sm" data-action="delete-session" data-id="${s.id}">Delete</button>
            </div>
          </div>`).join("")
      : `<p class="muted day-panel__quiet">Nothing logged on this day — a quiet one.</p>`;

    return `<aside class="card day-panel">
      <div class="day-panel__head">
        <div>
          <h3 class="day-panel__date">${escapeHtml(prettyDate(iso))}</h3>
          ${sessions.length ? `<p class="day-panel__sub">${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${fmtMinutes(total)}</p>` : ""}
        </div>
        <button class="btn btn--sm" data-action="log-for-day" data-date="${iso}">＋ Log</button>
      </div>
      ${body}
    </aside>`;
  }

  function heatLevel(mins) {
    if (mins <= 0) return 0;
    if (mins < 20) return 1;
    if (mins < 45) return 2;
    if (mins < 90) return 3;
    return 4;
  }

  /* ---------- Shared empty-state ---------- */
  function emptyState(mark, title, body, action, btn) {
    return `<div class="empty">
      <div class="empty__mark">${mark}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      <button class="btn" data-action="${action}">${escapeHtml(btn)}</button>
    </div>`;
  }

  /* =========================================================
     Event wiring (delegated)
     ========================================================= */
  function wireView() {
    // Search & filter inputs (Repertoire)
    const search = $("#piece-search");
    if (search) {
      search.addEventListener("input", (e) => {
        renderPieces._q = e.target.value;
        // Full re-render, then restore focus & caret so typing feels seamless
        const pos = e.target.selectionStart;
        render();
        const again = $("#piece-search");
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }
    const statusFilter = $("#piece-status-filter");
    if (statusFilter) statusFilter.addEventListener("change", (e) => { renderPieces._status = e.target.value; render(); });
  }

  // Global delegated click handler for everything with data-action
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;

    const handlers = {
      "new-session": () => openSessionModal(),
      "edit-session": () => openSessionModal(db.sessions.find((s) => s.id === id)),
      "delete-session": () => deleteSession(id),
      "new-piece": () => openPieceModal(),
      "edit-piece": () => openPieceModal(pieceById(id)),
      "delete-piece": () => deletePiece(id),
      "toggle-fav": () => { const p = pieceById(id); if (p) { p.favorite = !p.favorite; save(); render(); } },
      "goto-pieces": () => setView("pieces"),
      "cal-prev": () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); render(); },
      "cal-next": () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); render(); },
      "cal-today": () => { calCursor = startOfMonth(new Date()); calSelected = todayISO(); render(); },
      "cal-day": () => { calSelected = t.dataset.date; render(); },
      "log-for-day": () => openSessionModal(null, t.dataset.date),
      "import-csv": () => $("#csv-file-input").click(),
      "export-pieces": () => exportPiecesCSV(),
      "export-sessions": () => exportSessionsCSV(),
      "export-backup": () => exportBackup(),
      "import-backup": () => $("#json-file-input").click(),
      "clear-data": () => clearData(),
    };

    if (handlers[action]) {
      e.preventDefault();
      handlers[action]();
    }
  });

  /* =========================================================
     Modal system
     ========================================================= */
  function openModal(title, bodyHTML, onMount) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHTML;
    const overlay = $("#modal-overlay");
    overlay.hidden = false;
    if (onMount) onMount($("#modal-body"));
    // focus first field
    const first = $("#modal-body").querySelector("input, select, textarea, button");
    if (first) first.focus();
  }
  function closeModal() { $("#modal-overlay").hidden = true; $("#modal-body").innerHTML = ""; }

  document.addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay" || e.target.closest("[data-modal-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal-overlay").hidden) closeModal();
  });

  /* ---------- Piece modal ---------- */
  function openPieceModal(piece) {
    const editing = !!piece;
    const p = piece || newPiece();

    const statusOpts = STATUSES.map((s) => `<option value="${s}" ${s === p.status ? "selected" : ""}>${s}</option>`).join("");
    const diffOpts = ['<option value="">— difficulty —</option>']
      .concat(DIFFICULTIES.map((d) => `<option value="${d}" ${d === p.difficulty ? "selected" : ""}>${d}</option>`)).join("");

    openModal(editing ? "Edit piece" : "Add a piece", `
      <form class="form-grid" id="piece-form">
        <div>
          <label class="lbl">Title</label>
          <input type="text" name="title" required value="${escapeHtml(p.title)}" placeholder="e.g. Clair de Lune" />
        </div>
        <div class="form-row">
          <div><label class="lbl">Composer</label><input type="text" name="composer" value="${escapeHtml(p.composer)}" placeholder="e.g. Debussy" /></div>
          <div><label class="lbl">Catalog / Opus</label><input type="text" name="catalog" value="${escapeHtml(p.catalog)}" placeholder="e.g. L. 75 No. 3" /></div>
        </div>
        <div class="form-row">
          <div><label class="lbl">Status</label><select class="select" name="status">${statusOpts}</select></div>
          <div><label class="lbl">Difficulty</label><select class="select" name="difficulty">${diffOpts}</select></div>
        </div>
        <div class="form-row">
          <div><label class="lbl">Key</label><input type="text" name="musicalKey" value="${escapeHtml(p.musicalKey)}" placeholder="e.g. D-flat major" /></div>
          <div><label class="lbl">Tags (comma separated)</label><input type="text" name="tags" value="${escapeHtml((p.tags || []).join(", "))}" placeholder="e.g. impressionist, recital" /></div>
        </div>
        <div>
          <label class="lbl">Notes</label>
          <textarea name="notes" placeholder="Fingerings, goals, memories, things to fix…">${escapeHtml(p.notes)}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn">${editing ? "Save changes" : "Add piece"}</button>
        </div>
      </form>
    `, (body) => {
      $("#piece-form", body).addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const title = f.title.value.trim();
        if (!title) { toast("A title helps the piece feel real ☺", "bad"); return; }
        Object.assign(p, {
          title,
          composer: f.composer.value.trim(),
          catalog: f.catalog.value.trim(),
          status: f.status.value,
          difficulty: f.difficulty.value,
          musicalKey: f.musicalKey.value.trim(),
          tags: f.tags.value.split(",").map((s) => s.trim()).filter(Boolean),
          notes: f.notes.value.trim(),
        });
        if (!editing) db.pieces.push(p);
        save();
        closeModal();
        render();
        toast(editing ? "Piece updated." : "Added to your repertoire 🎼", "good");
      });
    });
  }

  function deletePiece(id) {
    const p = pieceById(id);
    if (!p) return;
    const linked = sessionsForPiece(id).length;
    const msg = linked
      ? `Delete "${p.title}"? It appears in ${linked} practice entr${linked === 1 ? "y" : "ies"}, which will keep their notes but lose the link.`
      : `Delete "${p.title}" from your repertoire?`;
    if (!confirm(msg)) return;
    db.pieces = db.pieces.filter((x) => x.id !== id);
    // detach references but keep the title snapshot in entries
    db.sessions.forEach((s) => s.entries.forEach((en) => { if (en.pieceId === id) en.pieceId = null; }));
    save();
    render();
    toast("Piece removed.");
  }

  /* ---------- Practice session modal ---------- */
  function openSessionModal(session, presetDate) {
    const editing = !!session;
    const s = session || { id: uid(), date: presetDate || todayISO(), mood: "", notes: "", entries: [], createdAt: Date.now() };
    const working = JSON.parse(JSON.stringify(s));
    const blankEntry = () => ({ pieceId: null, title: "", minutes: "", notes: "", tempo: "", focus: "", rating: 0, nextFocus: "" });
    if (!working.entries.length) working.entries.push(blankEntry());

    const moodOpts = MOODS.map((m) => `<option value="${m.v}" ${m.v === working.mood ? "selected" : ""}>${m.label}</option>`).join("");
    const datalist = `<datalist id="piece-options">${db.pieces.map((p) => `<option value="${escapeHtml(p.title)}">`).join("")}</datalist>`;

    openModal(editing ? "Edit practice session" : "Log a practice", `
      <form class="form-grid" id="session-form">
        <div class="form-row">
          <div><label class="lbl">Date</label><input type="date" name="date" value="${escapeHtml(working.date)}" max="${todayISO()}" required /></div>
          <div><label class="lbl">How did it feel?</label><select class="select" name="mood">${moodOpts}</select></div>
        </div>
        <div>
          <label class="lbl">Pieces practiced</label>
          <div id="entries"></div>
          <button type="button" class="btn btn--ghost btn--sm" id="add-entry" style="margin-top:8px">＋ Add another piece</button>
        </div>
        <div>
          <label class="lbl">Session notes (optional)</label>
          <textarea name="notes" placeholder="Overall thoughts, what to focus on next time…">${escapeHtml(working.notes)}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
          <button type="submit" class="btn">${editing ? "Save session" : "Save practice"}</button>
        </div>
        ${datalist}
      </form>
    `, (body) => {
      const entriesWrap = $("#entries", body);

      function focusOptions(sel) {
        return ['<option value="">— focus —</option>']
          .concat(FOCUS_TYPES.map((ft) => `<option value="${ft}" ${ft === sel ? "selected" : ""}>${ft}</option>`)).join("");
      }

      function entryRowHTML(en, idx) {
        const remPiece = findPieceByTitle(en.title);
        const reminder = remPiece ? lastNextFocusForPiece(remPiece.id, working.id) : "";
        const rating = Math.max(0, Math.min(5, Math.round(Number(en.rating) || 0)));
        const starsEdit = [1, 2, 3, 4, 5].map((n) =>
          `<button type="button" class="star-btn ${n <= rating ? "is-on" : ""}" data-val="${n}" title="${n} of 5">★</button>`).join("");
        return `<div class="entry-edit" data-idx="${idx}">
          <div class="entry-reminder" ${reminder ? "" : "hidden"}>🎯 Last time you wanted to: <span class="entry-reminder__text">${escapeHtml(reminder)}</span></div>
          <div class="entry-edit__row">
            <div>
              <label class="lbl">Piece</label>
              <input type="text" list="piece-options" class="e-title" value="${escapeHtml(en.title)}" placeholder="Type or pick a piece" />
            </div>
            <div>
              <label class="lbl">Minutes</label>
              <input type="number" class="e-min" min="0" step="1" value="${en.minutes === "" || en.minutes == null ? "" : en.minutes}" placeholder="0" />
            </div>
            <div>
              <label class="lbl">Tempo (BPM)</label>
              <input type="number" class="e-tempo" min="0" step="1" value="${en.tempo === "" || en.tempo == null ? "" : en.tempo}" placeholder="—" />
            </div>
            <div class="entry-edit__remove">
              <button type="button" class="iconbtn iconbtn--danger e-remove" title="Remove">✕</button>
            </div>
          </div>
          <div class="entry-edit__row2">
            <div>
              <label class="lbl">Practice focus</label>
              <select class="select e-focus">${focusOptions(en.focus)}</select>
            </div>
            <div>
              <label class="lbl">How it went</label>
              <div class="stars" data-rating="${rating}">${starsEdit}</div>
            </div>
          </div>
          <div>
            <label class="lbl">Notes for this piece</label>
            <textarea class="e-notes" placeholder="Bars to drill, what improved, fingering ideas…">${escapeHtml(en.notes)}</textarea>
          </div>
          <div>
            <label class="lbl">Focus for next time</label>
            <input type="text" class="e-nextfocus" value="${escapeHtml(en.nextFocus || "")}" placeholder="What to tackle next session…" />
          </div>
        </div>`;
      }

      function updateReminder(row) {
        const rem = $(".entry-reminder", row);
        if (!rem) return;
        const p = findPieceByTitle($(".e-title", row).value);
        const text = p ? lastNextFocusForPiece(p.id, working.id) : "";
        if (text) { $(".entry-reminder__text", rem).textContent = text; rem.hidden = false; }
        else rem.hidden = true;
      }

      function drawEntries() {
        entriesWrap.innerHTML = working.entries.map(entryRowHTML).join("");
        $$(".entry-edit", entriesWrap).forEach((row, i) => {
          $(".e-remove", row).addEventListener("click", () => {
            syncEntries();
            working.entries.splice(i, 1);
            if (!working.entries.length) working.entries.push(blankEntry());
            drawEntries();
          });
          // Star rating: click to set, click the same star again to clear
          $$(".star-btn", row).forEach((star) => star.addEventListener("click", () => {
            const starsEl = $(".stars", row);
            const val = Number(star.dataset.val);
            const next = (Number(starsEl.dataset.rating) || 0) === val ? 0 : val;
            starsEl.dataset.rating = next;
            $$(".star-btn", row).forEach((b) => b.classList.toggle("is-on", Number(b.dataset.val) <= next));
          }));
          // Surface last session's "next time" note when the piece is chosen
          const titleInput = $(".e-title", row);
          titleInput.addEventListener("input", () => updateReminder(row));
          titleInput.addEventListener("change", () => updateReminder(row));
        });
      }

      function syncEntries() {
        $$(".entry-edit", entriesWrap).forEach((row, i) => {
          const en = working.entries[i];
          if (!en) return;
          en.title = $(".e-title", row).value;
          en.minutes = $(".e-min", row).value;
          en.tempo = $(".e-tempo", row).value;
          en.focus = $(".e-focus", row).value;
          en.rating = Number($(".stars", row).dataset.rating) || 0;
          en.notes = $(".e-notes", row).value;
          en.nextFocus = $(".e-nextfocus", row).value;
        });
      }

      drawEntries();

      $("#add-entry", body).addEventListener("click", () => {
        syncEntries();
        working.entries.push(blankEntry());
        drawEntries();
        const rows = $$(".entry-edit", entriesWrap);
        const last = rows[rows.length - 1];
        if (last) $(".e-title", last).focus();
      });

      $("#session-form", body).addEventListener("submit", (ev) => {
        ev.preventDefault();
        syncEntries();
        const f = ev.target;
        // Build final entries: drop empty rows, link/create pieces
        const entries = working.entries
          .filter((en) => (en.title || "").trim() || (en.notes || "").trim() || en.minutes ||
            en.tempo || en.focus || en.rating || (en.nextFocus || "").trim())
          .map((en) => {
            const title = (en.title || "").trim();
            let pieceId = null;
            if (title) { const p = ensurePiece(title); pieceId = p ? p.id : null; }
            return {
              pieceId,
              title: title || "Practice",
              minutes: en.minutes === "" ? 0 : Math.max(0, Math.round(Number(en.minutes) || 0)),
              tempo: en.tempo === "" ? 0 : Math.max(0, Math.round(Number(en.tempo) || 0)),
              focus: en.focus || "",
              rating: Math.max(0, Math.min(5, Math.round(Number(en.rating) || 0))),
              notes: (en.notes || "").trim(),
              nextFocus: (en.nextFocus || "").trim(),
            };
          });

        if (!entries.length) { toast("Add at least one piece to save the session.", "bad"); return; }

        const finalSession = {
          id: working.id,
          date: f.date.value || todayISO(),
          mood: f.mood.value,
          notes: f.notes.value.trim(),
          entries,
          createdAt: working.createdAt || Date.now(),
        };

        const existing = db.sessions.findIndex((x) => x.id === finalSession.id);
        if (existing >= 0) db.sessions[existing] = finalSession;
        else db.sessions.push(finalSession);

        save();
        closeModal();
        render();
        toast(editing ? "Session updated." : "Practice logged — well done 🎹", "good");
      });
    });
  }

  function deleteSession(id) {
    const s = db.sessions.find((x) => x.id === id);
    if (!s) return;
    if (!confirm(`Delete the practice session from ${prettyDate(s.date)}?`)) return;
    db.sessions = db.sessions.filter((x) => x.id !== id);
    save();
    render();
    toast("Session deleted.");
  }

  /* =========================================================
     CSV utilities
     ========================================================= */
  function csvEscape(val) {
    const s = String(val == null ? "" : val);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(headers, rows) {
    const lines = [headers.map(csvEscape).join(",")];
    rows.forEach((r) => lines.push(headers.map((h) => csvEscape(r[h])).join(",")));
    return lines.join("\r\n");
  }

  // Robust CSV parser (handles quotes, commas & newlines inside quotes)
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    text = text.replace(/^﻿/, ""); // strip BOM
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { /* ignore, handled by \n */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map((h) => h.trim());
    return rows
      .filter((r) => r.some((v) => v.trim() !== ""))
      .map((r) => { const o = {}; headers.forEach((h, i) => (o[h] = (r[i] != null ? r[i] : ""))); return o; });
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function stamp() { return todayISO(); }

  /* ---------- Export: Repertoire ---------- */
  function exportPiecesCSV() {
    if (!db.pieces.length) { toast("No pieces to export yet.", "bad"); return; }
    const headers = ["Title", "Composer", "Catalog", "Status", "Difficulty", "Key", "Tags", "Favorite", "TotalMinutes", "Notes", "DateAdded"];
    const rows = db.pieces.map((p) => ({
      Title: p.title, Composer: p.composer, Catalog: p.catalog, Status: p.status,
      Difficulty: p.difficulty, Key: p.musicalKey, Tags: (p.tags || []).join("; "),
      Favorite: p.favorite ? "yes" : "", TotalMinutes: pieceMinutes(p.id), Notes: p.notes, DateAdded: p.dateAdded,
    }));
    downloadFile(`repertoire-${stamp()}.csv`, toCSV(headers, rows), "text/csv;charset=utf-8");
    toast("Repertoire exported.", "good");
  }

  /* ---------- Export: Practice log (one row per piece-entry) ---------- */
  function exportSessionsCSV() {
    if (!db.sessions.length) { toast("No practice sessions to export yet.", "bad"); return; }
    const headers = ["SessionId", "Date", "Mood", "Piece", "Composer", "Minutes", "Tempo", "Focus", "Rating", "PieceNotes", "NextFocus", "SessionNotes"];
    const rows = [];
    sortedSessions().forEach((s) => {
      if (!s.entries.length) {
        rows.push({ SessionId: s.id, Date: s.date, Mood: s.mood, Piece: "", Composer: "", Minutes: "", Tempo: "", Focus: "", Rating: "", PieceNotes: "", NextFocus: "", SessionNotes: s.notes });
      }
      s.entries.forEach((e) => {
        const p = e.pieceId ? pieceById(e.pieceId) : null;
        rows.push({
          SessionId: s.id, Date: s.date, Mood: s.mood, Piece: e.title,
          Composer: p ? p.composer : "", Minutes: e.minutes,
          Tempo: e.tempo || "", Focus: e.focus || "", Rating: e.rating || "",
          PieceNotes: e.notes, NextFocus: e.nextFocus || "", SessionNotes: s.notes,
        });
      });
    });
    downloadFile(`practice-log-${stamp()}.csv`, toCSV(headers, rows), "text/csv;charset=utf-8");
    toast("Practice log exported.", "good");
  }

  /* ---------- Import CSV (auto-detect type by headers) ---------- */
  function importCSVText(text) {
    const rows = parseCSV(text);
    if (!rows.length) { toast("That CSV looked empty.", "bad"); return; }
    const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());

    const looksLikeSessions = headers.includes("date") && (headers.includes("piece") || headers.includes("sessionid"));
    const looksLikePieces = headers.includes("title");

    if (looksLikeSessions) importSessionRows(rows);
    else if (looksLikePieces) importPieceRows(rows);
    else toast("Couldn't recognize this CSV. Expected a 'Title' column (repertoire) or 'Date'/'Piece' columns (practice log).", "bad");
  }

  function get(row, ...keys) {
    // case-insensitive header lookup
    for (const k of keys) {
      const found = Object.keys(row).find((h) => h.toLowerCase() === k.toLowerCase());
      if (found != null && row[found] !== "") return row[found];
    }
    return "";
  }

  function importPieceRows(rows) {
    let added = 0, merged = 0;
    rows.forEach((r) => {
      const title = String(get(r, "Title")).trim();
      if (!title) return;
      const data = {
        composer: String(get(r, "Composer")).trim(),
        catalog: String(get(r, "Catalog", "Opus")).trim(),
        status: STATUSES.includes(get(r, "Status")) ? get(r, "Status") : (get(r, "Status") || "Learning"),
        difficulty: String(get(r, "Difficulty")).trim(),
        musicalKey: String(get(r, "Key")).trim(),
        tags: String(get(r, "Tags")).split(/[;,]/).map((s) => s.trim()).filter(Boolean),
        favorite: /^(yes|true|1|y|★)$/i.test(String(get(r, "Favorite")).trim()),
        notes: String(get(r, "Notes")).trim(),
        dateAdded: String(get(r, "DateAdded")).trim() || todayISO(),
      };
      const existing = findPieceByTitle(title);
      if (existing) { Object.assign(existing, data); merged++; }
      else { db.pieces.push(newPiece(Object.assign({ title }, data))); added++; }
    });
    save(); render();
    toast(`Imported repertoire: ${added} added, ${merged} updated.`, "good");
  }

  function importSessionRows(rows) {
    // Group rows into sessions by SessionId when present, else by Date (+SessionNotes).
    const groups = new Map();
    rows.forEach((r) => {
      const date = normalizeDate(get(r, "Date"));
      if (!date) return;
      const key = String(get(r, "SessionId")).trim() || `${date}::${String(get(r, "SessionNotes")).trim()}`;
      if (!groups.has(key)) {
        groups.set(key, { id: uid(), date, mood: get(r, "Mood"), notes: get(r, "SessionNotes"), entries: [], createdAt: Date.now() });
      }
      const g = groups.get(key);
      const piece = String(get(r, "Piece", "Title")).trim();
      const minutes = Math.max(0, Math.round(Number(get(r, "Minutes")) || 0));
      const tempo = Math.max(0, Math.round(Number(get(r, "Tempo")) || 0));
      const focus = String(get(r, "Focus")).trim();
      const rating = Math.max(0, Math.min(5, Math.round(Number(get(r, "Rating")) || 0)));
      const pNotes = String(get(r, "PieceNotes", "Notes")).trim();
      const nextFocus = String(get(r, "NextFocus")).trim();
      if (piece || minutes || pNotes || tempo || focus || rating || nextFocus) {
        let pieceId = null;
        if (piece) { const p = ensurePiece(piece, get(r, "Composer")); pieceId = p ? p.id : null; }
        g.entries.push({ pieceId, title: piece || "Practice", minutes, tempo, focus, rating, notes: pNotes, nextFocus });
      }
    });

    let count = 0;
    groups.forEach((g) => {
      if (!g.entries.length) g.entries.push({ pieceId: null, title: "Practice", minutes: 0, tempo: 0, focus: "", rating: 0, notes: "", nextFocus: "" });
      db.sessions.push(g);
      count++;
    });
    save(); render();
    toast(`Imported ${count} practice session${count === 1 ? "" : "s"}.`, "good");
  }

  function normalizeDate(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    return isNaN(d) ? "" : toISO(d);
  }

  /* ---------- JSON backup ---------- */
  function exportBackup() {
    const payload = { app: "piano-repertoire-tracker", version: 1, exportedAt: new Date().toISOString(), data: db };
    downloadFile(`piano-repertoire-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast("Backup saved.", "good");
  }

  function importBackupText(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { toast("That file wasn't valid JSON.", "bad"); return; }
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.pieces) || !Array.isArray(data.sessions)) {
      toast("This doesn't look like a tracker backup.", "bad"); return;
    }
    if (!confirm("Restoring will replace everything currently on this device. Continue?")) return;
    db = { pieces: data.pieces, sessions: data.sessions };
    save(); render();
    toast("Backup restored.", "good");
  }

  function clearData() {
    if (!confirm("Erase ALL pieces and practice sessions from this device? This can't be undone.")) return;
    if (!confirm("Really sure? Consider exporting a backup first.")) return;
    db = { pieces: [], sessions: [] };
    save(); render();
    toast("All data erased.");
  }

  /* ---------- File input wiring ---------- */
  function readFile(input, handler) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { handler(String(reader.result || "")); input.value = ""; };
    reader.onerror = () => { toast("Couldn't read that file.", "bad"); input.value = ""; };
    reader.readAsText(file);
  }

  /* =========================================================
     Toasts
     ========================================================= */
  let toastTimer;
  function toast(msg, kind) {
    const stack = $("#toast-stack");
    const el = document.createElement("div");
    el.className = "toast" + (kind === "good" ? " toast--good" : kind === "bad" ? " toast--bad" : "");
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, 2600);
    setTimeout(() => el.remove(), 3100);
  }

  /* =========================================================
     Top-bar wiring (tabs + data menu)
     ========================================================= */
  function wireChrome() {
    $$(".tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

    // Day / night theme slider
    const themeToggle = $("#theme-toggle");
    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

    // Dropdown menu
    const menu = $("[data-menu]");
    const toggle = $("[data-menu-toggle]", menu);
    const list = $("[data-menu-list]", menu);
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", () => { list.hidden = true; toggle.setAttribute("aria-expanded", "false"); });
    list.addEventListener("click", () => { list.hidden = true; });

    // File inputs
    $("#csv-file-input").addEventListener("change", (e) => readFile(e.target, importCSVText));
    $("#json-file-input").addEventListener("change", (e) => readFile(e.target, importBackupText));
  }

  /* =========================================================
     Boot
     ========================================================= */
  function init() {
    // Flag touch / phone devices so CSS can drop hover-only affordances
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
        document.documentElement.classList.add("is-touch");
      }
    } catch (e) {}
    load();
    loadTheme();
    wireChrome();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
