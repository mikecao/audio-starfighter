export type SimulationSnapshot = {
  simTimeSeconds: number;
  simTick: number;
  ship: {
    x: number;
    y: number;
    z: number;
  };
  enemyCount: number;
  projectileCount: number;
  enemies: Array<{
    x: number;
    y: number;
    z: number;
    rotationZ: number;
  }>;
  projectiles: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  enemyProjectiles: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  explosions: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    alpha: number;
  }>;
  shieldAlpha: number;
  cueResolvedCount: number;
  cueMissedCount: number;
  avgCueErrorMs: number;
  currentIntensity: number;
  score: number;
  combo: number;
  pendingCueCount: number;
  plannedCueCount: number;
};

type EnemyPattern = "straight" | "sine" | "arc";

type Enemy = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  ageSeconds: number;
  pattern: EnemyPattern;
  baseY: number;
  phase: number;
  amplitude: number;
  frequency: number;
  radius: number;
  fireCooldownSeconds: number;
  scheduledCueTime: number | null;
};

type Projectile = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  ageSeconds: number;
  maxLifetimeSeconds: number;
  radius: number;
};

type EnemyProjectile = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  ageSeconds: number;
  maxLifetimeSeconds: number;
  radius: number;
};

type Explosion = {
  x: number;
  y: number;
  z: number;
  ageSeconds: number;
  lifetimeSeconds: number;
};

type ScheduledCue = {
  timeSeconds: number;
  planned: boolean;
  assignedEnemyId: number | null;
};

type PlannedCueShot = {
  cueTimeSeconds: number;
  enemyId: number;
  fireTimeSeconds: number;
};

type IntensitySample = {
  timeSeconds: number;
  intensity: number;
};

type SimulationState = {
  simTimeSeconds: number;
  simTick: number;
  shipX: number;
  shipY: number;
  shipShieldAlpha: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  explosions: Explosion[];
  nextEnemySpawnTime: number;
  nextPlayerFireTime: number;
  spawnIndex: number;
  nextEnemyId: number;
  cueTimeline: ScheduledCue[];
  cueStartOffsetSeconds: number;
  cueResolvedCount: number;
  cueMissedCount: number;
  cumulativeCueErrorMs: number;
  plannedCueShots: PlannedCueShot[];
  score: number;
  combo: number;
  intensityTimeline: IntensitySample[];
  randomSeed: number;
  rng: () => number;
};

export type Simulation = {
  step: (deltaSeconds: number) => void;
  getSnapshot: () => SimulationSnapshot;
  setCueTimeline: (cueTimesSeconds: number[]) => void;
  startTrackRun: (cueTimesSeconds: number[]) => void;
  setIntensityTimeline: (samples: IntensitySample[]) => void;
  setRandomSeed: (seed: number) => void;
};

