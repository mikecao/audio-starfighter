import {
  DEFAULT_COMBAT_CONFIG,
  ENEMY_ARCHETYPE_DEFINITIONS,
  normalizeCombatConfig,
  sanitizeEnabledArchetypes,
  type CombatConfig,
  type CombatConfigPatch,
  type EnemyArchetypeDefinition,
  type EnemyArchetypeId,
  type EnemyRosterConfig,
  type ShipWeaponsConfig
} from "./combatConfig";

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
    archetype: EnemyArchetypeId;
  }>;
  projectiles: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    rotationZ: number;
    isCueShot: boolean;
  }>;
  missiles: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    rotationZ: number;
    ageSeconds: number;
    maxLifetimeSeconds: number;
    launchX: number;
    launchY: number;
    targetX: number;
    targetY: number;
    loopDirection: number;
    loopTurns: number;
    pathVariant: number;
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
  purpleMissileEnabled: boolean;
};

type EnemyPattern = "straight" | "sine" | "arc" | "zigzag" | "weave";
type CueWeaponId = "blue" | "yellow" | "green" | "purple";

type Enemy = {
  id: number;
  archetype: EnemyArchetypeId;
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
  isCueShot: boolean;
};

type PurpleMissile = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  ageSeconds: number;
  maxLifetimeSeconds: number;
  launchX: number;
  launchY: number;
  targetEnemyId: number;
  targetX: number;
  targetY: number;
  loopTurns: number;
  loopDirection: number;
  pathVariant: number;
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
  assignedWeapon: CueWeaponId | null;
};

type PlannedCueShot = {
  cueTimeSeconds: number;
  enemyId: number;
  fireTimeSeconds: number;
  weapon: "blue" | "yellow";
};

