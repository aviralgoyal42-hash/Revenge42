"use strict";

const $ = (id) => document.getElementById(id);
const worker = new Worker("worker.js");

let ready = false;
const pending = { solve: null, bench: null };

function setBusy(busy) {
  $("solve").disabled = busy || !ready;
  $("random").disabled = busy || !ready;
  $("bench").disabled = busy || !ready;
}

worker.onmessage = (e) => {
  const m = e.data;

  if (m.type === "ready") {
    ready = true;
    setBusy(false);
    $("status").textContent = `Solver ready. Lookup tables built in ${(m.ms / 1000).toFixed(1)} s.`;
    return;
  }

  if (m.type === "scramble") {
    $("scramble").value = m.scramble;
    setBusy(false);
    $("status").textContent = "Random scramble loaded.";
    return;
  }

  if (m.type === "result") {
    setBusy(false);
    showResult(m);
    return;
  }

  if (m.type === "bench-progress") {
    pending.bench.rows.push(m.row);
    $("bench-status").textContent =
      `Solved ${m.done} of ${m.total}. Running average ` +
      `${average(pending.bench.rows.map((r) => r.moves)).toFixed(2)} moves.`;
    return;
  }

  if (m.type === "bench-done") {
    setBusy(false);
    showBench(m.results);
    return;
  }

  if (m.type === "error") {
    setBusy(false);
    $("status").textContent = "Error: " + m.error;
  }
};

const average = (a) => a.reduce((p, c) => p + c, 0) / (a.length || 1);

function showResult(m) {
  $("result-panel").hidden = false;
  $("solution").textContent = m.solution;

  const verdict = $("verdict");
  verdict.textContent = m.verified ? "verified" : "DOES NOT SOLVE";
  verdict.className = "tag " + (m.verified ? "ok" : "bad");

  const rows = [
    ["Centers, first axis", m.phases.p1, ""],
    ["Centers, remaining", m.phases.p2, ""],
    ["Edge pairing", m.phases.p3, "reduces to a 3x3x3"],
    ["Reduction, after cancellation", m.reductionMoves, ""],
    ["3x3x3 (Kociemba two-phase)", m.phases.p333, ""],
    ["Total", m.moves, "outer block turn metric"]
  ];
  $("breakdown").querySelector("tbody").innerHTML = rows
    .map(([a, b, c]) => `<tr><td>${a}</td><td class="num">${b}</td><td>${c}</td></tr>`)
    .join("");

  $("status").textContent =
    `${m.moves} moves in ${(m.ms / 1000).toFixed(1)} s. ` +
    `Compared ${m.stats.reductions} distinct reductions, ` +
    `deepened ${m.stats.deepened}.` +
    (m.stats.timedOut ? " Stopped on the time budget." : " Search space exhausted before the budget.");
}

function showBench(results) {
  const ok = results.filter((r) => r.verified && r.moves != null);
  const bad = results.length - ok.length;
  const base = ok.map((r) => r.baseline);
  const opt = ok.map((r) => r.moves);

  const line = (name, a, t) =>
    `<tr><td>${name}</td><td class="num">${average(a).toFixed(2)}</td>` +
    `<td class="num">${Math.min(...a)}</td><td class="num">${Math.max(...a)}</td>` +
    `<td class="num">${t}</td></tr>`;

  $("bench-table").hidden = false;
  $("bench-table").querySelector("tbody").innerHTML =
    line("stock three-phase", base, "< 1 s") +
    line("this solver", opt, (average(ok.map((r) => r.ms)) / 1000).toFixed(1) + " s");

  $("bench-status").textContent =
    `${ok.length} scrambles, ${(average(base) - average(opt)).toFixed(2)} moves shorter on average.` +
    (bad ? ` ${bad} FAILED VERIFICATION.` : " All solutions verified.");
}

$("solve").onclick = () => {
  setBusy(true);
  $("status").textContent = "Searching…";
  worker.postMessage({
    type: "solve",
    scramble: $("scramble").value.trim() || undefined,
    budgetMs: Number($("budget").value)
  });
};

$("random").onclick = () => {
  setBusy(true);
  $("status").textContent = "Generating…";
  worker.postMessage({ type: "scramble" });
};

$("bench").onclick = () => {
  setBusy(true);
  pending.bench = { rows: [] };
  const n = Number($("bench-n").value);
  const budgetMs = Number($("bench-budget").value);
  $("bench-status").textContent =
    `Running ${n} scrambles at ${budgetMs / 1000} s each. ` +
    `This takes about ${Math.round((n * budgetMs) / 60000)} minutes.`;
  worker.postMessage({ type: "bench", count: n, budgetMs });
};

setBusy(true);
worker.postMessage({ type: "init" });