export function createSimulation(): Simulation {
  const state: SimulationState = {
    simTimeSeconds: 0,
    simTick: 0,
    shipX: -6,
    shipY: 0,
    shipShieldAlpha: 0,
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    explosions: [],
    nextEnemySpawnTime: 0.4,
    nextPlayerFireTime: 0.2,
    spawnIndex: 0,
    nextEnemyId: 1,
    cueTimeline: [],
    cueStartOffsetSeconds: 0,
    cueResolvedCount: 0,
    cueMissedCount: 0,
    cumulativeCueErrorMs: 0,
    plannedCueShots: [],
    score: 0,
    combo: 0,
    intensityTimeline: [],
    randomSeed: 7,
    rng: createMulberry32(7)
  };

  return {
    step(deltaSeconds: number) {
      state.simTimeSeconds += deltaSeconds;
      state.simTick += 1;

      state.shipX = -6 + Math.sin(state.simTimeSeconds * 0.35) * 0.75;
      const baseY = Math.sin(state.simTimeSeconds * 1.4) * 1.8;
      state.shipY = steerShipY(state, baseY, deltaSeconds);

      spawnEnemies(state);
      planCueShots(state);
      fireQueuedCueShots(state);
      fireProjectiles(state);
      updateEnemies(state, deltaSeconds);
      updateProjectiles(state, deltaSeconds);
      updateEnemyProjectiles(state, deltaSeconds);
      updateExplosions(state, deltaSeconds);
      resolvePlayerProjectileCollisions(state);
      resolveEnemyProjectileShipCollisions(state);
      resolveDueCueExplosions(state);

      state.shipShieldAlpha = Math.max(0, state.shipShieldAlpha - deltaSeconds * 2.8);

      state.enemies = state.enemies.filter((enemy) => enemy.x > -16);
      state.projectiles = state.projectiles.filter(
        (projectile) =>
          projectile.ageSeconds < projectile.maxLifetimeSeconds &&
          projectile.x > -15 &&
          projectile.x < 20 &&
          Math.abs(projectile.y) < 11
      );
      state.enemyProjectiles = state.enemyProjectiles.filter(
        (projectile) =>
          projectile.ageSeconds < projectile.maxLifetimeSeconds &&
          projectile.x > -18 &&
          projectile.x < 16 &&
          Math.abs(projectile.y) < 11
      );
      state.explosions = state.explosions.filter(
        (explosion) => explosion.ageSeconds < explosion.lifetimeSeconds
      );
    },
    getSnapshot() {
      return {
        simTimeSeconds: state.simTimeSeconds,
        simTick: state.simTick,
        ship: {
          x: state.shipX,
          y: state.shipY,
          z: 0
        },
        enemyCount: state.enemies.length,
        projectileCount: state.projectiles.length + state.enemyProjectiles.length,
        enemies: state.enemies.map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          z: enemy.z,
          rotationZ: enemy.phase + enemy.ageSeconds * 2
        })),
        projectiles: state.projectiles.map((projectile) => ({
          x: projectile.x,
          y: projectile.y,
          z: projectile.z
        })),
        enemyProjectiles: state.enemyProjectiles.map((projectile) => ({
          x: projectile.x,
          y: projectile.y,
          z: projectile.z
        })),
        explosions: state.explosions.map((explosion) => {
          const normalizedAge =
            explosion.ageSeconds / Math.max(explosion.lifetimeSeconds, 1e-6);
          return {
            x: explosion.x,
            y: explosion.y,
            z: explosion.z,
            scale: 0.5 + normalizedAge * 1.5,
            alpha: 1 - normalizedAge
          };
        }),
        shieldAlpha: state.shipShieldAlpha,
        cueResolvedCount: state.cueResolvedCount,
        cueMissedCount: state.cueMissedCount,
        avgCueErrorMs:
          state.cueResolvedCount > 0
            ? state.cumulativeCueErrorMs / state.cueResolvedCount
            : 0,
        currentIntensity: getIntensityAtTime(state, state.simTimeSeconds),
        score: state.score,
        combo: state.combo,
        pendingCueCount: state.cueTimeline.length,
        plannedCueCount: countPlannedCues(state.cueTimeline)
      };
    },
    setCueTimeline(cueTimesSeconds) {
      state.cueStartOffsetSeconds = state.simTimeSeconds;
      state.cueResolvedCount = 0;
      state.cueMissedCount = 0;
      state.cumulativeCueErrorMs = 0;
      state.plannedCueShots = [];
      for (const enemy of state.enemies) {
        enemy.scheduledCueTime = null;
      }
      state.cueTimeline = cueTimesSeconds
        .filter((time) => Number.isFinite(time) && time >= 0)
        .map((time) => ({
          timeSeconds: state.cueStartOffsetSeconds + time,
          planned: false,
          assignedEnemyId: null
        }));
    },
    startTrackRun(cueTimesSeconds) {
      resetRunState(state);
      state.cueTimeline = cueTimesSeconds
        .filter((time) => Number.isFinite(time) && time >= 0)
        .map((time) => ({
          timeSeconds: time,
          planned: false,
          assignedEnemyId: null
        }));
    },
    setIntensityTimeline(samples) {
      state.intensityTimeline = samples
        .filter((sample) => Number.isFinite(sample.timeSeconds))
        .map((sample) => ({
          timeSeconds: Math.max(0, sample.timeSeconds),
          intensity: clamp(sample.intensity, 0, 1)
        }))
        .sort((a, b) => a.timeSeconds - b.timeSeconds);
    },
    setRandomSeed(seed) {
      const normalized = normalizeSeed(seed);
      state.randomSeed = normalized;
      state.rng = createMulberry32(normalized);
    }
  };
}

