// Correctness gate. Runs both solvers over many states and checks that every
// solution actually solves its cube. Any failure is fatal.
//
//   node bench/verify.js [count] [budgetMs]
"use strict";

const { createEngine } = require("../src/engine");

const count = Number(process.argv[2] || 40);
const budgetMs = Number(process.argv[3] || 2000);

const S = createEngine().scramble_444;
S.init();

const MOVES = ["U", "R", "F", "D", "L", "B", "Uw", "Rw", "Fw", "Dw", "Lw", "Bw"];
const SUF = ["", "2", "'"];
const randScramble = (n) =>
  Array.from({ length: n }, () => MOVES[(Math.random() * 12) | 0] + SUF[(Math.random() * 3) | 0]).join(" ");

let baseFail = 0;
let optFail = 0;
let baseSum = 0;
let optSum = 0;
let done = 0;

for (let i = 0; i < count; i++) {
  // Alternate the two ways a state can arrive, since they stress different
  // code paths: a random cubie state, and a state built by replaying moves.
  const state = i % 2 === 0 ? S.randomState() : S.scrambleToState(randScramble(40));

  const b = S.solveStateBaseline(state);
  if (b.error || !S.verify(state, b.solution).ok) {
    console.error("#%d BASELINE FAILED: %s", i, b.error || "solution does not solve");
    baseFail++;
  } else {
    baseSum += b.moves;
  }

  const o = S.solve(state, { budgetMs });
  if (o.error || !S.verify(state, o.solution).ok) {
    console.error("#%d OPTIMISER FAILED: %s", i, o.error || "solution does not solve");
    optFail++;
  } else {
    optSum += o.moves;
    done++;
  }

  if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${count}\n`);
}

console.log("\nbaseline  : %d failures, avg %s moves",
  baseFail, baseFail === count ? "-" : (baseSum / (count - baseFail)).toFixed(2));
console.log("optimiser : %d failures, avg %s moves (budget %dms)",
  optFail, done ? (optSum / done).toFixed(2) : "-", budgetMs);

process.exit(baseFail + optFail === 0 ? 0 : 1);
