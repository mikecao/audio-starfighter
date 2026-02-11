import { createSimulation, type SimulationSnapshot } from "./sim";
import type { CombatConfigPatch } from "./combatConfig";

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

type BuildPrecomputedRunParams = {
  seed: number;
  moodProfile: MoodProfile;
  intensityTimeline: IntensitySample[];
  cueTimesSeconds: number[];
  durationSeconds: number;
  stepSeconds?: number;
  enemyBulletRatio?: number;
  combatConfig?: CombatConfigPatch;
};

export function buildPrecomputedRun(params: BuildPrecomputedRunParams): PrecomputedRun {
  const buildStartMs = performance.now();
  const stepSeconds = params.stepSeconds ?? 1 / 180;
  const sim = createSimulation();
  sim.setRandomSeed(params.seed);
  sim.setMoodProfile(params.moodProfile);
  if (params.combatConfig) {
    sim.setCombatConfig(params.combatConfig);
  }
  if (typeof params.enemyBulletRatio === "number" && Number.isFinite(params.enemyBulletRatio)) {
    sim.setEnemyBulletRatio(params.enemyBulletRatio);
  }
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

  return finalizePrecomputedRun(buildStartMs, stepSeconds, totalDurationSeconds, snapshots);
}

export async function buildPrecomputedRunAsync(
  params: BuildPrecomputedRunParams,
  options: {
    onProgress?: (progress: number) => void;
    chunkSize?: number;
  } = {}
): Promise<PrecomputedRun> {
  const buildStartMs = performance.now();
  const stepSeconds = params.stepSeconds ?? 1 / 180;
  const sim = createSimulation();
  sim.setRandomSeed(params.seed);
  sim.setMoodProfile(params.moodProfile);
  if (params.combatConfig) {
    sim.setCombatConfig(params.combatConfig);
  }
  if (typeof params.enemyBulletRatio === "number" && Number.isFinite(params.enemyBulletRatio)) {
    sim.setEnemyBulletRatio(params.enemyBulletRatio);
  }
  sim.setIntensityTimeline(params.intensityTimeline);
  sim.startTrackRun(params.cueTimesSeconds);

  const snapshots: SimulationSnapshot[] = [];
  const totalDurationSeconds = Math.max(0, params.durationSeconds) + 3;
  const totalSteps = Math.max(1, Math.ceil(totalDurationSeconds / stepSeconds));
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 240));

  options.onProgress?.(0);
  snapshots.push(sim.getSnapshot());

  for (let start = 0; start < totalSteps; start += chunkSize) {
    const end = Math.min(totalSteps, start + chunkSize);
    for (let i = start; i < end; i += 1) {
      sim.step(stepSeconds);
      snapshots.push(sim.getSnapshot());
    }
    options.onProgress?.(Math.min(1, end / totalSteps));
    if (end < totalSteps) {
      await waitForNextFrame();
    }
  }

  options.onProgress?.(1);
  return finalizePrecomputedRun(buildStartMs, stepSeconds, totalDurationSeconds, snapshots);
}

function finalizePrecomputedRun(
  buildStartMs: number,
  stepSeconds: number,
  totalDurationSeconds: number,
  snapshots: SimulationSnapshot[]
): PrecomputedRun {
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

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
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
    bytes += snapshot.projectiles.length * 6 * 8;
    bytes += snapshot.enemyProjectiles.length * 4 * 8;
    bytes += snapshot.laserBeams.length * 5 * 8;
    bytes += snapshot.explosions.length * 7 * 8;
  }
  return bytes;
}
