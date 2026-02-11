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
    damageFlash: number;
  }>;
  projectiles: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    rotationZ: number;
  }>;
  enemyProjectiles: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
  }>;
  laserBeams: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    alpha: number;
  }>;
  explosions: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    alpha: number;
    variant: number;
    power: number;
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
  queuedCueShotCount: number;
  upcomingCueWindowCount: number;
  availableCueTargetCount: number;
  moodProfile: "calm" | "driving" | "aggressive";
};

type EnemyPattern = "straight" | "sine" | "arc" | "zigzag" | "weave";

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
  cuePrimed: boolean;
  damageFlash: number;
  hasEnteredView: boolean;
};

type Projectile = {
  id: number;
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
  id: number;
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
  variant: number;
  power: number;
};

type LaserBeam = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
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

type MoodProfile = "calm" | "driving" | "aggressive";

const CUE_ASSIGN_MIN_LEAD_SECONDS = 0.2;
const CUE_ASSIGN_MAX_LEAD_SECONDS = 0.8;
const CUE_SUPPORT_LEAD_PADDING_SECONDS = 0.55;
const MAX_CUE_SUPPORT_SPAWNS_PER_STEP = 12;
const PLAYER_PROJECTILE_SPEED = 22;
const PLAYER_TARGET_MAX_DISTANCE_X = 4.8;
const PLAYER_SECONDARY_TARGET_DISTANCE_X = 8.4;
const LASER_COOLDOWN_SECONDS = 0.22;
const LASER_REQUIRED_OUT_OF_RANGE_COUNT = 4;
const LASER_BEAM_LIFETIME_SECONDS = 0.26;
const MIN_ENEMY_SURVIVAL_SECONDS = 1.25;
const LASER_MAX_TARGET_X = 17.2;
const CLEANUP_BEHIND_SHIP_DISTANCE = 1.1;
const CLEANUP_BEHIND_REQUIRED_COUNT = 2;
const CLEANUP_OUT_OF_RANGE_EXTRA_DISTANCE = 1.6;
const CUE_FALLBACK_MIN_AHEAD_DISTANCE = 1.8;
const CUE_FALLBACK_MAX_AHEAD_DISTANCE = 10.2;
const CUE_FALLBACK_MAX_Y_DELTA = 1.35;
const SHIP_MIN_X = -12.4;
const SHIP_MAX_X = 4.2;
const SHIP_MIN_Y = -8.6;
const SHIP_MAX_Y = 8.6;
const SHIP_MAX_SPEED_X = 6.4;
const SHIP_MAX_SPEED_Y = 8.3;
const SHIP_ACCEL_X = 14.5;
const SHIP_ACCEL_Y = 17.5;
const SHIP_RETARGET_MIN_SECONDS = 0.18;
const SHIP_RETARGET_MAX_SECONDS = 0.46;
const SHIP_THREAT_HORIZON_SECONDS = 1.15;
const SHIP_SAFE_RADIUS = 1.25;
const SHIP_PANIC_THRESHOLD = 1.2;
const SHIP_COLLISION_RADIUS = 0.7;
const SHIP_ESCAPE_HORIZON_SECONDS = 1.05;
const SHIP_ESCAPE_STEP_SECONDS = 1 / 15;
const SHIP_ESCAPE_NEAR_MISS_RADIUS = 2.4;
const SHIP_EDGE_AVOIDANCE_BUFFER = 0.2;
const SHIP_EDGE_AVOIDANCE_PENALTY = 1.1;
const SHIP_EDGE_AVOIDANCE_BUFFER_X = 0.28;
const SHIP_EDGE_AVOIDANCE_PENALTY_X = 0.85;
const SHIP_EDGE_BREAKOUT_BAND = 0.85;
const SHIP_EDGE_BREAKOUT_THREAT_MIN = 0.45;
const SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS = 0.35;
const SHIP_EDGE_BREAKOUT_HOLD_SECONDS = 0.55;
const ENEMY_SPAWN_INTERVAL_MULTIPLIER = 0.9;
const ENEMY_FIRE_INTERVAL_MULTIPLIER = 1.15;
const ENEMY_FIRE_COOLDOWN_MULTIPLIER = 1.25;

type SimulationState = {
  simTimeSeconds: number;
  simTick: number;
  shipX: number;
  shipY: number;
  shipVx: number;
  shipVy: number;
  shipTargetX: number;
  shipTargetY: number;
  nextShipRetargetTime: number;
  edgeDwellSeconds: number;
  edgeBreakoutSeconds: number;
  shipShieldAlpha: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  laserBeams: LaserBeam[];
  explosions: Explosion[];
  nextEnemySpawnTime: number;
  nextPlayerFireTime: number;
  spawnIndex: number;
  nextEnemyId: number;
  nextProjectileId: number;
  nextEnemyProjectileId: number;
  nextLaserFireTime: number;
  cueTimeline: ScheduledCue[];
  cueStartOffsetSeconds: number;
  cueResolvedCount: number;
  cueMissedCount: number;
  cumulativeCueErrorMs: number;
  plannedCueShots: PlannedCueShot[];
  score: number;
  combo: number;
  intensityTimeline: IntensitySample[];
  intensityFloor: number;
  intensityCeil: number;
  moodProfile: MoodProfile;
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
  setMoodProfile: (mood: MoodProfile) => void;
};

