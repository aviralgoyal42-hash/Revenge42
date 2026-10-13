// Independently checks and summarises a saved benchmark run.
//
// Reads results/scrambles-*.txt, results/solutions-*.txt,
// results/baseline-solutions-*.txt and results/results-*.csv, then replays
// every scramble-and-solution pair through cubing.js, which shares no code
// with this solver, and confirms the cube ends solved. Writes a summary.
//
//   npm install && node bench/analyze.mjs [tag]
//
// Nothing here trusts the solver: the move counts are recounted from the saved
// solution strings rather than read from the CSV, and the CSV is only used to
// cross-check.

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { puzzles } from "cubing/puzzles";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, "..", "results");
const TAG = process.argv[2] || "2000";

const lines = (f) => readFileSync(join(RESULTS, f), "utf8").replace(/\n+$/, "").split("\n");

const scrambles = lines(`scrambles-${TAG}.txt`);
const solutions = lines(`solutions-${TAG}.txt`);
const baseSolutions = lines(`baseline-solutions-${TAG}.txt`);
const csv = lines(`results-${TAG}.csv`);
const header = csv[0].split(",");
const rows = csv.slice(1).map((l) => {
  const v = l.split(",");
  return Object.fromEntries(header.map((h, i) => [h, Number(v[i])]));
});

console.log("scrambles %d, solutions %d, baseline solutions %d, csv rows %d\n",
  scrambles.length, solutions.length, baseSolutions.length, rows.length);

const kpuzzle = await puzzles["4x4x4"].kpuzzle();
const solved = kpuzzle.defaultPattern();

// The 24 solved-but-rotated patterns. A 4x4x4 has no fixed centres, so a cube
// solved in a rotated orientation is genuinely solved.
const solvedClass = [];
{
  const seen = new Set();
  const queue = [solved];
  while (queue.length) {
    const p = queue.shift();
    const key = JSON.stringify(p.patternData);
    if (seen.has(key)) continue;
    seen.add(key);
    solvedClass.push(p);
    for (const g of ["x", "y"]) queue.push(p.applyAlg(g));
  }
}
const isSolved = (p) => solvedClass.some((q) => p.isIdentical(q));
console.log("solved-orientation class: %d patterns (expect 24)\n", solvedClass.length);

const count = (s) => { s = s.trim(); return s === "" ? 0 : s.split(/\s+/).length; };
const VOCAB = new Set();
for (const f of ["U", "R", "F", "D", "L", "B"]) {
  for (const w of ["", "w"]) for (const a of ["", "2", "'"]) VOCAB.add(f + w + a);
}

let solverFail = 0, baseFail = 0, vocabFail = 0, csvMismatch = 0;
let solverExact = 0, baseExact = 0;
const solverLens = [], baseLens = [];

for (let i = 0; i < scrambles.length; i++) {
  for (const tok of (scrambles[i] + " " + solutions[i]).trim().split(/\s+/)) {
    if (!VOCAB.has(tok)) { vocabFail++; break; }
  }
  // Solved in any of the 24 orientations counts as solved. "Exact" additionally
  // means it finished in the starting orientation. Reported separately because
  // more search makes rotated finishes far more common: measured on 200 states,
  // 23 percent rotated at 300 ms, 41.5 at 1000 ms and 62 at 5000 ms.
  const sp = solved.applyAlg(scrambles[i]).applyAlg(solutions[i]);
  const bp = solved.applyAlg(scrambles[i]).applyAlg(baseSolutions[i]);
  if (!isSolved(sp)) solverFail++; else if (sp.isIdentical(solved)) solverExact++;
  if (!isSolved(bp)) baseFail++; else if (bp.isIdentical(solved)) baseExact++;

  const sl = count(solutions[i]);
  const bl = count(baseSolutions[i]);
  solverLens.push(sl);
  baseLens.push(bl);
  if (sl !== rows[i].solverMoves || bl !== rows[i].baselineMoves) csvMismatch++;

  if ((i + 1) % 250 === 0) process.stdout.write(`  checked ${i + 1}/${scrambles.length}\n`);
}

const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) * (c - m), 0) / (a.length - 1)); };
const hist = (a) => { const h = {}; a.forEach((x) => h[x] = (h[x] || 0) + 1); return h; };

const d = solverLens.map((x, i) => baseLens[i] - x);
const se = sd(d) / Math.sqrt(d.length);
const seSolver = sd(solverLens) / Math.sqrt(solverLens.length);

const summary = {
  tag: TAG,
  n: scrambles.length,
  verification: {
    tool: "cubing.js, independent of the solver",
    solverSolutionsFailed: solverFail,
    baselineSolutionsFailed: baseFail,
    tokensOutsideMoveSet: vocabFail,
    csvDisagreesWithSolutionStrings: csvMismatch
  },
  finishOrientation: {
    note: "solved in any of the 24 orientations is solved; exact means it also ended in the starting orientation",
    solverExact,
    solverRotated: scrambles.length - solverFail - solverExact,
    baselineExact: baseExact,
    baselineRotated: scrambles.length - baseFail - baseExact
  },
  metric: "OBTM: 36 generators, wide turns and half turns each count as 1, no slice moves",
  solver: {
    avg: +avg(solverLens).toFixed(4), sd: +sd(solverLens).toFixed(4), se: +seSolver.toFixed(4),
    ci95: [+(avg(solverLens) - 1.96 * seSolver).toFixed(3), +(avg(solverLens) + 1.96 * seSolver).toFixed(3)],
    best: Math.min(...solverLens), worst: Math.max(...solverLens), hist: hist(solverLens)
  },
  baseline: {
    avg: +avg(baseLens).toFixed(4), sd: +sd(baseLens).toFixed(4),
    best: Math.min(...baseLens), worst: Math.max(...baseLens), hist: hist(baseLens)
  },
  pairedImprovement: {
    mean: +avg(d).toFixed(4), sd: +sd(d).toFixed(4), se: +se.toFixed(4),
    ci95: [+(avg(d) - 1.96 * se).toFixed(3), +(avg(d) + 1.96 * se).toFixed(3)],
    shorter: d.filter((x) => x > 0).length,
    equal: d.filter((x) => x === 0).length,
    longer: d.filter((x) => x < 0).length,
    hist: hist(d)
  },
  vsPublished4439: {
    note: "44.39 is cs0x7f's published mean for the Java TPR solver, not a per-solve threshold",
    solverSolvesAbove: solverLens.filter((x) => x > 44.39).length,
    baselineSolvesAbove: baseLens.filter((x) => x > 44.39).length
  },
  timing: {
    meanMs: Math.round(avg(rows.map((r) => r.solverMs))),
    worstMs: Math.max(...rows.map((r) => r.solverMs)),
    overBudget5000ms: rows.filter((r) => r.solverMs > 5000).length
  },
  breakdown: {
    reductionMoves: +avg(rows.map((r) => r.reductionMoves)).toFixed(3),
    moves333: +avg(rows.map((r) => r.p333)).toFixed(3),
    reductionsScreened: Math.round(avg(rows.map((r) => r.reductionsScreened)))
  }
};

writeFileSync(join(RESULTS, `summary-${TAG}.json`), JSON.stringify(summary, null, 2));
console.log("\n" + JSON.stringify(summary, null, 2));