type PlannedPurpleMissileShot = {
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
const MAX_CATCHUP_CUES_PER_STEP = 7;
const PLAYER_PROJECTILE_SPEED = 22;
const PLAYER_TARGET_MAX_DISTANCE_X = 4.8;
const PLAYER_TARGET_HARD_DISTANCE_X = 12.6;
const PLAYER_TARGET_MAX_LATERAL_DISTANCE = 7.2;
const PLAYER_TARGET_LOCK_MIN_SECONDS = 0.24;
const PLAYER_TARGET_LOCK_MAX_SECONDS = 0.5;
const PLAYER_AIM_LOCKED_JITTER = 0.06;
const PLAYER_AIM_UNLOCKED_JITTER = 0.14;
const BLUE_LASER_FIRE_INTERVAL_MULTIPLIER = 0.5;
const PURPLE_MISSILE_BASE_SPEED = 9.8;
const PURPLE_MISSILE_LAUNCH_OFFSET_X = -0.62;
const PURPLE_MISSILE_MAX_SPEED = 14.2;
const PURPLE_MISSILE_TURN_RATE = 7.2;
const PURPLE_MISSILE_LOOP_RADIUS_MIN = 3.5;
const PURPLE_MISSILE_LOOP_RADIUS_MAX = 5.6;
const PURPLE_MISSILE_LOOP_MIN_TURNS = 1.08;
const PURPLE_MISSILE_LOOP_MAX_TURNS = 1.36;
const PURPLE_MISSILE_LOOP_DURATION_MIN = 0.9;
const PURPLE_MISSILE_LOOP_DURATION_MAX = 1.55;
const PURPLE_MISSILE_LOOP_ENTRY_OFFSET_MIN = 1.3;
const PURPLE_MISSILE_LOOP_ENTRY_OFFSET_MAX = 2.4;
const PURPLE_MISSILE_LOOP_SIDE_OFFSET_MIN = 3.4;
const PURPLE_MISSILE_LOOP_SIDE_OFFSET_MAX = 5.8;
const PURPLE_MISSILE_POST_LOOP_SWERVE_DECAY = 1.7;
const PURPLE_MISSILE_COLLISION_RADIUS = 0.44;
const PURPLE_MISSILE_LEAD_SCALE = 2.65;
const PURPLE_MISSILE_MIN_LEAD_SECONDS = 0.24;
const PURPLE_MISSILE_MAX_LEAD_SECONDS = 2.45;
const PURPLE_MISSILE_FIRING_WINDOW_PADDING = 0.06;
const PURPLE_WEAPON_ASSIGNMENT_WEIGHT = 3;
const LASER_COOLDOWN_SECONDS = 0.22;
const LASER_REQUIRED_OUT_OF_RANGE_COUNT = 4;
const LASER_BEAM_LIFETIME_SECONDS = 0.26;
const MIN_ENEMY_SURVIVAL_SECONDS = 1.25;
const LASER_MAX_TARGET_X = 17.2;
const CLEANUP_BEHIND_SHIP_DISTANCE = 1.1;
const CLEANUP_BEHIND_REQUIRED_COUNT = 1;
const CLEANUP_OUT_OF_RANGE_EXTRA_DISTANCE = 1.6;
const FORCE_CLEANUP_OFFSCREEN_X = -15.9;
const SHIP_MIN_X = -19.8;
const SHIP_MAX_X = 19.8;
const SHIP_MIN_Y = -11.2;
const SHIP_MAX_Y = 11.2;
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
const SHIP_EDGE_AVOIDANCE_BUFFER = 0.05;
const SHIP_EDGE_AVOIDANCE_PENALTY = 0.45;
const SHIP_EDGE_AVOIDANCE_BUFFER_X = 0.08;
const SHIP_EDGE_AVOIDANCE_PENALTY_X = 0.35;
const SHIP_EDGE_BREAKOUT_BAND = 0.85;
const SHIP_EDGE_BREAKOUT_THREAT_MIN = 0.55;
const SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS = 0.5;
const SHIP_EDGE_BREAKOUT_HOLD_SECONDS = 0.45;
const SHIP_PRE_BREAKOUT_TRIGGER_FRACTION = 0.5;
const SHIP_CENTER_BIAS_THREAT_LOW = 0.25;
const SHIP_CENTER_BIAS_THREAT_HIGH = 1.1;
const SHIP_CENTER_BIAS_X_STRENGTH = 0.72;
const SHIP_CENTER_BIAS_Y_STRENGTH = 0.9;
const SHIP_EDGE_APPROACH_BUFFER_Y = 2.35;
const SHIP_EDGE_APPROACH_BUFFER_X = 2.9;
const SHIP_EDGE_APPROACH_PENALTY_Y = 1.15;
const SHIP_EDGE_APPROACH_PENALTY_X = 0.62;
const SHIP_EDGE_RETURN_COOLDOWN_SECONDS = 2.3;
const SHIP_EDGE_RETURN_BAND_Y = 7.4;
const SHIP_EDGE_RETURN_PENALTY = 1.7;
const SHIP_ENEMY_THREAT_HORIZON_SECONDS = 1.05;
const SHIP_ENEMY_SAFE_RADIUS = 1.45;
const SHIP_ENEMY_ESCAPE_NEAR_MISS_RADIUS = 2.65;
const SHIP_ENEMY_COLLISION_COST = 6200;
const SHIP_ENEMY_NEAR_MISS_COST = 1.55;
const ENEMY_EDGE_AIM_RELAX_DISTANCE_Y = 3.2;
const ENEMY_EDGE_AIM_RELAX_MAX_LAG_SECONDS = 0.12;
const ENEMY_EDGE_AIM_RELAX_MAX_JITTER = 0.45;
const ENEMY_EDGE_PRESSURE_WINDOW_X = 8.2;
const ENEMY_EDGE_PRESSURE_WINDOW_Y = 3.6;
const ENEMY_EDGE_PRESSURE_PROJECTILE_CAP = 8;
const ENEMY_EDGE_PRESSURE_EXTRA_SPREAD = 0.11;
const ENEMY_INTENSITY_SPAWN_BOOST = 0.08;
const ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST = 0.1;
const ENEMY_BULLET_RATE_BASE = 2.05;
const ENEMY_BULLET_RATE_INTENSITY_GAIN = 3.15;
const ENEMY_BULLET_RATE_MAX = 10.9;
const ENEMY_BULLET_BUDGET_WINDOW_SECONDS = 0.68;
const ENEMY_SPAWN_INTERVAL_MULTIPLIER = 0.9;
const ENEMY_FIRE_INTERVAL_MULTIPLIER = 1.15;
const ENEMY_FIRE_COOLDOWN_MULTIPLIER = 1.25;

type CombatPressureTuning = {
  spawnScale: number;
  enemyFireScale: number;
};

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
  lockedTargetEnemyId: number | null;
  targetLockUntilSeconds: number;
  lastPlayerAimX: number;
  lastPlayerAimY: number;
  edgeDwellSeconds: number;
  edgeBreakoutSeconds: number;
  recentEdgeSideY: number;
  recentEdgeCooldownSeconds: number;
  shipShieldAlpha: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  missiles: PurpleMissile[];
  enemyProjectiles: EnemyProjectile[];
  laserBeams: LaserBeam[];
  explosions: Explosion[];
  nextEnemySpawnTime: number;
  nextPlayerFireTime: number;
  spawnIndex: number;
  nextEnemyId: number;
  nextProjectileId: number;
  nextMissileId: number;
  nextEnemyProjectileId: number;
  enemyBulletBudget: number;
  enemyBulletRatio: number;
  enemyFireSelectionCursor: number;
  cueWeaponCursor: number;
  combatConfig: CombatConfig;
  activeEnemyArchetypes: EnemyArchetypeId[];
  nextLaserFireTime: number;
  cueTimeline: ScheduledCue[];
  cueStartOffsetSeconds: number;
  cueResolvedCount: number;
  cueMissedCount: number;
  cumulativeCueErrorMs: number;
  plannedCueShots: PlannedCueShot[];
  plannedPurpleMissileShots: PlannedPurpleMissileShot[];
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
  setEnemyBulletRatio: (ratio: number) => void;
  setShipWeapons: (weapons: Partial<ShipWeaponsConfig>) => void;
  setEnemyRoster: (roster: Partial<EnemyRosterConfig>) => void;
  setCombatConfig: (config: CombatConfigPatch) => void;
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
    lockedTargetEnemyId: null,
    targetLockUntilSeconds: 0,
    lastPlayerAimX: 1,
    lastPlayerAimY: 0,
    edgeDwellSeconds: 0,
    edgeBreakoutSeconds: 0,
    recentEdgeSideY: 0,
    recentEdgeCooldownSeconds: 0,
    shipShieldAlpha: 0,
    enemies: [],
    projectiles: [],
    missiles: [],
    enemyProjectiles: [],
    laserBeams: [],
    explosions: [],
    nextEnemySpawnTime: 0.4,
    nextPlayerFireTime: 0.2,
    spawnIndex: 0,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextMissileId: 1,
    nextEnemyProjectileId: 1,
    enemyBulletBudget: 0,
    enemyBulletRatio: 1,
    enemyFireSelectionCursor: 0,
    cueWeaponCursor: 0,
    combatConfig: normalizeCombatConfig(undefined),
    activeEnemyArchetypes: sanitizeEnabledArchetypes(DEFAULT_COMBAT_CONFIG.enemyRoster.enabledArchetypes),
    nextLaserFireTime: 0,
    cueTimeline: [],
    cueStartOffsetSeconds: 0,
    cueResolvedCount: 0,
    cueMissedCount: 0,
    cumulativeCueErrorMs: 0,
    plannedCueShots: [],
    plannedPurpleMissileShots: [],
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
      planCatchupCueKills(state);
      fireQueuedCueShots(state);
      fireQueuedPurpleMissiles(state);
      fireProjectiles(state);
      updateEnemies(state, deltaSeconds);
      updateProjectiles(state, deltaSeconds);
      updateMissiles(state, deltaSeconds);
      updateEnemyProjectiles(state, deltaSeconds);
      updateLaserBeams(state, deltaSeconds);
      updateExplosions(state, deltaSeconds);
      resolvePlayerProjectileCollisions(state);
      resolveEnemyProjectileShipCollisions(state);
      resolveDueCueExplosions(state);

      state.shipShieldAlpha = Math.max(0, state.shipShieldAlpha - deltaSeconds * 2.8);

      state.enemies = state.enemies.filter(
        (enemy) => enemy.x > -16 || enemy.scheduledCueTime !== null
      );
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
        projectileCount: state.projectiles.length + state.missiles.length + state.enemyProjectiles.length,
        enemies: state.enemies.map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          z: enemy.z,
          rotationZ: enemy.phase + enemy.ageSeconds * 2,
          damageFlash: enemy.damageFlash,
          archetype: enemy.archetype
        })),
        projectiles: state.projectiles.map((projectile) => ({
          id: projectile.id,
          x: projectile.x,
          y: projectile.y,
          z: projectile.z,
          rotationZ: Math.atan2(projectile.vy, projectile.vx),
          isCueShot: projectile.isCueShot
        })),
        missiles: state.missiles.map((missile) => {
          return {
            id: missile.id,
            x: missile.x,
            y: missile.y,
            z: missile.z,
            rotationZ: Math.atan2(missile.vy, missile.vx),
            ageSeconds: missile.ageSeconds,
            maxLifetimeSeconds: missile.maxLifetimeSeconds,
            launchX: missile.launchX,
            launchY: missile.launchY,
            targetX: missile.targetX,
            targetY: missile.targetY,
            loopDirection: missile.loopDirection,
            loopTurns: missile.loopTurns,
            pathVariant: missile.pathVariant
          };
        }),
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
        moodProfile: state.moodProfile,
        purpleMissileEnabled: isPurpleMissileEnabled(state)
      };
    },
    setCueTimeline(cueTimesSeconds) {
      state.cueStartOffsetSeconds = state.simTimeSeconds;
      state.cueResolvedCount = 0;
      state.cueMissedCount = 0;
      state.cumulativeCueErrorMs = 0;
      state.plannedCueShots = [];
      state.plannedPurpleMissileShots = [];
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
          assignedEnemyId: null,
          assignedWeapon: null
        }));
      state.cueWeaponCursor = 0;
    },
    startTrackRun(cueTimesSeconds) {
      resetRunState(state);
      state.cueTimeline = cueTimesSeconds
        .filter((time) => Number.isFinite(time) && time >= 0)
        .map((time) => ({
          timeSeconds: time,
          planned: false,
          assignedEnemyId: null,
          assignedWeapon: null
        }));
      state.cueWeaponCursor = 0;
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
    },
    setEnemyBulletRatio(ratio) {
      const normalizedRatio = clamp(ratio, 0, 4);
      state.enemyBulletRatio = normalizedRatio;
      if (normalizedRatio <= 0) {
        state.enemyBulletBudget = 0;
      }
    },
    setShipWeapons(weapons) {
      applyCombatConfigPatch(state, { shipWeapons: weapons });
    },
    setEnemyRoster(roster) {
      applyCombatConfigPatch(state, { enemyRoster: roster });
    },
    setCombatConfig(config) {
      applyCombatConfigPatch(state, config);
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
  state.lockedTargetEnemyId = null;
  state.targetLockUntilSeconds = 0;
  state.lastPlayerAimX = 1;
  state.lastPlayerAimY = 0;
  state.edgeDwellSeconds = 0;
  state.edgeBreakoutSeconds = 0;
  state.recentEdgeSideY = 0;
  state.recentEdgeCooldownSeconds = 0;
  state.shipShieldAlpha = 0;
  state.enemies = [];
  state.projectiles = [];
  state.missiles = [];
  state.enemyProjectiles = [];
  state.laserBeams = [];
  state.explosions = [];
  state.nextEnemySpawnTime = 0.4;
  state.nextPlayerFireTime = 0.2;
  state.spawnIndex = 0;
  state.nextEnemyId = 1;
  state.nextProjectileId = 1;
  state.nextMissileId = 1;
  state.nextEnemyProjectileId = 1;
  state.enemyBulletBudget = 0;
  state.enemyFireSelectionCursor = 0;
  state.cueWeaponCursor = 0;
  state.activeEnemyArchetypes = sanitizeEnabledArchetypes(
    state.combatConfig.enemyRoster.enabledArchetypes
  );
  state.nextLaserFireTime = 0;
  state.cueResolvedCount = 0;
  state.cueMissedCount = 0;
  state.cumulativeCueErrorMs = 0;
  state.plannedCueShots = [];
  state.plannedPurpleMissileShots = [];
  state.score = 0;
  state.combo = 0;
  state.cueStartOffsetSeconds = 0;
  state.moodProfile = "driving";
  state.rng = createMulberry32(state.randomSeed);
}

function applyCombatConfigPatch(state: SimulationState, patch: CombatConfigPatch): void {
  state.combatConfig = normalizeCombatConfig(patch, state.combatConfig);
  state.activeEnemyArchetypes = sanitizeEnabledArchetypes(
    state.combatConfig.enemyRoster.enabledArchetypes
  );
}

function isPrimaryWeaponEnabled(state: SimulationState): boolean {
  return state.combatConfig.shipWeapons.blueLaser;
}

function isCueShotWeaponEnabled(state: SimulationState): boolean {
  return state.combatConfig.shipWeapons.yellowLaser;
}

function isCleanupLaserEnabled(state: SimulationState): boolean {
  return state.combatConfig.shipWeapons.greenLaser;
}