export function createSimulation(): Simulation {
  const state: SimulationState = {
    simTimeSeconds: 0,
    simTick: 0,
    shipX: -6,
    shipY: 0,
    shipVx: 0,
    shipVy: 0,
    shipTargetX: -6,
    shipTargetY: 0,
    nextShipRetargetTime: 0,
    edgeDwellSeconds: 0,
    edgeBreakoutSeconds: 0,
    shipShieldAlpha: 0,
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    laserBeams: [],
    explosions: [],
    nextEnemySpawnTime: 0.4,
    nextPlayerFireTime: 0.2,
    spawnIndex: 0,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextEnemyProjectileId: 1,
    nextLaserFireTime: 0,
    cueTimeline: [],
    cueStartOffsetSeconds: 0,
    cueResolvedCount: 0,
    cueMissedCount: 0,
    cumulativeCueErrorMs: 0,
    plannedCueShots: [],
    score: 0,
    combo: 0,
    intensityTimeline: [],
    intensityFloor: 0,
    intensityCeil: 1,
    moodProfile: "driving",
    randomSeed: 7,
    rng: createMulberry32(7)
  };

  return {
    step(deltaSeconds: number) {
      state.simTimeSeconds += deltaSeconds;
      state.simTick += 1;

      updateShipMotion(state, deltaSeconds);

      spawnEnemies(state);
      planCueShots(state);
      fireQueuedCueShots(state);
      fireProjectiles(state);
      updateEnemies(state, deltaSeconds);
      fireCleanupLaser(state);
      updateProjectiles(state, deltaSeconds);
      updateEnemyProjectiles(state, deltaSeconds);
      updateLaserBeams(state, deltaSeconds);
      updateExplosions(state, deltaSeconds);
      resolvePlayerProjectileCollisions(state);
      resolveEnemyProjectileShipCollisions(state);
      resolveDueCueExplosions(state);

      state.shipShieldAlpha = Math.max(0, state.shipShieldAlpha - deltaSeconds * 2.8);

      state.enemies = state.enemies.filter((enemy) => enemy.x > -16);
      state.projectiles = state.projectiles.filter(
        (projectile) =>
          projectile.x > -15 &&
          projectile.x < 20 &&
          Math.abs(projectile.y) < 11
      );
      state.enemyProjectiles = state.enemyProjectiles.filter(
        (projectile) =>
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
          rotationZ: enemy.phase + enemy.ageSeconds * 2,
          damageFlash: enemy.damageFlash
        })),
        projectiles: state.projectiles.map((projectile) => ({
          id: projectile.id,
          x: projectile.x,
          y: projectile.y,
          z: projectile.z,
          rotationZ: Math.atan2(projectile.vy, projectile.vx)
        })),
        enemyProjectiles: state.enemyProjectiles.map((projectile) => ({
          id: projectile.id,
          x: projectile.x,
          y: projectile.y,
          z: projectile.z
        })),
        laserBeams: state.laserBeams.map((beam) => ({
          fromX: beam.fromX,
          fromY: beam.fromY,
          toX: beam.toX,
          toY: beam.toY,
          alpha: 1 - beam.ageSeconds / Math.max(beam.lifetimeSeconds, 1e-6)
        })),
        explosions: state.explosions.map((explosion) => {
          const normalizedAge =
            explosion.ageSeconds / Math.max(explosion.lifetimeSeconds, 1e-6);
          return {
            x: explosion.x,
            y: explosion.y,
            z: explosion.z,
            scale: 0.5 + normalizedAge * 1.5,
            alpha: 1 - normalizedAge,
            variant: explosion.variant,
            power: explosion.power
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
        plannedCueCount: countPlannedCues(state.cueTimeline),
        queuedCueShotCount: state.plannedCueShots.length,
        upcomingCueWindowCount: countUpcomingCueWindow(state),
        availableCueTargetCount: countAvailableCueTargets(state),
        moodProfile: state.moodProfile
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
        enemy.cuePrimed = false;
        enemy.damageFlash = 0;
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

      const intensities = state.intensityTimeline.map((sample) => sample.intensity);
      if (intensities.length === 0) {
        state.intensityFloor = 0;
        state.intensityCeil = 1;
        return;
      }

      intensities.sort((a, b) => a - b);
      const p08 = samplePercentile(intensities, 0.08);
      const p92 = samplePercentile(intensities, 0.92);
      const min = intensities[0];
      const max = intensities[intensities.length - 1];
      if (p92 - p08 > 0.06) {
        state.intensityFloor = p08;
        state.intensityCeil = p92;
      } else {
        state.intensityFloor = min;
        state.intensityCeil = Math.max(min + 0.05, max);
      }
    },
    setRandomSeed(seed) {
      const normalized = normalizeSeed(seed);
      state.randomSeed = normalized;
      state.rng = createMulberry32(normalized);
    },
    setMoodProfile(mood) {
      state.moodProfile = mood;
    }
  };
}

function resetRunState(state: SimulationState): void {
  state.simTimeSeconds = 0;
  state.simTick = 0;
  state.shipX = -6;
  state.shipY = 0;
  state.shipVx = 0;
  state.shipVy = 0;
  state.shipTargetX = -6;
  state.shipTargetY = 0;
  state.nextShipRetargetTime = 0;
  state.edgeDwellSeconds = 0;
  state.edgeBreakoutSeconds = 0;
  state.shipShieldAlpha = 0;
  state.enemies = [];
  state.projectiles = [];
  state.enemyProjectiles = [];
  state.laserBeams = [];
  state.explosions = [];
  state.nextEnemySpawnTime = 0.4;
  state.nextPlayerFireTime = 0.2;
  state.spawnIndex = 0;
  state.nextEnemyId = 1;
  state.nextProjectileId = 1;
  state.nextEnemyProjectileId = 1;
  state.nextLaserFireTime = 0;
  state.cueResolvedCount = 0;
  state.cueMissedCount = 0;
  state.cumulativeCueErrorMs = 0;
  state.plannedCueShots = [];
  state.score = 0;
  state.combo = 0;
  state.cueStartOffsetSeconds = 0;
  state.moodProfile = "driving";
  state.rng = createMulberry32(state.randomSeed);
}

function spawnEnemies(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextEnemySpawnTime) {
    spawnAmbientEnemy(state);

    state.spawnIndex += 1;
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const mood = moodParameters(state.moodProfile);
    const cadence = (0.9 - intensity * 0.5) * mood.spawnIntervalScale;
    state.nextEnemySpawnTime += clamp(cadence + state.rng() * 0.35, 0.22, 0.95);
  }

  ensureCueSupportEnemies(state);
}

