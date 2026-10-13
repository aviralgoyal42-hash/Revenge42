// Solver worker. Everything expensive happens here so the page stays
// responsive: table construction takes a couple of seconds and a solve can
// occupy a core for the whole time budget.
"use strict";

importScripts(
  "../vendor/shim.js",
  "../vendor/isaac.js",
  "../vendor/mathlib.js",
  "../vendor/min2phase.js",
  "../src/tpr444.js"
);

let ready = false;

function ensureReady() {
  if (ready) return 0;
  const t0 = Date.now();
  scramble_444.init();
  // A larger pool of reduction prefixes measurably helps and costs only a
  // few hundred milliseconds more in phase 2.
  scramble_444.setConfig({ phase2Sols: 300 });
  min2phase.initFull();
  ready = true;
  return Date.now() - t0;
}

// The states WCA regulation 4b3 excludes: solved in any of the 24 orientations,
// plus every state one move from one of those. A 4x4x4 has no fixed centres, so
// a cube one move from a rotated solved state also needs only one move.
//
// An earlier version held only the starting orientation: solved plus its 36
// one-move neighbours, 37 states out of the 672 the rule covers.
//
// Recolouring the canonical 37 by each rotation's colour permutation gives the
// rotated set exactly, because recolouring commutes with moves. Coincidences
// between orientations bring the total to 672, which matches an independent
// count made with cubing.js.
let trivialCache = null;
function trivialStates() {
  if (trivialCache) return trivialCache;
  const FACES = "URFDLB";
  const canonical = [scramble_444.scrambleToState("")];
  for (const face of ["U", "R", "F", "D", "L", "B", "Uw", "Rw", "Fw", "Dw", "Lw", "Bw"]) {
    for (const amount of ["", "2", "'"]) {
      canonical.push(scramble_444.scrambleToState(face + amount));
    }
  }
  const set = new Set();
  for (const perm of scramble_444.facePerms()) {
    for (const st of canonical) {
      let s = "";
      for (let i = 0; i < st.length; i++) s += FACES.charAt(perm[FACES.indexOf(st.charAt(i))]);
      set.add(s);
    }
  }
  trivialCache = set;
  return set;
}

function stateFrom(msg) {
  if (msg.state) return msg.state;
  if (msg.scramble) return scramble_444.scrambleToState(msg.scramble);
  return scramble_444.randomState();
}

