---
name: marine-navigation-qa
description: Engineering verification for BRIDGE MASTER. Use when implementing, changing, or reviewing vessel dynamics or hydrodynamics, rudder or engine response, radar or ARPA, ECDIS, AIS or navigation sensors, CPA/TCPA, COLREG decisions, time acceleration, or vessel traffic AI.
---

# Marine navigation QA

Verify the affected behavior with explicit units, deterministic evidence, and
production-code regression tests. Do not infer correctness from a convincing image.

## Workflow

1. Inspect the repository instructions, simulation loop, state ownership, affected
   modules, and existing Vitest setup. Identify missing components before testing.
2. State the mathematical model, coordinate frame, signs, units, assumptions,
   expected results, and numerical tolerances **before** changing implementation.
3. Trace inputs through dynamics, navigation calculations, sensors, and consumers.
   Use [verification recipes](references/verification.md) for relevant checks.
4. Add deterministic Vitest regressions calling the **production** functions.
   Cover the reported defect, nominal behavior, boundaries, and invalid input.
   Keep the test oracle independent of the implementation being tested.
5. Run affected tests after every relevant change, plus applicable integration,
   type, build, and existing regression checks. Diagnose failures; do not weaken
   assertions or silently skip required checks to obtain a pass.

## Required checks

- **Math and units:** use explicit conversions (1 NM = 1852 m; 1 kn = 1852/3600
  m/s). Check radians/degrees, seconds, angle wrapping, finite values, projection,
  dimensional consistency, and numerical stability. Never treat lat/lon as metres.
- **Motion quantities:** Heading is bow orientation; COG is ground-velocity
  direction; SOG is ground-speed magnitude; STW is water-relative speed. Use
  vectors for current and leeway; COG is undefined at zero ground speed.
- **Dynamics:** verify inertia, gradual yaw buildup/decay, rudder angle and rate
  limits, engine lag, and behavior at low speed, astern, and reversal. Verify
  response against the declared vessel model or calibration data. Label an
  uncalibrated model as such; do not call it realistic merely because it turns.
- **Shared state:** radar/ARPA, ECDIS, AIS, and external visuals must trace to the
  same authoritative simulation state/history and coordinate transforms. Compare
  matching entity IDs and simulation timestamps, accounting for interpolation.
- **Sensors:** keep ground truth separate from sampled/estimated measurements.
  Verify declared update rates, timestamps, latency, seeded noise, dropouts,
  stale-data handling, and ARPA tracking/CPA based on estimated motion. Do not
  demand instantaneous equality with noisy or delayed truth-derived observations.
- **CPA/TCPA:** use ground-relative vectors and deterministic reference cases.
  Distinguish signed TCPA, future-only CPA, and any finite prediction horizon.
  Cover equal velocities, opening targets, overlap, near-zero relative speed,
  crossing, overtaking, and a nonzero miss distance.
- **FPS and time:** replay seeded, simulation-time-scheduled controls at
  15/30/60/144 FPS and jittered frame times, at 1×/2×/4×/8× acceleration. Compare
  equal simulation timestamps within predeclared tolerances. Test pause/resume,
  factor changes, long frames, and dropped/clamped time; apply time scaling once.
- **COLREG and traffic AI:** test labelled head-on, crossing, overtaking, and
  boundary encounters; assert roles, encounter classification, maneuver timing,
  closest separation, and absence of oscillating decisions. State applicable
  rules, visibility, vessel status/type, and unsupported situations explicitly.

## Bundled CPA checks

From the repository root:

```sh
cd .agents/skills/marine-navigation-qa/scripts
npm ci
npm test
# Optional: exercise actual application CPA through the adapter contract below.
MARINE_CPA_MODULE=/absolute/path/to/adapter.mjs npm test
```

See [verification recipes](references/verification.md) for fixture conventions
and adapter details. The bundled reference suite validates the mathematical
fixtures/tooling only. Without an application adapter, production CPA tests are
explicitly skipped. It does **not** verify vessel behavior or application sensors.
Use the project's Vitest suite for full simulation regressions when it exists.

## Evidence and claims

Report changed behavior, commands, test counts (passed/failed/skipped/unrun),
reference expectations, tolerances, and observed deviations. Identify remaining
limitations, unverified behavior, and missing calibration data. Treat absent
production modules as unverified, never as passing tests. Never claim IMO or IEC
certification from these checks; a test pass supplies no certification evidence.
