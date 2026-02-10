import { createSimulation, type SimulationSnapshot } from "./sim";

type IntensitySample = {
  timeSeconds: number;
  intensity: number;
};

type MoodProfile = "calm" | "driving" | "aggressive";

export type PrecomputedRun = {
  stepSeconds: number;
  durationSeconds: number;
  snapshots: SimulationSnapshot[];
  buildMs: number;
  estimatedBytes: number;
  getSnapshotAtTime: (timeSeconds: number) => SimulationSnapshot;
};

export function buildPrecomputedRun(params: {
  seed: number;
  moodProfile: MoodProfile;
  intensityTimeline: IntensitySample[];
  cueTimesSeconds: number[];
  durationSeconds: number;
  stepSeconds?: number;
}): PrecomputedRun {
  const buildStartMs = performance.now();
  const stepSeconds = params.stepSeconds ?? 1 / 180;
  const sim = createSimulation();
  sim.setRandomSeed(params.seed);
  sim.setMoodProfile(params.moodProfile);
  sim.setIntensityTimeline(params.intensityTimeline);
  sim.startTrackRun(params.cueTimesSeconds);

  const snapshots: SimulationSnapshot[] = [];
  const totalDurationSeconds = Math.max(0, params.durationSeconds) + 3;
  const totalSteps = Math.max(1, Math.ceil(totalDurationSeconds / stepSeconds));

  snapshots.push(sim.getSnapshot());
  for (let i = 0; i < totalSteps; i += 1) {
    sim.step(stepSeconds);
    snapshots.push(sim.getSnapshot());
  }

  const fallbackSnapshot = snapshots[snapshots.length - 1];
  const lookup = buildMillisecondIndexLookup(totalDurationSeconds, stepSeconds, snapshots.length);

  return {
    stepSeconds,
    durationSeconds: totalDurationSeconds,
    snapshots,
    buildMs: performance.now() - buildStartMs,
    estimatedBytes: estimateSnapshotBytes(snapshots),
    getSnapshotAtTime(timeSeconds) {
      if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
        return snapshots[0];
      }

      const clampedMs = Math.max(
        0,
        Math.min(lookup.length - 1, Math.floor(timeSeconds * 1000))
      );
      const index = lookup[clampedMs];
      return snapshots[index] ?? fallbackSnapshot;
    }
  };
}

function buildMillisecondIndexLookup(
  durationSeconds: number,
  stepSeconds: number,
  snapshotCount: number
): Uint32Array {
  const maxMs = Math.max(1, Math.ceil(durationSeconds * 1000));
  const lookup = new Uint32Array(maxMs + 1);
  const maxIndex = Math.max(0, snapshotCount - 1);

  for (let ms = 0; ms <= maxMs; ms += 1) {
    const timeSeconds = ms / 1000;
    const index = Math.round(timeSeconds / stepSeconds);
    lookup[ms] = Math.min(maxIndex, Math.max(0, index));
  }

  return lookup;
}

function estimateSnapshotBytes(snapshots: SimulationSnapshot[]): number {
  let bytes = 0;
  for (const snapshot of snapshots) {
    bytes += 26 * 8;
    bytes += snapshot.enemies.length * 5 * 8;
    bytes += snapshot.projectiles.length * 5 * 8;
    bytes += snapshot.enemyProjectiles.length * 4 * 8;
    bytes += snapshot.laserBeams.length * 5 * 8;
    bytes += snapshot.explosions.length * 6 * 8;
  }
  return bytes;
}
