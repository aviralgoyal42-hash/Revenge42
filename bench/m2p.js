// How much does a shorter 3x3x3 solution actually cost?
"use strict";
const env = require("../src/engine").createEngine();
const m2p = env.min2phase;
m2p.initFull();

const N = 12;
const cubes = Array.from({ length: N }, () => m2p.randomCube());

function row(maxDepth, probeMax) {
  let ms = 0, len = 0, fails = 0, worst = 0;
  for (const c of cubes) {
    const a = Date.now();
    const s = new m2p.Search().solution(c, maxDepth, probeMax, 0);
    const dt = Date.now() - a;
    ms += dt;
    if (dt > worst) worst = dt;
    if (s.indexOf("Error") === 0) fails++;
    else len += s.trim().split(/\s+/).length;
  }
  const ok = N - fails;
  console.log(
    "maxDepth %d  probeMax %s  ->  solved %d/%d  avg len %s  mean %dms  worst %dms",
    maxDepth, String(probeMax).padStart(9), ok, N,
    ok ? (len / ok).toFixed(2) : "-", Math.round(ms / N), worst
  );
}

for (const d of [21, 20, 19, 18, 17]) {
  for (const p of [30000, 100000, 400000]) row(d, p);
}
