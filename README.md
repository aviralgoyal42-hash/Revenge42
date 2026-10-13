# Revenge42

A 4x4x4 (Rubik's Revenge) solver that runs entirely in the browser. No server
calls, no GPU, no shipped lookup tables. It searches over many possible
reductions instead of taking the first one, and picks the one whose total
solution is shortest.

## Running it

From the project folder:

```bash
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8378
```

`-File` resolves against your shell's current directory, not the script's, so a
bare `serve.ps1` only works if you are already in the project folder.

It prints the URL to open. If the port is already taken it names the process
holding it and moves to the next free one, so check the printed URL rather than
assuming 8378. Pass `-Strict` to make a busy port an error instead.

Any static file server works; `serve.ps1` exists only because this machine had
no other one. The page needs a server rather than `file://` because the solver
runs in a Web Worker.

To stop a server you left running:

```bash
Get-NetTCPConnection -State Listen -LocalPort 8378 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Node is needed only for the benchmarks, not for the solver itself.

```bash
node bench/verify.js 40 2000      # correctness gate, must report zero failures
node bench/run.js 30000 20        # benchmark against the stock solver
node bench/sweep2.js 8000 12 '[["label",{}]]'   # compare configurations
```

## Results

Solved in Chrome. Every solution was replayed onto its state and checked; none
failed and none came out longer than the stock solver's. Move counts are OBTM,
wide turns counting as one. Baselines are paired, meaning the stock solver ran
on the same states at csTimer's own search widths.

**2000 WCA random states, 5 second budget, both solvers on the same states.**
States drawn uniformly from the legal state space, excluding the states WCA
regulation 4b3 rules out: solved in any of the 24 orientations, or one move from
one of those, 672 in total. When this run was made the filter covered only the
starting orientation, 37 of the 672. None of the 2000 scrambles fall anywhere in
the full set, so the results are unaffected, and the filter now covers all 672.

| solver | average | sd | best | worst |
|---|---|---|---|---|
| TPR three-phase, faithful parameters | 44.224 | 1.254 | 39 | 48 |
| this solver | **42.458** | 1.044 | 38 | 45 |

Paired improvement 1.7665 moves, 95% CI [1.715, 1.818]. Shorter on 1703 states,
equal on 297, longer on none. Mean solve 4.29 s.

Every one of the 4000 saved solutions was replayed through cubing.js, which
shares no code with this project: zero failures. The scrambles, both solvers'
solutions and the per-state data are in `results/`, so the run can be checked
without re-running anything:

```bash
npm install
node bench/analyze.mjs 2000
```

At the default 30 second budget the average is **42.167** over 150 states, a
2.00 move improvement, 95% CI [1.80, 2.20]. The larger run uses 5 s because
2000 states at 30 s would take seventeen hours.

These numbers depend on how fast the machine runs. The solver works to a time
budget, so a faster machine searches more and finds shorter solutions, while the
stock solver, having no budget, is unaffected. By a fixed timing test, the laptop
these were measured on ran at roughly half speed on battery at any charge level,
and also for a few minutes after plugging in from nearly empty. Re-solving 200 of
the saved scrambles at full speed reproduced the 2000-state run exactly on 194 of
them, so the published figures were measured at full speed. The effect on move
counts is much smaller than the effect on search: on battery the same 200
scrambles averaged 42.47 moves against 42.43 at full speed. Benchmark on mains
power, and record the worker's `calibrate` timing with results. Details are in
[bench/RESULTS.md](bench/RESULTS.md).

Both numbers are OBTM, confirmed against TPR's Java source: a 36-token
alphabet, double-layer turns and 180 degree turns each counting as one, no
slice moves. This reproduces the published 44.39 figure to within the error
that figure's own harness introduces.

Earlier versions of this file claimed a 1.88 move improvement. That was
measured against a baseline weakened by a bug in my own shim, which called
min2phase with `probeMin = 0` where TPR uses 500. The details are in
[bench/RESULTS.md](bench/RESULTS.md).

**150 states, 5 s against 30 s, same states both times, after the probeMin
fix.**

| budget | average | actual time |
|---|---|---|
| 5 s | 42.527 | 4.31 s |
| 30 s | 42.167 | 27.62 s |

The paired gain from the longer budget is 0.36 moves, standard error 0.052, 95%
CI [0.26, 0.46]. Shorter on 41 of 150 states, never longer. That is real, not
noise, so **more time does help** and the page defaults to 30 seconds. The 5 s
arm's improvement over stock, 1.64 moves, is below the 2000-state run's 1.77.
Power state was not recorded for this run, so compare the two budgets within
it, not its averages against the 2000-state run.

This replaces an earlier 50-state comparison, 43.66 against 43.02, which was
measured before the probeMin fix. An earlier version still claimed more time
did not help, from a ten-state comparison too small to detect the effect. 30
against 60 seconds has not been measured at adequate sample size, so nothing is
claimed about it.

The budget is respected rather than approximated. A min2phase call cannot be
interrupted once started, so the solver records the worst time it has seen at
each search depth and refuses to start a call that will not fit in the time
left. Before that guard existed, a 5 second request was measured finishing in
10.3 seconds. Over 210 solves at a 5 second budget, none exceeded it.

Full tables, distributions and the correction are in
[bench/RESULTS.md](bench/RESULTS.md).

### Why it stops there

The solution splits into roughly 26 moves of reduction and 17 of 3x3x3.

The 3x3x3 side is effectively finished. Optimal solutions for random 3x3x3
states average about 17.7 moves, and this lands near 17 because it gets to
choose which reduced state to aim for rather than being handed one.

All the remaining slack is in the reduction, and enumerating alternatives does
not shorten it. Screening 1000 reductions instead of 130 was worth about 0.1
moves. The reduction length is set by the three-phase decomposition itself, so
beating it means a different reduction method, not more search over this one.

## How it works

The cube is reduced to a 3x3x3 state and then solved with Kociemba's two-phase
algorithm. Reduction is not Yau. It is Shuang Chen's three-phase reduction,
which searches coordinates with symmetry-reduced pruning tables and beats
human-style Yau reduction by a wide margin.

| phase | what it solves | typical moves |
|---|---|---|
| 1 | centers on one axis | 6.8 |
| 2 | the remaining centers | 5.9 |
| 3 | pairs all 12 dedges, reaching a 3x3x3 | 12.3 |
| 4 | the 3x3x3, via min2phase | 17 to 19 |

Parity needs no special handling. Edge permutation parity is folded into the
phase 2 and phase 3 coordinates, so the search cannot reach a parity-blocked
state and there are no OLL or PLL parity algorithms anywhere in the code.

### Where the extra time goes

The stock solver returns the first complete reduction it finds, which minimises
reduction length while ignoring what the 3x3x3 phase will then cost. Total
length is what matters. This solver:

1. Runs phases 1 and 2 unchanged, producing a pool of reduction prefixes.
2. Enumerates many complete reductions rather than stopping at the first.
3. Screens each one with a cheap 3x3x3 search and keeps the best by **total**.
4. Spends the remaining budget asking for shorter 3x3x3 solutions on the
   survivors.

Step 3 passes min2phase a `probeMin`, so it returns the shortest 3x3x3 solution
it saw rather than the first it found. That matters more than it sounds: since
step 3 then picks the candidate with the smallest total, returning first hits
meant partly selecting whichever reduction got lucky rather than the one that
was genuinely shortest. Fixing it was worth 1.13 moves.

Solving the inverse state as a second pass is implemented (`rounds: 2`) but off
by default, and it does not work. An earlier version of this file said it won
zero times out of 30, as if it were merely ineffective. It was broken. The
solver often finishes the cube solved but rotated, and in the composed solution
that rotation sits between the two halves, where no face relabelling can remove
it. So the inverted answer failed verification and the code silently fell back
to the direct solution every time. Whether the inverse framing would help if it
worked is unknown. Do not enable `rounds: 2`.

min2phase's cost is governed almost entirely by its depth limit, and its
`probeMax` parameter does not bound it at all. Measured here:

| depth limit | solution length | time per call |
|---|---|---|
| 21 | 20.8 | 10 ms |
| 20 | 19.8 | 200 ms |
| 19 | 19.0 | 1000 ms |
| 18 | often none found | tens of seconds |

That curve is why screening and deepening are separate passes. Asking every
candidate for its best possible 3x3x3 solution is unaffordable.

## Move metric

36 generators: six outer faces and six 2-layer wide turns, each plain, doubled
or inverted. Wide turns count as one move. This is OBTM, and it is the metric
every number here uses, including the baseline, so the comparison is direct.

## Layout

```
vendor/     csTimer sources, unmodified (GPL-3.0, cs0x7f)
src/tpr444.js   fork of csTimer's scramble_444.js; changes marked [revenge42]
src/engine.js   loads the browser scripts into a Node vm context for benchmarking
web/        the browser app: index.html, app.js, worker.js, cube.js (sticker model), cube3d.js (3D view)
bench/      correctness gate, benchmarks, configuration sweeps
```

`src/tpr444.js` is a modified copy of csTimer's `scramble_444.js`. Every change
is marked with a `[revenge42]` comment. The substantive ones:

- phase 3 records its move on the way down and reports every solution it
  reaches through a visitor, instead of returning only the first
- `solveState` enumerates and scores reductions; `solve` can add an
  inverse-state second pass, which is off by default and broken (see above)
- two bug fixes in `getMoveString`'s move merging, described below
- search widths are runtime-configurable

### Upstream bugs fixed

`getMoveString` merges consecutive same-axis moves. Its power counter can
exceed 3 once moves cancel across a phase boundary, and the original indexed
the move-name table with the raw total rather than the total modulo 4, reading
past the layer's own three entries and emitting a move on a different face. It
also left a power of exactly 4 in place instead of clearing it, leaking a stale
count into the next run.

csTimer rarely trips either case, because it appends a single 3x3x3 solution
and only ever uses the result as a scramble, where a wrong answer is still a
valid random scramble. This solver feeds many 3x3x3 solutions through the same
path and has to return sequences that actually solve the cube, so both are
fixed in the fork.

Every benchmark verifies every solution by replaying it onto the state and
checking that all six faces end up a single colour.

### One more wrinkle

The search works in a symmetry-reduced frame, so its answer solves a rotated
copy of the input. Relabelling the solution's faces by the right whole-cube
rotation fixes it; all 24 are tried and the one that verifies is kept. csTimer
does not need this, which is why it has a separate `appendRotationFix` helper
for the cases where it does.

## Licence

GPL-3.0. This is a derivative of csTimer (cs0x7f), which is GPL-3.0, and of
Shuang Chen's TPR-4x4x4-Solver and min2phase. Distributing the page means
distributing the source.
