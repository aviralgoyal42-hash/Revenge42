"use strict";

const $ = (id) => document.getElementById(id);
const C = self.Cube;
const worker = new Worker("worker.js");

// Face letter -> sticker colour, standard Western scheme.
const COLORS = {
  U: "#f5f4ee", R: "#e0263a", F: "#19b45a", D: "#ffd21f", L: "#ff7a1a", B: "#1f5fff", ".": "#2b2e38"
};
const NAMES = { U: "White", R: "Red", F: "Green", D: "Yellow", L: "Orange", B: "Blue" };
const ORDER = ["U", "F", "R", "D", "B", "L"];

let ready = false;
let busy = false;
let paint = C.SOLVED.split("");
let brush = "U";

// ---------------------------------------------------------------- backdrop
// A stained-glass window: jittered triangles in the six cube colours with
// dark leading between them. Seeded, so it is the same on every visit.
(function stainedGlass() {
  const svg = $("glass-bg");
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const W = 1600, Hh = 1000, cols = 11, rows = 7;
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  const pal = ["#b3122a", "#0c3fd1", "#e2a600", "#0f8f45", "#e85d04", "#d8d4c8", "#6a1b9a", "#0d6e7a"];
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols;
      const jx = edge ? 0 : (rnd() - 0.5) * (W / cols) * 0.7;
      const jy = edge ? 0 : (rnd() - 0.5) * (Hh / rows) * 0.7;
      row.push([(c * W) / cols + jx, (r * Hh) / rows + jy]);
    }
    pts.push(row);
  }
  let html = `<defs><filter id="glow"><feGaussianBlur stdDeviation="1.4"/></filter>
    <radialGradient id="shine" cx="70%" cy="10%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><g filter="url(#glow)">`;
  const tri = (a, b, c) => {
    const col = pal[(rnd() * pal.length) | 0];
    const op = 0.32 + rnd() * 0.4;
    html += `<polygon points="${a} ${b} ${c}" fill="${col}" fill-opacity="${op.toFixed(2)}" stroke="#040507" stroke-width="7" stroke-linejoin="round"/>`;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1];
      if (rnd() < 0.5) { tri(a, b, e); tri(a, e, d); } else { tri(a, b, d); tri(b, e, d); }
    }
  }
  html += `</g><rect width="${W}" height="${Hh}" fill="url(#shine)"/>`;
  svg.innerHTML = html;
})();

// ----------------------------------------------------------------- painter
const palette = $("palette");
ORDER.forEach((f, i) => {
  const b = document.createElement("button");
  b.className = "swatch" + (f === "B" ? " dark" : "");
  b.style.background = COLORS[f];
  b.dataset.face = f;
  b.title = `${NAMES[f]} (key ${i + 1})`;
  b.setAttribute("aria-label", NAMES[f]);
  b.innerHTML = `<kbd>${i + 1}</kbd><span class="count"></span>`;
  b.onclick = () => setBrush(f);
  palette.appendChild(b);
});

function setBrush(f) {
  brush = f;
  for (const s of palette.children) s.classList.toggle("active", s.dataset.face === f);
}

// Net layout: faces placed on a 16 x 12 grid of stickers.
const NET_POS = { U: [0, 4], L: [4, 0], F: [4, 4], R: [4, 8], B: [4, 12], D: [8, 4] };
const net = $("net");
const cellEls = new Array(96);
{
  const grid = Array.from({ length: 12 }, () => new Array(16).fill(-1));
  C.STICKERS.forEach((s, i) => {
    const [r0, c0] = NET_POS[s.face];
    grid[r0 + s.r][c0 + s.c] = i;
  });
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 16; c++) {
      const i = grid[r][c];
      const el = document.createElement("div");
      if (i < 0) { el.className = "gap"; net.appendChild(el); continue; }
      el.className = "cell";
      el.dataset.idx = i;
      const s = C.STICKERS[i];
      if (s.c === 0 && c > 0) el.classList.add("face-start-col");
      if (s.r === 0 && r > 0) el.classList.add("face-start-row");
      if (s.r === 0 && s.c === 0) el.title = s.face;
      net.appendChild(el);
      cellEls[i] = el;
    }
  }
  let painting = false;
  net.addEventListener("pointerdown", (e) => {
    const i = e.target.dataset && e.target.dataset.idx;
    if (i == null) return;
    painting = true;
    net.setPointerCapture(e.pointerId);
    paintAt(Number(i));
  });
  net.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.dataset && el.dataset.idx != null && el.parentNode === net) paintAt(Number(el.dataset.idx));
  });
  const stop = () => { painting = false; };
  net.addEventListener("pointerup", stop);
  net.addEventListener("pointercancel", stop);
}

