# Measured results

All runs in Chrome, in the solver's Web Worker, on the machine this project was
built on. Every solution was replayed onto its state and checked for six
uniform faces. Move counts are OBTM: six outer faces and six 2-layer wide
turns, each plain, doubled or inverted, wide turns counting as one.

Baselines are paired. The stock csTimer / TPR solver ran on the same states,
reconfigured back to its own search widths (`phase2Sols` 100) so the comparison
is against stock rather than against a tuned version of itself.

## Headline: 2000 WCA random states

The largest run, and the one to quote. 5 second budget, both solvers on the
same states. Raw data is in `results/`, and every number below was recomputed
from those files by `bench/analyze.mjs` rather than carried over from the run.

| solver | average | sd | best | worst |
|---|---|---|---|---|
| TPR three-phase, faithful parameters | 44.224 | 1.254 | 39 | 48 |
| this solver | **42.458** | 1.044 | 38 | 45 |

Solver mean 42.4575, standard error 0.0234, 95% CI [42.412, 42.503].

Paired improvement **1.7665 moves**, standard error 0.0263, 95% CI
[1.715, 1.818]. Shorter on 1703 states, equal on 297, **longer on none**.

| shorter by | states |
|---|---|
| 0 | 297 |
| 1 | 555 |
| 2 | 646 |
| 3 | 357 |
| 4 | 118 |
| 5 | 19 |
| 6 | 8 |

Move distribution:

| moves | TPR | this solver |
|---|---|---|
| 38 | 0 | 2 |
| 39 | 3 | 9 |
| 40 | 8 | 64 |
| 41 | 29 | 257 |
| 42 | 130 | 640 |
| 43 | 343 | 733 |
| 44 | 634 | 283 |
| 45 | 554 | 12 |
| 46 | 267 | 0 |
| 47 | 31 | 0 |
| 48 | 1 | 0 |

Against the published 44.39, 12 of 2000 solves came out above it, against 853
of 2000 for stock. That count is not a failure rate; 44.39 is a mean, not a
per-solve threshold.

Breakdown: reduction 25.189 moves, 3x3x3 17.281, 105 reductions screened per
solve. Timing: mean 4291 ms, worst 6907 ms, 5 of 2000 over the 5 second budget.

### Independently verified

All 4000 saved solutions, the solver's and the baseline's, were replayed
through **cubing.js**, which shares no code with this project, and checked
against the 24-member solved-orientation class.

| check | result |
|---|---|
| solver solutions that failed | 0 of 2000 |
| baseline solutions that failed | 0 of 2000 |
| tokens outside the 36-move set | 0 |
| saved CSV disagreeing with the saved solution strings | 0 |

Move counts in the summary were recounted from the solution strings rather than
trusted from the run, and agree with the CSV on all 2000 rows.

### Checking it yourself

```
results/scrambles-2000.txt            2000 scrambles, one per line
results/solutions-2000.txt            this solver's solution for each
results/baseline-solutions-2000.txt   stock's solution for each
results/results-2000.csv              per-state moves, timing, flags
results/summary-2000.json             everything above, machine-readable
```

```bash
npm install
node bench/analyze.mjs 2000
```

That re-derives every statistic and re-verifies all 4000 solutions from the
files alone. It never runs the solver, so it checks the claims rather than
reproducing them. Re-running the solver over `scrambles-2000.txt` reproduces
them.

## Budget: the shipped default was never benchmarked

The runs here mostly use a 5 second budget, because that is what lets a
2000-state benchmark finish in three hours. `budgetMs` defaults to 30000 and
the page offers 30 s, so the shipped configuration is not the one these tables
measure.

150 WCA random states at both budgets, paired, all verified, neither arm ever
longer than stock:

| budget | average | vs stock | 95% CI | actual time |
|---|---|---|---|---|
| 5 s | 42.527 | 1.64 | [1.45, 1.83] | 4.31 s |
| 30 s | 42.167 | 2.00 | [1.80, 2.20] | 27.62 s |

Paired gain from the longer budget: **0.36 moves**, standard error 0.052, 95%
CI [0.26, 0.46]. Shorter on 41 of 150 states, never longer. Note the sample
sizes differ and are stated as such: the headline above is n = 2000 at 5 s,
this is n = 150 at 30 s. A 2000-state run at 30 s would take seventeen hours.

## probeMin re-checked on a faster machine

