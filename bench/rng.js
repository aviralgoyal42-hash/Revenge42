// Checks the state generator against WCA regulation 4b3: "An official scramble
// sequence must produce a random state from all states that require at least 2
// moves to solve (equal probability for each state)."
//
//   node bench/rng.js [stateSamples] [scrambleSamples]
"use strict";

const env = require("../src/engine");
const engine = env.createEngine();
const S = engine.scramble_444;
S.init();

const N = Number(process.argv[2] || 20000);
const M = Number(process.argv[3] || 200);

const FACES = "URFDLB";

// --- invariants that every legal 4x4x4 state must satisfy -----------------

function cornerTwistSum(state) {
  // Corner facelet triples, from the solver's own tables.
  const CORNER = [[15, 16, 35], [12, 32, 67], [0, 64, 83], [3, 80, 19],
                  [51, 47, 28], [48, 79, 44], [60, 95, 76], [63, 31, 92]];
  let sum = 0;
  for (const tri of CORNER) {
    // Orientation is which of the three stickers carries a U or D colour.
    let ori = 0;
    for (; ori < 3; ori++) {
      const c = FACES.indexOf(state[tri[ori]]);
      if (c === 0 || c === 3) break;
    }
    if (ori === 3) return NaN;
    sum += ori;
  }
  return sum % 3;
}

function colourCounts(state) {
  const c = new Array(6).fill(0);
  for (let i = 0; i < 96; i++) c[FACES.indexOf(state[i])]++;
  return c;
}

// --- sample states --------------------------------------------------------

console.log("Sampling %d states from randomState()…", N);

const stickerHist = { 0: new Array(6).fill(0), 5: new Array(6).fill(0), 40: new Array(6).fill(0) };
const twistHist = new Array(3).fill(0);
let badCounts = 0;
let badTwist = 0;
let solvedStates = 0;
let badParse = 0;

for (let i = 0; i < N; i++) {
  const st = S.randomState();

  const counts = colourCounts(st);
  if (counts.some((x) => x !== 16)) badCounts++;

  const t = cornerTwistSum(st);
  if (Number.isNaN(t)) badTwist++;
  else twistHist[t]++;

  for (const k of Object.keys(stickerHist)) {
    stickerHist[k][FACES.indexOf(st[Number(k)])]++;
  }

  // A state that is already solved would violate the "at least 2 moves" rule.
  let uniform = true;
  for (let j = 0; j < 96 && uniform; j++) if (st[j] !== st[(j >> 4) << 4]) uniform = false;
  if (uniform) solvedStates++;

  // verify() runs the solver's own state parser, which rejects illegal
  // permutations, twists and colour counts. Checking the first 2000 keeps
  // this quick while still covering a wide sample.
  if (i < 2000 && S.verify(st, "").reason === "input state invalid") badParse++;
}

const chi2 = (obs) => {
  const n = obs.reduce((p, c) => p + c, 0);
  const e = n / obs.length;
  return obs.reduce((p, c) => p + ((c - e) * (c - e)) / e, 0);
};

console.log("\nSticker colour distribution (expect uniform, chi-square on 5 df, 11.07 = p 0.05)");
for (const k of Object.keys(stickerHist)) {
  console.log("  index %s: %s   chi2 %s", String(k).padStart(2),
    stickerHist[k].join(" "), chi2(stickerHist[k]).toFixed(2));
}

console.log("\nColour counts wrong on %d/%d states", badCounts, N);
console.log("Corner twist sum mod 3: %j  (legal states are all 0)", twistHist);
console.log("Unreadable corner orientation on %d states", badTwist);
console.log("Already-solved states generated: %d", solvedStates);
console.log("States rejected as illegal by the solver's parser: %d/2000", badParse);

// --- scramble sequences ---------------------------------------------------

console.log("\nSampling %d scrambles from getRandomScramble()…", M);

const scrSticker = { 0: new Array(6).fill(0), 5: new Array(6).fill(0) };
let unsolvable = 0;
let lens = [];

for (let i = 0; i < M; i++) {
  const scr = S.getRandomScramble().trim();
  lens.push(scr.split(/\s+/).length);
  const st = S.scrambleToState(scr);
  for (const k of Object.keys(scrSticker)) {
    scrSticker[k][FACES.indexOf(st[Number(k)])]++;
  }
  if (colourCounts(st).some((x) => x !== 16)) unsolvable++;
}

console.log("\nScramble-derived sticker distribution (tests whether the emitted");
console.log("sequence lands in a canonical orientation rather than a random one)");
for (const k of Object.keys(scrSticker)) {
  console.log("  index %s: %s   chi2 %s", String(k).padStart(2),
    scrSticker[k].join(" "), chi2(scrSticker[k]).toFixed(2));
}
const avg = (a) => a.reduce((p, c) => p + c, 0) / a.length;
console.log("\nScramble length: avg %s, min %d, max %d",
  avg(lens).toFixed(2), Math.min(...lens), Math.max(...lens));
console.log("Malformed states from scrambles: %d", unsolvable);