function isPurpleMissileEnabled(state: SimulationState): boolean {
  return state.combatConfig.shipWeapons.purpleMissile;
}

function getEnabledCueWeapons(state: SimulationState): CueWeaponId[] {
  const enabled: CueWeaponId[] = [];
  if (isPrimaryWeaponEnabled(state)) {
    enabled.push("blue");
  }
  if (isCueShotWeaponEnabled(state)) {
    enabled.push("yellow");
  }
  if (isCleanupLaserEnabled(state)) {
    enabled.push("green");
  }
  if (isPurpleMissileEnabled(state)) {
    enabled.push("purple");
  }
  return enabled;
}

function getCueWeaponAssignmentPool(state: SimulationState): CueWeaponId[] {
  const pool: CueWeaponId[] = [];
  if (isPrimaryWeaponEnabled(state)) {
    pool.push("blue");
  }
  if (isCueShotWeaponEnabled(state)) {
    pool.push("yellow");
  }
  if (isCleanupLaserEnabled(state)) {
    pool.push("green");
  }
  if (isPurpleMissileEnabled(state)) {
    for (let i = 0; i < PURPLE_WEAPON_ASSIGNMENT_WEIGHT; i += 1) {
      pool.push("purple");
    }
  }
  return pool;
}

function selectCueWeaponForAssignment(state: SimulationState): CueWeaponId | null {
  const pool = getCueWeaponAssignmentPool(state);
  if (pool.length === 0) {
    return null;
  }
  const weapon = pool[state.cueWeaponCursor % pool.length];
  state.cueWeaponCursor = (state.cueWeaponCursor + 1) % Math.max(1, pool.length);
  return weapon;
}

function isCueWeaponStillEnabled(state: SimulationState, weapon: CueWeaponId): boolean {
  if (weapon === "blue") {
    return isPrimaryWeaponEnabled(state);
  }
  if (weapon === "yellow") {
    return isCueShotWeaponEnabled(state);
  }
  if (weapon === "purple") {
    return isPurpleMissileEnabled(state);
  }
  return isCleanupLaserEnabled(state);
}

function getCombatPressureTuning(state: SimulationState): CombatPressureTuning {
  let spawnScale = state.combatConfig.enemyRoster.spawnScale;
  let enemyFireScale = state.combatConfig.enemyRoster.fireScale;

  if (!isCleanupLaserEnabled(state)) {
    spawnScale *= 0.9;
    enemyFireScale *= 0.92;
  }
  if (!isPrimaryWeaponEnabled(state)) {
    spawnScale *= 0.82;
    enemyFireScale *= 0.88;
  }
  if (!isCueShotWeaponEnabled(state)) {
    spawnScale *= 0.9;
  }
  if (!isPurpleMissileEnabled(state)) {
    spawnScale *= 0.93;
  }

  const purpleOnlyLoadout =
    isPurpleMissileEnabled(state) &&
    !isPrimaryWeaponEnabled(state) &&
    !isCueShotWeaponEnabled(state) &&
    !isCleanupLaserEnabled(state);
  if (purpleOnlyLoadout) {
    spawnScale *= 0.72;
    enemyFireScale *= 0.8;
  }

  const loadoutKillScale = getLoadoutKillScale(state);
  spawnScale *= loadoutKillScale;
  enemyFireScale *= 0.82 + loadoutKillScale * 0.28;

  return {
    spawnScale: clamp(spawnScale, 0.45, 2.4),
    enemyFireScale: clamp(enemyFireScale, 0.45, 2.4)
  };
}

function getLoadoutKillScale(state: SimulationState): number {
  let capacity = 0;
  if (isPrimaryWeaponEnabled(state)) {
    capacity += 1.5;
  }
  if (isCueShotWeaponEnabled(state)) {
    capacity += 1;
  }
  if (isCleanupLaserEnabled(state)) {
    capacity += 0.9;
  }
  if (isPurpleMissileEnabled(state)) {
    capacity += 1.35;
  }
  return clamp(capacity / 4.45, 0.38, 1.05);
}

function pickEnemyArchetype(state: SimulationState): EnemyArchetypeId {
  const enabled = state.activeEnemyArchetypes;
  if (enabled.length === 0) {
    return "redCube";
  }

  let totalWeight = 0;
  for (const archetypeId of enabled) {
    totalWeight += getEnemyArchetypeDefinition(archetypeId).spawnWeight;
  }
  if (totalWeight <= 1e-6) {
    return enabled[0];
  }

  let roll = state.rng() * totalWeight;
  for (const archetypeId of enabled) {
    roll -= getEnemyArchetypeDefinition(archetypeId).spawnWeight;
    if (roll <= 0) {
      return archetypeId;
    }
  }

  return enabled[enabled.length - 1];
}

function getEnemyArchetypeDefinition(archetypeId: EnemyArchetypeId): EnemyArchetypeDefinition {
  return ENEMY_ARCHETYPE_DEFINITIONS[archetypeId];
}

function spawnEnemies(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextEnemySpawnTime) {
    spawnAmbientEnemy(state);

    state.spawnIndex += 1;
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const mood = moodParameters(state.moodProfile);
    const combatTuning = getCombatPressureTuning(state);
    const cadence = (0.9 - intensity * 0.5) * mood.spawnIntervalScale;
    const intensitySpawnMultiplier = 1 - intensity * ENEMY_INTENSITY_SPAWN_BOOST;
    state.nextEnemySpawnTime += clamp(
      ((cadence + state.rng() * 0.35) * intensitySpawnMultiplier) / combatTuning.spawnScale,
      0.22,
      0.95
    );
  }

  ensureCueSupportEnemies(state);
}

function fireProjectiles(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextPlayerFireTime) {
    const intensity = getIntensityAtTime(state, state.simTimeSeconds);
    const mood = moodParameters(state.moodProfile);
    const interval =
      (0.2 - intensity * 0.07) *
      mood.playerFireIntervalScale *
      BLUE_LASER_FIRE_INTERVAL_MULTIPLIER;

    if (!isPrimaryWeaponEnabled(state)) {
      state.lockedTargetEnemyId = null;
      state.nextPlayerFireTime += clamp(interval, 0.05, 0.12);
      continue;
    }

    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;

    const target = selectPlayerFireTarget(state, shipX, shipY);
    let directionX = state.lastPlayerAimX;
    let directionY = state.lastPlayerAimY;

    if (target) {
      const futureTarget = solveProjectileIntercept(shipX, shipY, target, PLAYER_PROJECTILE_SPEED);
      const dx = futureTarget.x - shipX;
      const dy = futureTarget.y - shipY;
      const mag = Math.hypot(dx, dy);
      if (mag > 1e-6) {
        const locked = state.lockedTargetEnemyId === target.id;
        const baseJitter = locked ? PLAYER_AIM_LOCKED_JITTER : PLAYER_AIM_UNLOCKED_JITTER;
        const cueBias = target.scheduledCueTime !== null ? 0.55 : 1;
        const jitter = (state.rng() - 0.5) * baseJitter * cueBias;
        const desired = normalizeDirection(dx, dy + jitter);
        const blend = locked ? 0.84 : 0.72;
        const blended = normalizeDirection(
          state.lastPlayerAimX * (1 - blend) + desired.x * blend,
          state.lastPlayerAimY * (1 - blend) + desired.y * blend
        );
        directionX = blended.x;
        directionY = blended.y;
      }
    } else {
      state.lockedTargetEnemyId = null;
      const fallback = normalizeDirection(
        1,
        clamp(state.shipVy * 0.03 + Math.sin(state.simTimeSeconds * 1.15) * 0.04, -0.12, 0.12)
      );
      directionX = fallback.x;
      directionY = fallback.y;
    }

    state.lastPlayerAimX = directionX;
    state.lastPlayerAimY = directionY;

    state.projectiles.push({
      id: state.nextProjectileId++,
      x: shipX,
      y: shipY,
      z: 0,
      vx: directionX * PLAYER_PROJECTILE_SPEED,
      vy: directionY * PLAYER_PROJECTILE_SPEED,
      ageSeconds: 0,
      maxLifetimeSeconds: 1.45,
      radius: 0.16,
      isCueShot: false
    });

    state.nextPlayerFireTime += clamp(interval, 0.05, 0.12);
  }
}