`probeMin = 500` was chosen when screening managed about 62 reductions per
5 second solve. The 2000-state run screened 108, so this machine is faster than
when the value was tuned, and a faster machine can afford deeper screens. That
made it worth checking whether the optimum had moved up.

300 of the saved 2000 scrambles, all three values on the same states, 5 second
budget, 68 minutes, every solution verified. Stock averaged 44.153.

| probeMin | average | sd | reductions screened | vs 500 | 95% CI |
|---|---|---|---|---|---|
| 500 | 42.367 | 1.053 | 108 | — | — |
| 1000 | 42.427 | 1.102 | 48 | −0.06 | [−0.13, 0.01] |
| 2000 | 42.457 | 1.174 | 25 | −0.09 | [−0.18, 0.00] |

It had not moved. Doubling `probeMin` more than halves the reductions screened,
and the extra depth per candidate does not make up for the lost breadth. At
2000 the solver is longer than at 500 on 59 states and shorter on 37. 500 stays;
no code changed.

## Move counts depend on machine speed

The solver works to a time budget, so how much it searches depends on how fast
the machine is running at that moment, and more search finds shorter
solutions. This is not learning. Every solve starts from the same fixed lookup
tables and nothing carries over from one solve to the next.

Same code, same 5 second budget, same machine, measured hours apart:

| run | reductions screened per solve | average moves | improvement over stock |
|---|---|---|---|
| 2000 states, earlier | 105 | 42.458 | 1.767 |
| 200 states, later, on battery | 68 | 42.65 | 1.645 |

The difference in search volume is large and certain. The difference in moves
is in the direction expected, but on its own this comparison does not prove it:
the gap in improvement over stock is 0.12 moves at about 1.4 standard errors.
The firmer evidence that more search means shorter solutions is the budget
measurement further up, where six times the search time bought 0.36 moves at
seven standard errors.

### What was ruled out

| possible cause | check | result |
|---|---|---|
| drift within the 2000-state run | 250-state blocks, first half against second | screening wobbled 96 to 113 with no trend; moves 42.466 then 42.449 |
| random-cubie states against scramble-derived states | 100 of each, interleaved in one session | screened 68.8 and 67.3; improvement 1.64 and 1.65 |
| the stock baseline changing | it has no time budget | identical work on a given state everywhere |

### Cause: a nearly empty battery

Every slow measurement was taken with the battery nearly empty, and full speed
returned within minutes of charging. Three measurements agree.

**Fixed work, timed.** `calibrate` times the stock solver on eight fixed
scrambles. It does identical work every time, proven by a move checksum of 356.

| condition | charge | ms |
|---|---|---|
| on battery | 12% | 2629, 2720 |
| on charger, just plugged in | about 12% | 2860 |
| on charger, 14 minutes later | about 35% | 1553 |
| on charger, fresh worker | 37% | 1516, 1577, 1484 |

**Search volume ramped up after plugging in.** Re-solving the first 200 saved
scrambles, starting the moment the charger went in:

| solves | reductions screened |
|---|---|
| first 10 | 64 |
| next 10 | 73 |
| 20 to 39 | 99 |
| 40 onward | 107 to 124 |

The first ten matched the on-battery run's 68. Within about 40 solves, roughly
three minutes, it was back to full speed.

**The saved run reproduces at full speed.** On those same 200 states, 194 gave
exactly the same move count as the 2000-state run. Paired difference −0.025
moves, 95% CI [−0.05, 0.00]; screening 110.6 against 112.9. So the 2000-state
run was measured at full speed and its figures hold. Raw data for this re-run is
in `results/ac-rerun-200.csv`, with its calibrations in
`results/ac-rerun-200-meta.json`.

Both conditions slow this laptop. The slowdown lasted a few minutes after plugging
in from 12 percent, so very low charge does it even on the charger. A later
session on battery at 95 percent calibrated at 3418 ms and 2765 ms, about twice
the roughly 1500 ms seen on mains, so being on battery does it too, at any charge
level. An earlier version of this paragraph said the slowdown tracked low charge
rather than battery; that was wrong. The power plan does not cap maximum processor
state on battery, which is 100 percent on both, so the throttling comes from
something the plan settings shown here do not expose.

The two calibrations in that battery session differ by about 20 percent, so one
calibration is a rough indicator of speed, not a precise measurement.

The effect on move counts is much smaller than the effect on search volume. On
the first 200 saved scrambles, that battery session at 5 seconds screened 74
reductions per solve against 113 at full speed, yet averaged 42.47 moves against
42.43.