const paint3d = new Cube3D($("paint3d"), { colors: COLORS, onSticker: (i) => paintAt(i) });
$("orb-left").onclick = () => paint3d.nudge(-90);
$("orb-right").onclick = () => paint3d.nudge(90);
$("orb-up").onclick = () => paint3d.nudge(0, paint3d.rx < 0 ? 56 : -56);

function paintAt(i) {
  if (busy || paint[i] === brush) return;
  paint[i] = brush;
  renderPaint();
}

function loadPaint(state) {
  paint = state.split("");
  renderPaint();
}

function counts() {
  const n = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0, ".": 0 };
  for (const ch of paint) n[ch]++;
  return n;
}

function renderPaint() {
  clearProblems();
  for (let i = 0; i < 96; i++) {
    cellEls[i].style.background = COLORS[paint[i]];
    cellEls[i].classList.toggle("blank", paint[i] === ".");
  }
  paint3d.setState(paint.join(""));
  const n = counts();
  for (const s of palette.children) {
    const k = n[s.dataset.face];
    const el = s.querySelector(".count");
    el.textContent = `${k}/16`;
    el.className = "count" + (k === 16 ? " full" : k > 16 ? " over" : "");
  }
  updateSolveButton();
}

// What is wrong with the painting, in words, or null if it can be submitted.
function paintProblem() {
  const n = counts();
  if (n["."]) return `${n["."]} sticker${n["."] === 1 ? "" : "s"} still unpainted.`;
  const off = ORDER.filter((f) => n[f] !== 16).map((f) => `${NAMES[f]} ${n[f]}`);
  if (off.length) return `Each colour needs exactly 16 stickers. Off: ${off.join(", ")}.`;
  return null;
}

function updateSolveButton() {
  $("solve").disabled = busy || !ready;
  for (const id of ["fill-random", "random-scramble", "bench", "apply-scramble"]) $(id).disabled = busy || !ready;
  for (const id of ["fill-solved", "fill-clear"]) $(id).disabled = busy;
  if (ready && !busy) {
    const p = paintProblem();
    if ($("problems").hidden) setStatus(p ? p : "Ready to solve.", p ? "" : "good");
  }
}

$("fill-solved").onclick = () => loadPaint(C.SOLVED);
$("fill-clear").onclick = () => loadPaint(".".repeat(96));
$("fill-random").onclick = () => { setBusy(true, "Generating a random state…"); worker.postMessage({ type: "wcaStates", count: 1 }); };

document.addEventListener("keydown", (e) => {
  if (e.target.matches("textarea, input, select")) return;
  const k = Number(e.key);
  if (k >= 1 && k <= 6) setBrush(ORDER[k - 1]);
  if (e.key === " " && !$("result-step").hidden) { e.preventDefault(); togglePlay(); }
  if (e.key === "ArrowRight" && !$("result-step").hidden) stepTo(pos + 1, true);
  if (e.key === "ArrowLeft" && !$("result-step").hidden) stepTo(pos - 1);
});