function fireProjectiles(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextPlayerFireTime) {
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const mood = moodParameters(state.moodProfile);
    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;

    let target = findBestTarget(state.enemies, shipX, shipY);
    if (!target) {
      target = findBestTarget(state.enemies, shipX, shipY, PLAYER_SECONDARY_TARGET_DISTANCE_X);
    }
    let directionX = 1;
    let directionY = clamp(state.shipVy * 0.035, -0.12, 0.12);

    if (target) {
      const directDx = target.x - shipX;
      const directDy = target.y - shipY;
      const directDistance = Math.hypot(directDx, directDy);
      const travelSeconds = clamp(directDistance / PLAYER_PROJECTILE_SPEED, 0.04, 0.5);
      const futureTarget = predictEnemyPosition(target, travelSeconds);
      const dx = futureTarget.x - shipX;
      const dy = futureTarget.y - shipY;
      const mag = Math.hypot(dx, dy);
      if (mag > 1e-6) {
        const leadFalloff = clamp(1 - (mag - 6.5) / 9.5, 0.28, 1);
        const jitter = (state.rng() - 0.5) * (1 - leadFalloff) * 0.2;
        directionX = dx / mag;
        directionY = dy / mag + jitter;
        const directionMag = Math.hypot(directionX, directionY) || 1;
        directionX /= directionMag;
        directionY /= directionMag;
      }
    }

    state.projectiles.push({
      id: state.nextProjectileId++,
      x: shipX,
      y: shipY,
      z: 0,
      vx: directionX * PLAYER_PROJECTILE_SPEED,
      vy: directionY * PLAYER_PROJECTILE_SPEED,
      ageSeconds: 0,
      maxLifetimeSeconds: 1.45,
      radius: 0.16
    });

    const interval = (0.2 - intensity * 0.07) * mood.playerFireIntervalScale;
    state.nextPlayerFireTime += clamp(interval, 0.1, 0.24);
  }
}

