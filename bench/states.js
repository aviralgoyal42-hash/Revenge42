// Generates a fixed set of random 4x4x4 states so every configuration is
// measured on identical inputs. Writes bench/states.json.
"use strict";

const fs = require("fs");
const path = require("path");
const { createEngine } = require("../src/engine");

const env = createEngine();
const S = env.scramble_444;
const N = Number(process.argv[2] || 50);
const SEED = process.argv[3] || "revenge-solver";

env.mathlib.setSeed(SEED);
S.init();

const states = [];
for (let i = 0; i < N; i++) {
  states.push(S.randomState());
}

const out = path.join(__dirname, "states.json");
fs.writeFileSync(out, JSON.stringify({ seed: SEED, count: N, states }, null, 0));
console.log("wrote %d states (seed %j) to %s", N, SEED, out);
