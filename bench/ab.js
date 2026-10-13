// Did forking the solver cost search speed? Times the untouched csTimer
// solver against our fork on the same work.
"use strict";
const { createEngine } = require("../src/engine");

function timeIt(label, pristine, n) {
  const S = createEngine({ pristine }).scramble_444;
  const t0 = Date.now();
  S.getRandomScramble();
  const init = Date.now() - t0;

  const times = [];
  const lens = [];
  for (let i = 0; i < n; i++) {
    const a = Date.now();
    const s = S.getRandomScramble();
    times.push(Date.now() - a);
    lens.push(s.trim().split(/\s+/).length);
  }
  times.sort((x, y) => x - y);
  const sum = (a) => a.reduce((p, c) => p + c, 0);
  console.log(
    "%s: init %dms | median %dms  mean %dms  p90 %dms  max %dms | avg moves %s",
    label, init,
    times[n >> 1], Math.round(sum(times) / n), times[Math.floor(n * 0.9)], times[n - 1],
    (sum(lens) / n).toFixed(2)
  );
}

const N = 30;
timeIt("pristine csTimer", true, N);
timeIt("our fork        ", false, N);