function updateEnemies(state: SimulationState, deltaSeconds: number): void {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);

  for (const enemy of state.enemies) {
    enemy.ageSeconds += deltaSeconds;
    enemy.x += enemy.vx * deltaSeconds;

    if (enemy.pattern === "straight") {
      enemy.y = enemy.baseY;
    } else if (enemy.pattern === "sine") {
      enemy.y =
        enemy.baseY +
        Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency) * enemy.amplitude;
    } else if (enemy.pattern === "zigzag") {
      const wave = Math.asin(Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency * 1.8));
      enemy.y = enemy.baseY + wave * enemy.amplitude * 0.85;
    } else if (enemy.pattern === "weave") {
      enemy.y =
        enemy.baseY +
        Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency * 0.75) * (enemy.amplitude * 0.55) +
        Math.cos(enemy.phase * 1.4 + enemy.ageSeconds * enemy.frequency * 1.9) *
          (enemy.amplitude * 0.35);
    } else {
      enemy.y =
        enemy.baseY +
        Math.sin(enemy.phase + enemy.ageSeconds * enemy.frequency * 1.2) *
          (enemy.amplitude * 0.55) +
        Math.sin(enemy.ageSeconds * 0.9) * 0.45;
    }

    enemy.damageFlash = Math.max(0, enemy.damageFlash - deltaSeconds * 8);
    if (!enemy.hasEnteredView && enemy.x <= LASER_MAX_TARGET_X) {
      enemy.hasEnteredView = true;
    }
    enemy.fireCooldownSeconds -= deltaSeconds;
    if (enemy.fireCooldownSeconds <= 0 && enemy.x > state.shipX + 2.5) {
      const burstCount = intensity > 0.72 ? 3 : intensity > 0.45 ? 2 : 1;
      const spreadStep = 0.12 + state.rng() * 0.07;
      for (let i = 0; i < burstCount; i += 1) {
        const centeredIndex = i - (burstCount - 1) * 0.5;
        spawnEnemyProjectile(state, enemy, centeredIndex * spreadStep);
      }
      enemy.fireCooldownSeconds =
        (0.28 + (1 - intensity) * 0.52 + state.rng() * 0.32) *
        mood.enemyFireIntervalScale *
        ENEMY_FIRE_COOLDOWN_MULTIPLIER;
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

function fireCleanupLaser(state: SimulationState): void {
  if (state.simTimeSeconds < state.nextLaserFireTime) {
    return;
  }

  const behindShip = state.enemies.filter(
    (enemy) =>
      enemy.ageSeconds >= MIN_ENEMY_SURVIVAL_SECONDS &&
      enemy.hasEnteredView &&
      enemy.scheduledCueTime === null &&
      enemy.x < state.shipX - CLEANUP_BEHIND_SHIP_DISTANCE
  );

  if (behindShip.length >= CLEANUP_BEHIND_REQUIRED_COUNT) {
    let target = behindShip[0];
    for (const enemy of behindShip) {
      if (enemy.x < target.x) {
        target = enemy;
      }
    }

    spawnLaserBeam(state, target.x, target.y);
    spawnExplosion(state, target.x, target.y, target.z);
    state.enemies = state.enemies.filter((enemy) => enemy.id !== target.id);
    state.nextLaserFireTime = state.simTimeSeconds + LASER_COOLDOWN_SECONDS * 1.15;
    return;
  }

  const outOfRange = state.enemies.filter(
    (enemy) =>
      enemy.ageSeconds >= MIN_ENEMY_SURVIVAL_SECONDS &&
      enemy.hasEnteredView &&
      enemy.scheduledCueTime === null &&
      enemy.x <= LASER_MAX_TARGET_X &&
      enemy.x > state.shipX + PLAYER_TARGET_MAX_DISTANCE_X + CLEANUP_OUT_OF_RANGE_EXTRA_DISTANCE
  );

  if (outOfRange.length < LASER_REQUIRED_OUT_OF_RANGE_COUNT) {
    return;
  }

  let target = outOfRange[0];
  for (const enemy of outOfRange) {
    if (enemy.x > target.x) {
      target = enemy;
    }
  }

  spawnLaserBeam(state, target.x, target.y);
  spawnExplosion(state, target.x, target.y, target.z);
  state.enemies = state.enemies.filter((enemy) => enemy.id !== target.id);
  state.nextLaserFireTime =
    state.simTimeSeconds + LASER_COOLDOWN_SECONDS * 1.25 + state.rng() * 0.08;
}

function updateLaserBeams(state: SimulationState, deltaSeconds: number): void {
  for (const beam of state.laserBeams) {
    beam.ageSeconds += deltaSeconds;
  }
  state.laserBeams = state.laserBeams.filter((beam) => beam.ageSeconds < beam.lifetimeSeconds);
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
        const timeUntilCue =
          enemy.scheduledCueTime === null ? Number.POSITIVE_INFINITY : enemy.scheduledCueTime - state.simTimeSeconds;

        if (enemy.scheduledCueTime !== null && timeUntilCue > 0.04) {
          enemy.cuePrimed = true;
          enemy.damageFlash = 1;
          destroyedProjectiles.add(p);
          break;
        }

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
  if (state.cueTimeline.length === 0) {
    return;
  }

  for (const cue of state.cueTimeline) {
    if (cue.planned) {
      continue;
    }

    const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
    if (leadSeconds < CUE_ASSIGN_MIN_LEAD_SECONDS) {
      continue;
    }

    if (leadSeconds > CUE_ASSIGN_MAX_LEAD_SECONDS) {
      if (leadSeconds <= 2.2) {
        const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
        cue.planned = true;
        cue.assignedEnemyId = reserved.id;
      }
      continue;
    }

    const candidate = findCueCandidate(state, cue.timeSeconds);
    if (!candidate) {
      const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
      cue.planned = true;
      cue.assignedEnemyId = reserved.id;
      continue;
    }

    const fireTimeSeconds = solveCueFireTime(state, candidate.enemy, cue.timeSeconds);
    if (fireTimeSeconds === null) {
      const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
      cue.planned = true;
      cue.assignedEnemyId = reserved.id;
      continue;
    }

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

function spawnReservedCueEnemy(state: SimulationState, cueTimeSeconds: number): Enemy {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);
  const leadSeconds = Math.max(0.2, cueTimeSeconds - state.simTimeSeconds);
  const shipAtCue = predictShipPosition(state, leadSeconds);
  const spawnX = 21.5 + state.rng() * 3.5;
  const targetX = shipAtCue.x + 6.8 + (state.rng() - 0.5) * 2.2;
  const requiredVx = (targetX - spawnX) / leadSeconds;
  const vx = clamp(requiredVx, -6.2, -1.9) * mood.enemySpeedScale;
  const lane = ((state.spawnIndex + 2) % 5) - 2;
  const laneOffset = lane * 0.82;
  const baseY = clamp(shipAtCue.baseY + laneOffset + (state.rng() - 0.5) * 0.45, -4.2, 4.2);
  const enemy: Enemy = {
    id: state.nextEnemyId++,
    x: spawnX,
    y: baseY,
    z: 0,
    vx,
    ageSeconds: 0,
    pattern: state.rng() < 0.5 ? "sine" : state.rng() < 0.75 ? "arc" : "weave",
    baseY,
    phase: state.rng() * Math.PI * 2,
    amplitude: 0.25 + state.rng() * (0.7 + intensity * 0.6),
    frequency: 0.8 + state.rng() * 1.15,
    radius: 0.44,
    fireCooldownSeconds:
      (0.9 + state.rng() * 0.9) * mood.enemyFireIntervalScale * ENEMY_FIRE_COOLDOWN_MULTIPLIER,
    scheduledCueTime: cueTimeSeconds,
    cuePrimed: false,
    damageFlash: 0,
    hasEnteredView: false
  };
  state.enemies.push(enemy);
  state.spawnIndex += 1;
  return enemy;
}

function spawnAmbientEnemy(state: SimulationState): void {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);
  const lane = (state.spawnIndex % 5) - 2;
  const patternSelector = state.spawnIndex % 5;
  const pattern: EnemyPattern =
    patternSelector === 0
      ? "straight"
      : patternSelector === 1
        ? "sine"
        : patternSelector === 2
          ? "arc"
          : patternSelector === 3
            ? "zigzag"
            : "weave";

  state.enemies.push({
    id: state.nextEnemyId++,
    x: 22.2 + state.rng() * 3.1,
    y: lane * 1.6,
    z: 0,
    vx: (-2.5 - intensity * 1.8 - state.rng() * 0.95) * mood.enemySpeedScale,
    ageSeconds: 0,
    pattern,
    baseY: lane * 1.6,
    phase: state.rng() * Math.PI * 2,
    amplitude: 0.35 + state.rng() * 1.25,
    frequency: 1 + state.rng() * 1.4,
    radius: 0.44,
    fireCooldownSeconds:
      (0.5 + (1 - intensity) * 0.8 + state.rng() * 0.5) *
      mood.enemyFireIntervalScale *
      ENEMY_FIRE_COOLDOWN_MULTIPLIER,
    scheduledCueTime: null,
    cuePrimed: false,
    damageFlash: 0,
    hasEnteredView: false
  });
}

function ensureCueSupportEnemies(state: SimulationState): void {
  if (state.cueTimeline.length === 0) {
    return;
  }

  let pendingCueCount = 0;
  for (const cue of state.cueTimeline) {
    if (cue.planned) {
      continue;
    }
    const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
    if (
      leadSeconds >= CUE_ASSIGN_MIN_LEAD_SECONDS &&
      leadSeconds <= CUE_ASSIGN_MAX_LEAD_SECONDS + CUE_SUPPORT_LEAD_PADDING_SECONDS
    ) {
      pendingCueCount += 1;
    }
  }

  if (pendingCueCount === 0) {
    return;
  }

  let availableEnemyCount = 0;
  for (const enemy of state.enemies) {
    if (enemy.scheduledCueTime !== null) {
      continue;
    }
    if (enemy.x <= state.shipX + 1.2) {
      continue;
    }
    if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
      continue;
    }
    availableEnemyCount += 1;
  }

  const needed = Math.min(
    MAX_CUE_SUPPORT_SPAWNS_PER_STEP,
    Math.max(0, pendingCueCount - availableEnemyCount)
  );
  if (needed === 0) {
    return;
  }

  for (let i = 0; i < needed; i += 1) {
    spawnCueSupportEnemy(state);
  }
}