function selectPlayerFireTarget(state: SimulationState, shipX: number, shipY: number): Enemy | null {
  if (state.lockedTargetEnemyId !== null && state.simTimeSeconds <= state.targetLockUntilSeconds) {
    const lockedTarget = getEnemyById(state.enemies, state.lockedTargetEnemyId);
    if (lockedTarget && isPlayerTargetViable(lockedTarget, shipX, shipY)) {
      return lockedTarget;
    }
  }

  let bestTarget: Enemy | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of state.enemies) {
    if (!isPlayerTargetViable(enemy, shipX, shipY)) {
      continue;
    }

    const score = scorePlayerFireTarget(state, enemy, shipX, shipY);
    if (score < bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }

  if (!bestTarget) {
    state.lockedTargetEnemyId = null;
    state.targetLockUntilSeconds = 0;
    return null;
  }

  state.lockedTargetEnemyId = bestTarget.id;
  state.targetLockUntilSeconds =
    state.simTimeSeconds +
    PLAYER_TARGET_LOCK_MIN_SECONDS +
    state.rng() * (PLAYER_TARGET_LOCK_MAX_SECONDS - PLAYER_TARGET_LOCK_MIN_SECONDS);
  return bestTarget;
}

function scorePlayerFireTarget(
  state: SimulationState,
  enemy: Enemy,
  shipX: number,
  shipY: number
): number {
  const intercept = solveProjectileIntercept(shipX, shipY, enemy, PLAYER_PROJECTILE_SPEED);
  const dx = intercept.x - shipX;
  const dy = intercept.y - shipY;
  const distance = Math.hypot(dx, dy);
  let score = dx * 0.52 + Math.abs(dy) * 1.35 + distance * 0.06;

  if (enemy.scheduledCueTime !== null) {
    const timeUntilCue = enemy.scheduledCueTime - state.simTimeSeconds;
    if (timeUntilCue > 0.06 && timeUntilCue < 1.2) {
      score -= 1.2 + (1.2 - timeUntilCue) * 0.45;
    } else {
      score -= 0.55;
    }
  }
  if (enemy.cuePrimed) {
    score -= 0.35;
  }
  if (!enemy.hasEnteredView) {
    score += 0.28;
  }
  if (state.lockedTargetEnemyId === enemy.id) {
    score -= 0.7;
  }

  return score;
}

function isPlayerTargetViable(enemy: Enemy, shipX: number, shipY: number): boolean {
  if (enemy.x < shipX + 0.5) {
    return false;
  }
  if (enemy.x > shipX + PLAYER_TARGET_HARD_DISTANCE_X || enemy.x > LASER_MAX_TARGET_X + 1.2) {
    return false;
  }
  if (Math.abs(enemy.y - shipY) > PLAYER_TARGET_MAX_LATERAL_DISTANCE) {
    return false;
  }
  return true;
}

function solveProjectileIntercept(
  shipX: number,
  shipY: number,
  enemy: Enemy,
  projectileSpeed: number
): { x: number; y: number } {
  const initialDx = enemy.x - shipX;
  const initialDy = enemy.y - shipY;
  let travelSeconds = clamp(Math.hypot(initialDx, initialDy) / projectileSpeed, 0.03, 0.85);

  for (let i = 0; i < 3; i += 1) {
    const future = predictEnemyPosition(enemy, travelSeconds);
    const dx = future.x - shipX;
    const dy = future.y - shipY;
    travelSeconds = clamp(Math.hypot(dx, dy) / projectileSpeed, 0.03, 0.85);
  }

  return predictEnemyPosition(enemy, travelSeconds);
}

function updateEnemies(state: SimulationState, deltaSeconds: number): void {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);
  const combatTuning = getCombatPressureTuning(state);
  const readyToFire: Enemy[] = [];

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
      readyToFire.push(enemy);
    }
  }

  replenishEnemyBulletBudget(state, deltaSeconds, intensity, mood, combatTuning);
  if (readyToFire.length === 0 || state.enemyBulletBudget < 1) {
    return;
  }

  const startIndex = state.enemyFireSelectionCursor % readyToFire.length;
  let firedEnemies = 0;
  for (let offset = 0; offset < readyToFire.length; offset += 1) {
    if (state.enemyBulletBudget < 1) {
      break;
    }

    const enemy = readyToFire[(startIndex + offset) % readyToFire.length];
    const desiredBurstCount = getEnemyBurstCount(intensity);
    const burstCount = Math.min(desiredBurstCount, Math.max(1, Math.floor(state.enemyBulletBudget)));
    fireEnemyBurst(state, enemy, burstCount);
    state.enemyBulletBudget = Math.max(0, state.enemyBulletBudget - burstCount);
    const fireCadenceIntensityMultiplier = enemyFireIntensityMultiplier(intensity);
    enemy.fireCooldownSeconds =
      (0.28 + (1 - intensity) * 0.52 + state.rng() * 0.32) *
      mood.enemyFireIntervalScale *
      ENEMY_FIRE_COOLDOWN_MULTIPLIER *
      fireCadenceIntensityMultiplier /
      combatTuning.enemyFireScale;
    firedEnemies += 1;
  }

  state.enemyFireSelectionCursor = (startIndex + firedEnemies) % readyToFire.length;
}

function replenishEnemyBulletBudget(
  state: SimulationState,
  deltaSeconds: number,
  intensity: number,
  mood: {
    enemyBulletRateScale: number;
  },
  combatTuning: CombatPressureTuning
): void {
  const bulletsPerSecond = clamp(
    (ENEMY_BULLET_RATE_BASE + intensity * ENEMY_BULLET_RATE_INTENSITY_GAIN) *
      mood.enemyBulletRateScale *
      state.enemyBulletRatio *
      combatTuning.enemyFireScale,
    0,
    ENEMY_BULLET_RATE_MAX
  );
  const maxBudget = bulletsPerSecond * ENEMY_BULLET_BUDGET_WINDOW_SECONDS;
  state.enemyBulletBudget = Math.min(maxBudget, state.enemyBulletBudget + bulletsPerSecond * deltaSeconds);
}

function getEnemyBurstCount(intensity: number): number {
  if (intensity > 0.72) {
    return 3;
  }
  if (intensity > 0.45) {
    return 2;
  }
  return 1;
}

function fireEnemyBurst(state: SimulationState, enemy: Enemy, burstCount: number): void {
  const spreadStep = 0.12 + state.rng() * 0.07;
  for (let i = 0; i < burstCount; i += 1) {
    const centeredIndex = i - (burstCount - 1) * 0.5;
    spawnEnemyProjectile(state, enemy, centeredIndex * spreadStep);
  }
}

function enemyFireIntensityMultiplier(intensity: number): number {
  return clamp(1 - intensity * ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST, 0.82, 1);
}

function updateProjectiles(state: SimulationState, deltaSeconds: number): void {
  for (const projectile of state.projectiles) {
    projectile.ageSeconds += deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
  }
}

function updateMissiles(state: SimulationState, deltaSeconds: number): void {
  if (state.missiles.length === 0) {
    return;
  }

  const survivors: PurpleMissile[] = [];
  for (const missile of state.missiles) {
    missile.ageSeconds += deltaSeconds;
    if (missile.ageSeconds >= missile.maxLifetimeSeconds) {
      continue;
    }
    survivors.push(missile);
  }

  state.missiles = survivors;
}

function updateEnemyProjectiles(state: SimulationState, deltaSeconds: number): void {
  for (const projectile of state.enemyProjectiles) {
    projectile.ageSeconds += deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;
  }
}

function fireCleanupLaser(state: SimulationState): void {
  void state;
}

function forceCleanupBehindEnemies(state: SimulationState): void {
  if (!isCleanupLaserEnabled(state)) {
    return;
  }

  const removedEnemyIds = new Set<number>();

  for (const enemy of state.enemies) {
    if (enemy.scheduledCueTime !== null || !enemy.hasEnteredView) {
      continue;
    }
    if (enemy.x > FORCE_CLEANUP_OFFSCREEN_X) {
      continue;
    }

    spawnLaserBeam(state, enemy.x, enemy.y);
    spawnExplosion(state, enemy.x, enemy.y, enemy.z);
    removedEnemyIds.add(enemy.id);
  }

  if (removedEnemyIds.size === 0) {
    return;
  }

  state.enemies = state.enemies.filter((enemy) => !removedEnemyIds.has(enemy.id));
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
        if (enemy.scheduledCueTime !== null) {
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

    const cueWeapon = selectCueWeaponForAssignment(state);
    if (!cueWeapon) {
      continue;
    }

    if (leadSeconds > CUE_ASSIGN_MAX_LEAD_SECONDS) {
      if (leadSeconds <= 2.2) {
        const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
        cue.planned = true;
        cue.assignedEnemyId = reserved.id;
        cue.assignedWeapon = cueWeapon;
        if (cueWeapon === "purple") {
          queuePurpleMissileForEnemy(state, reserved, cue.timeSeconds);
        } else if (cueWeapon !== "green") {
          queueCueShotForEnemy(state, reserved, cue.timeSeconds, cueWeapon);
        }
      }
      continue;
    }

    const candidate = findCueCandidate(state, cue.timeSeconds);
    if (!candidate) {
      const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
      cue.planned = true;
      cue.assignedEnemyId = reserved.id;
      cue.assignedWeapon = cueWeapon;
      if (cueWeapon === "purple") {
        queuePurpleMissileForEnemy(state, reserved, cue.timeSeconds);
      } else if (cueWeapon !== "green") {
        queueCueShotForEnemy(state, reserved, cue.timeSeconds, cueWeapon);
      }
      continue;
    }

    candidate.enemy.scheduledCueTime = cue.timeSeconds;
    cue.planned = true;
    cue.assignedEnemyId = candidate.enemy.id;
    cue.assignedWeapon = cueWeapon;
    if (cueWeapon === "purple") {
      queuePurpleMissileForEnemy(state, candidate.enemy, cue.timeSeconds);
    } else if (cueWeapon !== "green") {
      queueCueShotForEnemy(state, candidate.enemy, cue.timeSeconds, cueWeapon);
    }
  }
}

