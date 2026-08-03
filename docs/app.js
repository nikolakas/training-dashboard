/* Training Dashboard - reads data.json + standards.json, renders everything.
   Every section renders defensively so new data.json keys can be added later
   without breaking older sections (and missing keys degrade to a notice). */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const num = (n) => (Math.round(n * 10) / 10).toString();

const CHART_FONT = { family: '"Helvetica Neue", Helvetica, Inter, system-ui, Arial, sans-serif' };
const AXIS = { color: "#6f6f68", font: { ...CHART_FONT, size: 11 } };
const GRID = { color: "rgba(17,17,17,0.07)" };
const INK = "#111111";

/* ---------------- Skip-day excuses (original, written for this page) ------- */
const EXCUSES = [
  "My foam roller and I are currently not on speaking terms.",
  "Rest is part of the program, and today I am being extremely compliant.",
  "The gym is 11 minutes away and my motivation has a 10-minute range.",
  "I already carried four bags of groceries up two flights. That was leg day.",
  "My pre-workout expired, and so did my enthusiasm.",
  "Someone is definitely on the hack squat right now. I can feel it.",
  "I'm deloading. I decided this roughly ninety seconds ago.",
  "My lifting shoes are in the car, and the car is a whole outside away.",
  "Scientifically, muscles grow during rest. I'm just growing very aggressively today.",
  "I did think about the gym for a solid twenty minutes. That's mental reps.",
  "My playlist isn't ready and I refuse to train unprepared.",
  "The weather is doing something, and I've decided it's a problem.",
  "I'm protecting my central nervous system from my own ambition.",
  "Last session's DOMS filed a formal complaint with management.",
  "My water bottle is dirty and I simply cannot train without it.",
  "I'm saving today's energy for a much more impressive session tomorrow.",
  "Technically, if I never train again, my PRs stay untouched forever.",
  "The stars aligned for rest. I don't make the rules, I just follow the sky.",
  "I've been advised by my couch to stay put.",
  "Going today would ruin the perfectly good streak of not going.",
];

/* ---------------- helpers ------------------------------------------------- */
function section(data, key, fallback = null) {
  return (data && data.sections && key in data.sections) ? data.sections[key] : fallback;
}
function emptyNote(msg) {
  return `<p class="muted small">${esc(msg)}</p>`;
}

/* Live chart instances, so they can be resized when their view is shown. */
const CHARTS = [];

