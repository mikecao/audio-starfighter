# Audio Starfighter

Audio Starfighter is a browser-based 3D side-scrolling shooter prototype.
It analyzes a user-provided track with Web Audio, generates cue points, and
drives game pacing and combat scheduling from that analysis.

## Current Features

- WebGL scene rendering with three.js
- Autonomous ship movement and angled firing
- Enemy spawning with multiple movement patterns
- Enemy projectile fire and ship dodge behavior
- Cue-based explosion scheduling with hit/miss tracking
- Audio intensity-driven pacing (spawn and firing pressure)
- Sync debug HUD:
  - BPM, cue count, cue hits/misses
  - average cue error
  - simulation/audio drift
  - cue queue, planned cue count, queued cue shots, cue hit rate
  - score and combo
- Audio analysis panel:
  - load and analyze audio file
  - intensity/cue timeline view with playhead
  - mood classification (`calm`, `driving`, `aggressive`)
  - synced run start/restart and playback controls
  - deterministic run seed input (persisted locally)
  - JSON export of run summary metrics

## Run

```bash
pnpm install
pnpm dev
```

## Validate

```bash
pnpm test
pnpm build
```

## Controls

- Load an audio file in the Audio Analysis panel.
- Click `Start Synced Run` to reset the simulation and begin a run aligned to cue time zero.
- Click `Restart Run` to replay the same analyzed track and current seed immediately.
- Use built-in audio controls to pause/resume playback while observing drift and cue metrics.
- Keyboard shortcuts:
  - `Space` toggles audio playback (when not focused in an input)
  - `R` restarts the current run (when not focused in an input)