function planCatchupCueKills(state: SimulationState): void {
  if (getEnabledCueWeapons(state).length === 0) {
    return;
  }

  let created = 0;
  for (const enemy of state.enemies) {
    if (created >= MAX_CATCHUP_CUES_PER_STEP) {
      break;
    }
    if (enemy.scheduledCueTime !== null || !enemy.hasEnteredView) {
      continue;
    }
    if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
      continue;
    }

    const aheadDistance = enemy.x - state.shipX;
    if (aheadDistance > 8.8 || aheadDistance < -2.5) {
      continue;
    }

    const weapon = selectCueWeaponForAssignment(state);
    if (!weapon) {
      break;
    }

    const shipX = state.shipX + 0.65;
    const shipY = state.shipY;
    const distance = Math.hypot(enemy.x - shipX, enemy.y - shipY);
    const baseLead = clamp(distance / PLAYER_PROJECTILE_SPEED, 0.14, 0.75);
    const cueLeadSeconds =
      weapon === "green"
        ? clamp(baseLead * 0.6, 0.14, 0.34)
        : weapon === "purple"
          ? clamp(baseLead * 2.35, 0.58, 1.76)
          : clamp(baseLead, 0.18, 0.58);
    const cueTimeSeconds = state.simTimeSeconds + cueLeadSeconds;

    enemy.scheduledCueTime = cueTimeSeconds;
    const cue: ScheduledCue = {
      timeSeconds: cueTimeSeconds,
      planned: true,
      assignedEnemyId: enemy.id,
      assignedWeapon: weapon
    };
    insertScheduledCue(state, cue);

    if (weapon === "purple") {
      queuePurpleMissileForEnemy(state, enemy, cueTimeSeconds);
    } else if (weapon !== "green") {
      queueCueShotForEnemy(state, enemy, cueTimeSeconds, weapon);
    }

    created += 1;
  }
}

function insertScheduledCue(state: SimulationState, cue: ScheduledCue): void {
  const insertAt = state.cueTimeline.findIndex((candidate) => candidate.timeSeconds > cue.timeSeconds);
  if (insertAt < 0) {
    state.cueTimeline.push(cue);
  } else {
    state.cueTimeline.splice(insertAt, 0, cue);
  }
}

function queuePurpleMissileForEnemy(
  state: SimulationState,
  enemy: Enemy,
  cueTimeSeconds: number
): void {
  if (!isPurpleMissileEnabled(state)) {
    return;
  }

  let fireTimeSeconds = solvePurpleMissileFireTime(state, enemy, cueTimeSeconds);
  if (fireTimeSeconds === null) {
    const leadSeconds = cueTimeSeconds - state.simTimeSeconds;
    fireTimeSeconds = cueTimeSeconds - clamp(leadSeconds * 0.5, 0.2, 0.85);
  }

  fireTimeSeconds = Math.max(fireTimeSeconds, state.simTimeSeconds + 0.02);
  fireTimeSeconds = Math.min(fireTimeSeconds, cueTimeSeconds - 0.04);
  if (fireTimeSeconds <= state.simTimeSeconds + 0.01) {
    fireImmediatePurpleMissile(state, enemy, cueTimeSeconds);
    return;
  }

  insertPlannedPurpleMissileShot(state, {
    cueTimeSeconds,
    enemyId: enemy.id,
    fireTimeSeconds
  });
}

function solvePurpleMissileFireTime(
  state: SimulationState,
  enemy: Enemy,
  cueTimeSeconds: number
): number | null {
  const dtCue = cueTimeSeconds - state.simTimeSeconds;
  if (dtCue <= 0.03) {
    return null;
  }

  const enemyAtCue = predictEnemyPosition(enemy, dtCue);
  const shipAtNowX = state.shipX + PURPLE_MISSILE_LAUNCH_OFFSET_X;
  const shipAtNowY = state.shipY;
  const straightDistance = Math.hypot(enemyAtCue.x - shipAtNowX, enemyAtCue.y - shipAtNowY);
  const travelSeconds = clamp(
    (straightDistance / PURPLE_MISSILE_BASE_SPEED) * PURPLE_MISSILE_LEAD_SCALE,
    PURPLE_MISSILE_MIN_LEAD_SECONDS,
    PURPLE_MISSILE_MAX_LEAD_SECONDS
  );
  const fireTimeSeconds = cueTimeSeconds - travelSeconds;

  if (fireTimeSeconds <= state.simTimeSeconds || fireTimeSeconds >= cueTimeSeconds - 0.02) {
    return null;
  }
  return fireTimeSeconds;
}

function fireImmediatePurpleMissile(
  state: SimulationState,
  enemy: Enemy,
  cueTimeSeconds: number
): void {
  if (!isPurpleMissileEnabled(state)) {
    return;
  }

  spawnPurpleMissile(state, enemy, cueTimeSeconds);
  enemy.damageFlash = Math.max(enemy.damageFlash, 0.25);
}

function fireQueuedPurpleMissiles(state: SimulationState): void {
  const plannedShots = state.plannedPurpleMissileShots;
  if (plannedShots.length === 0) {
    return;
  }

  let processedCount = 0;
  while (processedCount < plannedShots.length) {
    const shot = plannedShots[processedCount];
    if (shot.fireTimeSeconds > state.simTimeSeconds) {
      break;
    }

    if (isPurpleMissileEnabled(state)) {
      const enemy = state.enemies.find((candidate) => candidate.id === shot.enemyId);
      if (enemy) {
        spawnPurpleMissile(state, enemy, shot.cueTimeSeconds);
        enemy.damageFlash = Math.max(enemy.damageFlash, 0.25);
      }
    }
    processedCount += 1;
  }

  if (processedCount > 0) {
    plannedShots.splice(0, processedCount);
  }
}

function spawnPurpleMissile(state: SimulationState, enemy: Enemy, cueTimeSeconds: number): void {
  const shipX = state.shipX + PURPLE_MISSILE_LAUNCH_OFFSET_X;
  const shipY = state.shipY;
  const loopDirection = state.rng() < 0.5 ? -1 : 1;
  const loopTurns =
    PURPLE_MISSILE_LOOP_MIN_TURNS +
    state.rng() * (PURPLE_MISSILE_LOOP_MAX_TURNS - PURPLE_MISSILE_LOOP_MIN_TURNS);
  const cueLeadSeconds = Math.max(0.02, cueTimeSeconds - state.simTimeSeconds);
  const targetAtCue = predictEnemyPosition(enemy, cueLeadSeconds);
  const targetX = targetAtCue.x;
  const targetY = targetAtCue.y;
  const dir = normalizeDirection(targetX - shipX, targetY - shipY);
  const launchSpeed = PURPLE_MISSILE_BASE_SPEED;
  const maxLifetimeSeconds = clamp(cueLeadSeconds, 0.42, 1.35);

  state.missiles.push({
    id: state.nextMissileId++,
    x: shipX,
    y: shipY,
    z: 0,
    vx: dir.x * launchSpeed,
    vy: dir.y * launchSpeed,
    ageSeconds: 0,
    maxLifetimeSeconds,
    launchX: shipX,
    launchY: shipY,
    targetEnemyId: enemy.id,
    targetX,
    targetY,
    loopTurns,
    loopDirection,
    pathVariant: state.rng()
  });
}

