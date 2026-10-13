// Loads the vendored csTimer sources plus our fork into one shared script
// context. They are plain browser scripts that talk to each other through
// globals, so a vm context reproduces the browser's <script> semantics
// exactly and lets the same files serve both Node and the web build.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const BASE = [
  ["vendor", "shim.js"],
  ["vendor", "isaac.js"],
  ["vendor", "mathlib.js"],
  ["vendor", "min2phase.js"]
];

// `pristine` loads the untouched csTimer solver instead of our fork, so the
// two can be timed against each other in the same process.
function scriptsFor(pristine) {
  return BASE.concat([pristine ? ["vendor", "scramble_444.js"] : ["src", "tpr444.js"]]);
}

function createEngine({ debug = false, pristine = false } = {}) {
  const sandbox = {
    console,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    // mathlib seeds ISAAC from crypto.getRandomValues when it exists and
    // silently falls back to the millisecond clock when it does not. Without
    // this the Node harness ran on a ~40-bit timestamp seed while the browser
    // got 4096 bits, so the two were not sampling the same way.
    crypto: require("crypto").webcrypto
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const parts of scriptsFor(pristine)) {
    const file = path.join(ROOT, ...parts);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  if (debug) {
    sandbox.DEBUG = true;
  }
  return sandbox;
}

module.exports = { createEngine };