/* Run a render in isolation. One broken section must not blank the page. */
function safe(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[${name}]`, err);
    const box = $("boot-error");
    if (box) {
      box.hidden = false;
      const prev = box.textContent ? box.textContent + " · " : "Some sections failed to render: ";
      box.textContent = prev + name;
    }
    return null;
  }
}

window.addEventListener("error", (e) => {
  const box = $("boot-error");
  if (box && e.message) {
    box.hidden = false;
    box.textContent = "Script error: " + e.message;
  }
});

/* ---------------- Today --------------------------------------------------- */
function renderToday(data) {
  const rest = section(data, "rest", {});
  const flag = rest && rest.flag;
  $("rest-flag").innerHTML = flag
    ? `<div class="flag">${esc(flag)}</div>`
    : `<div class="flag ok">No rest flag triggered — you're clear to train.</div>`;

  const sugg = section(data, "suggestions", []) || [];
  const order = { increase: 0, deload: 1, note: 2 };
  const sorted = [...sugg].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));

  $("suggestions").innerHTML = sorted.length ? sorted.map(s => {
    const kind = ["increase", "deload", "note"].includes(s.type) ? s.type : "note";
    const arrow = { increase: "↑", deload: "↓", note: "→" }[kind];
    const prev = s.previous || {};

    // "last time" line - what they actually did
    const lastBits = [];
    if (prev.weight_kg != null) {
      lastBits.push(`${num(prev.weight_kg)}kg × ${prev.reps ?? "?"}`);
      if (prev.sets) lastBits.push(`${prev.sets} sets`);
      if (prev.rpe != null) lastBits.push(`RPE ${prev.rpe}`);
    }
    const lastLine = lastBits.length
      ? `Last time: ${lastBits.join(" · ")}${prev.date ? " on " + fmtDay(prev.date) : ""}`
      : "No earlier session logged";

    // hover / tap detail
    const tipBits = [];
    if (s.current_weight_kg != null) {
      tipBits.push(`Most recent: ${num(s.current_weight_kg)}kg × ${s.current_reps ?? "?"}`
        + (s.current_sets ? ` (${s.current_sets} sets)` : "")
        + (s.current_rpe != null ? ` @ RPE ${s.current_rpe}` : ""));
    }
    tipBits.push(lastLine);
    if (s.why) tipBits.push(s.why);
    if (s.increment_kg != null) {
      tipBits.push(`Step ${num(s.increment_kg)}kg (${s.increment_source === "history"
        ? "learned from your history" : "category default"})`);
    }
    if (s.zone) tipBits.push(s.zone);

    const delta = (s.delta_kg && s.delta_kg !== 0)
      ? `<span class="delta ${s.delta_kg > 0 ? "up" : "down"}">${s.delta_kg > 0 ? "+" : ""}${num(s.delta_kg)}kg</span>`
      : "";
    // Make the blocker obvious: without RPE we can't make a real call.
    const blocked = (s.current_rpe == null)
      ? `<span class="flagchip">no RPE</span>` : "";

    return `<div class="sug ${kind}" tabindex="0">
      <div class="sug-main">
        <div class="sug-ex">${esc(s.exercise)}${blocked}</div>
        <div class="sug-do">
          <span class="sug-verb">${esc(s.action || "")}</span>
          <span class="sug-arrow">${arrow}</span>
          <span class="sug-target">${esc(s.target_text || "—")}</span>
          ${delta}
        </div>
      </div>
      <div class="sug-last">${esc(lastLine)}</div>
      <div class="sug-tip" role="tooltip">
        ${tipBits.map(b => `<div>${esc(b)}</div>`).join("")}
      </div>
    </div>`;
  }).join("") : emptyNote("No suggestions today — not enough recent data, or nothing changed.");

  const st = section(data, "stretches", []) || [];
  $("stretches").innerHTML = st.length
    ? st.map(s => `<li>${esc(s)}</li>`).join("")
    : `<li class="muted">No session data to base this on yet.</li>`;
}

/* ---------------- Streak -------------------------------------------------- */
function renderStreak(data) {
  const s = section(data, "streak");
  if (!s) {
    $("streak-num").textContent = "–";
    $("streak-note").textContent = "No streak data in this export.";
    return;
  }

  const n = s.current_streak_weeks || 0;
  $("streak-num").textContent = n === 1 ? "1 week" : `${n} weeks`;
  $("streak-note").textContent =
    `Consecutive weeks with ${s.sessions_per_good_week}+ sessions. `
    + `This week so far: ${s.current_week_sessions ?? 0}.`;

  const flame = $("flame");
  flame.className = "flame" + (n >= 1 ? " lit" : "") + (n >= 8 ? " blaze" : n >= 4 ? " hot" : "");
  flame.title = n >= 8 ? "Blazing (8+ weeks)" : n >= 4 ? "Hot (4+ weeks)" : n >= 1 ? "Lit" : "No active streak";

  $("streak-weeks").innerHTML = (s.weeks || [])
    .map(w => `<span class="${w.good ? "good" : ""}" title="${w.year}-W${w.week}: ${w.sessions} sessions">${w.sessions}</span>`)
    .join("");
}

/* ---------------- Research ------------------------------------------------ */
function renderResearch(data) {
  const r = section(data, "research", { entries: [] }) || { entries: [] };
  const entries = r.entries || [];
  $("research").innerHTML = entries.length ? entries.map(e => `
    <div class="research-entry">
      <h4>${esc(e.week || "Untitled week")}</h4>
      <div class="muted small">${esc(e.date || "")}${e.status ? " · " + esc(e.status) : ""}${e.relevant ? " · relevant: " + esc(e.relevant) : ""}</div>
      ${e.findings ? `<p class="findings">${esc(e.findings)}</p>` : ""}
      ${e.recommended_change ? `<div class="rec"><strong>Recommended change:</strong> ${esc(e.recommended_change)}</div>` : ""}
    </div>`).join("")
    : emptyNote("No research entries yet. Add a row to the Weekly Findings database in Notion, then re-run the export.");
}

