# Verification recipes

## CPA oracle and application adapter

Fixtures in `../assets/cpa-cases.json` use local Cartesian `[east, north]` metres
and ground velocities in m/s; results are seconds and metres. The independent
oracle assumes constant velocities on an unbounded prediction horizon:

```text
r = target.position - own.position
v = target.velocity - own.velocity
signedTCPA = -dot(r, v) / dot(v, v)
futureTCPA = max(0, signedTCPA)
futureDCPA = length(r + v * futureTCPA)
```

For relative speed <= 1e-6 m/s, signed TCPA is undefined (`null`), future TCPA is
zero, and future DCPA is current range. This threshold is a numerical policy,
not a maritime standard. Historical line-CPA distance and future DCPA differ
when signed TCPA is negative. Keep any bounded forecast API separately labelled.

The values are hand-derived: head-on closes 1000 m at 10 m/s in 100 s; the miss
case closes an eastward offset of 1000 m at 10 m/s while preserving 300 m north.
The stationary 120/-50 and equal-velocity 300/400 offsets have ranges 130 and
500 m. Translation, swapping vessels, common velocity offsets, and 90° rotation
must preserve all results. Tests use absolute tolerance 1e-8 m and 1e-8 s for
these small, exactly specified Cartesian cases; choose and justify appropriate
separate tolerances for geographic/projected application results.
The oracle rejects nonfinite inputs/results and arithmetic overflow; it is scoped
to small local-coordinate cases, not extreme-magnitude numerical computation.

To test application CPA, provide an ES module at an absolute path exporting:

```js
export function computeCpa(input, { relativeSpeedEpsilonMps }) {
  // Call the real application calculation, converting units/shape as needed.
  // input.own / input.target: { positionM: [east, north], velocityMps: [east, north] }
  // Return { tcpaSignedS: number | null, tcpaFutureS: number, dcpaFutureM: number }.
}
```

The wrapper may translate documented sentinel values and units; it must not
recompute CPA using the reference oracle or hard-code expected answers. If the
production API lacks these semantics, test its documented variant separately
and report the mismatch rather than masking it. Do not copy this oracle into
production just to make the checks pass. The optional adapter suite awaits results
and fails on an invalid module/export. Without the module it reports skipped tests.

## Production Vitest regression recipes

- **Heading/COG/SOG/STW:** Heading 000°, zero leeway, STW 10 kn, east current
  3 kn gives velocity `[3, 10]` kn, SOG sqrt(109) kn, and COG
  atan2(3, 10) ≈ 16.699244°. Heading remains 000°. Check 359°/001° wrap,
  cancelling current (undefined COG), and geographic/dateline transforms.
- **Rudder/engine/inertia:** replay a rudder step, neutral recovery, engine
  step/stop/reversal, and port/starboard mirror cases in calm water. Assert the
  configured actuator limits, lag, continuous angular velocity, bounded state,
  and yaw/momentum response against the declared physical model. A no-force
  model conserves momentum; a model with drag dissipates energy. Do not demand
  conservation from a powered, damped vessel. Calibrate turning/stopping
  distances against sourced vessel data before making fidelity claims.
- **FPS/acceleration:** build a production-loop replay helper driven by injected
  frame deltas and a seeded random source. Queue identical controls in simulation
  time; stop/sample at identical simulation instants, including the final partial
  step. Replay the FPS × acceleration matrix from SKILL.md, including acceleration
  switches and pause. Compare position (m), speed (m/s), wrapped heading (rad),
  yaw rate (rad/s), and sensor/AI event order within explicit tolerances. Check
  simulated elapsed time against the integral of wall-time × acceleration;
  detect dropped time and integration step changes. Use virtual clocks, not sleeps.
- **State/sensors:** inject known truth trajectories and assert transforms,
  radar relative bearings/ranges, ECDIS fixes, AIS messages, visual poses, and
  ARPA estimates using matching simulation timestamps. Test truth versus delayed
  sampled observations separately, including sensor failure and out-of-order
  fixes. Verify time acceleration changes simulated sensor cadence consistently.
- **Traffic/COLREG:** fix initial positions, velocities, visibility, vessel
  capabilities/status, seed, and applicable rule per scenario. Check head-on,
  crossing from each side, overtaking, threshold boundaries, and restricted
  visibility only where modeled. Assert safe separation and decision stability
  across the same FPS/acceleration matrix. These scenario tests cannot establish
  complete COLREG compliance or IMO/IEC certification.

Keep actual regressions beside production code/tests under the repository's
Vitest conventions. No application exists in the initial checkout: these recipes
are instructions for future checks, not evidence that those behaviors work.
