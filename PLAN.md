# Audio Starfighter Development Plan

## Project Goal
Build a browser-based 3D side-scrolling shooter that auto-plays in sync with user-provided audio. The game uses WebGL for rendering and Web Audio for audio analysis. A non-player spaceship moves and fires automatically, enemies follow patterns, and key events (especially explosions) align with detected musical cues.

## MVP Definition (v0)
The first release is considered successful when all of the following are true:

1. The user can load an audio file in the browser.
2. The app analyzes the audio into a cue timeline (beats and intensity peaks).
3. A 3D side-scrolling scene renders smoothly.
4. The spaceship moves and fires automatically with angled projectiles.
5. Cube enemies spawn in visible movement patterns.
6. Enemy defeats and explosions can be scheduled to land on cue moments.
7. The spaceship does not die, but attempts to dodge incoming enemy projectiles.

## Technical Stack
Recommended choices for fast, maintainable delivery:

1. TypeScript
2. Vite
3. three.js for WebGL rendering
4. Native Web Audio API for audio decoding and feature extraction
5. Small central game/audio store (zustand or custom store)
6. Vitest for core logic testing

## System Architecture
Top-level modules and ownership boundaries:

1. `src/audio/`
- `decoder.ts`: file decode to PCM
- `feature-extractor.ts`: RMS, spectral flux, spectral centroid
- `beat-detector.ts`: BPM and beat phase estimation
- `cue-generator.ts`: produce gameplay cue timeline

2. `src/game/`
- `sim.ts`: fixed timestep simulation loop
- `entities/`: ship, enemies, projectiles, explosions
- `ai/`: autopilot movement, dodge behavior, firing logic
- `scheduler/cue-scheduler.ts`: map cue timeline to game events
- `patterns/`: enemy movement and firing pattern definitions

3. `src/render/`
- `scene.ts`: three.js scene setup
- `systems/`: entity-to-mesh sync, camera, lighting, FX placeholders

4. `src/ui/`
- audio file loader
- controls (play/pause/restart)
- debug overlays (BPM, cue markers, timing error)

## Data and Time Model
A deterministic simulation model is required for reliable cue sync.

1. Run game logic on a fixed timestep (e.g., 60Hz).
2. Keep render interpolation separate from simulation updates.
3. Maintain a canonical simulation clock in seconds.
4. Schedule events against audio-relative timestamps.
5. Use seeded randomness for reproducible scenarios during testing.

## Audio Analysis Pipeline
The pipeline should transform raw audio into robust cue points.

1. Decode
- Use `AudioContext.decodeAudioData` on user-selected file.
- Convert to mono for core feature extraction while preserving stereo optionality.

2. Feature extraction (windowed, ~10ms hop)
- RMS energy envelope
- Spectral flux (onset strength)
- Spectral centroid (brightness proxy)

3. Smoothing and normalization
- Apply EMA smoothing on noisy features.
- Normalize per-track to avoid track loudness bias.

4. Beat/BPM detection
- Build onset envelope from spectral flux.
- Estimate BPM via autocorrelation or comb filtering in a realistic BPM range (e.g., 70-180).
- Track beat phase over time and correct drift.

5. Intensity and mood proxies
- Intensity score: weighted RMS + flux.
- Mood buckets from feature combinations (calm, driving, aggressive).
- Mood is a gameplay modulator, not a music genre classifier.

6. Cue generation
- Candidate cues from strong beats and local intensity maxima.
- Quantize to beat subdivisions (1/4 or 1/8).
- Emit cue objects with timestamps and strength metadata.

## Gameplay and Sync Algorithms

### 1) Explosion-on-cue Scheduling
Goal: enemy defeat should occur on cue timestamp `tc`.

Inputs:
- ship trajectory `S(t)` from autopilot planner
- enemy path `E(t)` from selected pattern
- projectile speed `vp`

Find fire time `tf` such that projectile can intercept on cue:
- `|E(tc) - S(tf)| = vp * (tc - tf)`
- projectile direction at fire time aims at `E(tc)`

Rules:
1. Only accept valid `tf < tc` with minimum lead time and within firing cadence constraints.
2. If infeasible for current enemy lane, adjust one of:
- enemy spawn lane/pattern
- projectile angle profile
- candidate cue selection
3. Keep fallback behavior deterministic.

### 2) Autopilot Movement
Ship is not user-controlled.

1. Follow base lane drift pattern for readable movement.
2. Blend with tactical offsets from dodge module.
3. Clamp acceleration/turn-rate to avoid unnatural snapping.

### 3) Dodge Behavior
Ship cannot die but should visibly evade enemy fire.

1. Predict incoming enemy bullet trajectories over a short horizon.
2. Evaluate candidate ship offsets using a risk score (minimum distance over time).
3. Choose lowest-risk feasible path with smoothing.
4. On unavoidable hits, trigger shield flare/penalty instead of destruction.

