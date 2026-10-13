// Two measurements that bound what is still available.
//
// 1. Optimality gap of the winner's 3x3x3. The solver reports p333 around
//    17.2. If the true optimum for those same states is 17.2, that phase is
//    finished. If it is 16.3, there is nearly a move sitting there.
//
// 2. Framing variance. Solving the state after one prepended move is a valid
//    solution one move longer, so k prepended moves is a legitimate
//    multi-start. It pays only if the same state, searched from different
//    starting moves, gives genuinely different lengths. This measures that
//    spread, which is the thing that decides it.
"use strict";

const { createEngine } = require("../src/engine");
const env = createEngine();
const S = env.scramble_444;
const m2p = env.min2phase;
S.init();
S.setConfig({ phase2Sols: 300 });
m2p.initFull();

const N = Number(process.argv[2] || 12);
const BUDGET = Number(process.argv[3] || 3000);

const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) * (c - m), 0) / (a.length - 1)); };

// --- 1. how far is the winner's 3x3x3 from optimal? ----------------------
console.log("1. Optimality gap of the winning reduction's 3x3x3\n");
const found = [];
const optimal = [];
for (let i = 0; i < N; i++) {
  const st = S.randomState();
  const r = S.solve(st, { budgetMs: BUDGET });
  if (r.error || !r.reduced333) continue;
  const got = r.phases.p333;

  // Not the true optimum: proving optimality at low depth means exhausting
  // the space, which runs for minutes. This is the shortest solution a very
  // thorough but bounded search finds, which is the slack actually reachable.
  const s = new m2p.Search().solution(r.reduced333, 21, 1e7, 10000);
  const best = s.indexOf("Error") === 0 ? got : s.trim().split(/\s+/).length;
  found.push(got);
  optimal.push(best);
  process.stdout.write(`   state ${i}: solver ${got}, thorough ${best}\n`);
}
console.log("\n   solver p333    %s", avg(found).toFixed(2));
console.log("   thorough p333  %s", avg(optimal).toFixed(2));
console.log("   reachable slack %s moves per solve\n", (avg(found) - avg(optimal)).toFixed(2));

// --- 2. how much does the starting move change the answer? ---------------
console.log("2. Framing variance from a single prepended move\n");
const PREFIXES = ["", "U", "R", "F", "Rw", "Uw", "Fw"];
const spreads = [];
const gains = [];
for (let i = 0; i < N; i++) {
  const st = S.randomState();
  const lens = [];
  for (const p of PREFIXES) {
    const start = p === "" ? st : S.applyMoves(st, p);
    if (!start) continue;
    const r = S.solve(start, { budgetMs: BUDGET });
    if (r.error) continue;
    const full = p === "" ? r.solution : p + " " + r.solution;
    if (!S.verify(st, full).ok) { console.log("   VERIFY FAILED for prefix", p); continue; }
    lens.push(full.trim().split(/\s+/).length);
  }
  if (lens.length < 2) continue;
  const direct = lens[0];
  const best = Math.min(...lens);
  spreads.push(sd(lens));
  gains.push(direct - best);
  process.stdout.write(`   state ${i}: direct ${direct}, arms [${lens.join(",")}], best ${best}\n`);
}
console.log("\n   within-state sd across framings %s", avg(spreads).toFixed(2));
console.log("   best-of-%d beats direct by       %s moves (before paying for split budget)",
  PREFIXES.length, avg(gains).toFixed(2));