function queueCueShotForEnemy(
  state: SimulationState,
  enemy: Enemy,
  cueTimeSeconds: number,
  weapon: "blue" | "yellow"
): void {
  if (!isCueWeaponStillEnabled(state, weapon)) {
    return;
  }

  let fireTimeSeconds = solveCueFireTime(state, enemy, cueTimeSeconds);
  if (fireTimeSeconds === null) {
    const leadSeconds = cueTimeSeconds - state.simTimeSeconds;
    fireTimeSeconds = cueTimeSeconds - clamp(leadSeconds * 0.35, 0.16, 0.46);
  }

  fireTimeSeconds = Math.max(fireTimeSeconds, state.simTimeSeconds + 0.015);
  fireTimeSeconds = Math.min(fireTimeSeconds, cueTimeSeconds - 0.02);
  if (fireTimeSeconds <= state.simTimeSeconds + 0.01 || fireTimeSeconds >= cueTimeSeconds - 0.01) {
    fireImmediateCueProjectile(state, enemy, weapon);
    return;
  }

  insertPlannedCueShot(state, {
    cueTimeSeconds,
    enemyId: enemy.id,
    fireTimeSeconds,
    weapon
  });
}

function fireImmediateCueProjectile(
  state: SimulationState,
  enemy: Enemy,
  weapon: "blue" | "yellow"
): void {
  if (!isCueWeaponStillEnabled(state, weapon)) {
    return;
  }

  const shipX = state.shipX + 0.65;
  const shipY = state.shipY;
  const future = predictEnemyPosition(enemy, 0.12);
  const dir = normalizeDirection(future.x - shipX, future.y - shipY);

  state.projectiles.push({
    id: state.nextProjectileId++,
    x: shipX,
    y: shipY,
    z: 0,
    vx: dir.x * PLAYER_PROJECTILE_SPEED,
    vy: dir.y * PLAYER_PROJECTILE_SPEED,
    ageSeconds: 0,
    maxLifetimeSeconds: 0.34,
    radius: 0.16,
    isCueShot: weapon === "yellow"
  });
  enemy.cuePrimed = true;
  enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
}

function spawnReservedCueEnemy(state: SimulationState, cueTimeSeconds: number): Enemy {
  const intensity = getIntensityAtTime(state, state.simTimeSeconds);
  const mood = moodParameters(state.moodProfile);
  const combatTuning = getCombatPressureTuning(state);
  const archetype = pickEnemyArchetype(state);
  const archetypeDef = getEnemyArchetypeDefinition(archetype);
  const leadSeconds = Math.max(0.2, cueTimeSeconds - state.simTimeSeconds);
  const shipAtCue = predictShipPosition(state, leadSeconds);
  const spawnX = 21.5 + state.rng() * 3.5;
  const targetX = shipAtCue.x + 6.8 + (state.rng() - 0.5) * 2.2;
  const requiredVx = (targetX - spawnX) / leadSeconds;
  const vx =
    clamp(requiredVx, -6.2, -1.9) * mood.enemySpeedScale * archetypeDef.speedScale;
  const lane = ((state.spawnIndex + 2) % 5) - 2;
  const laneOffset = lane * 0.82;
  const baseY = clamp(shipAtCue.baseY + laneOffset + (state.rng() - 0.5) * 0.45, -4.2, 4.2);
  const enemy: Enemy = {
    id: state.nextEnemyId++,
    archetype,
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
    radius: 0.44 * archetypeDef.radiusScale,
    fireCooldownSeconds:
      (0.9 + state.rng() * 0.9) *
      mood.enemyFireIntervalScale *
      ENEMY_FIRE_COOLDOWN_MULTIPLIER *
      enemyFireIntensityMultiplier(intensity) *
      archetypeDef.fireCooldownScale /
      combatTuning.enemyFireScale,
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
  const combatTuning = getCombatPressureTuning(state);
  const archetype = pickEnemyArchetype(state);
  const archetypeDef = getEnemyArchetypeDefinition(archetype);
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
    archetype,
    x: 22.2 + state.rng() * 3.1,
    y: lane * 1.6,
    z: 0,
    vx:
      (-2.5 - intensity * 1.8 - state.rng() * 0.95) *
      mood.enemySpeedScale *
      archetypeDef.speedScale,
    ageSeconds: 0,
    pattern,
    baseY: lane * 1.6,
    phase: state.rng() * Math.PI * 2,
    amplitude: 0.35 + state.rng() * 1.25,
    frequency: 1 + state.rng() * 1.4,
    radius: 0.44 * archetypeDef.radiusScale,
    fireCooldownSeconds:
      (0.5 + (1 - intensity) * 0.8 + state.rng() * 0.5) *
      mood.enemyFireIntervalScale *
      ENEMY_FIRE_COOLDOWN_MULTIPLIER *
      enemyFireIntensityMultiplier(intensity) *
      archetypeDef.fireCooldownScale /
      combatTuning.enemyFireScale,
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
  const combatTuning = getCombatPressureTuning(state);
  const archetype = pickEnemyArchetype(state);
  const archetypeDef = getEnemyArchetypeDefinition(archetype);
  const lane = ((state.spawnIndex + 1) % 5) - 2;
  const baseY = lane * 1.6 + (state.rng() - 0.5) * 0.35;

  state.enemies.push({
    id: state.nextEnemyId++,
    archetype,
    x: 22 + state.rng() * 2.9,
    y: baseY,
    z: 0,
    vx:
      (-2.15 - intensity * 1.2 - state.rng() * 0.6) *
      mood.enemySpeedScale *
      archetypeDef.speedScale,
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
    radius: 0.44 * archetypeDef.radiusScale,
    fireCooldownSeconds:
      (0.9 + state.rng() * 0.7) *
      mood.enemyFireIntervalScale *
      ENEMY_FIRE_COOLDOWN_MULTIPLIER *
      enemyFireIntensityMultiplier(intensity) *
      archetypeDef.fireCooldownScale /
      combatTuning.enemyFireScale,
    scheduledCueTime: null,
    cuePrimed: false,
    damageFlash: 0,
    hasEnteredView: false
  });

  state.spawnIndex += 1;
}

function fireQueuedCueShots(state: SimulationState): void {
  const plannedShots = state.plannedCueShots;
  if (plannedShots.length === 0) {
    return;
  }

  let processedCount = 0;
  while (processedCount < plannedShots.length) {
    const shot = plannedShots[processedCount];
    if (shot.fireTimeSeconds > state.simTimeSeconds) {
      break;
    }

    const enemy = state.enemies.find((candidate) => candidate.id === shot.enemyId);
    if (!enemy) {
      processedCount += 1;
      continue;
    }

    if (!isCueWeaponStillEnabled(state, shot.weapon)) {
      processedCount += 1;
      continue;
    }

    const leadSeconds = shot.cueTimeSeconds - state.simTimeSeconds;
    if (leadSeconds <= 0.02) {
      enemy.cuePrimed = true;
      enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
      processedCount += 1;
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
      radius: 0.16,
      isCueShot: shot.weapon === "yellow"
    });

    enemy.cuePrimed = true;
    enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
    processedCount += 1;
  }

  if (processedCount > 0) {
    plannedShots.splice(0, processedCount);
  }
}

function insertPlannedCueShot(state: SimulationState, shot: PlannedCueShot): void {
  const planned = state.plannedCueShots;
  if (
    planned.length === 0 ||
    planned[planned.length - 1].fireTimeSeconds <= shot.fireTimeSeconds
  ) {
    planned.push(shot);
    return;
  }

  const insertAt = planned.findIndex((candidate) => candidate.fireTimeSeconds > shot.fireTimeSeconds);
  if (insertAt < 0) {
    planned.push(shot);
  } else {
    planned.splice(insertAt, 0, shot);
  }
}

