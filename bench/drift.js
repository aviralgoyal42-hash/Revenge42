// Did conditions change during a saved benchmark run?
//
// A fixed time budget means the amount of search done per solve depends on how
// fast the machine is running at that moment. reductionsScreened is the
// cleanest record of that. Baseline moves are a control: the baseline solver has
// no time budget and does identical work on a given state every time, so any
// drift in its average reflects the states, not the machine.
//
//   node bench/drift.js [results.csv] [blockSize]
"use strict";

const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.join(__dirname, "..", "results", "results-2000.csv");
const block = Number(process.argv[3] || 250);

const lines = fs.readFileSync(file, "utf8").trim().split("\n");
const head = lines[0].split(",");
const rows = lines.slice(1).map((l) => {
  const v = l.split(",");
  return Object.fromEntries(head.map((k, i) => [k, Number(v[i])]));
});

const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) * (c - m), 0) / (a.length - 1)); };
const f = (x, d = 2) => x.toFixed(d).padStart(8);

console.log("%s, %d rows, blocks of %d\n", path.basename(file), rows.length, block);
console.log("   rows        screened  solverMs    solver  baseline");
for (let s = 0; s < rows.length; s += block) {
  const b = rows.slice(s, s + block);
  console.log(
    "%s  %s  %s  %s  %s",
    `${String(s).padStart(4)}-${String(s + b.length - 1).padStart(4)}`,
    f(avg(b.map((r) => r.reductionsScreened)), 1),
    f(avg(b.map((r) => r.solverMs)), 0),
    f(avg(b.map((r) => r.solverMoves)), 3),
    f(avg(b.map((r) => r.baselineMoves)), 3)
  );
}

const half = rows.length >> 1;
const A = rows.slice(0, half);
const B = rows.slice(half);
console.log("\nfirst half against second half");
for (const key of ["reductionsScreened", "solverMs", "solverMoves", "baselineMoves"]) {
  const a = A.map((r) => r[key]);
  const b = B.map((r) => r[key]);
  const diff = avg(b) - avg(a);
  const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);
  console.log("  %s  first %s  second %s  diff %s  z %s",
    key.padEnd(18), f(avg(a), 3), f(avg(b), 3), f(diff, 3), f(diff / se, 2));
}

// Least-squares slope of screening against position in the run.
const xs = rows.map((_, i) => i);
const ys = rows.map((r) => r.reductionsScreened);
const mx = avg(xs), my = avg(ys);
let num = 0, den = 0;
for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
console.log("\nscreening trend: %s reductions per 1000 solves", (1000 * num / den).toFixed(2));