### 4) Enemy Behavior
Start simple and extensible.

1. Render enemies as cubes for MVP.
2. Implement 3 base movement families:
- linear lane sweep
- sine-wave undulation
- spline/arc fly-in
3. Implement basic enemy fire patterns tied to intensity level.

### 5) Projectile Model

1. Ship fires angled projectiles (not only straight ahead).
2. Use pooled projectile entities for performance.
3. Enable preplanned firing solutions to satisfy cue-aligned impacts.

## Performance and Reliability Requirements

1. Target 60 FPS on a mid-tier laptop.
2. Avoid per-frame object allocation in the hot path.
3. Use object pooling for projectiles/enemies/explosions.
4. Ensure long-session stability (3+ minute audio track without memory creep).
5. Keep timing jitter low; target median cue error under ~50ms.

## Test Strategy

1. Unit tests
- beat detection stability on synthetic click tracks
- cue generation determinism
- intercept solver correctness
- dodge risk scoring behavior

2. Integration tests
- fixed-seed simulation replay consistency
- scheduler event ordering
- collision and destroy timing alignment

3. Manual verification tools
- debug timeline overlay with cue markers
- in-game markers for planned vs actual impact times
- logging for per-cue timing error distributions

## Development Workstreams (Specialized Agent Model)
If using multiple agents, split by domain and integrate frequently.

1. Agent A: Rendering/Scene
- three.js scene, camera, scrolling background, entity mesh sync, simple FX

2. Agent B: Audio Analysis
- decode, feature extraction, BPM detection, cue generator

3. Agent C: Gameplay AI and Combat
- autopilot movement, dodge logic, firing, collisions

4. Agent D: Sync Scheduler
- cue-to-event planner, intercept solver, fallback rules

5. Agent E: Integration and QA
- deterministic replay harness, profiling, balancing tools, regression checks

## Milestones and Deliverables

### Milestone 1: Foundation (1-2 days)
Deliverables:
1. Vite + TypeScript setup
2. Base three.js scene and render loop
3. Fixed timestep simulation scaffold
4. Debug HUD shell

Exit criteria:
- App boots, renders scene, and runs a deterministic simulation tick.

### Milestone 2: Audio Pipeline (2-3 days)
Deliverables:
1. Audio file upload and decode
2. Feature extraction pipeline
3. BPM estimation and beat timeline
4. Cue generation and visual timeline panel

Exit criteria:
- User can load a track and see stable cue points on a timeline.

### Milestone 3: Core Gameplay (3-4 days)
Deliverables:
1. Auto-moving ship
2. Angled projectile firing
3. Cube enemies with basic patterns
4. Collision and explosion placeholders

Exit criteria:
- Game loop has complete combat cycle without cue sync enforcement.

### Milestone 4: Audio Sync Scheduler (2-3 days)
Deliverables:
1. Cue scheduler integrated with spawn/fire planning
2. Intercept solver for cue-aligned enemy defeats
3. Fallback strategy for infeasible cues

Exit criteria:
- Majority of intended explosions land at cue timestamps within target tolerance.

### Milestone 5: Dodge and Polish (2-3 days)
Deliverables:
1. Enemy projectile system
2. Ship dodge behavior
3. Performance optimization pass
4. Deterministic replay mode and tuning constants

Exit criteria:
- Gameplay remains smooth under load and ship visibly evades threats.

## Backlog After MVP
Planned enhancements for post-v0:

1. Replace primitive enemy cubes and ship proxy with authored meshes.
2. Add shader-driven effects and richer explosion visuals.
3. Improve mood classification with optional lightweight ML model.
4. Add difficulty presets driven by audio profile.
5. Add score/combo system tied to sync accuracy.
6. Add editor/debug tools for pattern authoring.

## Risk Register and Mitigations

1. Risk: Beat detection unstable on complex tracks.
- Mitigation: combine beat confidence with adaptive smoothing and fallback subdivision strategies.

2. Risk: Intercept scheduling infeasible for some cue timings.
- Mitigation: lane/pattern adaptation and cue fallback policy with deterministic priority.

3. Risk: Browser audio clock and simulation drift.
- Mitigation: explicit synchronization strategy and periodic phase correction.

4. Risk: Performance drop from object churn.
- Mitigation: strict pooling and frame-time instrumentation from day one.

## Immediate Next Actions

1. Scaffold project structure and tooling.
2. Implement Milestone 1 foundation.
3. Implement Milestone 2 audio ingestion + cue timeline before deeper gameplay complexity.
4. Integrate scheduler early with minimal entities to validate sync assumptions.

## Definition of Done for v0

1. A user loads an audio file and starts simulation.
2. The game renders a side-scrolling 3D scene with ship, enemies, and projectiles.
3. The ship autonomously moves, dodges, and fires angled shots.
4. Enemy destruction/explosions are audibly and visually synchronized to generated cue points.
5. Performance and timing metrics meet stated targets on a representative machine.