An earlier version of this section guessed that the first calibration of a run
was slow because the browser had not yet optimised the code. That was tested and
is wrong: in a fresh worker the very first calibration took 1516 ms.

### What this means

- **The saved results stand.** `bench/analyze.mjs` checks the saved solutions
  directly and never re-runs the solver, and a full-speed re-run reproduces them.
- **Benchmark on mains power with a charged battery.** On this laptop a nearly
  empty battery cut search per solve by about 40 percent.
- **Re-running on other hardware gives different numbers.** At a fixed budget a
  slower or throttled machine produces somewhat longer solutions and a faster one
  somewhat shorter. Move counts are only comparable when speed is recorded
  alongside them.
- **A faster machine does not approach the optimum.** Six times the search time
  bought 0.36 moves, and the reduction step, 25.2 moves here, is set by the
  three-phase method rather than by search.
- **`probeMin = 500` holds across this range.** It was chosen at about 62
  reductions screened and re-checked at about 108, and was best at both.

### Recording speed from now on

Run `calibrate` at the start and end of every benchmark, and record the power
state and charge level with the results. On this laptop a calibration well above
about 1500 ms means the machine was throttled. That reliably reduces search, but
at a 5 second budget it barely moves the average: 42.47 moves on battery against
42.43 at full speed on the same 200 scrambles. Two calibrations in one session
can differ by about 20 percent, so treat a single one as a rough indicator.

## Earlier and smaller runs

These are kept for the record. All are superseded by the 2000-state run above,
and the ones marked as measured against a weakened baseline overstate the
improvement for the reason given further down.

## Headline comparison

500 WCA random states, both solvers on the same states, 5 second budget. Every
solution verified. This supersedes every earlier run in this file.

| solver | average | sd | best | worst |
|---|---|---|---|---|
| TPR three-phase, faithful parameters | 44.286 | 1.310 | 39 | 47 |
| this solver, 5 s | 42.522 | 1.161 | 38 | 46 |

Paired improvement **1.764 moves**, standard error 0.053, 95% CI [1.66, 1.87].

| outcome | states |
|---|---|
| this solver shorter | 427 |
| equal | 73 |
| this solver longer | 0 |

Seven of the 500 solves exceeded 44.39. Mean solve 4.30 s, worst 5.49 s, three
of 500 over the budget. Wall clock 37.9 minutes.

Move distribution:

| moves | TPR | this solver |
|---|---|---|
| 38 | 0 | 2 |
| 39 | 2 | 7 |
| 40 | 2 | 14 |
| 41 | 8 | 64 |
| 42 | 32 | 128 |
| 43 | 81 | 196 |
| 44 | 137 | 82 |
| 45 | 156 | 6 |
| 46 | 72 | 1 |
| 47 | 10 | 0 |

### What produced this: probeMin in screening

Screening compares many candidate reductions by solving each one's 3x3x3 with
a cheap search. It used to pass `probeMin = 0`, which makes min2phase return
the first solution it finds. That was wrong twice over. Every candidate scored
worse than it needed to, and worse, screening picks the candidate with the
smallest measured total, so it was partly selecting whichever reduction had
got a *lucky* first solution rather than the one that was genuinely shortest.
Selection on noise.

Swept over 50 states held fixed, against a stock baseline of 44.40:

| probeMin | average | reductions screened | longer than stock |
|---|---|---|---|
| 0 | 43.86 | 157 | 7 |
| 50 | 43.34 | 141 | 2 |
| 100 | 43.10 | 124 | 1 |
| 250 | 42.82 | 89 | 1 |
| 500 | 42.70 | 62 | 0 |
| 1000 | 42.74 | 41 | 0 |
| 2000 | 42.64 | 24 | 0 |

It flattens from 500 onward, where shorter screens start costing more
candidates than they gain. 500 is the knee, and it is the value TPR itself
passes, so it was chosen over the nominally-lowest 2000 rather than fitting a
number to 50 states.

Screening now compares about 70 reductions per solve instead of 157, and wins
anyway.

### Verified after the change

| check | result |
|---|---|
| cubing.js: scramble then solution reaches solved | 100 of 100 |
| reported move count equals emitted tokens | 4,352 vs 4,352 |
| min2phase validity errors | 0 of 523 calls |
| Node correctness gate, both solve paths | 0 failures of 40 |
| tokens outside the 36-move set | 0 |