function resetRunState(state: SimulationState): void {
  state.simTimeSeconds = 0;
  state.simTick = 0;
  state.shipX = -6;
  state.shipY = 0;
  state.shipShieldAlpha = 0;
  state.enemies = [];
  state.projectiles = [];
  state.enemyProjectiles = [];
  state.explosions = [];
  state.nextEnemySpawnTime = 0.4;
  state.nextPlayerFireTime = 0.2;
  state.spawnIndex = 0;
  state.nextEnemyId = 1;
  state.cueResolvedCount = 0;
  state.cueMissedCount = 0;
  state.cumulativeCueErrorMs = 0;
  state.plannedCueShots = [];
  state.score = 0;
  state.combo = 0;
  state.cueStartOffsetSeconds = 0;
  state.rng = createMulberry32(state.randomSeed);
}

function spawnEnemies(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextEnemySpawnTime) {
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const lane = (state.spawnIndex % 5) - 2;
    const patternSelector = state.spawnIndex % 3;
    const pattern: EnemyPattern =
      patternSelector === 0 ? "straight" : patternSelector === 1 ? "sine" : "arc";

    state.enemies.push({
      id: state.nextEnemyId++,
      x: 13 + state.rng() * 2.5,
      y: lane * 1.6,
      z: 0,
      vx: -2.5 - intensity * 1.8 - state.rng() * 0.95,
      ageSeconds: 0,
      pattern,
      baseY: lane * 1.6,
      phase: state.rng() * Math.PI * 2,
      amplitude: 0.35 + state.rng() * 1.25,
      frequency: 1 + state.rng() * 1.4,
      radius: 0.44,
      fireCooldownSeconds: 0.5 + (1 - intensity) * 0.8 + state.rng() * 0.5,
      scheduledCueTime: null
    });

    state.spawnIndex += 1;
    const cadence = 0.9 - intensity * 0.5;
    state.nextEnemySpawnTime += clamp(cadence + state.rng() * 0.35, 0.28, 1.1);
  }
}

function fireProjectiles(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextPlayerFireTime) {
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const projectileSpeed = 14;
    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;

    const target = findBestTarget(state.enemies, shipX, shipY);
    let directionX = 1;
    let directionY = Math.sin(state.simTimeSeconds * 1.7) * 0.18;

    if (target) {
      const dx = target.x - shipX;
      const dy = target.y - shipY;
      const mag = Math.hypot(dx, dy);
      if (mag > 1e-6) {
        directionX = dx / mag;
        directionY = dy / mag;
      }
    }

    state.projectiles.push({
      x: shipX,
      y: shipY,
      z: 0,
      vx: directionX * projectileSpeed,
      vy: directionY * projectileSpeed,
      ageSeconds: 0,
      maxLifetimeSeconds: 1.45,
      radius: 0.16
    });

    const interval = 0.2 - intensity * 0.08;
    state.nextPlayerFireTime += clamp(interval, 0.1, 0.24);
  }
}

function updateEnemies(state: SimulationState, deltaSeconds: number): void {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);

  for (const enemy of state.enemies) {
    enemy.ageSeconds += deltaSeconds;
    enemy.x += enemy.vx * deltaSeconds;

    if (enemy.pattern === "straight") {
      enemy.y = enemy.baseY;
    } else if (enemy.pattern === "sine") {
      enemy.y =
        enemy.baseY +
        Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency) * enemy.amplitude;
    } else {
      enemy.y =
        enemy.baseY +
        Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency * 1.2) *
          (enemy.amplitude * 0.55) +
        Math.sin(enemy.ageSeconds * 0.9) * 0.45;
    }

    enemy.fireCooldownSeconds -= deltaSeconds;
    if (enemy.fireCooldownSeconds <= 0 && enemy.x > state.shipX + 2.5) {
      spawnEnemyProjectile(state, enemy);
      enemy.fireCooldownSeconds = 0.5 + (1 - intensity) * 1 + state.rng() * 0.55;
    }
  }
}

