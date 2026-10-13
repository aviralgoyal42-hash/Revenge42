// How much did the shim's probeMin setting change the stock baseline?
"use strict";
const { createEngine } = require("../src/engine");

const S = createEngine().scramble_444;
S.init();
S.setConfig({ phase2Sols: 100 });

const N = Number(process.argv[2] || 60);
const states = [];
for (let i = 0; i < N; i++) states.push(S.randomState());

const moves = [];
const times = [];
let fails = 0;
for (const st of states) {
  const t = Date.now();
  const b = S.solveStateBaseline(st);
  times.push(Date.now() - t);
  if (b.error || !S.verify(st, b.solution).ok) { fails++; continue; }
  moves.push(b.moves);
}

const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) * (c - m), 0) / (a.length - 1)); };
console.log("stock baseline over %d states (TPR's own min2phase arguments)", moves.length);
console.log("  average %s   sd %s   best %d   worst %d",
  avg(moves).toFixed(2), sd(moves).toFixed(2), Math.min(...moves), Math.max(...moves));
console.log("  mean time %d ms", Math.round(avg(times)));
if (fails) console.log("  FAILURES %d", fails);