self.onmessage = function (e) {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      postMessage({ type: "ready", ms: ensureReady() });
      return;
    }

    if (msg.type === "solve") {
      ensureReady();
      const state = stateFrom(msg);
      const t0 = Date.now();
      const res = scramble_444.solve(state, Object.assign(
        { budgetMs: msg.budgetMs || 30000 }, msg.options || {}));
      if (res.error) {
        postMessage({ type: "error", error: res.error });
        return;
      }
      const check = scramble_444.verify(state, res.solution);
      postMessage({
        type: "result",
        state,
        solution: res.solution,
        moves: res.moves,
        reductionMoves: res.reductionMoves,
        phases: res.phases,
        stats: res.stats,
        ms: Date.now() - t0,
        verified: check.ok
      });
      return;
    }

    if (msg.type === "bench") {
      ensureReady();
      const n = msg.count || 20;
      const budgetMs = msg.budgetMs || 30000;
      const results = [];
      for (let i = 0; i < n; i++) {
        const state = msg.states ? msg.states[i] : scramble_444.randomState();
        // Measure the baseline at csTimer's own search widths, so the
        // comparison is against the stock solver rather than a tuned one.
        scramble_444.setConfig({ phase2Sols: 100 });
        const b = scramble_444.solveStateBaseline(state);
        scramble_444.setConfig({ phase2Sols: 300 });
        const o = scramble_444.solve(state, Object.assign({ budgetMs }, msg.options || {}));
        const row = {
          i,
          baseline: b.error ? null : b.moves,
          moves: o.error ? null : o.moves,
          direct: o.directMoves,
          round: o.round,
          ms: o.ms,
          reductions: o.stats && o.stats.reductions,
          timedOut: o.stats && o.stats.timedOut,
          red: o.reductionMoves,
          p333: o.phases && o.phases.p333,
          baseSolution: b.error ? null : b.solution,
          solution: o.error ? null : o.solution,
          verified: !o.error && scramble_444.verify(state, o.solution).ok,
          baseVerified: !b.error && scramble_444.verify(state, b.solution).ok
        };
        results.push(row);
        postMessage({ type: "bench-progress", done: i + 1, total: n, row });
      }
      postMessage({ type: "bench-done", results });
      return;
    }

    if (msg.type === "states") {
      ensureReady();
      const out = [];
      for (let i = 0; i < (msg.count || 20); i++) out.push(scramble_444.randomState());
      postMessage({ type: "states", states: out });
      return;
    }

    // WCA regulation 4b3 wants a uniform draw from the states needing at
    // least two moves to solve. The generator already rejects the solved
    // state in every orientation; this also rejects every state one move from
    // any solved orientation, 672 in all, built by trivialStates(). The filter
    // lives here rather than in the solver so tpr444.js is untouched.
    if (msg.type === "wcaStates") {
      ensureReady();
      const skip = trivialStates();
      const out = [];
      let rejected = 0;
      while (out.length < (msg.count || 20)) {
        const st = scramble_444.randomState();
        if (skip.has(st)) { rejected++; continue; }
        out.push(st);
      }
      postMessage({ type: "states", states: out, rejected, excluded: skip.size });
      return;
    }

    // WCA random states paired with an exact generating scramble, so a run can
    // be reproduced or checked from the scramble file alone. Same two-move
    // exclusion as wcaStates.
    if (msg.type === "wcaScrambles") {
      ensureReady();
      const skip = trivialStates();
      const scrambles = [];
      const states = [];
      let rejected = 0;
      while (states.length < (msg.count || 20)) {
        const scr = scramble_444.getRandomScramble().trim();
        const st = scramble_444.scrambleToState(scr);
        if (skip.has(st)) { rejected++; continue; }
        scrambles.push(scr);
        states.push(st);
        if (states.length % 100 === 0) {
          postMessage({ type: "scrambles-progress", done: states.length, total: msg.count });
        }
      }
      postMessage({ type: "scrambles", scrambles, states, rejected, excluded: skip.size });
      return;
    }

    // Fixed-work speed check. A benchmark with a time budget does more search
    // on a faster machine and so finds shorter solutions, which makes move
    // counts from different machines, or different days, not directly
    // comparable. This times identical work so that speed can be recorded next
    // to every result. The stock solver has no time budget and is
    // deterministic, so these eight states cost the same work everywhere, and
    // the returned move checksum proves the work was identical.
    if (msg.type === "calibrate") {
      ensureReady();
      const CALIBRATION_SCRAMBLES = [
        "U2 D' F' U2 L2 F' B R2 D2 F R2 L B L2 F B2 R2 U2 D' L Rw2 Fw2 L' B' Fw2 L' D2 Rw2 Uw2 F L B2 U' Uw2 L Uw' R U2 Rw U2 F' Fw' Rw Fw Rw' D'",
        "B' U2 F U2 B R2 D2 L2 B2 L' U D' F B D F' D2 L D' Fw2 L Fw2 D' Uw2 F2 D R D2 R' Rw2 Fw U2 Rw2 B' L' Uw R B Rw2 Uw' Rw' Fw Rw",
        "L' F' L2 U2 R2 U B2 U F2 D' B2 U2 F D2 B U2 R' L' U' L Fw2 L B2 Uw2 L' B2 U' D Fw2 L Rw2 D F2 Fw' Rw2 B Rw2 D2 R' Uw' L Fw Uw' L F",
        "D2 B2 L D2 R' U B L D2 R2 B2 R U2 R2 U2 R U2 D B' U2 Fw2 D2 L' D' Uw2 F2 L' D' F2 L' Fw2 L' Fw' Uw2 B2 Rw2 Fw' U Fw2 R Uw' F2 B2 Rw' Fw L",
        "B2 R' U2 L F2 R U2 R2 U2 B2 D2 B' D R2 L D' B2 U R2 L' Fw2 U' Uw2 F2 D' R' Fw2 L2 Fw2 U' L Uw2 Fw' Uw2 F' R' Fw Uw F R2 L2 F2 Fw Uw2",
        "B D2 R2 F2 L2 F2 U' B2 D F2 L' D' F L B2 R2 U L B Uw2 L2 B Rw2 D' F Uw2 L2 B2 Fw2 D2 F Rw' F B2 U' R' U' D Uw F Rw' B' Uw B' Rw",
        "F2 L F2 U2 L2 B2 D' L2 F2 U D' R F R2 F' L' D' L F Fw2 U' L2 D' B Fw2 U' B2 Rw2 D2 B U' D Rw U' B' D Uw B2 Rw' B' R L' U",
        "L2 B2 D2 R2 L' U D2 F' B2 R2 D' L2 F2 D' L2 U D L2 B2 L Uw2 R Fw2 U D R' D L Uw2 Fw2 R2 Fw' D Rw2 B2 Fw2 R2 Uw' F' B' L F' Fw' Uw2"
      ];
      scramble_444.setConfig({ phase2Sols: 100 });
      const t0 = Date.now();
      let checksum = 0;
      for (const scr of CALIBRATION_SCRAMBLES) {
        const r = scramble_444.solveStateBaseline(scramble_444.scrambleToState(scr));
        checksum += r.error ? 0 : r.moves;
      }
      const ms = Date.now() - t0;
      scramble_444.setConfig({ phase2Sols: 300 });
      postMessage({
        type: "calibration",
        ms,
        states: CALIBRATION_SCRAMBLES.length,
        checksumMoves: checksum,
        cores: self.navigator && navigator.hardwareConcurrency,
        userAgent: self.navigator && navigator.userAgent
      });
      return;
    }

    if (msg.type === "scramble") {
      ensureReady();
      postMessage({ type: "scramble", scramble: scramble_444.getRandomScramble().trim() });
      return;
    }

    postMessage({ type: "error", error: "unknown message type: " + msg.type });
  } catch (err) {
    postMessage({ type: "error", error: String((err && err.stack) || err) });
  }
};