function insertPlannedPurpleMissileShot(
  state: SimulationState,
  shot: PlannedPurpleMissileShot
): void {
  const planned = state.plannedPurpleMissileShots;
  if (
    planned.length === 0 ||
    planned[planned.length - 1].fireTimeSeconds <= shot.fireTimeSeconds
  ) {
    planned.push(shot);
    return;
  }

  const insertAt = planned.findIndex((candidate) => candidate.fireTimeSeconds > shot.fireTimeSeconds);
  if (insertAt < 0) {
    planned.push(shot);
  } else {
    planned.splice(insertAt, 0, shot);
  }
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

    const assignedWeapon = cue.assignedWeapon;
    if (!assignedWeapon || !isCueWeaponStillEnabled(state, assignedWeapon)) {
      state.cueMissedCount += 1;
      state.combo = 0;
      continue;
    }

    const targetIndex =
      cue.assignedEnemyId === null
        ? -1
        : state.enemies.findIndex((enemy) => enemy.id === cue.assignedEnemyId);

    if (targetIndex < 0) {
      if (assignedWeapon === "purple") {
        state.cueResolvedCount += 1;
        state.cumulativeCueErrorMs += cueErrorMs;
        state.combo += 1;
        state.score += 100 + Math.min(900, state.combo * 10);
        continue;
      }
      state.cueMissedCount += 1;
      state.combo = 0;
      continue;
    }

    const enemy = state.enemies[targetIndex];

    if (assignedWeapon === "green") {
      if (!isCleanupLaserEnabled(state)) {
        state.cueMissedCount += 1;
        state.combo = 0;
      } else {
        spawnLaserBeam(state, enemy.x, enemy.y);
        spawnExplosion(state, enemy.x, enemy.y, enemy.z);
        state.enemies.splice(targetIndex, 1);
        state.cueResolvedCount += 1;
        state.cumulativeCueErrorMs += cueErrorMs;
        state.combo += 1;
        state.score += 100 + Math.min(900, state.combo * 10);
      }
      continue;
    }

    if (assignedWeapon === "purple") {
      enemy.cuePrimed = true;
    }

    const didCueHit = scheduledEnemyHasCueHit(state, enemy);
    if (didCueHit) {
      spawnExplosion(state, enemy.x, enemy.y, enemy.z);
      state.enemies.splice(targetIndex, 1);
      state.cueResolvedCount += 1;
      state.cumulativeCueErrorMs += cueErrorMs;
      state.combo += 1;
      state.score += 100 + Math.min(900, state.combo * 10);
    } else {
      enemy.scheduledCueTime = null;
      enemy.cuePrimed = false;
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
  const preBreakoutActive =
    !breakoutActive &&
    state.edgeDwellSeconds >= SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS * SHIP_PRE_BREAKOUT_TRIGGER_FRACTION &&
    threat.score >= SHIP_EDGE_BREAKOUT_THREAT_MIN * 0.72;
  const centerBiasStrength =
    1 -
    clamp(
      (threat.score - SHIP_CENTER_BIAS_THREAT_LOW) /
        Math.max(1e-4, SHIP_CENTER_BIAS_THREAT_HIGH - SHIP_CENTER_BIAS_THREAT_LOW),
      0,
      1
    );

  let baseDesiredX = clamp(
    state.shipTargetX +
      threat.dodgeX * (0.8 + panicFactor * 2.2) -
      panicFactor * (breakoutActive ? 0.45 : preBreakoutActive ? 0.92 : 1.6),
    SHIP_MIN_X,
    SHIP_MAX_X
  );
  let baseDesiredY = clamp(
    state.shipTargetY + threat.dodgeY * (0.95 + panicFactor * 2.4),
    SHIP_MIN_Y,
    SHIP_MAX_Y
  );

  baseDesiredX = clamp(
    baseDesiredX + (0 - baseDesiredX) * centerBiasStrength * SHIP_CENTER_BIAS_X_STRENGTH,
    SHIP_MIN_X,
    SHIP_MAX_X
  );
  baseDesiredY = clamp(
    baseDesiredY + (0 - baseDesiredY) * centerBiasStrength * SHIP_CENTER_BIAS_Y_STRENGTH,
    SHIP_MIN_Y,
    SHIP_MAX_Y
  );

  if (preBreakoutActive || breakoutActive) {
    const inwardYDirection = state.shipY >= 0 ? -1 : 1;
    const inwardYStrength = breakoutActive
      ? 1.4 + panicFactor * 1.8
      : 0.78 + panicFactor * 1.25;
    baseDesiredY = clamp(
      baseDesiredY + inwardYDirection * inwardYStrength,
      SHIP_MIN_Y,
      SHIP_MAX_Y
    );

    const centerX = 0;
    const spreadDirection = state.shipX < centerX ? 1 : -1;
    const spreadStrength = breakoutActive
      ? 1.2 + panicFactor * 1.1
      : 0.72 + panicFactor * 0.85;
    baseDesiredX = clamp(
      baseDesiredX + spreadDirection * spreadStrength,
      SHIP_MIN_X,
      SHIP_MAX_X
    );
  }

  const escapeTarget = selectEscapeTarget(
    state,
    baseDesiredX,
    baseDesiredY,
    panicFactor,
    breakoutActive,
    preBreakoutActive,
    centerBiasStrength
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

  for (const enemy of state.enemies) {
    if (enemy.x < state.shipX - 2.2 || enemy.x > state.shipX + 11.6) {
      continue;
    }

    let closestDist = Number.POSITIVE_INFINITY;
    let closestDx = 0;
    let closestDy = 0;
    let tClosest = 0;
    const steps = 6;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * SHIP_ENEMY_THREAT_HORIZON_SECONDS;
      const enemyFuture = predictEnemyPosition(enemy, t);
      const shipFutureX = state.shipX + state.shipVx * t;
      const shipFutureY = state.shipY + state.shipVy * t;
      const dx = enemyFuture.x - shipFutureX;
      const dy = enemyFuture.y - shipFutureY;
      const dist = Math.hypot(dx, dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestDx = dx;
        closestDy = dy;
        tClosest = t;
      }
    }

    const safeRadius = SHIP_ENEMY_SAFE_RADIUS + enemy.radius;
    if (closestDist > safeRadius * 2.1) {
      continue;
    }

    const closeness = clamp(1 - closestDist / (safeRadius * 2.1), 0, 1);
    const imminence = clamp(1 - tClosest / SHIP_ENEMY_THREAT_HORIZON_SECONDS, 0, 1);
    const weight = closeness * (1.1 + imminence * 1.8);
    const awayX =
      closestDist > 1e-4 ? -closestDx / closestDist : state.rng() < 0.5 ? -1 : 1;
    const awayY =
      closestDist > 1e-4 ? -closestDy / closestDist : state.rng() < 0.5 ? -1 : 1;
    dodgeX += awayX * weight * 2.6;
    dodgeY += awayY * weight * 3.2;
    score += weight * 1.15;
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
  if (state.recentEdgeCooldownSeconds > 0) {
    state.recentEdgeCooldownSeconds = Math.max(0, state.recentEdgeCooldownSeconds - deltaSeconds);
    if (state.recentEdgeCooldownSeconds <= 0) {
      state.recentEdgeSideY = 0;
    }
  }

  const verticalEdgeDistance = Math.min(state.shipY - SHIP_MIN_Y, SHIP_MAX_Y - state.shipY);
  const isEdgePinned = verticalEdgeDistance < SHIP_EDGE_BREAKOUT_BAND;
  const edgeSideY = isEdgePinned ? (state.shipY >= 0 ? 1 : -1) : 0;
  if (isEdgePinned && threatScore >= SHIP_EDGE_BREAKOUT_THREAT_MIN) {
    state.edgeDwellSeconds += deltaSeconds;
  } else {
    state.edgeDwellSeconds = Math.max(0, state.edgeDwellSeconds - deltaSeconds * 1.8);
  }

  if (state.edgeDwellSeconds >= SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS) {
    state.edgeBreakoutSeconds = Math.max(state.edgeBreakoutSeconds, SHIP_EDGE_BREAKOUT_HOLD_SECONDS);
    if (edgeSideY !== 0) {
      state.recentEdgeSideY = edgeSideY;
      state.recentEdgeCooldownSeconds = SHIP_EDGE_RETURN_COOLDOWN_SECONDS;
    }
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
  breakoutActive: boolean,
  preBreakoutActive: boolean,
  centerBiasStrength: number
): { x: number; y: number } {
  const hasNearbyEnemyThreat = state.enemies.some(
    (enemy) => enemy.x > state.shipX - 1.4 && enemy.x < state.shipX + 10.8
  );
  if (state.enemyProjectiles.length === 0 && !hasNearbyEnemyThreat) {
    return {
      x: baseDesiredX,
      y: baseDesiredY
    };
  }

  const xOffsets = breakoutActive
    ? [-3.6, -2.2, -1.1, 0, 1.1, 2.2, 3.6]
    : preBreakoutActive
      ? [-2.8, -1.8, -1, 0, 1, 1.8, 2.8]
    : [-2.2, -1.3, -0.6, 0, 0.6, 1.3, 2.2];
  const yOffsets = breakoutActive
    ? [-4.2, -2.8, -1.5, 0, 1.5, 2.8, 4.2]
    : preBreakoutActive
      ? [-3.7, -2.5, -1.35, 0, 1.35, 2.5, 3.7]
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
        breakoutActive,
        preBreakoutActive,
        centerBiasStrength
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
  breakoutActive: boolean,
  preBreakoutActive: boolean,
  centerBiasStrength: number
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

    for (const enemy of state.enemies) {
      if (enemy.x < simX - 3.2 || enemy.x > simX + 12.4) {
        continue;
      }

      const enemyFuture = predictEnemyPosition(enemy, t);
      const dx = enemyFuture.x - simX;
      const dy = enemyFuture.y - simY;
      const dist = Math.hypot(dx, dy);
      const imminence = 1 - t / horizon;
      const collisionRadius = SHIP_COLLISION_RADIUS + enemy.radius;

      if (dist <= collisionRadius) {
        totalCost += SHIP_ENEMY_COLLISION_COST * (1 + imminence * 2.1);
        continue;
      }

      const nearMissRadius = SHIP_ENEMY_ESCAPE_NEAR_MISS_RADIUS + enemy.radius;
      if (dist <= nearMissRadius) {
        const nearMiss = nearMissRadius - dist;
        totalCost +=
          nearMiss * nearMiss * SHIP_ENEMY_NEAR_MISS_COST * (1.05 + imminence * 1.55);
      }
    }

    const edgeDistanceY = Math.min(simY - SHIP_MIN_Y, SHIP_MAX_Y - simY);
    if (edgeDistanceY < SHIP_EDGE_AVOIDANCE_BUFFER) {
      totalCost +=
        (SHIP_EDGE_AVOIDANCE_BUFFER - edgeDistanceY) *
        (SHIP_EDGE_AVOIDANCE_PENALTY + panicFactor * 0.8);
    }
    if (edgeDistanceY < SHIP_EDGE_APPROACH_BUFFER_Y) {
      const approach =
        (SHIP_EDGE_APPROACH_BUFFER_Y - edgeDistanceY) / Math.max(1e-4, SHIP_EDGE_APPROACH_BUFFER_Y);
      totalCost +=
        approach *
        approach *
        (SHIP_EDGE_APPROACH_PENALTY_Y + centerBiasStrength * 1.15) *
        (0.75 + panicFactor * 0.65);
    }

    const edgeDistanceX = Math.min(simX - SHIP_MIN_X, SHIP_MAX_X - simX);
    if (edgeDistanceX < SHIP_EDGE_AVOIDANCE_BUFFER_X) {
      totalCost +=
        (SHIP_EDGE_AVOIDANCE_BUFFER_X - edgeDistanceX) *
        (SHIP_EDGE_AVOIDANCE_PENALTY_X + panicFactor * 0.6);
    }
    if (edgeDistanceX < SHIP_EDGE_APPROACH_BUFFER_X) {
      const approach =
        (SHIP_EDGE_APPROACH_BUFFER_X - edgeDistanceX) / Math.max(1e-4, SHIP_EDGE_APPROACH_BUFFER_X);
      totalCost +=
        approach *
        approach *
        (SHIP_EDGE_APPROACH_PENALTY_X + centerBiasStrength * 0.75) *
        (0.72 + panicFactor * 0.55);
    }

    if (breakoutActive) {
      const trappedEdgeDistance = state.shipY >= 0 ? SHIP_MAX_Y - simY : simY - SHIP_MIN_Y;
      if (trappedEdgeDistance < SHIP_EDGE_BREAKOUT_BAND) {
        totalCost +=
          (SHIP_EDGE_BREAKOUT_BAND - trappedEdgeDistance) *
          (4.4 + panicFactor * 2.8);
      }
    } else if (preBreakoutActive) {
      const trappedEdgeDistance = state.shipY >= 0 ? SHIP_MAX_Y - simY : simY - SHIP_MIN_Y;
      if (trappedEdgeDistance < SHIP_EDGE_BREAKOUT_BAND) {
        totalCost +=
          (SHIP_EDGE_BREAKOUT_BAND - trappedEdgeDistance) *
          (2.1 + panicFactor * 1.3 + centerBiasStrength * 1.5);
      }
    }
  }

  totalCost += Math.abs(targetY - state.shipY) * 0.12;
  totalCost += Math.abs(targetX - state.shipX) * (breakoutActive ? 0.03 : 0.09);
  totalCost += Math.abs(targetY) * (0.08 + centerBiasStrength * 0.54);
  totalCost += Math.abs(targetX) * (0.04 + centerBiasStrength * 0.24);

  if (state.recentEdgeCooldownSeconds > 0 && state.recentEdgeSideY !== 0) {
    const targetSideY = targetY > 0 ? 1 : targetY < 0 ? -1 : 0;
    if (targetSideY === state.recentEdgeSideY && Math.abs(targetY) > SHIP_EDGE_RETURN_BAND_Y) {
      const cooldownT =
        state.recentEdgeCooldownSeconds / Math.max(1e-4, SHIP_EDGE_RETURN_COOLDOWN_SECONDS);
      const overshoot =
        (Math.abs(targetY) - SHIP_EDGE_RETURN_BAND_Y) /
        Math.max(0.2, SHIP_MAX_Y - SHIP_EDGE_RETURN_BAND_Y);
      totalCost +=
        (1 + overshoot * 1.8) *
        SHIP_EDGE_RETURN_PENALTY *
        cooldownT *
        (0.7 + centerBiasStrength * 1.1);
    }
  }

  if (breakoutActive) {
    const xShift = Math.abs(targetX - state.shipX);
    if (xShift < 1.2) {
      totalCost += (1.2 - xShift) * 0.9;
    }
  }

  return totalCost;
}

function chooseShipTarget(state: SimulationState): { x: number; y: number } {
  const lockedTarget =
    state.lockedTargetEnemyId === null
      ? null
      : getEnemyById(state.enemies, state.lockedTargetEnemyId);
  const focus =
    lockedTarget && isPlayerTargetViable(lockedTarget, state.shipX, state.shipY)
      ? lockedTarget
      : findBestTarget(state.enemies, state.shipX, state.shipY, PLAYER_TARGET_HARD_DISTANCE_X);
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

function getEnemyById(enemies: Enemy[], enemyId: number): Enemy | null {
  for (const enemy of enemies) {
    if (enemy.id === enemyId) {
      return enemy;
    }
  }
  return null;
}

function normalizeDirection(x: number, y: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y) || 1;
  return {
    x: x / magnitude,
    y: y / magnitude
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
  const edgeDistanceY = Math.min(state.shipY - SHIP_MIN_Y, SHIP_MAX_Y - state.shipY);
  const edgeProximity = clamp(
    (ENEMY_EDGE_AIM_RELAX_DISTANCE_Y - edgeDistanceY) / ENEMY_EDGE_AIM_RELAX_DISTANCE_Y,
    0,
    1
  );
  let localProjectilePressure = 0;
  for (const projectile of state.enemyProjectiles) {
    if (projectile.x < state.shipX - 1 || projectile.x > state.shipX + ENEMY_EDGE_PRESSURE_WINDOW_X) {
      continue;
    }
    if (Math.abs(projectile.y - state.shipY) > ENEMY_EDGE_PRESSURE_WINDOW_Y) {
      continue;
    }
    localProjectilePressure += 1;
    if (localProjectilePressure >= ENEMY_EDGE_PRESSURE_PROJECTILE_CAP) {
      break;
    }
  }
  const pressure = clamp(localProjectilePressure / ENEMY_EDGE_PRESSURE_PROJECTILE_CAP, 0, 1);
  const edgePressure = edgeProximity * pressure;
  const aimLagSeconds = edgePressure * ENEMY_EDGE_AIM_RELAX_MAX_LAG_SECONDS;
  const relaxedShipX = state.shipX - state.shipVx * aimLagSeconds;
  const relaxedShipY = state.shipY - state.shipVy * aimLagSeconds;
  const jitter = (state.rng() - 0.5) * (0.55 + edgePressure * ENEMY_EDGE_AIM_RELAX_MAX_JITTER);
  const targetX = relaxedShipX - 0.2;
  const targetY = relaxedShipY + jitter;
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const magnitude = Math.hypot(dx, dy) || 1;

  const baseX = dx / magnitude;
  const baseY = dy / magnitude;
  const spreadWithPressure =
    spreadRadians + (state.rng() - 0.5) * edgePressure * ENEMY_EDGE_PRESSURE_EXTRA_SPREAD;
  const cos = Math.cos(spreadWithPressure);
  const sin = Math.sin(spreadWithPressure);
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
  enemyBulletRateScale: number;
  playerFireIntervalScale: number;
} {
  if (mood === "calm") {
    return {
      enemySpeedScale: 0.88,
      spawnIntervalScale: 1.12,
      enemyFireIntervalScale: 1.15,
      enemyBulletRateScale: 0.84,
      playerFireIntervalScale: 1.04
    };
  }
  if (mood === "aggressive") {
    return {
      enemySpeedScale: 1.04,
      spawnIntervalScale: 0.8,
      enemyFireIntervalScale: 0.82,
      enemyBulletRateScale: 1.22,
      playerFireIntervalScale: 0.92
    };
  }
  return {
    enemySpeedScale: 1,
    spawnIntervalScale: ENEMY_SPAWN_INTERVAL_MULTIPLIER,
    enemyFireIntervalScale: ENEMY_FIRE_INTERVAL_MULTIPLIER,
    enemyBulletRateScale: 1,
    playerFireIntervalScale: 1
  };
}