The previous version of this section reported 43.656 against 44.216, a 0.56
move improvement, losing on 84 of 500 states. Both the average and the losses
came from the screening flaw above.

### The metric, settled

Both figures are the same metric, confirmed from the Java source rather than
assumed.

`Moves.java` defines the output alphabet as 36 tokens, identical to the
JavaScript port's:

```java
public static final String[] move2str = {"U  ", "U2 ", "U' ", "R  ", ...
    "Uw ", "Uw2", "Uw'", "Rw ", "Rw2", "Rw'", "Fw ", "Fw2", "Fw'", ...};
```

and `test.java`, the harness that produced the published average, counts

```java
int cur_len = val.length() / 4;
```

Every token is three characters plus a space, so this is a count of tokens. A
double-layer turn is one token, a 180 degree turn is one token, and no slice
move exists in the alphabet. That is **OBTM**, the metric used throughout this
file.

One caveat on the published 44.39 specifically. `Search.java` has
`with_rotation = true`, so the string it measures ends with a cube-rotation
suffix from `Center1.rot2str`. Twelve of those 24 suffixes are four or five
characters, and integer division by four then counts them as an extra move. So
44.39 is an upper bound on TPR's true average, inflated by up to one move on
roughly half of its solves. Pinning it down exactly needs a JDK to compile and
run, and this machine has only a JRE.

That is why the comparison above is against a faithful in-process
reimplementation rather than against the published number. Reassuringly the two
agree: 44.216 measured here against 44.39 published, with the difference in the
direction the rotation-suffix bug predicts.

## Correction: the earlier improvement figures were inflated

The 1.75 and 1.88 move improvements reported in the sections below are wrong.
They were measured against a baseline my own shim had weakened.

`tpr444.js` reaches the 3x3x3 stage through `scramble_333.solvFacelet`, a name
csTimer supplies and which I had to provide myself in `vendor/shim.js`. I wrote
it as `min2phase.solve(facelet)`, whose default `probeMin` is 0, meaning it
returns the first solution it finds. TPR's own call is

```java
String sol = search333.solution(facelet, 21, 1000000, 500, 0);
```

with `probeMin = 500`, which keeps searching and returns the shortest solution
seen within 500 probes. That single argument is worth about 1.2 moves. The
baseline went from 45.40 to 44.22 once the shim matched TPR.

This solver's own figure is unaffected, because it calls min2phase directly
rather than through the shim. Its average was 43.649 over 1,000 states and
43.656 over the 500 here. What changed is only what it is being compared
against, and therefore the size of the claimed win: from 1.88 moves to 0.56.

## Stress test: 1,000 WCA random states, 5 second budget

Note: the baseline column here used the weakened shim described above, so its
45.40 is too high by roughly 1.2 moves and the improvement figures in this
section are superseded. This solver's own numbers stand.

States drawn uniformly from the legal 4x4x4 state space, then filtered to
exclude the solved state and the 36 states one move from it. At the time that
filter covered the starting orientation only, whereas WCA regulation 4b3 excludes
those states in all 24 orientations, 672 in total; the harness now covers all
672. All 1,000 were distinct and none were rejected by the filter. Whether any
fell among the 635 missed states was not checked for this run, because its
scrambles were not saved; the chance is negligible.
Every solution was replayed onto its state and verified. Wall clock 75.5
minutes.

| solver | average | sd | best | worst |
|---|---|---|---|---|
| stock three-phase (csTimer / TPR) | 45.40 | 1.089 | 41 | 48 |
| this solver | 43.65 | 1.091 | 38 | 48 |

Mean 43.649, standard error 0.035, 95% CI [43.58, 43.72].

Paired improvement 1.748 moves, sd 1.117, standard error 0.035, 95% CI
[1.68, 1.82]. Shorter on 867 states, equal on 133, longer on none.

Move distribution:

| moves | stock | this solver |
|---|---|---|
| 38 | 0 | 1 |
| 40 | 0 | 7 |
| 41 | 2 | 25 |
| 42 | 9 | 94 |
| 43 | 40 | 279 |
| 44 | 126 | 396 |
| 45 | 331 | 173 |
| 46 | 353 | 24 |
| 47 | 132 | 0 |
| 48 | 7 | 1 |

### Against the 44.39 figure

Counted as asked: 198 of 1,000 solves came out above 44.39, against 823 of
1,000 for the stock solver. Move counts are integers, so "above 44.39" means 45
or more.

