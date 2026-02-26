# Audio Starfighter

Audio Starfighter is a browser-based 3D side-scrolling shooter that syncs combat
events to analyzed audio cues. The app ingests a track, precomputes a deterministic
run timeline, and renders a replay-style simulation aligned to playback time.

## Live Demo

https://audio-starfighter.vercel.app

## What It Does

- Analyzes user-provided audio (`BPM`, mood, frame intensity, beat/cue timings)
- Builds a precomputed simulation cache and drives runtime from time-indexed snapshots
- Schedules cue-linked enemy explosions with hit/miss tracking and timing diagnostics
- Uses a player-like autonomous ship controller with predictive projectile dodging
- Renders three.js combat visuals with intensity-reactive, palette-varied explosions
- Samples a live spectrum analyzer (`FFT_SIZE=1024`, reactive window `0..6000Hz`)
- Converts analyzer dB bins to magnitudes for normalized, track-adaptive visual reactivity
- Supports runtime waveform-plane visual controls without forcing simulation recompute

## Core Features

- **Replay-style runtime**
  - precomputed run snapshots (`src/game/precomputedRun.ts`)
  - millisecond lookup for low realtime CPU overhead
  - seek-friendly behavior tied to audio clock
- **Cue/event synchronization**
  - cue-first timeline selection (beat fallback only when needed)
  - quiet-intro gating to avoid false early beat explosions
  - cue resolution metrics (hit/miss/error)
- **Combat simulation**
  - diverse enemy movement (`straight`, `sine`, `arc`, `zigzag`, `weave`)
  - optional green triangle enemy formations (tetrahedron-rendered) with chained flight paths
  - enemy projectile style toggle (`balls` or `lasers`)
  - cue reservation for enemy availability near cue time
  - green cleanup/causality laser beam effects
- **Rendering and VFX**
  - orthographic side-scroller camera framing
  - multi-layer parallax starfield
  - explosion core + ring + spark particles
  - explosion power scaled by per-track relative intensity range
  - audio-reactive waveform terrain plane with independent surface and wireframe materials
  - waveform plane controls: enable/disable, max height, separate surface/wireframe colors
  - surface shading modes: `smooth`, `flat`, `matte`, `metallic`
- **Debug and tooling UI**
  - cue rail showing upcoming events crossing `NOW`
  - audio analysis panel with waveform/cue timeline and playback controls
  - live spectrum analyzer bars between waveform timeline and playback controls
  - settings modal with ship/enemy/visual controls applied live
  - debug HUD with sync/combat/precompute telemetry
  - `Hide UI` toggle for canvas-focused view
  - run summary JSON export

## Project Structure

- `src/main.ts` - app orchestration, audio/sim/render loop, UI wiring
- `src/game/sim.ts` - gameplay simulation, cue scheduling, ship/enemy logic
- `src/game/precomputedRun.ts` - precompute pipeline + time-indexed snapshot lookup
- `src/render/scene.ts` - three.js scene setup and frame rendering
- `src/audio/*` - decode, feature extraction, beat detection, cue generation, mood
- `src/ui/*` - audio panel, debug HUD, event timeline
- `src/styles.css` - layout and UI theming

## Run

```bash
pnpm install
pnpm dev
```

Open the Vite URL, load a track, and the app auto-starts a synced run once analysis completes.

## Validate

```bash
pnpm test
pnpm build
```

## Controls

- Load audio via the **Audio Analysis** panel (`Choose File`)
- Playback: native audio controls or `Space`
- Restart run: `R`
- Toggle overlay UI: `Hide UI` / `Show UI` button
- Open **Settings** to change ship, enemy, and waveform-plane visual options
- Waveform-plane visual-only settings apply immediately and do not trigger run recompute

## Notes

- Seeded runs are deterministic for a given analysis + seed.
- Best score and run seed are stored locally in browser storage.
- Precompute stats in HUD show snapshot count, build time, and memory estimate.

## License

MIT