function spawnCueSupportEnemy(state: SimulationState): void {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);
  const lane = ((state.spawnIndex + 1) % 5) - 2;
  const baseY = lane * 1.6 + (state.rng() - 0.5) * 0.35;

  state.enemies.push({
    id: state.nextEnemyId++,
    x: 22 + state.rng() * 2.9,
    y: baseY,
    z: 0,
    vx: (-2.15 - intensity * 1.2 - state.rng() * 0.6) * mood.enemySpeedScale,
    ageSeconds: 0,
    pattern:
      state.rng() < 0.5
        ? "straight"
        : state.rng() < 0.75
          ? "sine"
          : state.rng() < 0.9
            ? "zigzag"
            : "weave",
    baseY,
    phase: state.rng() * Math.PI * 2,
    amplitude: 0.2 + state.rng() * 0.65,
    frequency: 0.8 + state.rng() * 0.8,
    radius: 0.44,
    fireCooldownSeconds:
      (0.9 + state.rng() * 0.7) * mood.enemyFireIntervalScale * ENEMY_FIRE_COOLDOWN_MULTIPLIER,
    scheduledCueTime: null,
    cuePrimed: false,
    damageFlash: 0,
    hasEnteredView: false
  });

  state.spawnIndex += 1;
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
      id: state.nextProjectileId++,
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

    if (targetIndex >= 0) {
      const enemy = state.enemies[targetIndex];
      const didCueHit = scheduledEnemyHasCueHit(state, enemy);
      if (!didCueHit) {
        spawnLaserBeam(state, enemy.x, enemy.y);
      }
      spawnExplosion(state, enemy.x, enemy.y, enemy.z);
      state.enemies.splice(targetIndex, 1);
      if (didCueHit) {
        state.cueResolvedCount += 1;
        state.cumulativeCueErrorMs += cueErrorMs;
        state.combo += 1;
        state.score += 100 + Math.min(900, state.combo * 10);
      } else {
        state.cueMissedCount += 1;
        state.combo = 0;
      }
    } else {
      const fallbackEnemy = pickFallbackCueEnemy(state);
      if (fallbackEnemy) {
        spawnLaserBeam(state, fallbackEnemy.x, fallbackEnemy.y);
        spawnExplosion(state, fallbackEnemy.x, fallbackEnemy.y, fallbackEnemy.z);
      }
      state.cueMissedCount += 1;
      state.combo = 0;
    }
  }
}

function spawnLaserBeam(state: SimulationState, toX: number, toY: number): void {
  state.laserBeams.push({
    fromX: state.shipX + 0.4,
    fromY: state.shipY,
    toX,
    toY,
    ageSeconds: 0,
    lifetimeSeconds: LASER_BEAM_LIFETIME_SECONDS
  });
}

function pickFallbackCueEnemy(state: SimulationState): Enemy | null {
  let bestEnemyIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  const preferredAheadDistance = 6.4;

  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    if (enemy.scheduledCueTime !== null || !enemy.hasEnteredView) {
      continue;
    }
    const aheadDistance = enemy.x - state.shipX;
    if (
      aheadDistance <= CUE_FALLBACK_MIN_AHEAD_DISTANCE ||
      aheadDistance >= CUE_FALLBACK_MAX_AHEAD_DISTANCE
    ) {
      continue;
    }
    const laneOffset = Math.abs(enemy.y - state.shipY);
    if (laneOffset > CUE_FALLBACK_MAX_Y_DELTA) {
      continue;
    }
    const score = Math.abs(aheadDistance - preferredAheadDistance) + laneOffset * 1.7;
    if (score < bestScore) {
      bestScore = score;
      bestEnemyIndex = i;
    }
  }

  if (bestEnemyIndex >= 0) {
    const enemy = state.enemies[bestEnemyIndex];
    state.enemies.splice(bestEnemyIndex, 1);
    return enemy;
  }

  return null;
}