That count is not a failure rate. 44.39 is cs0x7f's published *mean* for the
Java TPR solver, and any solver averaging 43.6 with a standard deviation near
1.1 will place roughly a fifth of its solves at 45 or above. The comparison
that means something is mean against mean: 43.649 against 44.39, which is 21.5
standard errors below it.

The 44.39 figure could not be reproduced here. csTimer's JavaScript port of
that same three-phase solver measures 45.40 on these 1,000 states, so the Java
original appears to search harder than the port this project is built on.

It is also not certain that 44.39 is in the same metric. The TPR README says
"44.39 moves (face turn metric)", and "face turn metric" is not a precisely
standardised term for NxN puzzles; that README's own TODO list has "Solution
format" as unfinished. The assumption that it equals OBTM rests on it being the
same algorithm over the same 36-move generator set, not on any statement in the
source. **The comparison worth trusting is 43.65 against 45.40**, which is the
same 1,000 states, the same metric, and the same process.

### Timing

Mean 4.33 s, median 4.28 s, one-time table build 1.2 s.

Ten solves of 1,000 exceeded the 5 second budget, the worst at 7.19 s; the
other overruns were between 5.07 and 5.73 s. The deep-pass guard estimates a
search's cost from the worst it has previously seen at that depth, so the first
call at a depth it has not yet timed can overrun. At 210 scrambles none
exceeded the budget, which was too small a sample to show this. The budget is
a firm target with a roughly 1 percent tail, not a hard cap.

## Large sample: 210 random states, 5 second budget

| solver | average | sd | best | worst |
|---|---|---|---|---|
| stock three-phase | 45.46 | 1.04 | 42 | 47 |
| this solver | 43.58 | 1.07 | 41 | 46 |

Paired improvement 1.881 moves, sd 1.137, standard error 0.078, 95% CI
[1.73, 2.03].

Per-state outcome:

| shorter by | states |
|---|---|
| 0 | 23 |
| 1 | 55 |
| 2 | 77 |
| 3 | 38 |
| 4 | 13 |
| 5 | 4 |

Longer than stock on none of the 210. Verification failures: none.

Move distribution:

| moves | stock | this solver |
|---|---|---|
| 41 | 0 | 6 |
| 42 | 1 | 30 |
| 43 | 7 | 53 |
| 44 | 27 | 81 |
| 45 | 68 | 37 |
| 46 | 73 | 3 |
| 47 | 34 | 0 |

Timing: mean 4.32 s, median 4.29 s, range 4.25 to 4.88 s. None of the 210
exceeded the 5 second budget. One-time lookup table build 2.4 s. Total wall
clock for the run, including the paired baselines, 15.9 minutes.

## Budget: 5 s against 30 s, 50 states, both budgets on the same states

| budget | average | improvement over stock | 95% CI | actual time |
|---|---|---|---|---|
| 5 s | 43.66 | 1.80 | [1.45, 2.15] | 4.30 s |
| 30 s | 43.02 | 2.44 | [2.11, 2.77] | 27.78 s |

Stock averaged 45.46 on these states, matching the large sample.

Paired difference between the budgets: 0.64 moves, standard error 0.11, 95% CI
[0.42, 0.86]. Per state, the 5 second run was longer by 1 move on 17 states, 2
on 6, 3 on 1, and equal on 26.

So a longer budget does buy shorter solutions, and the effect is about
two thirds of a move for six times the time.

### A correction

An earlier version of this project claimed more time did not help, on the
strength of a ten-state comparison that showed 43.30 at 5 s and 43.20 at 30 s.
At the variance measured here, ten states give a standard error near 0.25 on
the paired difference. That comparison could not have detected the 0.64 move
effect it was being used to rule out. The claim was wrong and the defaults that
followed from it have been reverted.

30 s against 60 s has not been measured at adequate sample size. Nothing is
claimed about it either way.

## Independent audit: metric and parity

Run with `scratchpad/audit.mjs`, 150 solves, 6,720 emitted moves. Solutions are
checked with **cubing.js**, which shares no code with this solver, by applying
scramble then solution to its own 4x4x4 model and comparing against the solved
pattern. Its model labels the four centres of a face identically
(`0,0,0,0,4,4,4,4,…`), so centre indistinguishability is handled correctly.

### The move metric

