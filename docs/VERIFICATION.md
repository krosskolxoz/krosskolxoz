# Verification — 2026-10-31

## Final results

| Command | Passed | Failed | Skipped |
|---|---:|---:|---:|
| `npm test` (production simulation/navigation/instrument code) | 68 | 0 | 0 |
| `MARINE_CPA_MODULE=$PWD/src/simulation/cpa-adapter.mjs npm test --prefix .agents/skills/marine-navigation-qa/scripts` | 52 | 0 | 0 |
| `npm run test:e2e` (Chromium, software WebGL) | 5 | 0 | 0 |
| `npm run build` (strict TypeScript + Vite) | successful | — | — |

The supplied Skill tests were retained. Their production adapter delegates to actual application CPA rather than recomputing the oracle. The test fixtures, mathematical conventions, tolerances and numerical policy are documented in MODEL.md and the existing Skill.

## Browser evidence

Playwright exercised the real React application in Chromium with SwiftShader at 1024×768, 1440×1000 and 1920×1080. No horizontal overflow or uncaught page errors were observed in the final suite. At 1024×768, the desktop workspace scrolls vertically.

Confirmed:

1. 3D WebGL scene renders, radar/ECDIS stations open, orientation and EBL/VRM controls work.
2. Rudder command is immediate but actual rudder/heading respond gradually; 8× advances the same production simulation; pause stops it; engine stop preserves immediate momentum.
3. GPS loss appears on the chart; adding and immediately deleting a waypoint changes the real route; route check produces a result.
4. Autopilot sets heading commands without teleporting the vessel; local browser save/restore restores the actual state.
5. Radar target acquisition, starboard 20° command, target motion, heading/trail growth and changed CPA/TCPA all occur in one continuous exercise.

Independent visual captures inspected sunset, night and fog. Mouse look is fixed-position and the ocean/traffic are visible above the consoles. Live clock and sampled GPS positions advance. A first-frame RAF timestamp error and a newly added waypoint's selected-index error were fixed before the final passing suite.

## Limits of the evidence

Software rendering does not establish 60 FPS on a physical GPU. No hardware benchmark, real-vessel calibration, complete COLREG compliance, real ARPA convergence, Furuno firmware compatibility, ENC validation or IMO/IEC certification was performed or claimed. Weather is visual in this milestone. The three scenarios are initial-state presets, not scored lessons; save/restore is available, replay is not.