function updateProjectiles(state: SimulationState, deltaSeconds: number): void {
  for (const projectile of state.projectiles) {
    projectile.ageSeconds += deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
  }
}

function updateEnemyProjectiles(state: SimulationState, deltaSeconds: number): void {
  for (const projectile of state.enemyProjectiles) {
    projectile.ageSeconds += deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
  }
}

function updateExplosions(state: SimulationState, deltaSeconds: number): void {
  for (const explosion of state.explosions) {
    explosion.ageSeconds += deltaSeconds;
  }
}

function resolvePlayerProjectileCollisions(state: SimulationState): void {
  const destroyedEnemies = new Set<number>();
  const destroyedProjectiles = new Set<number>();

  for (let p = 0; p < state.projectiles.length; p += 1) {
    const projectile = state.projectiles[p];

    for (let e = 0; e < state.enemies.length; e += 1) {
      if (destroyedEnemies.has(e)) {
        continue;
      }

      const enemy = state.enemies[e];
      const dx = enemy.x - projectile.x;
      const dy = enemy.y - projectile.y;
      const radius = enemy.radius + projectile.radius;
      if (dx * dx + dy * dy <= radius * radius) {
        destroyedEnemies.add(e);
        destroyedProjectiles.add(p);
        spawnExplosion(state, enemy.x, enemy.y, enemy.z);
        break;
      }
    }
  }

  if (destroyedEnemies.size > 0) {
    state.enemies = state.enemies.filter((_, index) => !destroyedEnemies.has(index));
  }
  if (destroyedProjectiles.size > 0) {
    state.projectiles = state.projectiles.filter(
      (_, index) => !destroyedProjectiles.has(index)
    );
  }
}

function resolveEnemyProjectileShipCollisions(state: SimulationState): void {
  const kept: EnemyProjectile[] = [];

  for (const projectile of state.enemyProjectiles) {
    const dx = projectile.x - state.shipX;
    const dy = projectile.y - state.shipY;
    const radius = projectile.radius + 0.52;
    if (dx * dx + dy * dy <= radius * radius) {
      state.shipShieldAlpha = 1;
      continue;
    }

    kept.push(projectile);
  }

  state.enemyProjectiles = kept;
}

function planCueShots(state: SimulationState): void {
  if (state.cueTimeline.length === 0 || state.enemies.length === 0) {
    return;
  }

  for (const cue of state.cueTimeline) {
    if (cue.planned) {
      continue;
    }

    const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
    if (leadSeconds < 0.2 || leadSeconds > 0.9) {
      continue;
    }

    const candidate = findCueCandidate(state, cue.timeSeconds);
    if (!candidate) {
      continue;
    }

    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;
    const dx = candidate.futureX - shipX;
    const dy = candidate.futureY - shipY;
    const projectileSpeed = 14;
    const requiredLeadSeconds = Math.hypot(dx, dy) / projectileSpeed;
    const fireTimeSeconds = cue.timeSeconds - requiredLeadSeconds;
    if (fireTimeSeconds < state.simTimeSeconds || fireTimeSeconds > cue.timeSeconds) {
      continue;
    }

    candidate.enemy.scheduledCueTime = cue.timeSeconds;
    cue.planned = true;
    cue.assignedEnemyId = candidate.enemy.id;
    state.plannedCueShots.push({
      cueTimeSeconds: cue.timeSeconds,
      enemyId: candidate.enemy.id,
      fireTimeSeconds
    });
  }
}

