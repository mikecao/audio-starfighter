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
  const stepSeconds = params.stepSeconds ?? 1 / 120;
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
      const exactIndex = timeSeconds / stepSeconds;
      const indexA = Math.floor(exactIndex);
      const indexB = indexA + 1;
      const blend = clamp01(exactIndex - indexA);

      if (indexA < 0) {
        return snapshots[0];
      }
      if (indexA >= snapshots.length) {
        return fallbackSnapshot;
      }

      const snapshotA = snapshots[indexA];
      const snapshotB = snapshots[Math.min(indexB, snapshots.length - 1)] ?? snapshotA;
      if (blend <= 0 || snapshotA === snapshotB) {
        return snapshotA;
      }
      return blendSnapshots(snapshotA, snapshotB, blend);
    }
  };
}

function blendSnapshots(a: SimulationSnapshot, b: SimulationSnapshot, t: number): SimulationSnapshot {
  return {
    simTimeSeconds: lerp(a.simTimeSeconds, b.simTimeSeconds, t),
    simTick: t < 0.5 ? a.simTick : b.simTick,
    ship: {
      x: lerp(a.ship.x, b.ship.x, t),
      y: lerp(a.ship.y, b.ship.y, t),
      z: lerp(a.ship.z, b.ship.z, t)
    },
    enemyCount: t < 0.5 ? a.enemyCount : b.enemyCount,
    projectileCount: t < 0.5 ? a.projectileCount : b.projectileCount,
    enemies: blendEnemies(a.enemies, b.enemies, t),
    projectiles: blendProjectiles(a.projectiles, b.projectiles, t),
    enemyProjectiles: blendEnemyProjectiles(a.enemyProjectiles, b.enemyProjectiles, t),
    explosions: blendExplosions(a.explosions, b.explosions, t),
    shieldAlpha: lerp(a.shieldAlpha, b.shieldAlpha, t),
    cueResolvedCount: t < 0.5 ? a.cueResolvedCount : b.cueResolvedCount,
    cueMissedCount: t < 0.5 ? a.cueMissedCount : b.cueMissedCount,
    avgCueErrorMs: lerp(a.avgCueErrorMs, b.avgCueErrorMs, t),
    currentIntensity: lerp(a.currentIntensity, b.currentIntensity, t),
    score: t < 0.5 ? a.score : b.score,
    combo: t < 0.5 ? a.combo : b.combo,
    pendingCueCount: t < 0.5 ? a.pendingCueCount : b.pendingCueCount,
    plannedCueCount: t < 0.5 ? a.plannedCueCount : b.plannedCueCount,
    queuedCueShotCount: t < 0.5 ? a.queuedCueShotCount : b.queuedCueShotCount,
    upcomingCueWindowCount: t < 0.5 ? a.upcomingCueWindowCount : b.upcomingCueWindowCount,
    availableCueTargetCount: t < 0.5 ? a.availableCueTargetCount : b.availableCueTargetCount,
    moodProfile: t < 0.5 ? a.moodProfile : b.moodProfile
  };
}

function blendEnemies(
  a: SimulationSnapshot["enemies"],
  b: SimulationSnapshot["enemies"],
  t: number
): SimulationSnapshot["enemies"] {
  const count = Math.min(a.length, b.length);
  const out: SimulationSnapshot["enemies"] = [];
  for (let i = 0; i < count; i += 1) {
    const ea = a[i];
    const eb = b[i];
    out.push({
      x: lerp(ea.x, eb.x, t),
      y: lerp(ea.y, eb.y, t),
      z: lerp(ea.z, eb.z, t),
      rotationZ: lerpAngle(ea.rotationZ, eb.rotationZ, t),
      damageFlash: lerp(ea.damageFlash, eb.damageFlash, t)
    });
  }
  if (t < 0.5) {
    for (let i = count; i < a.length; i += 1) {
      out.push(a[i]);
    }
  } else {
    for (let i = count; i < b.length; i += 1) {
      out.push(b[i]);
    }
  }
  return out;
}

function blendProjectiles(
  a: SimulationSnapshot["projectiles"],
  b: SimulationSnapshot["projectiles"],
  t: number
): SimulationSnapshot["projectiles"] {
  const out: SimulationSnapshot["projectiles"] = [];
  const byIdB = new Map<number, SimulationSnapshot["projectiles"][number]>();
  for (const projectile of b) {
    byIdB.set(projectile.id, projectile);
  }

  const seen = new Set<number>();
  for (const pa of a) {
    const pb = byIdB.get(pa.id);
    if (pb) {
      out.push({
        id: pa.id,
        x: lerp(pa.x, pb.x, t),
        y: lerp(pa.y, pb.y, t),
        z: lerp(pa.z, pb.z, t),
        rotationZ: lerpAngle(pa.rotationZ, pb.rotationZ, t)
      });
      seen.add(pa.id);
      continue;
    }
    if (t < 0.5) {
      out.push(pa);
    }
  }

  if (t >= 0.5) {
    for (const pb of b) {
      if (!seen.has(pb.id)) {
        out.push(pb);
      }
    }
  }
  return out;
}

function blendEnemyProjectiles(
  a: SimulationSnapshot["enemyProjectiles"],
  b: SimulationSnapshot["enemyProjectiles"],
  t: number
): SimulationSnapshot["enemyProjectiles"] {
  const out: SimulationSnapshot["enemyProjectiles"] = [];
  const byIdB = new Map<number, SimulationSnapshot["enemyProjectiles"][number]>();
  for (const projectile of b) {
    byIdB.set(projectile.id, projectile);
  }

  const seen = new Set<number>();
  for (const pa of a) {
    const pb = byIdB.get(pa.id);
    if (pb) {
      out.push({
        id: pa.id,
        x: lerp(pa.x, pb.x, t),
        y: lerp(pa.y, pb.y, t),
        z: lerp(pa.z, pb.z, t)
      });
      seen.add(pa.id);
      continue;
    }
    if (t < 0.5) {
      out.push(pa);
    }
  }

  if (t >= 0.5) {
    for (const pb of b) {
      if (!seen.has(pb.id)) {
        out.push(pb);
      }
    }
  }
  return out;
}

function blendExplosions(
  a: SimulationSnapshot["explosions"],
  b: SimulationSnapshot["explosions"],
  t: number
): SimulationSnapshot["explosions"] {
  const count = Math.min(a.length, b.length);
  const out: SimulationSnapshot["explosions"] = [];
  for (let i = 0; i < count; i += 1) {
    const ea = a[i];
    const eb = b[i];
    out.push({
      x: lerp(ea.x, eb.x, t),
      y: lerp(ea.y, eb.y, t),
      z: lerp(ea.z, eb.z, t),
      scale: lerp(ea.scale, eb.scale, t),
      alpha: lerp(ea.alpha, eb.alpha, t),
      variant: t < 0.5 ? ea.variant : eb.variant
    });
  }
  if (t < 0.5) {
    for (let i = count; i < a.length; i += 1) {
      out.push(a[i]);
    }
  } else {
    for (let i = count; i < b.length; i += 1) {
      out.push(b[i]);
    }
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  return a + delta * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