/* ---------------- Trends -------------------------------------------------- */
function renderTrends(data) {
  const hist = section(data, "compound_history", {}) || {};
  const names = Object.keys(hist);
  const box = $("charts");
  if (!names.length) { box.innerHTML = emptyNote("No compound history in this export."); return; }

  box.innerHTML = names.map((n, i) =>
    `<div class="chart-box"><h4>${esc(n)}</h4><canvas id="chart-${i}"></canvas></div>`).join("");

  names.forEach((name, i) => {
    const pts = (hist[name] || []).filter(p => p.top_weight_kg != null);
    CHARTS.push(new Chart($(`chart-${i}`), {
      type: "line",
      data: {
        labels: pts.map(p => p.date),
        datasets: [{
          label: "Top set (kg)",
          data: pts.map(p => p.top_weight_kg),
          borderColor: INK,
          backgroundColor: "rgba(17,17,17,0.06)",
          tension: 0.25, fill: true, pointRadius: 2.5,
          pointBackgroundColor: "#fff", pointBorderColor: INK, borderWidth: 1.75,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const p = pts[ctx.dataIndex];
                const bits = [`${p.reps} reps`];
                if (p.avg_rpe != null) bits.push(`RPE ${p.avg_rpe}`);
                if (p.est_1rm_kg != null) bits.push(`e1RM ${p.est_1rm_kg}kg`);
                return bits.join(" · ");
              },
            },
          },
        },
        scales: {
          x: { ticks: AXIS, grid: GRID },
          y: { ticks: AXIS, grid: GRID, title: { display: true, text: "kg", color: "#6f6f68" } },
        },
      },
    }));
  });
}

/* ---------------- Volume battle ------------------------------------------- */
function renderBattle(data) {
  const vb = section(data, "volume_battle");
  if (!vb || !vb.by_day_type) return;
  const d = vb.by_day_type;
  const labels = ["Push", "Pull", "Legs"];
  const vals = labels.map(l => d[l] || 0);

  CHARTS.push(new Chart($("battle-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sets",
        data: vals,
        backgroundColor: ["#c4622d", "#3a6ea8", "#2f7d55"],
        borderRadius: 6, maxBarThickness: 92,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: AXIS, grid: { display: false } },
        y: { ticks: AXIS, grid: GRID, beginAtZero: true, title: { display: true, text: "sets", color: "#6f6f68" } },
      },
    },
  }));

  const max = Math.max(...vals), min = Math.min(...vals);
  const winner = labels[vals.indexOf(max)];
  const loser = labels[vals.indexOf(min)];
  const gap = max - min;
  let line;
  if (max === 0) line = "No volume logged yet — the battle awaits.";
  else if (gap === 0) line = "Dead heat. Perfectly balanced, as all things should be.";
  else if (gap <= 5) line = `${winner} leads by ${num(gap)} sets — close enough that ${loser} could still take it.`;
  else if (gap <= 15) line = `${winner} is winning by ${num(gap)} sets. ${loser} is quietly falling behind.`;
  else line = `${winner} is dominating by ${num(gap)} sets. ${loser} has essentially left the arena.`;
  $("battle-commentary").textContent = line;
}

/* ---------------- Where I Stand ------------------------------------------- */
const BW_KEY = "td_bodyweight_kg";

function interpolateStandards(rows, bw) {
  const sorted = [...rows].sort((a, b) => a[0] - b[0]);
  if (bw <= sorted[0][0]) return sorted[0].slice(1);
  if (bw >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1].slice(1);
  for (let i = 0; i < sorted.length - 1; i++) {
    const [w1, ...v1] = sorted[i], [w2, ...v2] = sorted[i + 1];
    if (bw >= w1 && bw <= w2) {
      const t = (bw - w1) / (w2 - w1);
      return v1.map((v, k) => v + t * (v2[k] - v));
    }
  }
  return sorted[sorted.length - 1].slice(1);
}

