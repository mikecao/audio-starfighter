# PLAN Status

Status labels:
- `Done`: implemented and validated in code
- `Partial`: implemented in simplified form or missing formal validation target
- `Backlog`: intentionally not implemented yet

## Overall
- MVP from `PLAN.md`: `Done` (functional)
- Formal performance/timing certification targets: `Partial`
- Post-MVP backlog: `Backlog` (except score/combo, which is done)

## Project Goal
- Status: `Done`
- Evidence:
  - 3D side-scroller rendering and gameplay loop: `src/render/scene.ts`, `src/game/sim.ts`
  - Audio analysis and cue generation: `src/audio/analyze-track.ts`, `src/audio/beat-detector.ts`, `src/audio/cue-generator.ts`
  - Cue-aligned scheduling and metrics: `src/game/sim.ts`, `src/ui/debugHud.ts`

## MVP Definition (v0)
1. Load audio file in browser: `Done`
- `src/ui/audioPanel.ts`
2. Analyze audio into cue timeline: `Done`
- `src/audio/analyze-track.ts`, `src/audio/cue-generator.ts`
3. Render smooth 3D side-scrolling scene: `Done`
- `src/render/scene.ts`
4. Ship auto-moves and fires angled projectiles: `Done`
- `src/game/sim.ts`
5. Cube enemies spawn with patterns: `Done`
- `src/game/sim.ts`
6. Enemy defeats/explosions land on cue moments: `Done` (with measured hit/miss)
- `src/game/sim.ts`, `src/ui/debugHud.ts`
7. Ship does not die and dodges enemy projectiles: `Done`
- `src/game/sim.ts`

## Technical Stack
1. TypeScript: `Done`
2. Vite: `Done`
3. three.js: `Done`
4. Web Audio API decode/features: `Done`
5. central store (zustand/custom): `Partial`
- custom state is in `sim.ts`; no dedicated global store abstraction
6. Vitest: `Done`

## System Architecture
- `src/audio/*`: `Done`
- `src/game/sim.ts`: `Done`
- `src/render/scene.ts`: `Done`
- `src/ui/*`: `Done`
- requested folder decomposition (`entities/`, `ai/`, `scheduler/`, `patterns/`, `render/systems/`): `Partial`
- implemented mostly inside `src/game/sim.ts` for MVP speed

## Data and Time Model
1. Fixed timestep: `Done`
2. Render interpolation split from sim updates: `Done`
3. Canonical sim clock in seconds: `Done`
4. Schedule against audio-relative timestamps: `Done`
5. Seeded randomness reproducibility: `Done`
- Evidence: `src/main.ts`, `src/game/sim.ts`, `src/game/sim.test.ts`

## Audio Analysis Pipeline
1. Decode + mono mixdown: `Done`
2. Features (RMS/flux/centroid): `Done`
3. Smoothing + normalization: `Done`
4. BPM detection (autocorrelation): `Done`
5. Intensity + mood proxy buckets: `Done`
6. Cue generation: `Done`
- Evidence: `src/audio/*.ts`, `src/audio/*.test.ts`

## Gameplay and Sync Algorithms
1. Explosion-on-cue scheduling: `Done` (MVP solver approach)
- queued cue shots and cue-enemy binding: `src/game/sim.ts`
2. Autopilot movement: `Done`
3. Dodge behavior: `Done`
4. Enemy behavior (3 base families): `Done`
5. Projectile model (angled + preplanned): `Done`
- object pooling specifically: `Partial` (mesh pooling done in render; sim entities use arrays)

## Performance and Reliability Requirements
1. 60 FPS target on mid-tier laptop: `Partial` (no formal benchmark artifact)
2. Avoid per-frame allocations in hot path: `Partial`
3. Pooling for projectiles/enemies/explosions: `Partial`
4. 3+ minute stability test: `Partial` (manual-capable, not formally recorded)
5. Median cue error <50ms: `Partial` (metric implemented, not yet certified by benchmark run)
- Evidence: runtime metrics in `src/ui/debugHud.ts`, export in `src/main.ts`

## Test Strategy
Unit tests:
- beat detection: `Done`
- cue generation: `Done`
- intercept/scheduling correctness: `Partial` (scheduler behavior covered; no standalone intercept solver test module)
- dodge risk scoring: `Partial` (behavior covered indirectly in sim tests)

Integration tests:
- fixed-seed replay consistency: `Done`
- scheduler ordering/accounting: `Done`
- collision/destroy timing alignment: `Partial` (covered at system level; no dedicated timing harness)

Manual verification tools:
- timeline overlay + playhead: `Done`
- per-cue hit/miss/error metrics: `Done`
- logs/distributions: `Partial` (JSON summary export exists; no histogram tooling)

Evidence: `src/game/sim.test.ts`, `src/audio/*.test.ts`, `src/ui/audioPanel.ts`, `src/ui/debugHud.ts`, `src/main.ts`

## Milestones and Deliverables
- Milestone 1 Foundation: `Done`
- Milestone 2 Audio Pipeline: `Done`
- Milestone 3 Core Gameplay: `Done`
- Milestone 4 Audio Sync Scheduler: `Done`
- Milestone 5 Dodge and Polish: `Done` (MVP level), `Partial` for formal perf certification

## Backlog After MVP
1. Authored meshes: `Backlog`
2. Richer shader FX/explosions: `Backlog` (basic intensity-reactive visuals are done)
3. ML mood classifier: `Backlog` (rule-based mood proxy done)
4. Difficulty presets from audio: `Backlog`
5. Score/combo tied to sync: `Done`
6. Pattern authoring editor/debug tools: `Backlog`

## Risks / Mitigations (implemented)
1. Beat stability risk: `Done` (feature smoothing + tests)
2. Scheduling infeasibility risk: `Done` (cue binding, queued shots, miss accounting)
3. Audio/sim drift risk: `Done` (drift metric + adaptive correction + pause handling)
4. Object churn risk: `Partial` (render pooling done; sim pooling not fully introduced)

## Definition of Done for v0
1. Load audio and start simulation: `Done`
2. Side-scrolling 3D scene with ship/enemies/projectiles: `Done`
3. Ship auto-moves/dodges/fires angled shots: `Done`
4. Cue-synchronized enemy explosions: `Done` (with measurable hit/miss/error)
5. Performance/timing targets on representative machine: `Partial` (needs formal benchmark run)

## Recommended Closeout Steps
1. Run a formal 3-minute benchmark session and record FPS + cue error statistics.
2. Add a dedicated scheduler benchmark/test harness for cue timing quantiles.
3. Decide whether to keep monolithic `src/game/sim.ts` or refactor into `entities/ai/scheduler/patterns` modules.
