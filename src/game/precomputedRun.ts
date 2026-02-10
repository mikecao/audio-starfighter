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
  const stepSeconds = params.stepSeconds ?? 1 / 60;
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
  const estimatedBytes = estimateSnapshotBytes(snapshots);
  const buildMs = performance.now() - buildStartMs;

  return {
    stepSeconds,
    durationSeconds: totalDurationSeconds,
    snapshots,
    buildMs,
    estimatedBytes,
    getSnapshotAtTime(timeSeconds) {
      if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
        return snapshots[0];
      }
      const index = Math.floor(timeSeconds / stepSeconds);
      if (index < 0) {
        return snapshots[0];
      }
      if (index >= snapshots.length) {
        return fallbackSnapshot;
      }
      return snapshots[index];
    }
  };
}

function estimateSnapshotBytes(snapshots: SimulationSnapshot[]): number {
  let bytes = 0;
  for (const snapshot of snapshots) {
    bytes += 24 * 8;
    bytes += snapshot.enemies.length * 5 * 8;
    bytes += snapshot.projectiles.length * 4 * 8;
    bytes += snapshot.enemyProjectiles.length * 3 * 8;
    bytes += snapshot.explosions.length * 5 * 8;
  }
  return bytes;
}
