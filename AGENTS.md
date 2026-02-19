# AGENTS.md

Guidance for coding agents working in this repository.

## Mission

Preserve music-to-visual sync quality while keeping runtime stable under heavy scenes.

## Non-Negotiable Behaviors

- Cue explosions should map to cue events and remain visually causal.
- Avoid introducing free-floating explosions that are not tied to enemy resolution flow.
- Pause semantics matter: when playback/sim time is paused, time-driven visuals should pause too.
- Keep deterministic behavior for a given seed + analysis result.

## Architecture Map

- `src/main.ts`
  - App orchestration
  - Audio analysis/start-run hooks
  - Precompute handoff and frame loop
  - UI update gating (including hidden-UI mode)
- `src/game/sim.ts`
  - Simulation state and step loop
  - Ship movement AI, enemy patterns, projectile logic
  - Cue scheduling / reservation / resolution
- `src/game/precomputedRun.ts`
  - Precompute run snapshots
  - Millisecond-indexed lookup for replay-time sampling
- `src/render/scene.ts`
  - three.js scene, camera, mesh pools
  - Stars, enemies, projectiles, explosions, laser beams
  - Waveform plane materials, shader wiring, runtime distortion selection
- `src/render/waveformPlaneDistortion.ts`
  - Distortion algorithm catalog (`ridge`, `ripple`)
  - Distortion-specific shader header generation
  - Spectrum shaping + amplitude metrics used by scene uniforms
- `src/audio/*`
  - Decode, feature extraction, beat detection, cue generation, mood classification
- `src/ui/*`
  - Audio panel, debug HUD, event timeline rail
  - Reactive spectrum publishing/subscription and playback controls

## Development Workflow

1. Make focused edits with existing style/conventions.
2. Run build validation:
   - `pnpm build`
3. If touching logic-heavy areas, also run tests:
   - `pnpm test`

## Performance Expectations

- Prefer precompute-time work over per-frame runtime work.
- Avoid per-frame object churn in hot paths.
- Keep render update loops pool-based and allocation-light.
- Keep spectrum flow single-source: update once, fan out via subscribers.

## Cue/Sync Expectations

- Favor cue-driven event timelines over naive constant beat grids.
- Be careful with intro/low-energy sections: avoid premature cue events.
- If modifying ship motion, update cue intercept scheduling accordingly.

## UI Expectations

- Canvas-first layout: scene on top, controls below.
- Hidden UI mode should skip unnecessary UI update calculations.
- Keep waveform/timeline canvases sharp on HiDPI displays.
- Distortion and smoothing controls should remain consistent with render behavior.

## Waveform Plane Expectations

- Distortion changes must route through normalized algorithm selection.
- Preserve deterministic distortion output for identical audio input and settings.
- Maintain pause semantics for time/spectrum-driven displacement updates.

## Git Hygiene

- Do not rewrite history unless explicitly requested.
- Keep commits small, descriptive, and behavior-focused.
- Avoid bundling unrelated refactors with sync-sensitive fixes.