The generator set is 36 moves: six outer faces and six 2-layer wide turns, each
plain, doubled or inverted. Across 6,720 emitted moves, zero fell outside that
set and zero used slice notation.

| question | answer |
|---|---|
| Does a double-layer turn count as 1? | **Yes.** `Uw`, `Rw2`, `Fw'` are one token each. 1,529 of the 6,720 were wide. |
| Does an inner slice alone count as 1? | **Not applicable.** No slice move is ever emitted. There is no `u`, `2R`, `M`, `E` or `S` in the generator set. |
| Is a 180 degree turn 1 move or 2? | **1.** This is a half-turn metric. 3,045 of the 6,720 were half turns. |

So the reported metric is wide = 1, half = 1, no slices, which is OBTM. The
same 150 solutions re-scored under other conventions:

| metric | rule | average |
|---|---|---|
| OBTM | wide 1, half 1 | 44.80 |
| QTM | wide 1, half 2 | 65.10 |
| SSTM | wide 2, half 1 | 54.99 |
| SQTM | wide 2, half 2 | 80.91 |

These averages are from a 3 second budget in Node, which is roughly five times
slower than the browser, so they are higher than the 43.65 headline. The ratios
between metrics are the point.

An adjacent pair like `Rw` then `R'` is physically an inner slice. It is
emitted as two tokens and counted as two, which is what OBTM requires; SSTM
would score that pair as one. There were 723 adjacent same-axis pairs.

### Parity

**There are no parity algorithms on the solve path.** The `ppll_map` and
`poll_map` tables in `tpr444.js` are csTimer's case-trainer *scramble*
generators, registered as `444ppll` and `444poll`, and are never reached when
solving. Parity is carried inside the phase 2 and phase 3 coordinates
(`$set_2` takes the edge permutation parity, `$set_3` takes edge parity XOR
corner parity), so the search cannot reach a parity-blocked state and there is
nothing to append afterwards.

Three checks that it is neither skipped nor miscounted:

| check | result |
|---|---|
| cubing.js: scramble then solution reaches solved | 150 of 150 |
| reported move count equals emitted token count | 6,720 vs 6,720, zero mismatches |
| min2phase validity errors (codes 1 to 6) | 0 across 1,622 calls |

The third is the structural one. A mishandled parity would leave the reduced
3x3x3 illegal, typically an odd edge permutation against an even corner
permutation, and min2phase rejects such states with a validity error before
searching. It never did. Codes 7 and 8, which mean it simply found nothing
within the depth limit, also did not occur.

The second rules out miscounting: the number reported is the length of the
exact sequence that was then verified, so no move can be applied without being
counted or counted without being applied.

### Two things to be aware of

**An error in the audit, not the solver.** My first version of this check used
a hand-written list of the 24 cube rotations to decide whether a solution had
finished in a rotated orientation. The list was wrong, and it reported 1 solve
in 20 as unsolved. Generating the rotation class properly, as the closure of
the solved pattern under x and y, gives exactly 24 elements and zero failures.
The alarming first number was my bug.

**Rotated finishes, and why their rate varies.** In this audit 93 of 150 ended
exactly solved and 57 ended solved with the colour scheme rotated. On a 4x4x4
that is a solved cube, because there are no fixed centres. An earlier version of
this file generalised the 38 percent seen here to all runs. That was wrong: the
2000-state run finished rotated on 1256 of 2000, 63 percent.

The rate depends on how much the solver searches. The same 200 saved scrambles
were re-solved at three budgets in one browser session, and once more with this
audit's Node settings, then checked with cubing.js. The saved solutions are in
`results/orient-*`.

| run | reductions screened per solve | rotated | identical to stock's solution | rotated when different from stock | average moves |
|---|---|---|---|---|---|
| stock solver | — | 29.5% | 200 | — | 44.20 |
| browser, 300 ms | 1.3 | 23.0% | 144 | 39.3% | 43.93 |
| Node, 3000 ms, this audit's settings | 3.1 | 30.0% | 108 | 46.7% | 43.55 |
| browser, 1000 ms | 9.8 | 41.5% | 75 | 56.8% | 43.22 |
| browser, 5000 ms | 74.1 | 62.0% | 31 | 72.2% | 42.47 |
| saved 2000-state run, 5000 ms | 112.9 | 63.5% | 27 | 72.8% | 42.43 |

