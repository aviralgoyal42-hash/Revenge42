// Benchmarks a solver configuration over the fixed state set.
//
//   node bench/run.js [budgetMs] [count] [json-overrides]
//
// Every solution is verified. A configuration that produces even one wrong
// solution is reported as failed, not as a fast result.
"use strict";

const fs = require("fs");
const path = require("path");
const { createEngine } = require("../src/engine");

const budgetMs = Number(process.argv[2] || 30000);
const count = Number(process.argv[3] || 20);
const overrides = process.argv[4] ? JSON.parse(process.argv[4]) : {};

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "states.json"), "utf8"));
const states = data.states.slice(0, count);

const S = createEngine().scramble_444;
if (overrides.phase2Sols || overrides.phase1Sols || overrides.phase2Atts) {
  S.setConfig(overrides);
}
S.init();

const opts = Object.assign({ budgetMs }, overrides);

const base = [];
const opt = [];
const times = [];
let fails = 0;

for (let i = 0; i < states.length; i++) {
  const state = states[i];

  const b = S.solveStateBaseline(state);
  if (b.error || !S.verify(state, b.solution).ok) {
    console.error("state %d: baseline failed (%s)", i, b.error || "bad solution");
    fails++;
    continue;
  }

  const o = S.solve(state, Object.assign({}, opts));
  if (o.error || !S.verify(state, o.solution).ok) {
    console.error("state %d: optimiser failed (%s)", i, o.error || "bad solution");
    fails++;
    continue;
  }

  base.push(b.moves);
  opt.push(o.moves);
  times.push(o.ms);
  process.stdout.write(
    `${String(i).padStart(3)}  ${b.moves} -> ${o.moves}  ` +
    `(red ${o.reductionMoves} + 3x3x3 ${o.phases.p333})  ` +
    `${Math.round(o.ms)}ms  red=${o.stats.reductions} deep=${o.stats.deepened}` +
    `${o.stats.timedOut ? " [budget]" : ""}\n`
  );
}

const sum = (a) => a.reduce((p, c) => p + c, 0);
const avg = (a) => sum(a) / a.length;

console.log("\n=== %d states, %d ms budget, overrides %j ===", opt.length, budgetMs, overrides);
console.log("baseline   avg %s   best %d   worst %d", avg(base).toFixed(2), Math.min(...base), Math.max(...base));
console.log("optimised  avg %s   best %d   worst %d", avg(opt).toFixed(2), Math.min(...opt), Math.max(...opt));
console.log("improvement %s moves per solve", (avg(base) - avg(opt)).toFixed(2));
console.log("time       avg %dms   worst %dms", Math.round(avg(times)), Math.round(Math.max(...times)));
if (fails) console.log("FAILURES: %d", fails);
