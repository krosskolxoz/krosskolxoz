---
name: marine-navigation-qa
description: Review and test maritime navigation calculations, ship dynamics, radar, ARPA, AIS, ECDIS and COLREG-72 scenarios.
---

# Marine navigation QA

Use this skill to review calculations, diagnose navigation defects, and design or
run deterministic tests of existing maritime software. Keep work within the
requested review or fix; this workflow does not require building a full game.

## Invocation and bundled checks

Open Codex in this repository (or a subdirectory) and request, for example:

```text
$marine-navigation-qa Check CPA/TCPA for r = (1000, 300) m and v = (-10, 0) m/s.
```

If the skill was added during an existing session, refresh the skill list or
start a new session. The instruction file itself needs no dependency installation.
Bundled checks require Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` as specified in
`scripts/package.json`. From the repository root:

```sh
npm --prefix .agents/skills/marine-navigation-qa/scripts ci
npm --prefix .agents/skills/marine-navigation-qa/scripts test
# Optional: use an adapter that calls the actual application's CPA calculation.
MARINE_CPA_MODULE=/absolute/path/to/adapter.mjs npm --prefix .agents/skills/marine-navigation-qa/scripts test
```

The reference suite tests the bundled mathematical tooling. Without
`MARINE_CPA_MODULE`, production-adapter tests are explicitly skipped; this is not
evidence that application CPA, sensors, dynamics, or COLREG logic were tested.
See [verification recipes](references/verification.md) for the adapter contract.

## Verification workflow

1. Read repository instructions and inspect the affected production functions,
   simulation loop, authoritative state, sensor interfaces, and existing tests.
   Identify missing implementations and unsupported scenarios before testing.
2. Declare coordinate frames, units, angle conventions, time sources, vessel
   parameters, model assumptions, and acceptance tolerances before judging results.
3. Derive expected results independently using the checks below. Trace inputs
   through dynamics, calculations, sensors, and displays at matching timestamps.
4. Run the relevant existing checks and, when implementing a requested fix, add
   focused regressions that call production code. Cover nominal behavior, the
   defect, boundaries, and invalid inputs. Use the repository's test framework;
   do not substitute a copied implementation or reference-only suite for it.
5. Run applicable integration, type, and build checks after code changes. Report
   expected versus actual results, deviations, and checks that were not run.
   Missing implementations are unverified, never passing.

## Coordinates, heading versus COG, and SOG versus STW

- Use explicit conversions: 1 NM = 1852 m; 1 kn = 1852/3600 m/s. Keep seconds,
  hours, degrees, and radians distinct. Never use latitude/longitude as metres;
  declare the projection and validity range of any local planar approximation.
- For local east/north axes and navigation angles clockwise from true north,
  `velocity = [speed * sin(theta), speed * cos(theta)]`, with theta in radians.
  Recover course with `atan2(east, north)` and wrap angles consistently. Distinguish
  true from magnetic references and verify bearing/range transforms independently.
- Heading is bow orientation; COG is the direction of ground velocity. SOG is its
  magnitude; STW is speed relative to water. In a common earth frame,
  `groundVelocity = waterRelativeVelocity + currentVelocity`. Heading aligns with
  water-relative velocity only under the model's zero-leeway, forward-motion
  assumptions. Do not replace heading with COG or STW with SOG.
- Verify a cross-current fixture: heading 000 degrees, STW 10 kn, no leeway,
  and eastward current 3 kn give ground velocity `[3, 10]` kn,
  SOG `sqrt(109)` kn (about 10.4403), and COG about 16.6992 degrees;
  heading remains 000 degrees. Also test following/adverse current, leeway,
  astern motion, 359/001 degree wrap, and current that cancels ground velocity.
  At zero SOG, COG is undefined; verify the documented unavailable-value policy.

## CPA and TCPA formulas

Use simultaneous positions and ground velocities in one Cartesian frame. The
constant-velocity model assumes no maneuver during the prediction interval.

```text
r = targetPosition - ownPosition
v = targetGroundVelocity - ownGroundVelocity
q = dot(v, v)
tSigned = -dot(r, v) / q
lineDCPA = norm(r + v * tSigned)
tFuture = max(0, tSigned)
futureDCPA = norm(r + v * tFuture)
```

- With metres and m/s, TCPA is seconds and DCPA is metres. Retain signed TCPA:
  a negative value means the unconstrained CPA occurred in the past. Compute
  future distance at `tFuture`, not at `tSigned`, for future-only risk logic.
- Before division, compare `q` with a declared relative-speed epsilon squared.
  At effectively equal velocities there is no unique TCPA; report it unavailable
  and use current range as DCPA. If an API needs a future-time sentinel, document
  it separately (for example, zero). Do not silently return infinity or NaN.
- For a finite horizon H, compute `tWindow = clamp(tSigned, 0, H)` and distance
  there; label it a bounded-window minimum, not the unbounded CPA. Evaluate the
  equal-velocity case separately. Reject negative or nonfinite horizons.
- Evaluate the norm of the separation vector, preferably with a stable hypot;
  avoid cancellation from subtracting nearly equal squared distances. Validate
  finite inputs/results and test the chosen epsilon on both sides of its boundary.
- Recalculate predictions after maneuvers. Validate actual minimum separation
  along the simulated trajectory separately from a constant-velocity forecast.

Use these independently derived fixtures; `r` is metres and `v` is m/s.
For the equal-velocity row, the future-time sentinel is zero by policy.

| Case | r (east, north) | v (east, north) | Signed TCPA (s) | Future time (s) | Future DCPA (m) |
| --- | --- | --- | ---: | ---: | ---: |
| Direct closing | (1000, 0) | (-10, 0) | 100 | 100 | 0 |
| Nonzero miss | (1000, 300) | (-10, 0) | 100 | 100 | 300 |
| Opening / past CPA | (1000, 0) | (10, 0) | -100 | 0 | 1000 |
| Equal velocities | (300, 400) | (0, 0) | Unavailable | 0 | 500 |
| Crossing tracks | (100, -100) | (-5, 5) | 20 | 20 | 0 |
| Overtaking, collinear | (1000, 0) | (-5, 0) | 200 | 200 | 0 |
| Already overlapping | (0, 0) | (1, 0) | 0 | 0 | 0 |

For the crossing fixture, own velocity is `(5, 0)` and target velocity `(0, 5)`.
For overtaking, they are `(10, 0)` and `(5, 0)`. These labels describe kinematics;
COLREG classification also needs heading, vessel status, visibility, and context.
For direct closing with H = 60 s, the bounded-window result is 60 s and 400 m.

## Ship inertia and rudder response

- Test engine step/stop/reversal and rudder step/neutral/reversal commands.
  Check actuator angle/rate limits, engine lag, acceleration, yaw buildup/decay,
  continuing motion after commands, stopping distance, and turning response.
  Commands must not teleport speed, position, heading, or yaw rate.
- Compare against the declared dynamics model or sourced vessel calibration,
  including mass/inertia, drag, propulsion, and rudder-flow assumptions. Check
  low speed, zero speed, astern, propeller wash where modeled, and port/starboard
  behavior. Do not assume universal reverse-rudder behavior or vessel symmetry.
- With propulsion and external forcing removed, verify momentum conservation
  for an undamped model or energy dissipation for a drag model, as applicable.
  Check finite bounded states and convergence as the timestep is reduced.
  State missing calibration data before making physical-fidelity claims.

## Radar, ARPA, AIS and ECDIS consistency

- Trace each output to authoritative simulation state/history while keeping
  truth separate from sampled or estimated measurements. Align entity IDs,
  simulation epochs, coordinate datum, sensor offsets, heading sources, and units.
- Inject known trajectories. Check radar range/bearing and heading-up/north-up
  transforms; distinguish relative/true vectors and sea/ground stabilization.
  Test ARPA acquisition, tracking lag, estimated velocity, CPA/TCPA, maneuvers,
  target swaps, and lost tracks against the documented estimator behavior.
- Check AIS position, COG/SOG, heading, timestamps, reporting cadence, missing
  fields, and unavailable-value encodings. AIS heading and COG may differ.
  Verify ECDIS position/course and radar/AIS overlays after frame/time alignment.
- Exercise seeded noise, latency, asynchronous updates, stale/out-of-order data,
  dropouts, and sensor failures. Assert declared uncertainty and age limits;
  do not demand instantaneous equality between delayed estimates and truth.
  Consult official documentation for modeled equipment; identify undocumented
  behavior instead of inventing it.

## COLREG-72 scenario logic

For each fixture record positions, headings, motion, vessel type/status,
visibility, waterway context, risk of collision, applicable rule, expected roles,
allowed actions, timing, and minimum separation. Verify rules against an
authoritative COLREG-72 text and the modeled amendments. Use Rules 2 and 5-8 for
responsibility, lookout, safe speed, risk assessment, and effective action.

- For power-driven vessels in sight, test Rule 14 head-on mutual starboard
  alteration; Rule 15 crossing with the vessel seeing the other to starboard
  giving way and, if circumstances admit, avoiding crossing ahead; and Rule 16
  early, substantial give-way action.
- Test Rule 13 overtaking from more than 22.5 degrees abaft the beam, doubt
  handling, and the overtaker's continuing obligation until finally past and
  clear, even if later bearing changes resemble a crossing situation.
- Test Rule 17 stand-on stages: initially maintain course/speed, permitted
  action when give-way action is inadequate, and required action when collision
  cannot be avoided by the give-way vessel alone. Include Rule 17(c)'s port-turn
  restriction when applicable; do not implement unconditional stand-on inaction.
- Evaluate Rules 9/10 for narrow channels/traffic separation schemes and Rule 18
  vessel responsibilities with their exceptions. Do not encode an unconditional
  vessel-priority hierarchy. Restricted visibility with vessels not in sight
  requires separate Rule 19 logic, including its qualified alteration constraints.
- Exercise head-on/crossing/overtaking boundaries, ambiguous classifications,
  each vessel's perspective, and multiple contacts. Assert stable decisions,
  feasible maneuvers given inertia, and actual separation throughout the encounter.
  A favorable CPA alone does not prove rule compliance; label unsupported cases.

## Time acceleration and numerical stability

- Replay the same seeded controls scheduled in simulation time at 15/30/60/144
  render FPS, jittered/long frames, and 1x/2x/4x/8x acceleration. Compare position,
  speed, wrapped heading, yaw rate, sensor cadence, and AI/event order at equal
  simulation timestamps within predeclared tolerances, using virtual clocks.
- Apply time scaling once. Keep integration steps within the model's stability
  limit, typically using a fixed-step accumulator with substeps. Repeat at half
  the physics timestep to check convergence and detect speed-dependent drift.
- Test pause/resume, acceleration switches, accumulator remainders, and overload
  policies for capped substeps or dropped time. Account explicitly for elapsed
  simulated time. Sensor latency, track age, control updates, and encounter timers
  must follow their declared clocks. Detect skipped collision/CPA/event crossings
  with substeps or continuous checks where needed.

## Mathematical edge cases and evidence

- Cover near-zero relative speed, tangent/near-parallel motion, coincident
  positions, past CPA, horizon boundaries, large coordinates/tiny separations,
  zero/negative/missing/nonfinite inputs as applicable, and arithmetic overflow.
  Test degrees/radians, NM/metres, knots/m/s, angle wrap, antimeridian crossings,
  and polar/projection limitations. Reject invalid inputs explicitly; signed
  vector components and astern velocity can legitimately be negative.
- Check CPA invariants under common position translation, common velocity
  addition, rotation, and swapping own/target vessels. DCPA and signed TCPA
  should remain equal within justified tolerances. Compare analytic fixtures
  with an independent oracle and actual production results.
- Report scope, assumptions/sources, production code locations, inputs,
  expected/actual values, units, tolerances, reproduction commands, and test
  counts (passed/failed/skipped/unrun). Separate defects from model limitations.
  These checks do not establish IMO/IEC certification or operational suitability.

Existing [verification recipes](references/verification.md) and bundled CPA
fixtures/scripts can supplement these checks. A reference-suite pass alone does
not verify application code; its adapter must call the actual production CPA.