The more the solver searches, the more often it replaces the stock solver's first
reduction with a different one, and a different reduction usually finishes
rotated. The Node row sits exactly where its search volume places it among the
browser rows, so the platform is not the cause. This audit's 38 percent was a
consequence of how little it searched.

Two things are not established. Why a different reduction usually finishes
rotated when the stock solver's first reduction mostly does not. And why, on the
states where the solver kept stock's solution, the rotated rate sits below
stock's overall 29.5 percent; that subset is selected by move length, so some
link to orientation is plausible but unexplained.

Rotated solutions are not shorter. On the 2000-state run they averaged 42.50
moves against 42.38 for exact finishes, so orientation freedom is not what buys
the improvement.

## Is the state generator WCA random-state?

WCA regulation 4b3: "An official scramble sequence must produce a random state
from all states that require at least 2 moves to solve (equal probability for
each state)." 4x4x4 is a random-state event; only 5x5x5, 6x6x6, 7x7x7 and
Megaminx use random moves instead.

Checked with `node bench/rng.js`.

**The sampled space is exactly the legal one.** The generator draws a uniform
corner permutation (8!), uniform corner twists with one corner corrected so the
sum is 0 mod 3 (3^7), a uniform wing permutation (24!), and a uniform centre
arrangement (24!/(4!)^6). That product, divided by 24 because a 4x4x4 has no
fixed centres and so no determinate orientation, is

```
7401196841564901869874093974498574336000000000
```

which is the published 4x4x4 state count, verified exactly in BigInt.

**The shuffle is unbiased.** `mathlib.rndPerm` is a correct Fisher-Yates. The
generator is ISAAC, a cryptographic stream cipher, seeded in the browser with
4096 bits from `crypto.getRandomValues`.

**It measures uniform.** 200,000 states:

| check | result |
|---|---|
| sticker colour at index 0 | chi-square 4.26 on 5 df |
| sticker colour at index 5 | chi-square 3.76 on 5 df |
| sticker colour at index 40 | chi-square 3.86 on 5 df |
| colour counts not 16 each | 0 |
| corner twist sum not 0 mod 3 | 0 |
| states rejected as illegal by the parser | 0 of 2000 |
| already-solved states emitted | 0 |

The critical value at p 0.05 is 11.07. A run at 20,000 samples produced a
16.98, which the ten-times-larger sample did not reproduce.

**The emitted sequence does not canonicalise orientation.** The solver works in
a symmetry-reduced frame, so this was worth testing separately: replaying 200
generated scrambles onto a solved cube gave uniform sticker colours, chi-square
7.06 and 7.96 on 5 df.

### Where it differs

**The "at least 2 moves" clause lives in the harness, not the generator.** The
generator rejects the solved state in every orientation and nothing else. The
benchmark harness adds the rest. Because a 4x4x4 has no fixed centres, a state
one move from solved in any of the 24 orientations also needs just one move, so
the full exclusion set is 672 states, matching an independent count made with
cubing.js. The harness first covered only the starting orientation, 37 of the
672, and now covers all of them. None of the 2000 saved benchmark scrambles fall
anywhere in the full set, so nothing measured is affected. Anyone calling the
solver's own generator directly still gets only the solved-state rejection.

**These are not official WCA scrambles.** They are distributionally equivalent,
not TNoodle output. TNoodle is a different implementation seeded from
`SecureRandom`, and its scramble sequences are not the same length as these,
which average 45.3 moves. Regulation 4b3 constrains the resulting state rather
than the sequence, so sequence length is not a compliance question, but nothing
here is a substitute for TNoodle at a competition.

**The Node harness used to seed weakly.** `mathlib` falls back to a millisecond
timestamp when `crypto` is absent, which it was inside the Node sandbox, so the
Node benchmarks ran on roughly 40 bits of seed while the browser had 4096. Node
now gets `crypto.webcrypto`. The 210-state benchmark above ran in the browser
and was never affected.

## Reproducing

Open the page, use the benchmark panel, or drive the worker directly. The Node
harness measures the same thing roughly five times slower, so its budgets are
not comparable to the browser's:

```bash
node bench/verify.js 40 3000     # correctness gate, must report zero failures
node bench/run.js 30000 20       # paired benchmark on the fixed state set
node bench/rng.js 200000 200     # state generator uniformity checks
```

`bench/audit.mjs` needs cubing.js, which is deliberately not a dependency of
the solver. Install it somewhere separate and run from there:

```bash
npm install cubing
node bench/audit.mjs 150 3000
```