function fireQueuedCueShots(state: SimulationState): void {
  if (state.plannedCueShots.length === 0) {
    return;
  }

  const remainingShots: PlannedCueShot[] = [];
  for (const shot of state.plannedCueShots) {
    if (shot.fireTimeSeconds > state.simTimeSeconds) {
      remainingShots.push(shot);
      continue;
    }

    const enemy = state.enemies.find((candidate) => candidate.id === shot.enemyId);
    if (!enemy) {
      continue;
    }

    const leadSeconds = shot.cueTimeSeconds - state.simTimeSeconds;
    if (leadSeconds <= 0.02) {
      continue;
    }

    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;
    const future = predictEnemyPosition(enemy, leadSeconds);
    const dx = future.x - shipX;
    const dy = future.y - shipY;

    state.projectiles.push({
      x: shipX,
      y: shipY,
      z: 0,
      vx: dx / leadSeconds,
      vy: dy / leadSeconds,
      ageSeconds: 0,
      maxLifetimeSeconds: leadSeconds + 0.12,
      radius: 0.16
    });
  }

  state.plannedCueShots = remainingShots;
}

function resolveDueCueExplosions(state: SimulationState): void {
  if (state.cueTimeline.length === 0) {
    return;
  }

  while (
    state.cueTimeline.length > 0 &&
    state.cueTimeline[0].timeSeconds <= state.simTimeSeconds
  ) {
    const cue = state.cueTimeline.shift();
    if (!cue) {
      break;
    }
    const cueErrorMs = Math.abs(state.simTimeSeconds - cue.timeSeconds) * 1000;

    const targetIndex =
      cue.assignedEnemyId === null
        ? -1
        : state.enemies.findIndex((enemy) => enemy.id === cue.assignedEnemyId);

    if (targetIndex >= 0 && scheduledEnemyHasPlayerShotNearby(state, state.enemies[targetIndex])) {
      const enemy = state.enemies[targetIndex];
      spawnExplosion(state, enemy.x, enemy.y, enemy.z);
      state.enemies.splice(targetIndex, 1);
      state.cueResolvedCount += 1;
      state.cumulativeCueErrorMs += cueErrorMs;
      state.combo += 1;
      state.score += 100 + Math.min(900, state.combo * 10);
    } else {
      state.cueMissedCount += 1;
      state.combo = 0;
    }
  }
}

function scheduledEnemyHasPlayerShotNearby(state: SimulationState, enemy: Enemy): boolean {
  const hitRadius = enemy.radius + 0.28;
  const hitRadiusSq = hitRadius * hitRadius;

  for (const projectile of state.projectiles) {
    const dx = projectile.x - enemy.x;
    const dy = projectile.y - enemy.y;
    if (dx * dx + dy * dy <= hitRadiusSq) {
      return true;
    }
  }

  return false;
}

function findCueCandidate(
  state: SimulationState,
  cueTimeSeconds: number
): { enemy: Enemy; futureX: number; futureY: number } | null {
  let best: { enemy: Enemy; futureX: number; futureY: number } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of state.enemies) {
    if (enemy.scheduledCueTime !== null || enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
      continue;
    }

    const dt = cueTimeSeconds - state.simTimeSeconds;
    if (dt <= 0) {
      continue;
    }

    const future = predictEnemyPosition(enemy, dt);
    const dx = future.x - state.shipX;
    const dy = future.y - state.shipY;
    const score = Math.abs(dy) * 1.5 + dx * 0.4;

    if (future.x <= state.shipX + 0.8 || future.x >= 18) {
      continue;
    }

    if (score < bestScore) {
      bestScore = score;
      best = {
        enemy,
        futureX: future.x,
        futureY: future.y
      };
    }
  }

  return best;
}

function enemyAlreadyAssignedToCue(cues: ScheduledCue[], enemyId: number): boolean {
  for (const cue of cues) {
    if (cue.assignedEnemyId === enemyId) {
      return true;
    }
  }
  return false;
}

function countPlannedCues(cues: ScheduledCue[]): number {
  let count = 0;
  for (const cue of cues) {
    if (cue.planned) {
      count += 1;
    }
  }
  return count;
}

