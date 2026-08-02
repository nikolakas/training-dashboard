/* Training Dashboard - reads data.json + standards.json, renders everything.
   Every section renders defensively so new data.json keys can be added later
   without breaking older sections (and missing keys degrade to a notice). */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const num = (n) => (Math.round(n * 10) / 10).toString();

const CHART_FONT = { family: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const AXIS = { color: "#93a1b3", font: { ...CHART_FONT, size: 11 } };
const GRID = { color: "rgba(255,255,255,0.06)" };

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

/* ---------------- Today --------------------------------------------------- */
function renderToday(data) {
  const rest = section(data, "rest", {});
  const flag = rest && rest.flag;
  $("rest-flag").innerHTML = flag
    ? `<div class="flag">${esc(flag)}</div>`
    : `<div class="flag ok">No rest flag triggered — you're clear to train.</div>`;

  const sugg = section(data, "suggestions", []) || [];
  $("suggestions").innerHTML = sugg.length ? sugg.map(s => {
    const kind = ["increase", "deload", "note"].includes(s.type) ? s.type : "note";
    const label = { increase: "Increase", deload: "Deload", note: "Info" }[kind];
    const zone = s.zone ? `<span class="pill">${esc(s.zone)}</span>` : "";
    return `<div class="item ${kind}">
      <div class="name">${esc(s.exercise)}<span class="pill">${label}</span>${zone}</div>
      <div class="detail">${esc(s.detail)}</div>
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
  if (!s) { $("streak-card").innerHTML = "<h2>Streak</h2>" + emptyNote("No streak data in this export."); return; }

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
    new Chart($(`chart-${i}`), {
      type: "line",
      data: {
        labels: pts.map(p => p.date),
        datasets: [{
          label: "Top set (kg)",
          data: pts.map(p => p.top_weight_kg),
          borderColor: "#ff8a3d",
          backgroundColor: "rgba(255,138,61,0.14)",
          tension: 0.25, fill: true, pointRadius: 3, borderWidth: 2,
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
          y: { ticks: AXIS, grid: GRID, title: { display: true, text: "kg", color: "#93a1b3" } },
        },
      },
    });
  });
}

/* ---------------- Volume battle ------------------------------------------- */
function renderBattle(data) {
  const vb = section(data, "volume_battle");
  if (!vb || !vb.by_day_type) return;
  const d = vb.by_day_type;
  const labels = ["Push", "Pull", "Legs"];
  const vals = labels.map(l => d[l] || 0);

  new Chart($("battle-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sets",
        data: vals,
        backgroundColor: ["#ff8a3d", "#5aa9f7", "#46d18a"],
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: AXIS, grid: { display: false } },
        y: { ticks: AXIS, grid: GRID, beginAtZero: true, title: { display: true, text: "sets", color: "#93a1b3" } },
      },
    },
  });

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

/* ---------------- boot ---------------------------------------------------- */
async function boot() {
  let data, standards;
  try {
    const [d, s] = await Promise.all([
      fetch("data.json?t=" + Date.now()).then(r => r.json()),
      fetch("standards.json").then(r => r.json()).catch(() => null),
    ]);
    data = d; standards = s;
  } catch (e) {
    $("meta").textContent = "Could not load data.json.";
    return;
  }

  $("meta").textContent =
    `${data.sessions_analyzed} sessions in the last ${data.lookback_days} days · `
    + `generated ${new Date(data.generated_at).toLocaleString()}`;
  $("hist-days").textContent = data.history_days ?? 90;
  $("lookback-days").textContent = data.lookback_days ?? 28;

  renderToday(data);
  renderStreak(data);
  renderResearch(data);
  renderTrends(data);
  renderBattle(data);
  renderPRs(data);
  renderStand(data, standards);
  renderSoundtrack(data);
  renderChangelog(data);

  // bodyweight
  const saved = localStorage.getItem(BW_KEY);
  if (saved) $("bw").value = saved;
  $("bw-save").addEventListener("click", () => {
    const v = parseFloat($("bw").value);
    if (v > 0) { localStorage.setItem(BW_KEY, String(v)); renderStand(data, standards); }
  });
  $("bw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("bw-save").click(); });

  // PR toggle
  document.querySelectorAll("[data-pr]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-pr]").forEach(b => b.classList.remove("toggle-active"));
      btn.classList.add("toggle-active");
      PR_MODE = btn.dataset.pr;
      renderPRs(data);
    });
  });

  // excuses
  let last = -1;
  $("excuse-btn").addEventListener("click", () => {
    let i; do { i = Math.floor(Math.random() * EXCUSES.length); } while (EXCUSES.length > 1 && i === last);
    last = i;
    $("excuse").textContent = "“" + EXCUSES[i] + "”";
  });
}

boot();