function percentileFor(e1rm, bands, pcts) {
  // bands: [beginner, novice, intermediate, advanced, elite] in kg
  // pcts:  [5, 20, 50, 80, 95]
  if (e1rm <= bands[0]) return Math.max(0, (e1rm / bands[0]) * pcts[0]);
  for (let i = 0; i < bands.length - 1; i++) {
    if (e1rm >= bands[i] && e1rm <= bands[i + 1]) {
      const t = (e1rm - bands[i]) / (bands[i + 1] - bands[i]);
      return pcts[i] + t * (pcts[i + 1] - pcts[i]);
    }
  }
  return pcts[pcts.length - 1];
}

function levelName(pct, levels, pcts) {
  let name = "Below beginner";
  for (let i = 0; i < pcts.length; i++) if (pct >= pcts[i]) name = levels[i];
  return name;
}

function renderStand(data, standards) {
  const box = $("standings");
  const meta = standards && standards._meta;
  const lifts = standards && standards.lifts;
  if (!meta || !lifts) { box.innerHTML = emptyNote("Standards data unavailable."); return; }

  $("standards-credit").innerHTML =
    `Standards: <a href="${esc(meta.source_url)}" target="_blank" rel="noopener">${esc(meta.source_name)}</a> `
    + `(${esc(meta.sex)}, ${esc(meta.units)}, retrieved ${esc(meta.retrieved)}). `
    + `${esc(meta.percentile_note)} Estimated 1RM uses the Epley formula.`;

  const bw = parseFloat(localStorage.getItem(BW_KEY) || "");
  if (!bw) { box.innerHTML = emptyNote("Enter your bodyweight above to see where you stand."); return; }

  const prs = section(data, "personal_records", []) || [];
  const byName = {};
  prs.forEach(p => { byName[p.exercise] = p; });

  const levels = meta.levels;
  const pcts = levels.map(l => meta.percentiles[l]);

  const rows = Object.entries(lifts).map(([name, spec]) => {
    const pr = byName[name];
    if (!pr || pr.est_1rm_kg == null) {
      return `<div class="stand">
        <div class="stand-head"><span class="stand-name">${esc(name)}</span>
        <span class="muted small">no logged data</span></div></div>`;
    }
    const bands = interpolateStandards(spec.rows, bw);
    const pct = Math.max(0, Math.min(99, percentileFor(pr.est_1rm_kg, bands, pcts)));
    const lvl = levelName(pct, levels, pcts);
    return `<div class="stand">
      <div class="stand-head">
        <span class="stand-name">${esc(name)}</span>
        <span class="stand-level">${esc(lvl)} · ~${Math.round(pct)}th pct</span>
      </div>
      <div class="muted small">Best e1RM ${num(pr.est_1rm_kg)}kg (${num(pr.weight_kg)}kg × ${pr.reps}, ${esc(pr.date)})
        · at ${num(bw)}kg BW: ${bands.map((b, i) => `${levels[i][0]}&nbsp;${Math.round(b)}`).join(" · ")}</div>
      <div class="meter"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="ticks"><span>Beginner</span><span>Novice</span><span>Int.</span><span>Adv.</span><span>Elite</span></div>
      <div class="muted small"><a href="${esc(spec.source)}" target="_blank" rel="noopener">source table</a></div>
    </div>`;
  });

  box.innerHTML = rows.join("");
}

/* ---------------- PRs ----------------------------------------------------- */
let PR_MODE = "compound";
function renderPRs(data) {
  const prs = section(data, "personal_records", []) || [];
  const list = PR_MODE === "compound" ? prs.filter(p => p.is_compound) : prs;
  const shown = PR_MODE === "compound" ? list : list.slice(0, 40);
  $("prs").innerHTML = shown.length ? shown.map(p => `
    <div class="pr">
      <div>
        <div class="pr-name">${esc(p.exercise)}</div>
        <div class="pr-date">${esc(p.date)} · e1RM ${num(p.est_1rm_kg)}kg</div>
      </div>
      <div class="pr-val">${num(p.weight_kg)}kg × ${p.reps}</div>
    </div>`).join("")
    : emptyNote(PR_MODE === "compound"
        ? "No compound PRs yet — add lifts to COMPOUND_EXERCISES in hevy_coach.py."
        : "No PRs found in your history.");
}