function predictEnemyPosition(enemy: Enemy, dt: number): { x: number; y: number } {
  const age = enemy.ageSeconds + dt;
  const x = enemy.x + enemy.vx * dt;
  let y = enemy.baseY;

  if (enemy.pattern === "sine") {
    y = enemy.baseY + Math.sin(enemy.phase + age * enemy.frequency) * enemy.amplitude;
  } else if (enemy.pattern === "arc") {
    y =
      enemy.baseY +
      Math.sin(enemy.phase + age * enemy.frequency * 1.2) * (enemy.amplitude * 0.55) +
      Math.sin(age * 0.9) * 0.45;
  }

  return { x, y };
}

function steerShipY(state: SimulationState, baseY: number, deltaSeconds: number): number {
  let avoidance = 0;

  for (const projectile of state.enemyProjectiles) {
    if (projectile.vx >= -0.2) {
      continue;
    }

    const timeToShipX = (state.shipX - projectile.x) / projectile.vx;
    if (timeToShipX < 0 || timeToShipX > 0.9) {
      continue;
    }

    const predictedY = projectile.y + projectile.vy * timeToShipX;
    const deltaY = baseY - predictedY;
    const distance = Math.abs(deltaY);
    if (distance > 1.6) {
      continue;
    }

    const weight = (1.6 - distance) / 1.6;
    avoidance += (deltaY >= 0 ? 1 : -1) * weight;
  }

  const dodgeOffset = clamp(avoidance * 1.35, -2, 2);
  const targetY = clamp(baseY + dodgeOffset, -4.2, 4.2);
  const steer = clamp((targetY - state.shipY) * 4.8 * deltaSeconds, -0.4, 0.4);
  return state.shipY + steer;
}

function findBestTarget(enemies: Enemy[], shipX: number, shipY: number): Enemy | null {
  let bestEnemy: Enemy | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.x < shipX + 0.6) {
      continue;
    }

    const dx = enemy.x - shipX;
    const dy = enemy.y - shipY;
    const score = dx * 0.8 + Math.abs(dy) * 1.6;
    if (score < bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

function spawnEnemyProjectile(state: SimulationState, enemy: Enemy): void {
  const speed = 6.8 + state.rng() * 2;
  const jitter = (state.rng() - 0.5) * 0.55;
  const targetX = state.shipX - 0.2;
  const targetY = state.shipY + jitter;
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const magnitude = Math.hypot(dx, dy) || 1;

  state.enemyProjectiles.push({
    x: enemy.x - 0.5,
    y: enemy.y,
    z: 0,
    vx: (dx / magnitude) * speed,
    vy: (dy / magnitude) * speed,
    ageSeconds: 0,
    maxLifetimeSeconds: 3,
    radius: 0.18
  });
}

function spawnExplosion(state: SimulationState, x: number, y: number, z: number): void {
  state.explosions.push({
    x,
    y,
    z,
    ageSeconds: 0,
    lifetimeSeconds: 0.33
  });
}

function getIntensityAtTime(state: SimulationState, timeSeconds: number): number {
  const timeline = state.intensityTimeline;
  if (timeline.length === 0) {
    return 0.5;
  }

  if (timeSeconds <= timeline[0].timeSeconds) {
    return timeline[0].intensity;
  }

  const last = timeline[timeline.length - 1];
  if (timeSeconds >= last.timeSeconds) {
    return last.intensity;
  }

  for (let i = 1; i < timeline.length; i += 1) {
    const next = timeline[i];
    if (timeSeconds > next.timeSeconds) {
      continue;
    }
    const prev = timeline[i - 1];
    const span = Math.max(next.timeSeconds - prev.timeSeconds, 1e-6);
    const t = (timeSeconds - prev.timeSeconds) / span;
    return prev.intensity + (next.intensity - prev.intensity) * t;
  }

  return last.intensity;
}

function createMulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 7;
  }
  const int = Math.trunc(value);
  return int >>> 0;
}
