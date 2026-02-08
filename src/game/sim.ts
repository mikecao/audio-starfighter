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
  explosions: Array<{
    x: number;
    y: number;
    z: number;
    scale: number;
    alpha: number;
  }>;
};

type EnemyPattern = "straight" | "sine" | "arc";

type Enemy = {
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

type Explosion = {
  x: number;
  y: number;
  z: number;
  ageSeconds: number;
  lifetimeSeconds: number;
};

type SimulationState = {
  simTimeSeconds: number;
  simTick: number;
  shipX: number;
  shipY: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  explosions: Explosion[];
  nextEnemySpawnTime: number;
  nextPlayerFireTime: number;
  spawnIndex: number;
  rng: () => number;
};

export type Simulation = {
  step: (deltaSeconds: number) => void;
  getSnapshot: () => SimulationSnapshot;
};

export function createSimulation(): Simulation {
  const state: SimulationState = {
    simTimeSeconds: 0,
    simTick: 0,
    shipX: -6,
    shipY: 0,
    enemies: [],
    projectiles: [],
    explosions: [],
    nextEnemySpawnTime: 0.4,
    nextPlayerFireTime: 0.2,
    spawnIndex: 0,
    rng: createMulberry32(7)
  };

  return {
    step(deltaSeconds: number) {
      state.simTimeSeconds += deltaSeconds;
      state.simTick += 1;

      state.shipY = Math.sin(state.simTimeSeconds * 1.4) * 1.8;
      state.shipX = -6 + Math.sin(state.simTimeSeconds * 0.35) * 0.75;

      spawnEnemies(state);
      fireProjectiles(state);
      updateEnemies(state, deltaSeconds);
      updateProjectiles(state, deltaSeconds);
      updateExplosions(state, deltaSeconds);
      resolvePlayerProjectileCollisions(state);

      state.enemies = state.enemies.filter((enemy) => enemy.x > -16);
      state.projectiles = state.projectiles.filter(
        (projectile) =>
          projectile.ageSeconds < projectile.maxLifetimeSeconds &&
          projectile.x > -15 &&
          projectile.x < 20 &&
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
        projectileCount: state.projectiles.length,
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
        })
      };
    }
  };
}

function spawnEnemies(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextEnemySpawnTime) {
    const lane = (state.spawnIndex % 5) - 2;
    const patternSelector = state.spawnIndex % 3;
    const pattern: EnemyPattern =
      patternSelector === 0 ? "straight" : patternSelector === 1 ? "sine" : "arc";

    state.enemies.push({
      x: 13 + state.rng() * 2.5,
      y: lane * 1.6,
      z: 0,
      vx: -2.7 - state.rng() * 1.1,
      ageSeconds: 0,
      pattern,
      baseY: lane * 1.6,
      phase: state.rng() * Math.PI * 2,
      amplitude: 0.35 + state.rng() * 1.25,
      frequency: 1 + state.rng() * 1.4,
      radius: 0.44
    });

    state.spawnIndex += 1;
    state.nextEnemySpawnTime += 0.62 + state.rng() * 0.32;
  }
}

function fireProjectiles(state: SimulationState): void {
  while (state.simTimeSeconds >= state.nextPlayerFireTime) {
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

    state.nextPlayerFireTime += 0.17;
  }
}

function updateEnemies(state: SimulationState, deltaSeconds: number): void {
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
  }
}

function updateProjectiles(state: SimulationState, deltaSeconds: number): void {
  for (const projectile of state.projectiles) {
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
        state.explosions.push({
          x: enemy.x,
          y: enemy.y,
          z: enemy.z,
          ageSeconds: 0,
          lifetimeSeconds: 0.33
        });
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

function createMulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