/* ---------------- Soundtrack ---------------------------------------------- */
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "itunes_cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 8000);
    function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
    window[cb] = (d) => { cleanup(); resolve(d); };
    s.onerror = () => { cleanup(); reject(new Error("network")); };
    s.src = `${url}&callback=${cb}`;
    document.body.appendChild(s);
  });
}

async function renderSoundtrack(data) {
  const dt = section(data, "day_type");
  const box = $("soundtrack");
  if (!dt || !dt.inferred || !dt.soundtrack) {
    box.innerHTML = emptyNote("Couldn't infer a day type from your most recent session.");
    return;
  }
  const { album, artist } = dt.soundtrack;
  const spotify = `https://open.spotify.com/search/${encodeURIComponent(artist + " " + album)}`;
  box.innerHTML = `
    <img id="cover" alt="${esc(album)} album cover" width="120" height="120"
         style="visibility:hidden" referrerpolicy="no-referrer">
    <div class="sound-meta">
      <div class="daypill">${esc(dt.inferred)} day</div>
      <div class="album">${esc(album)}</div>
      <div class="artist">${esc(artist)}</div>
      <a class="spotify" href="${esc(spotify)}" target="_blank" rel="noopener">Open in Spotify ↗</a>
    </div>`;

  try {
    const q = encodeURIComponent(`${artist} ${album}`);
    const res = await jsonp(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`);
    const art = res && res.results && res.results[0] && res.results[0].artworkUrl100;
    if (art) {
      const img = $("cover");
      img.src = art.replace("100x100bb", "300x300bb");
      img.style.visibility = "visible";
    }
  } catch { /* cover art is decorative - fail silently */ }
}

/* ---------------- Changelog ----------------------------------------------- */
function renderChangelog(data) {
  const cl = section(data, "changelog", { entries: [] }) || { entries: [] };
  const e = cl.entries || [];
  $("changelog").innerHTML = e.length
    ? e.map(x => `<li><div class="cl-date">${esc(x.date || "")}</div><div>${esc(x.text || "")}</div></li>`).join("")
    : emptyNote("No changelog entries yet.");
}

/* ---------------- hero + stats -------------------------------------------- */
function renderHero(data) {
  const s = section(data, "streak", {}) || {};
  const vb = section(data, "volume_battle", {}) || {};
  const prs = section(data, "personal_records", []) || [];
  const dt = section(data, "day_type", {}) || {};
  const totalSets = Object.values(section(data, "volume", {}) || {})
    .reduce((a, b) => a + b, 0);

  $("eyebrow").textContent =
    `${data.date} · last ${data.lookback_days} days`;
  $("headline").textContent = dt.inferred
    ? `${dt.inferred} was your last session`
    : "Training Dashboard";

  const stats = [
    { k: "Sessions", v: data.sessions_analyzed, s: `in ${data.lookback_days}d` },
    { k: "Total sets", v: num(totalSets), s: `in ${data.lookback_days}d` },
    { k: "Week streak", v: s.current_streak_weeks ?? 0, s: `${s.sessions_per_good_week ?? 3}+/wk` },
    { k: "Lifetime PRs", v: prs.length, s: "tracked" },
    { k: "Leading", v: leader(vb.by_day_type), s: "by volume" },
  ];
  $("stats").innerHTML = stats.map(x =>
    `<div class="stat"><div class="k">${esc(x.k)}</div>
     <div class="v">${esc(x.v)} <small>${esc(x.s)}</small></div></div>`).join("");
}
function leader(byDay) {
  if (!byDay) return "—";
  const e = Object.entries(byDay);
  if (!e.length) return "—";
  return e.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/* ---------------- recent workouts ----------------------------------------- */
function fmtDay(iso) {
  try {
    return new Date(iso + "T00:00:00")
      .toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch { return iso; }
}

function relativeDay(iso) {
  const d = new Date(iso + "T00:00:00");
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const w = Math.floor(days / 7);
  return w === 1 ? "1 week ago" : `${w} weeks ago`;
}

function renderSessions(data) {
  const list = section(data, "recent_sessions", []) || [];
  const box = $("sessions-list");
  if (!list.length) { box.innerHTML = emptyNote("No sessions in the current window."); return; }

  box.innerHTML = list.map(s => {
    const chips = (s.exercises || []).map(e => {
      const load = (e.top_weight_kg != null)
        ? `<b>${num(e.top_weight_kg)}kg${e.top_reps ? " × " + e.top_reps : ""}</b>`
        : `<b>${e.sets} sets</b>`;
      return `<span class="exchip">${esc(e.title)} ${load}</span>`;
    }).join("");
    const d = new Date(s.date + "T00:00:00");
    const nice = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `<div class="session">
      <div class="when">
        <div class="d">${esc(nice)}</div>
        <div class="rel">${esc(relativeDay(s.date))}</div>
      </div>
      <div class="what">
        <div class="stitle">${esc(s.title)}
          ${s.day_type ? `<span class="daytag">${esc(s.day_type)}</span>` : ""}
          <span class="daytag">${s.exercise_count} exercises</span>
        </div>
        <div class="exlist">${chips}</div>
      </div>
    </div>`;
  }).join("");
}

/* ---------------- offline download ---------------------------------------- */
async function downloadStandalone(data, standards, btn) {
  btn = btn || $("dl-btn");
  const old = btn.textContent;
  btn.textContent = "Packaging…";
  try {
    const [html, css, js] = await Promise.all([
      fetch("index.html").then(r => r.text()),
      fetch("styles.css").then(r => r.text()),
      fetch("app.js").then(r => r.text()),
    ]);
    // Inline CSS + JS, and freeze the data so the copy works with no network.
    let out = html
      .replace(/<link rel="stylesheet" href="styles\.css">/, `<style>\n${css}\n</style>`)
      .replace(/<script src="app\.js" defer><\/script>/,
        `<script>window.__FROZEN__=${JSON.stringify({ data, standards })};</script>\n`
        + `<script>\n${js}\n</script>`);
    const blob = new Blob([out], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training-dashboard-${data.date}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    btn.textContent = "Downloaded ✓";
  } catch (e) {
    btn.textContent = "Download failed";
  }
  setTimeout(() => { btn.textContent = old; }, 2500);
}

/* ---------------- boot ---------------------------------------------------- */
async function boot() {
  let data, standards;
  if (window.__FROZEN__) {
    // Running from a downloaded standalone copy - no network needed.
    ({ data, standards } = window.__FROZEN__);
  } else {
    try {
      const [d, s] = await Promise.all([
        fetch("data.json?t=" + Date.now()).then(r => r.json()),
        fetch("standards.json").then(r => r.json()).catch(() => null),
      ]);
      data = d; standards = s;
    } catch (e) {
      $("eyebrow").textContent = "Error";
      $("headline").textContent = "Could not load data.json";
      return;
    }
  }

  $("ctx").textContent =
    `${data.sessions_analyzed} sessions · updated ${new Date(data.generated_at).toLocaleDateString()}`;
  $("hist-days").textContent = data.history_days ?? 90;
  $("lookback-days").textContent = data.lookback_days ?? 28;

  // Each section is isolated: one failure can no longer wipe out the rest
  // of the page (that was the old silent-blank-section bug).
  safe("hero", () => renderHero(data));
  safe("sessions", () => renderSessions(data));
  safe("today", () => renderToday(data));
  safe("streak", () => renderStreak(data));
  safe("research", () => renderResearch(data));
  safe("records", () => renderPRs(data));
  safe("standing", () => renderStand(data, standards));
  safe("soundtrack", () => renderSoundtrack(data));
  safe("changelog", () => renderChangelog(data));

  initViews(data);

  // Tap a suggestion to reveal its detail (phones have no hover).
  // Delegated, so it survives re-renders of the list.
  $("suggestions").addEventListener("click", (e) => {
    const row = e.target.closest(".sug");
    document.querySelectorAll(".sug.open").forEach(el => { if (el !== row) el.classList.remove("open"); });
    if (row) row.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#suggestions")) {
      document.querySelectorAll(".sug.open").forEach(el => el.classList.remove("open"));
    }
  });

  // bodyweight
  const saved = localStorage.getItem(BW_KEY);
  if (saved) $("bw").value = saved;
  $("bw-save").addEventListener("click", () => {
    const v = parseFloat($("bw").value);
    if (v > 0) { localStorage.setItem(BW_KEY, String(v)); safe("standing", () => renderStand(data, standards)); }
  });
  $("bw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("bw-save").click(); });

  // PR toggle
  document.querySelectorAll("[data-pr]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-pr]").forEach(b => b.classList.add("btn-ghost"));
      btn.classList.remove("btn-ghost");
      PR_MODE = btn.dataset.pr;
      safe("records", () => renderPRs(data));
    });
  });

  // offline download (both entry points)
  ["dl-btn", "dl-btn-2"].forEach(id => {
    const b = $(id);
    if (b) b.addEventListener("click", () => downloadStandalone(data, standards, b));
  });

  // installable on phone (ignored when opened as a local file)
  if (navigator.serviceWorker && location.protocol.startsWith("http")) {
    try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch {}
  }

  // excuses
  let last = -1;
  $("excuse-btn").addEventListener("click", () => {
    let i; do { i = Math.floor(Math.random() * EXCUSES.length); } while (EXCUSES.length > 1 && i === last);
    last = i;
    $("excuse").textContent = "“" + EXCUSES[i] + "”";
  });
}

/* ---------------- view controller: tabs + swipe --------------------------- */
const TABS = [
  { id: "v-today",    label: "Today",    ico: "◉" },
  { id: "v-sessions", label: "Sessions", ico: "≡" },
  { id: "v-trends",   label: "Trends",   ico: "↗" },
  { id: "v-records",  label: "Records",  ico: "★" },
  { id: "v-more",     label: "More",     ico: "⋯" },
];
let CUR = 0;
let TRENDS_READY = false;

function initViews(data) {
  const views = TABS.map(t => document.getElementById(t.id)).filter(Boolean);

  // top nav
  $("navtabs").innerHTML = TABS
    .map((t, i) => `<button data-i="${i}">${esc(t.label)}</button>`).join("");
  // bottom bar
  $("tabbar").innerHTML =
    `<div class="tabbar-inner">` + TABS.map((t, i) =>
      `<button data-i="${i}"><span class="ico">${t.ico}</span><span>${esc(t.label)}</span></button>`
    ).join("") + `</div>`;

  document.querySelectorAll("[data-i]").forEach(b =>
    b.addEventListener("click", () => show(parseInt(b.dataset.i, 10), data)));

  // deep link (#trends) and back/forward
  const fromHash = () => {
    const h = (location.hash || "").replace("#", "");
    const i = TABS.findIndex(t => t.id === "v-" + h);
    return i >= 0 ? i : 0;
  };
  window.addEventListener("hashchange", () => show(fromHash(), data, true));

  // keyboard
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") show(CUR + 1, data);
    if (e.key === "ArrowLeft") show(CUR - 1, data);
  });

  // swipe
  const vp = $("viewport");
  let x0 = null, y0 = null, t0 = 0;
  vp.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });
  vp.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
    x0 = null;
    // horizontal, far enough, fast enough, and not a vertical scroll
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.8 && dt < 700) {
      show(dx < 0 ? CUR + 1 : CUR - 1, data);
    }
  }, { passive: true });

  show(fromHash(), data, true);
}

function show(i, data, silent) {
  i = Math.max(0, Math.min(TABS.length - 1, i));
  CUR = i;
  TABS.forEach((t, k) => {
    const el = document.getElementById(t.id);
    if (el) el.classList.toggle("is-active", k === i);
  });
  document.querySelectorAll("[data-i]").forEach(b =>
    b.classList.toggle("active", parseInt(b.dataset.i, 10) === i));

  if (!silent) history.replaceState(null, "", "#" + TABS[i].id.replace("v-", ""));
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  // Charts must be built/resized while visible - a canvas in a display:none
  // container measures 0x0 and renders blank.
  if (TABS[i].id === "v-trends") {
    if (!TRENDS_READY) {
      TRENDS_READY = true;
      safe("trends", () => renderTrends(data));
      safe("battle", () => renderBattle(data));
    } else {
      requestAnimationFrame(() => CHARTS.forEach(c => { try { c.resize(); } catch {} }));
    }
  }
}

boot();
