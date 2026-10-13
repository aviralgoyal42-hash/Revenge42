// What does probeMin buy, and what does it cost?
//
// Screening compares many reductions with a cheap 3x3x3 search. probeMin
// makes min2phase keep looking after it finds a solution, returning the
// shortest it saw. The question is whether the shorter screen is worth the
// smaller number of reductions that then fit in the budget.
"use strict";

const env = require("../src/engine").createEngine();
const m2p = env.min2phase;
m2p.initFull();

const N = Number(process.argv[2] || 40);
const cubes = Array.from({ length: N }, () => m2p.randomCube());

function row(maxDepth, probeMax, probeMin) {
  let ms = 0, len = 0, fails = 0, worst = 0;
  for (const c of cubes) {
    const a = Date.now();
    const s = new m2p.Search().solution(c, maxDepth, probeMax, probeMin);
    const dt = Date.now() - a;
    ms += dt;
    if (dt > worst) worst = dt;
    if (s.indexOf("Error") === 0) fails++;
    else len += s.trim().split(/\s+/).length;
  }
  const ok = N - fails;
  console.log(
    "  depth %d  probeMax %s  probeMin %s  ->  len %s  mean %sms  worst %dms  fails %d",
    maxDepth, String(probeMax).padStart(8), String(probeMin).padStart(6),
    ok ? (len / ok).toFixed(2) : "-", (ms / N).toFixed(1), worst, fails
  );
}

console.log("min2phase on %d random 3x3x3 states, full tables\n", N);
for (const pmin of [0, 50, 100, 250, 500, 1000, 2000]) {
  row(21, 1000000, pmin);
}
console.log("");
for (const pmin of [0, 100, 500]) {
  row(20, 1000000, pmin);
}
