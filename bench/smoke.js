// Correctness first: every solution must actually solve its state.
"use strict";

const { createEngine } = require("../src/engine");

const S = createEngine().scramble_444;

const t0 = Date.now();
S.init();
console.log("table build: %d ms\n", Date.now() - t0);

const budget = Number(process.argv[2] || 30000);
const n = Number(process.argv[3] || 5);
let fails = 0;
let baseSum = 0;
let optSum = 0;

for (let i = 0; i < n; i++) {
  const state = S.randomState();

  const base = S.solveStateBaseline(state);
  const bv = S.verify(state, base.solution);

  const opt = S.solveState(state, { budgetMs: budget });
  if (opt.error) {
    console.log("#%d optimiser ERROR: %s", i, opt.error);
    fails++;
    continue;
  }
  const ov = S.verify(state, opt.solution);
  if (!bv.ok || !ov.ok) fails++;
  baseSum += base.moves;
  optSum += opt.moves;

  console.log(
    "#%d  baseline %d  ->  %d  (%+d)  %dms  verified %s/%s",
    i, base.moves, opt.moves, opt.moves - base.moves, opt.ms, bv.ok, ov.ok
  );
  console.log(
    "    red %d + 3x3x3 %d | screened %d reductions, kept %d, deepened %d, searches %d, timedOut %s",
    opt.reductionMoves, opt.phases.p333, opt.stats.reductions, opt.stats.kept,
    opt.stats.deepened, opt.stats.searches, opt.stats.timedOut
  );
}

const solved = n - fails;
if (solved) {
  console.log("\nbaseline avg %s  optimised avg %s", (baseSum / solved).toFixed(2), (optSum / solved).toFixed(2));
}
console.log(fails === 0 ? "all solutions verified" : `${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
