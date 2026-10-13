# Status

## Result

**2000 WCA random states, 5 second budget, both solvers on the same states.**

| solver | average | sd | best | worst |
|---|---|---|---|---|
| TPR three-phase, faithful parameters | 44.224 | 1.254 | 39 | 48 |
| this solver | 42.458 | 1.044 | 38 | 45 |

Solver mean 42.4575, standard error 0.0234, 95% CI [42.412, 42.503]. Paired
improvement 1.7665, standard error 0.0263, 95% CI [1.715, 1.818]. Shorter on
1703, equal on 297, longer on none. Breakdown: reduction 25.189, 3x3x3 17.281.

All 4000 saved solutions verified through cubing.js, zero failures. Raw data in
`results/`; `node bench/analyze.mjs 2000` re-derives every figure from the files
without running the solver.

At the default 30 second budget: 42.167 over 150 states, improvement 2.00,
95% CI [1.80, 2.20].

## Benchmark methodology

**Scramble source.** States are drawn from csTimer's `partialSolvedState` via
`scramble_444.randomState()`: uniform corner permutation, uniform corner twists
with one corner corrected so the sum is 0 mod 3, uniform wing permutation,
uniform centre arrangement. That product divided by 24, for the indeterminate
cube orientation, equals the published 4x4x4 state count
`7401196841564901869874093974498574336000000000`, verified in exact integer
arithmetic. Measured uniform over 200,000 samples: sticker-colour chi-square
3.76 to 4.26 on 5 degrees of freedom.

**WCA 4b3 compliance.** The regulation wants a uniform draw from states needing
at least two moves to solve. The generator rejects the solved state in every
orientation, and the harness in `web/worker.js` additionally excludes every
state one move from solved in any of the 24 orientations, because a 4x4x4 has
no fixed centres. That set is 672 states, matching an independent count made
with cubing.js. None of the 2000 benchmark scrambles fall in it.

**Baseline.** The same three-phase solver, reconfigured to csTimer's own search
widths (`phase2Sols` 100) and reached through `solveStateBaseline`. Its 3x3x3
stage goes through `vendor/shim.js`, which passes TPR's exact arguments:

```js
new min2phase.Search().solution(facelet, 21, 1000000, 500, 0)
```

`probeMin = 500` matters: with it set to 0 the baseline is artificially weak
and the improvement is overstated.

**Solver configuration.** Defaults in `DEFAULT_OPTS` in `src/tpr444.js`:

```
budgetMs 30000   rounds 1        maxLen3 17     extraLen 8
solsPerNode 24   screenDepth 21  deepFloor 19   keep 24
deepMs 2500      deepGuessMs 800 m2pProbe 100000  m2pProbeMin 500
```

plus `phase2Sols: 300` set by the worker. The headline run used `budgetMs 5000`
and defaults for everything else.

**Verification.** Two independent layers. The solver's own `verify()` replays
the solution and checks all six faces are a single colour, which for a 4x4x4 is
a complete solvedness test. Separately `bench/audit.mjs` verifies with
cubing.js, which shares no code with this project.

**Move metric.** OBTM. The generator set is 36 moves, six outer faces and six
2-layer wide turns, each plain, doubled or inverted. A wide turn counts as 1, a
180 degree turn counts as 1, and no slice move exists in the alphabet. This
matches TPR's own counting (`move2str` in `Moves.java`, token count in
`test.java`).

**Machine speed.** The solver works to a time budget, so a slower machine
searches less. Benchmarks are run in the browser on mains power; Node runs
about five times slower and its numbers are not comparable.

## What I tried that didn't work

Each of these was implemented, measured on fixed states, and removed.

- **Resumable refinement of the 3x3x3 phase** (min2phase's `next()`), as a pass
  over the top-ranked reductions. Best setting: +0.067 moves, 95% CI
  [−0.06, 0.20], which includes zero. The time it took away from screening cost
  as much as it gained.
- **Two-tier cascade**: cheap scoring of every reduction, then deep scoring of
  the best 24. Clearly worse; the cheap tier made the ranking too noisy.
- **Inverse-state multi-start**: solving the inverse state and inverting.
  Doesn't compose, because solutions often finish in a rotated orientation, so
  the rotation ends up in the middle of the combined solution.
- **Multi-start over prepended moves**: solving from several first moves and
  keeping the best. The spread between starts is large (sd 1.09 moves, worth
  about 0.6 moves with unlimited time), but splitting one budget across the
  starts cancels the gain: +0.08, CI [−0.11, 0.26].
- **Raising `probeMin` above 500.** 1000 and 2000 were both slightly worse; the
  extra depth per reduction doesn't pay for the fewer reductions screened.

**Where the moves are.** Reduction takes about 25.3 moves and the 3x3x3 stage
about 17.2. The 3x3x3 stage is already below the ~17.7 optimal average for
random states (the solver picks which reduced state to aim for), and a much
deeper re-solve of it recovers at most 0.40 moves. The remaining length is in
the reduction itself.

## Future improvements

1. **A different reduction method.** This is the main one. Getting to ~40.5
   moves means cutting reduction from ~25.3 to ~23.3, which more search over
   the current three-phase reduction won't do.
2. **Capture the search spread without paying for restarts.** Different
   starting framings differ by about a move on a typical state; a search that
   covers that diversity in one pass could gain most of it.
3. **Hard time cap.** A min2phase call can't be interrupted, so the budget is a
   target: about 1% of solves overrun (worst seen 7.19 s at a 5 s budget). A
   cost model seeded at startup would fix this.
4. **Report the final orientation.** Most solutions finish solved but rotated
   (63% at 5 s), which is fine on a 4x4x4 but the solver should append the
   rotation the way TPR does.
5. **Measure longer budgets.** 30 s against 60 s hasn't been measured at a
   proper sample size.
6. **Move the WCA two-move filter into the solver's own generator**, not just
   the benchmark harness.

## Licence

GPL-3.0, inherited from csTimer, TPR-4x4x4-Solver and min2phase (all cs0x7f).
Distributing the page means distributing the source.