// ------------------------------------------------------------------ status
function setStatus(text, kind = "", spin = false) {
  const el = $("status");
  el.className = "status" + (kind ? " " + kind : "");
  el.innerHTML = (spin ? '<span class="spinner"></span>' : "") + escapeHtml(text);
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let meterTimer = null;
function setBusy(b, text) {
  busy = b;
  if (text) setStatus(text, "", true);
  updateSolveButton();
}

function startMeter(ms) {
  const m = $("meter");
  m.hidden = false;
  const bar = m.firstElementChild;
  const t0 = performance.now();
  clearInterval(meterTimer);
  meterTimer = setInterval(() => {
    bar.style.width = Math.min(100, ((performance.now() - t0) / ms) * 100) + "%";
  }, 100);
}
function stopMeter() { clearInterval(meterTimer); $("meter").hidden = true; }

// ------------------------------------------------------------------- solve
let lastBudget = 0;
$("solve").onclick = () => {
  const problems = Cube.diagnose(paint.join(""));
  if (problems.length) { showProblems(problems); return; }
  clearProblems();
  pause();
  lastBudget = Number($("budget").value);
  setBusy(true, `Searching for ${lastBudget / 1000} s…`);
  startMeter(lastBudget);
  worker.postMessage({ type: "solve", state: paint.join(""), budgetMs: lastBudget });
};

// ---------------------------------------------------------------- problems
function clearProblems() {
  $("problems").hidden = true;
  $("problems").innerHTML = "";
  document.querySelectorAll(".bad, .focus").forEach((el) => el.classList.remove("bad", "focus"));
  for (const el of [$("net"), paint3d.root]) el.classList.remove("diag", "has-focus");
}

function markStickers(list, cls) {
  for (const i of list) {
    cellEls[i].classList.add(cls);
    paint3d.stickerEls[i].classList.add(cls);
  }
}

// Turn the 3D view so the given stickers face the viewer.
function lookAt(list) {
  const n = [0, 0, 0];
  for (const i of list) C.STICKERS[i].pos.forEach((v, k) => (n[k] += v));
  const len = Math.hypot(...n);
  if (!len) return;
  const [x, y, z] = n.map((v) => v / len);
  paint3d.ry = (-Math.atan2(x, z) * 180) / Math.PI;
  paint3d.rx = Math.max(-70, Math.min(70, -y * 62));
  paint3d.nudge(0);
}

function showProblems(problems) {
  clearProblems();
  const ul = $("problems");
  problems.forEach((p, k) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>Problem ${k + 1}</b>${escapeHtml(p.text)}`;
    if (p.stickers.length && p.stickers.length < 96) {
      const b = document.createElement("button");
      b.textContent = "Show me";
      b.onclick = () => {
        document.querySelectorAll(".focus").forEach((el) => el.classList.remove("focus"));
        markStickers(p.stickers, "focus");
        for (const el of [$("net"), paint3d.root]) el.classList.add("has-focus");
        lookAt(p.stickers);
        $("net").scrollIntoView({ behavior: "smooth", block: "center" });
      };
      li.appendChild(b);
    }
    ul.appendChild(li);
    markStickers(p.stickers, "bad");
  });
  ul.hidden = false;
  if (problems.some((p) => p.stickers.length && p.stickers.length < 96)) {
    for (const el of [$("net"), paint3d.root]) el.classList.add("diag");
  }
  setStatus(
    problems.length === 1 ? "This cube can't be solved yet. One problem to fix:" :
      `This cube can't be solved yet. ${problems.length} problems to fix:`,
    "err"
  );
}

function friendlyError(err) {
  if (/state check failed/.test(err)) {
    return "That colouring isn't a possible cube. Usually one or two stickers are mispainted, " +
      "or a corner's colours are in the wrong order. Check against your cube and try again.";
  }
  return "Error: " + err;
}

// ------------------------------------------------------------------ player
const play3d = new Cube3D($("play3d"), { colors: COLORS });
let sol = [];        // move tokens
let stepStates = [];     // stepStates[k] = state after k moves
let pos = 0;
let playing = false;
let animating = false;

function showResult(m) {
  $("result-step").hidden = false;
  sol = C.tokens(m.solution);
  stepStates = [m.state];
  for (const t of sol) stepStates.push(C.applyMove(stepStates[stepStates.length - 1], t));
  const end = stepStates[stepStates.length - 1];
  const solvedEnd = [0, 1, 2, 3, 4, 5].every((f) => new Set(end.substr(f * 16, 16)).size === 1);

  $("bigcount").innerHTML = `${m.moves}<small>moves</small>`;
  const ok = m.verified && solvedEnd;
  $("verdict").textContent = ok ? "Verified solved" : "Did not verify";
  $("verdict").className = "tag " + (ok ? "ok" : "bad");
  $("rot-note").hidden = end === C.SOLVED;

  const movesEl = $("moves");
  movesEl.innerHTML = "";
  const split = m.reductionMoves + m.phases.p333 === sol.length ? m.reductionMoves : -1;
  sol.forEach((t, i) => {
    if (i === 0 && split > 0) movesEl.insertAdjacentHTML("beforeend", '<div class="stage">Reduction</div>');
    if (i === split) movesEl.insertAdjacentHTML("beforeend", '<div class="stage">3x3x3 stage</div>');
    const b = document.createElement("button");
    b.textContent = t;
    b.onclick = () => { pause(); stepTo(i + 1); };
    movesEl.appendChild(b);
  });

  const rows = [
    ["Centres, first axis", m.phases.p1],
    ["Centres, remaining", m.phases.p2],
    ["Edge pairing", m.phases.p3],
    ["Reduction after cancellation", m.reductionMoves],
    ["3x3x3 (Kociemba two-phase)", m.phases.p333]
  ];
  $("breakdown").querySelector("tbody").innerHTML =
    rows.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join("") +
    `<tr class="total"><td>Total</td><td class="n">${m.moves}</td></tr>`;

  $("progress").max = sol.length;
  stepTo(0);
  setStatus(
    `${m.moves} moves in ${(m.ms / 1000).toFixed(1)} s, after comparing ${m.stats.reductions} reductions.`,
    "good"
  );
  $("result-step").scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  $("progress").value = pos;
  $("counter").textContent = `${pos} / ${sol.length}`;
  const btns = $("moves").querySelectorAll("button");
  btns.forEach((b, i) => {
    b.classList.toggle("done", i < pos - 1);
    b.classList.toggle("cur", i === pos - 1);
  });
  $("p-play").textContent = playing ? "⏸" : "▶";
}

async function stepTo(k, animate = false) {
  k = Math.max(0, Math.min(sol.length, k));
  if (animating) return;
  if (animate && k === pos + 1) {
    animating = true;
    pos = k;
    render();
    await play3d.animate(sol[k - 1], Number($("p-speed").value));
    animating = false;
  } else {
    pos = k;
    play3d.setState(stepStates[k]);
    render();
  }
}

async function togglePlay() {
  if (playing) { pause(); return; }
  if (pos >= sol.length) stepTo(0);
  playing = true;
  render();
  while (playing && pos < sol.length) {
    await stepTo(pos + 1, true);
    await new Promise((r) => setTimeout(r, 40));
  }
  playing = false;
  render();
}
function pause() { playing = false; render(); }

$("p-play").onclick = togglePlay;
$("p-start").onclick = () => { pause(); stepTo(0); };
$("p-end").onclick = () => { pause(); stepTo(sol.length); };
$("p-back").onclick = () => { pause(); stepTo(pos - 1); };
$("p-fwd").onclick = () => { pause(); stepTo(pos + 1, true); };
$("progress").oninput = (e) => { pause(); stepTo(Number(e.target.value)); };

// ---------------------------------------------------------------- advanced
$("apply-scramble").onclick = () => {
  const text = $("scramble").value.trim();
  const bad = C.tokens(text).filter((t) => !C.parseMove(t));
  const st = $("scr-status");
  if (!text) { st.textContent = "Type a scramble first."; st.className = "status err"; return; }
  if (bad.length) { st.textContent = `Not a move: ${bad.slice(0, 4).join(" ")}`; st.className = "status err"; return; }
  loadPaint(C.applyAlg(C.SOLVED, text));
  st.textContent = `Applied ${C.tokens(text).length} moves to the painter.`;
  st.className = "status good";
};
$("random-scramble").onclick = () => { setBusy(true, "Generating a WCA random-state scramble…"); worker.postMessage({ type: "scramble" }); };

const average = (a) => a.reduce((p, c) => p + c, 0) / (a.length || 1);
let benchRows = [];
$("bench").onclick = () => {
  const n = Number($("bench-n").value);
  const budgetMs = Number($("bench-budget").value);
  benchRows = [];
  setBusy(true, "Benchmark running…");
  $("bench-status").textContent = `Running ${n} states at ${budgetMs / 1000} s each, about ${Math.max(1, Math.round((n * budgetMs) / 60000))} min.`;
  worker.postMessage({ type: "bench", count: n, budgetMs });
};

function showBench(results) {
  const ok = results.filter((r) => r.verified && r.baseVerified && r.moves != null);
  const bad = results.length - ok.length;
  const base = ok.map((r) => r.baseline), opt = ok.map((r) => r.moves);
  const line = (name, a) =>
    `<tr><td>${name}</td><td class="n">${average(a).toFixed(2)}</td><td class="n">${Math.min(...a)}</td><td class="n">${Math.max(...a)}</td></tr>`;
  $("bench-table").hidden = false;
  $("bench-table").querySelector("tbody").innerHTML = line("TPR three-phase", base) + line("Revenge42", opt);
  $("bench-status").textContent =
    `${ok.length} states, ${(average(base) - average(opt)).toFixed(2)} moves shorter on average.` +
    (bad ? ` ${bad} failed verification.` : " Every solution verified.");
}

// ------------------------------------------------------------------ worker
worker.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case "ready":
      ready = true;
      setBusy(false);
      return;
    case "states":
      loadPaint(m.states[0]);
      setBusy(false);
      return;
    case "scramble":
      $("scramble").value = m.scramble;
      loadPaint(C.applyAlg(C.SOLVED, m.scramble));
      $("scr-status").textContent = "Random WCA scramble applied to the painter.";
      $("scr-status").className = "status good";
      setBusy(false);
      return;
    case "result":
      stopMeter();
      busy = false;
      updateSolveButton();
      showResult(m);
      return;
    case "bench-progress":
      benchRows.push(m.row);
      $("bench-status").textContent =
        `Solved ${m.done} of ${m.total}. Running average ${average(benchRows.map((r) => r.moves)).toFixed(2)} moves.`;
      return;
    case "bench-done":
      setBusy(false);
      showBench(m.results);
      return;
    case "error":
      stopMeter();
      busy = false;
      updateSolveButton();
      setStatus(friendlyError(m.error), "err");
      return;
  }
};

// ------------------------------------------------------------------- theme
function applyTheme(t) {
  if (t === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  const light = t === "light";
  $("theme-label").textContent = light ? "Light" : "Dark";
  $("theme-icon").setAttribute("d", light
    ? "M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"
    : "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z");
  try { localStorage.setItem("r42-theme", t); } catch (e) {}
}
$("theme-toggle").onclick = () =>
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

setBrush("U");
renderPaint();
setBusy(true, "Loading solver…");
worker.postMessage({ type: "init" });
