// Compares arbitrary configurations, given as JSON, on the same states.
//
//   node bench/sweep.js <budgetMs> <count> <configs.json>
//
// configs.json holds [["label", {overrides}], ...]
"use strict";

const fs = require("fs");
const path = require("path");
const { createEngine } = require("../src/engine");

const budgetMs = Number(process.argv[2] || 8000);
const count = Number(process.argv[3] || 12);
const configs = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "states.json"), "utf8"));
const states = data.states.slice(0, count);

const S = createEngine().scramble_444;
S.init();

const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const baseline = states.map((s) => S.solveStateBaseline(s).moves);
console.log("baseline avg %s over %d states, budget %dms\n", avg(baseline).toFixed(2), count, budgetMs);

for (const [label, over] of configs) {
  S.setConfig({
    phase1Sols: over.phase1Sols !== undefined ? over.phase1Sols : 10000,
    phase2Atts: over.phase2Atts !== undefined ? over.phase2Atts : 500,
    phase2Sols: over.phase2Sols !== undefined ? over.phase2Sols : 100
  });

  const moves = [];
  const times = [];
  let fails = 0;
  for (const state of states) {
    const o = S.solve(state, Object.assign({ budgetMs }, over));
    if (o.error || !S.verify(state, o.solution).ok) {
      fails++;
      continue;
    }
    moves.push(o.moves);
    times.push(o.ms);
  }
  console.log(
    "%s  avg %s  best %d  worst %d  meanMs %d%s",
    label.padEnd(32),
    moves.length ? avg(moves).toFixed(2) : "-",
    moves.length ? Math.min(...moves) : 0,
    moves.length ? Math.max(...moves) : 0,
    times.length ? Math.round(avg(times)) : 0,
    fails ? "  FAILURES " + fails : ""
  );
}