function scheduledEnemyHasCueHit(state: SimulationState, enemy: Enemy): boolean {
  if (enemy.cuePrimed) {
    return true;
  }

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
  const shipAtCue = predictShipPosition(state, cueTimeSeconds - state.simTimeSeconds);

  for (const enemy of state.enemies) {
    if (enemy.scheduledCueTime !== null || enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
      continue;
    }

    const dt = cueTimeSeconds - state.simTimeSeconds;
    if (dt <= 0) {
      continue;
    }

    const future = predictEnemyPosition(enemy, dt);
    const dx = future.x - shipAtCue.x;
    const dy = future.y - shipAtCue.baseY;
    const score = Math.abs(dy) * 1.5 + Math.abs(dx - 6.2) * 0.65;

    if (future.x <= shipAtCue.x + 0.8 || future.x > shipAtCue.x + 9.2 || future.x >= 18.8) {
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

function solveCueFireTime(
  state: SimulationState,
  enemy: Enemy,
  cueTimeSeconds: number
): number | null {
  const dtCue = cueTimeSeconds - state.simTimeSeconds;
  if (dtCue <= 0.02) {
    return null;
  }

  const enemyAtCue = predictEnemyPosition(enemy, dtCue);
  let fireTimeSeconds = cueTimeSeconds - clamp(dtCue * 0.5, 0.14, 0.8);

  for (let i = 0; i < 4; i += 1) {
    const shipPose = predictShipPosition(state, fireTimeSeconds - state.simTimeSeconds);
    const shotX = shipPose.x + 0.65;
    const shotY = shipPose.baseY;
    const leadSeconds = Math.hypot(enemyAtCue.x - shotX, enemyAtCue.y - shotY) / PLAYER_PROJECTILE_SPEED;
    fireTimeSeconds = cueTimeSeconds - leadSeconds;
  }

  if (fireTimeSeconds < state.simTimeSeconds || fireTimeSeconds > cueTimeSeconds - 0.01) {
    return null;
  }

  return fireTimeSeconds;
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

function countUpcomingCueWindow(state: SimulationState): number {
  let count = 0;
  const maxLead = CUE_ASSIGN_MAX_LEAD_SECONDS + CUE_SUPPORT_LEAD_PADDING_SECONDS;
  for (const cue of state.cueTimeline) {
    if (cue.planned) {
      continue;
    }
    const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
    if (leadSeconds >= CUE_ASSIGN_MIN_LEAD_SECONDS && leadSeconds <= maxLead) {
      count += 1;
    }
  }
  return count;
}

function countAvailableCueTargets(state: SimulationState): number {
  let count = 0;
  for (const enemy of state.enemies) {
    if (enemy.scheduledCueTime !== null) {
      continue;
    }
    if (enemy.x <= state.shipX + 1.2) {
      continue;
    }
    if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
      continue;
    }
    count += 1;
  }
  return count;
}

function predictEnemyPosition(enemy: Enemy, dt: number): { x: number; y: number } {
  const age = enemy.ageSeconds + dt;
  const x = enemy.x + enemy.vx * dt;
  let y = enemy.baseY;

  if (enemy.pattern === "sine") {
    y = enemy.baseY + Math.sin(enemy.phase + age * enemy.frequency) * enemy.amplitude;
  } else if (enemy.pattern === "zigzag") {
    const wave = Math.asin(Math.sin(enemy.phase + age * enemy.frequency * 1.8));
    y = enemy.baseY + wave * enemy.amplitude * 0.85;
  } else if (enemy.pattern === "weave") {
    y =
      enemy.baseY +
      Math.sin(enemy.phase + age * enemy.frequency * 0.75) * (enemy.amplitude * 0.55) +
      Math.cos(enemy.phase * 1.4 + age * enemy.frequency * 1.9) * (enemy.amplitude * 0.35);
  } else if (enemy.pattern === "arc") {
    y =
      enemy.baseY +
      Math.sin(enemy.phase + age * enemy.frequency * 1.2) * (enemy.amplitude * 0.55) +
      Math.sin(age * 0.9) * 0.45;
  }

  return { x, y };
}

function updateShipMotion(state: SimulationState, deltaSeconds: number): void {
  if (state.simTimeSeconds >= state.nextShipRetargetTime) {
    const target = chooseShipTarget(state);
    state.shipTargetX = target.x;
    state.shipTargetY = target.y;
    state.nextShipRetargetTime =
      state.simTimeSeconds +
      SHIP_RETARGET_MIN_SECONDS +
      state.rng() * (SHIP_RETARGET_MAX_SECONDS - SHIP_RETARGET_MIN_SECONDS);
  }

  const threat = analyzeProjectileThreat(state);
  const panicFactor = clamp(threat.score / SHIP_PANIC_THRESHOLD, 0, 1);
  const breakoutActive = updateEdgeBreakoutState(state, threat.score, deltaSeconds);

  let baseDesiredX = clamp(
    state.shipTargetX + threat.dodgeX * (0.8 + panicFactor * 2.2) - panicFactor * (breakoutActive ? 0.45 : 1.6),
    SHIP_MIN_X,
    SHIP_MAX_X
  );
  let baseDesiredY = clamp(
    state.shipTargetY + threat.dodgeY * (0.95 + panicFactor * 2.4),
    SHIP_MIN_Y,
    SHIP_MAX_Y
  );

  if (breakoutActive) {
    const inwardYDirection = state.shipY >= 0 ? -1 : 1;
    baseDesiredY = clamp(
      baseDesiredY + inwardYDirection * (1.4 + panicFactor * 1.8),
      SHIP_MIN_Y,
      SHIP_MAX_Y
    );

    const centerX = SHIP_MIN_X * 0.4 + SHIP_MAX_X * 0.6;
    const spreadDirection = state.shipX < centerX ? 1 : -1;
    baseDesiredX = clamp(
      baseDesiredX + spreadDirection * (1.2 + panicFactor * 1.1),
      SHIP_MIN_X,
      SHIP_MAX_X
    );
  }

  const escapeTarget = selectEscapeTarget(
    state,
    baseDesiredX,
    baseDesiredY,
    panicFactor,
    breakoutActive
  );
  const desiredX = escapeTarget.x;
  const desiredY = escapeTarget.y;

  const speedScale = 1 + panicFactor * 0.9;
  const accelScale = 1 + panicFactor * 1.35;

  const desiredVx = clamp(
    (desiredX - state.shipX) * (3.1 + panicFactor * 2.1),
    -SHIP_MAX_SPEED_X * speedScale,
    SHIP_MAX_SPEED_X * speedScale
  );
  const desiredVy = clamp(
    (desiredY - state.shipY) * (3.7 + panicFactor * 2.4),
    -SHIP_MAX_SPEED_Y * speedScale,
    SHIP_MAX_SPEED_Y * speedScale
  );

  const maxDvX = SHIP_ACCEL_X * accelScale * deltaSeconds;
  const maxDvY = SHIP_ACCEL_Y * accelScale * deltaSeconds;
  state.shipVx += clamp(desiredVx - state.shipVx, -maxDvX, maxDvX);
  state.shipVy += clamp(desiredVy - state.shipVy, -maxDvY, maxDvY);

  state.shipVx *= 1 - Math.min(0.3, deltaSeconds * 0.6);
  state.shipVy *= 1 - Math.min(0.3, deltaSeconds * 0.5);

  state.shipX = clamp(state.shipX + state.shipVx * deltaSeconds, SHIP_MIN_X, SHIP_MAX_X);
  state.shipY = clamp(state.shipY + state.shipVy * deltaSeconds, SHIP_MIN_Y, SHIP_MAX_Y);

  if (state.shipX === SHIP_MIN_X || state.shipX === SHIP_MAX_X) {
    state.shipVx *= breakoutActive ? 0.72 : 0.35;
  }
  if (state.shipY === SHIP_MIN_Y || state.shipY === SHIP_MAX_Y) {
    state.shipVy *= breakoutActive ? 0.78 : 0.35;
  }
}

function analyzeProjectileThreat(state: SimulationState): {
  dodgeX: number;
  dodgeY: number;
  score: number;
} {
  let dodgeX = 0;
  let dodgeY = 0;
  let score = 0;

  for (const projectile of state.enemyProjectiles) {
    const relPx = projectile.x - state.shipX;
    const relPy = projectile.y - state.shipY;
    const relVx = projectile.vx - state.shipVx;
    const relVy = projectile.vy - state.shipVy;
    const relSpeedSq = Math.max(1e-6, relVx * relVx + relVy * relVy);
    const tClosest = clamp(
      -(relPx * relVx + relPy * relVy) / relSpeedSq,
      0,
      SHIP_THREAT_HORIZON_SECONDS
    );

    const closestDx = relPx + relVx * tClosest;
    const closestDy = relPy + relVy * tClosest;
    const closestDist = Math.hypot(closestDx, closestDy);
    if (closestDist > SHIP_SAFE_RADIUS * 2.2) {
      continue;
    }

    const closeness = clamp(1 - closestDist / (SHIP_SAFE_RADIUS * 2.2), 0, 1);
    const imminence = clamp(1 - tClosest / SHIP_THREAT_HORIZON_SECONDS, 0, 1);
    const weight = closeness * (0.8 + imminence * 1.4);

    const awayX = closestDist > 1e-4 ? -closestDx / closestDist : state.rng() < 0.5 ? -1 : 1;
    const awayY = closestDist > 1e-4 ? -closestDy / closestDist : state.rng() < 0.5 ? -1 : 1;
    dodgeX += awayX * weight * 2.1;
    dodgeY += awayY * weight * 2.9;
    score += weight;
  }

  return {
    dodgeX,
    dodgeY,
    score
  };
}

function updateEdgeBreakoutState(
  state: SimulationState,
  threatScore: number,
  deltaSeconds: number
): boolean {
  const verticalEdgeDistance = Math.min(state.shipY - SHIP_MIN_Y, SHIP_MAX_Y - state.shipY);
  const isEdgePinned = verticalEdgeDistance < SHIP_EDGE_BREAKOUT_BAND;
  if (isEdgePinned && threatScore >= SHIP_EDGE_BREAKOUT_THREAT_MIN) {
    state.edgeDwellSeconds += deltaSeconds;
  } else {
    state.edgeDwellSeconds = Math.max(0, state.edgeDwellSeconds - deltaSeconds * 1.8);
  }

  if (state.edgeDwellSeconds >= SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS) {
    state.edgeBreakoutSeconds = Math.max(state.edgeBreakoutSeconds, SHIP_EDGE_BREAKOUT_HOLD_SECONDS);
    state.edgeDwellSeconds = 0;
  }

  if (state.edgeBreakoutSeconds > 0) {
    state.edgeBreakoutSeconds = Math.max(0, state.edgeBreakoutSeconds - deltaSeconds);
  }

  return state.edgeBreakoutSeconds > 0;
}

function selectEscapeTarget(
  state: SimulationState,
  baseDesiredX: number,
  baseDesiredY: number,
  panicFactor: number,
  breakoutActive: boolean
): { x: number; y: number } {
  if (state.enemyProjectiles.length === 0) {
    return {
      x: baseDesiredX,
      y: baseDesiredY
    };
  }

  const xOffsets = breakoutActive
    ? [-3.6, -2.2, -1.1, 0, 1.1, 2.2, 3.6]
    : [-2.2, -1.3, -0.6, 0, 0.6, 1.3, 2.2];
  const yOffsets = breakoutActive
    ? [-4.2, -2.8, -1.5, 0, 1.5, 2.8, 4.2]
    : [-2.9, -1.9, -1.0, 0, 1.0, 1.9, 2.9];

  let bestX = baseDesiredX;
  let bestY = baseDesiredY;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const xOffset of xOffsets) {
    const candidateX = clamp(baseDesiredX + xOffset, SHIP_MIN_X, SHIP_MAX_X);
    for (const yOffset of yOffsets) {
      const candidateY = clamp(baseDesiredY + yOffset, SHIP_MIN_Y, SHIP_MAX_Y);
      const cost = evaluateEscapeCandidate(
        state,
        candidateX,
        candidateY,
        panicFactor,
        breakoutActive
      );
      if (cost < bestCost) {
        bestCost = cost;
        bestX = candidateX;
        bestY = candidateY;
      }
    }
  }

  return {
    x: bestX,
    y: bestY
  };
}

function evaluateEscapeCandidate(
  state: SimulationState,
  targetX: number,
  targetY: number,
  panicFactor: number,
  breakoutActive: boolean
): number {
  let simX = state.shipX;
  let simY = state.shipY;
  let simVx = state.shipVx;
  let simVy = state.shipVy;
  let totalCost = 0;
  const horizon = SHIP_ESCAPE_HORIZON_SECONDS;
  const steps = Math.max(1, Math.floor(horizon / SHIP_ESCAPE_STEP_SECONDS));
  const speedLimitX = SHIP_MAX_SPEED_X * (1 + panicFactor * 0.9);
  const speedLimitY = SHIP_MAX_SPEED_Y * (1 + panicFactor * 0.9);
  const accelLimitX = SHIP_ACCEL_X * (1 + panicFactor * 1.35);
  const accelLimitY = SHIP_ACCEL_Y * (1 + panicFactor * 1.35);

  for (let i = 1; i <= steps; i += 1) {
    const t = i * SHIP_ESCAPE_STEP_SECONDS;
    const desiredVx = clamp((targetX - simX) * (3.1 + panicFactor * 2.1), -speedLimitX, speedLimitX);
    const desiredVy = clamp((targetY - simY) * (3.8 + panicFactor * 2.6), -speedLimitY, speedLimitY);
    simVx += clamp(
      desiredVx - simVx,
      -accelLimitX * SHIP_ESCAPE_STEP_SECONDS,
      accelLimitX * SHIP_ESCAPE_STEP_SECONDS
    );
    simVy += clamp(
      desiredVy - simVy,
      -accelLimitY * SHIP_ESCAPE_STEP_SECONDS,
      accelLimitY * SHIP_ESCAPE_STEP_SECONDS
    );
    simVx *= 1 - Math.min(0.22, SHIP_ESCAPE_STEP_SECONDS * 0.6);
    simVy *= 1 - Math.min(0.22, SHIP_ESCAPE_STEP_SECONDS * 0.5);
    simX = clamp(simX + simVx * SHIP_ESCAPE_STEP_SECONDS, SHIP_MIN_X, SHIP_MAX_X);
    simY = clamp(simY + simVy * SHIP_ESCAPE_STEP_SECONDS, SHIP_MIN_Y, SHIP_MAX_Y);

    for (const projectile of state.enemyProjectiles) {
      const px = projectile.x + projectile.vx * t;
      const py = projectile.y + projectile.vy * t;
      const dx = px - simX;
      const dy = py - simY;
      const dist = Math.hypot(dx, dy);
      const imminence = 1 - t / horizon;

      if (dist <= SHIP_COLLISION_RADIUS) {
        totalCost += 5000 * (1 + imminence * 2.2);
        continue;
      }

      if (dist <= SHIP_ESCAPE_NEAR_MISS_RADIUS) {
        const nearMiss = SHIP_ESCAPE_NEAR_MISS_RADIUS - dist;
        totalCost += nearMiss * nearMiss * (1.2 + imminence * 1.8);
      }
    }

    const edgeDistanceY = Math.min(simY - SHIP_MIN_Y, SHIP_MAX_Y - simY);
    if (edgeDistanceY < SHIP_EDGE_AVOIDANCE_BUFFER) {
      totalCost +=
        (SHIP_EDGE_AVOIDANCE_BUFFER - edgeDistanceY) *
        (SHIP_EDGE_AVOIDANCE_PENALTY + panicFactor * 0.8);
    }

    const edgeDistanceX = Math.min(simX - SHIP_MIN_X, SHIP_MAX_X - simX);
    if (edgeDistanceX < SHIP_EDGE_AVOIDANCE_BUFFER_X) {
      totalCost +=
        (SHIP_EDGE_AVOIDANCE_BUFFER_X - edgeDistanceX) *
        (SHIP_EDGE_AVOIDANCE_PENALTY_X + panicFactor * 0.6);
    }

    if (breakoutActive) {
      const trappedEdgeDistance = state.shipY >= 0 ? SHIP_MAX_Y - simY : simY - SHIP_MIN_Y;
      if (trappedEdgeDistance < SHIP_EDGE_BREAKOUT_BAND) {
        totalCost +=
          (SHIP_EDGE_BREAKOUT_BAND - trappedEdgeDistance) *
          (4.4 + panicFactor * 2.8);
      }
    }
  }

  totalCost += Math.abs(targetY - state.shipY) * 0.12;
  totalCost += Math.abs(targetX - state.shipX) * (breakoutActive ? 0.03 : 0.09);

  if (breakoutActive) {
    const xShift = Math.abs(targetX - state.shipX);
    if (xShift < 1.2) {
      totalCost += (1.2 - xShift) * 0.9;
    }
  }

  return totalCost;
}

function chooseShipTarget(state: SimulationState): { x: number; y: number } {
  const focus = findBestTarget(state.enemies, state.shipX, state.shipY);
  const roamPhase = state.simTimeSeconds * 0.72;

  if (focus) {
    return {
      x: clamp(focus.x - 5.8 + Math.sin(roamPhase) * 0.7, SHIP_MIN_X, SHIP_MAX_X),
      y: clamp(focus.y + Math.sin(roamPhase * 1.25) * 0.9, SHIP_MIN_Y, SHIP_MAX_Y)
    };
  }

  return {
    x: clamp(
      -5.4 +
        Math.sin(roamPhase * 0.9) * 2.4 +
        Math.sin(roamPhase * 0.47 + 1.2) * 1.1,
      SHIP_MIN_X,
      SHIP_MAX_X
    ),
    y: clamp(
      Math.sin(roamPhase * 1.35 + 0.4) * 2.6 +
        Math.cos(roamPhase * 0.52 + 0.2) * 1.05,
      SHIP_MIN_Y,
      SHIP_MAX_Y
    )
  };
}

function predictShipPosition(state: SimulationState, dt: number): {
  x: number;
  baseY: number;
  vx: number;
  vy: number;
} {
  const t = Math.max(0, dt);
  const projectedX = state.shipX + state.shipVx * t + (state.shipTargetX - state.shipX) * 0.35;
  const projectedY = state.shipY + state.shipVy * t + (state.shipTargetY - state.shipY) * 0.35;
  return {
    x: clamp(projectedX, SHIP_MIN_X, SHIP_MAX_X),
    baseY: clamp(projectedY, SHIP_MIN_Y, SHIP_MAX_Y),
    vx: state.shipVx,
    vy: state.shipVy
  };
}

function findBestTarget(
  enemies: Enemy[],
  shipX: number,
  shipY: number,
  maxDistanceX = PLAYER_TARGET_MAX_DISTANCE_X
): Enemy | null {
  let bestEnemy: Enemy | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.x < shipX + 0.6) {
      continue;
    }
    if (enemy.x > shipX + maxDistanceX) {
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

function spawnEnemyProjectile(state: SimulationState, enemy: Enemy, spreadRadians = 0): void {
  const speed = 6.8 + state.rng() * 2;
  const jitter = (state.rng() - 0.5) * 0.55;
  const targetX = state.shipX - 0.2;
  const targetY = state.shipY + jitter;
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const magnitude = Math.hypot(dx, dy) || 1;

  const baseX = dx / magnitude;
  const baseY = dy / magnitude;
  const cos = Math.cos(spreadRadians);
  const sin = Math.sin(spreadRadians);
  const dirX = baseX * cos - baseY * sin;
  const dirY = baseX * sin + baseY * cos;

  state.enemyProjectiles.push({
    id: state.nextEnemyProjectileId++,
    x: enemy.x - 0.5,
    y: enemy.y,
    z: 0,
    vx: dirX * speed,
    vy: dirY * speed,
    ageSeconds: 0,
    maxLifetimeSeconds: 3,
    radius: 0.18
  });
}

function spawnExplosion(state: SimulationState, x: number, y: number, z: number): void {
  const relativeIntensity = getRelativeIntensityAtTime(state, state.simTimeSeconds);
  const power = clamp(0.12 + Math.pow(relativeIntensity, 2.2) * 2, 0.12, 2.12);
  state.explosions.push({
    x,
    y,
    z,
    ageSeconds: 0,
    lifetimeSeconds: 0.34 + power * 0.1,
    variant: Math.floor(state.rng() * 6),
    power
  });
}

function getRelativeIntensityAtTime(state: SimulationState, timeSeconds: number): number {
  const intensity = getIntensityAtTime(state, timeSeconds);
  const floor = state.intensityFloor;
  const ceil = state.intensityCeil;
  const span = Math.max(1e-4, ceil - floor);
  return clamp((intensity - floor) / span, 0, 1);
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

function samplePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }
  const p = clamp(percentile, 0, 1);
  const index = p * (values.length - 1);
  const lo = Math.floor(index);
  const hi = Math.min(values.length - 1, lo + 1);
  const t = index - lo;
  return values[lo] + (values[hi] - values[lo]) * t;
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return 7;
  }
  const int = Math.trunc(value);
  return int >>> 0;
}

function moodParameters(mood: MoodProfile): {
  enemySpeedScale: number;
  spawnIntervalScale: number;
  enemyFireIntervalScale: number;
  playerFireIntervalScale: number;
} {
  if (mood === "calm") {
    return {
      enemySpeedScale: 0.88,
      spawnIntervalScale: 1.12,
      enemyFireIntervalScale: 1.15,
      playerFireIntervalScale: 1.04
    };
  }
  if (mood === "aggressive") {
    return {
      enemySpeedScale: 1.1,
      spawnIntervalScale: 0.82,
      enemyFireIntervalScale: 0.82,
      playerFireIntervalScale: 0.92
    };
  }
  return {
    enemySpeedScale: 1,
    spawnIntervalScale: ENEMY_SPAWN_INTERVAL_MULTIPLIER,
    enemyFireIntervalScale: ENEMY_FIRE_INTERVAL_MULTIPLIER,
    playerFireIntervalScale: 1
  };
}
