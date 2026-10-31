# BRIDGE MASTER — Development Rules

## Goal
Build a realistic browser-based maritime navigation
simulator with professional bridge equipment.

## Architecture
- TypeScript and React.
- Three.js / React Three Fiber for 3D.
- Separate simulation, rendering, UI and sensors.
- Use one authoritative simulation state.
- Use fixed-step simulation updates.

## Core Requirements
- Vessel dynamics must include inertia.
- Rudder and engine commands must be simulated.
- Radar and ECDIS must reflect actual simulation state.
- Sensor measurements may differ from ground truth.
- CPA/TCPA must use verified vector mathematics.
- Traffic AI must consider COLREG and vessel dynamics.
- Time acceleration must not break simulation.

## Development Workflow
- Implement features in testable milestones.
- Keep the application runnable.
- Add regression tests for simulation mathematics.
- Run build and applicable tests after changes.
- Verify important visual features in a browser.
- Preserve existing working features.
- Record known limitations.

## Equipment
- Furuno FAR-2xx8 radar family.
- Furuno FMD-3200/3300 ECDIS family.
- Use official documentation where available.
- Do not invent undocumented equipment behavior.
- Simulation only; not for real navigation.
